import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  commitTransaction,
  createLocalReq,
  getPayload,
  initTransaction,
  killTransaction,
} from 'payload';
import { catalogSchema, questContentSchema, questSnapshotSchema } from '@sidequest/contracts';
import { publicEndpoints } from '../src/endpoints/public';
import config from '../src/payload.config';
import { EXPANSION_BATCH_KEY, EXPANSION_QUESTS } from './data/expansion-quests';

// Explicit modes: default is read-only; verify exercises all hooks then rolls back.
// apply is authorized for this exact batch by the user; never called during application startup.
const mode = process.env.SIDEQUEST_SEED_MODE ?? 'check';
assert.ok(['check', 'verify', 'apply'].includes(mode), 'Unknown seed mode');
assert.equal(EXPANSION_QUESTS.length, 100);
assert.equal(new Set(EXPANSION_QUESTS.map((item) => item.key)).size, 100);
const contents = EXPANSION_QUESTS.map((item) => questContentSchema.parse(item.content));
const titles = contents.map((item) => item.title);
assert.equal(new Set(titles).size, 100, 'Duplicate batch titles');
const digest = createHash('sha256').update(JSON.stringify(contents)).digest('hex');
const payload = await getPayload({ config });

try {
  const admins = await payload.find({
    collection: 'admins',
    where: { role: { equals: 'admin' } },
    limit: 2,
    overrideAccess: true,
  });
  assert.equal(
    admins.totalDocs,
    1,
    'Expected one administrator; choose an actor explicitly otherwise',
  );
  const admin = admins.docs[0]!;
  const req = await createLocalReq({ user: { ...admin, collection: 'admins' } }, payload);
  const marker = (
    await payload.find({
      collection: 'audit-log',
      req,
      overrideAccess: false,
      where: { key: { equals: EXPANSION_BATCH_KEY } },
      limit: 1,
    })
  ).docs[0];
  const dbTarget = new URL(process.env.DATABASE_URL!);
  const before = await payload.count({ collection: 'quests', req, overrideAccess: false });
  console.log(
    JSON.stringify({
      mode,
      database: {
        host: dbTarget.hostname,
        port: dbTarget.port || '5432',
        name: dbTarget.pathname.slice(1),
      },
      existingQuests: before.totalDocs,
      batchKey: EXPANSION_BATCH_KEY,
      digest,
      categories: Object.fromEntries(
        [...new Set(contents.map((item) => item.category))].map((category) => [
          category,
          contents.filter((item) => item.category === category).length,
        ]),
      ),
    }),
  );

  if (marker) {
    // Never overwrite later edits or republish withdrawals on a repeated seed command.
    const receipt: { digest: string; ids: number[] } = JSON.parse(marker.entityId);
    assert.equal(
      receipt.digest,
      digest,
      'Batch changed after publication; stop for editorial review',
    );
    assert.equal(receipt.ids.length, 100);
    const current = await payload.find({
      collection: 'quests',
      req,
      overrideAccess: false,
      pagination: false,
      where: { id: { in: receipt.ids } },
    });
    assert.equal(current.totalDocs, 100, 'Previously seeded records are missing');
    console.log(
      JSON.stringify({
        status: 'already-imported',
        ids: receipt.ids,
        writes: 0,
        publishedNow: current.docs.filter((doc) => doc.status === 'published').length,
      }),
    );
  } else {
    const duplicates = await payload.find({
      collection: 'quests',
      req,
      overrideAccess: false,
      where: { title: { in: titles } },
      limit: 100,
    });
    assert.equal(
      duplicates.totalDocs,
      0,
      `Existing titles conflict: ${duplicates.docs.map((doc) => doc.title).join(', ')}`,
    );
    if (mode === 'check') {
      console.log(
        'PASS: 100 valid unique tasks; no existing title conflicts. Read-only, no writes.',
      );
    } else {
      assert.equal(await initTransaction(req), true, 'A real database transaction is required');
      const ids: number[] = [];
      try {
        // The unique marker serializes concurrent attempts; all rows share this transaction.
        const batchAudit = await payload.create({
          collection: 'audit-log',
          req,
          overrideAccess: true,
          data: {
            key: EXPANSION_BATCH_KEY,
            actorId: String(admin.id),
            action: 'authorized-batch-publish',
            entityId: JSON.stringify({ digest, ids }),
            revision: 1,
          },
        });
        for (const content of contents) {
          const draft = await payload.create({
            collection: 'quests',
            req,
            overrideAccess: false,
            data: {
              content,
              status: 'draft',
              reason: `用户明确授权直接发布；批次 ${EXPANSION_BATCH_KEY}。已做文案与结构检查，未声称实地试玩；素材出处见仓库内容说明。`,
            },
          });
          assert.ok(draft.revision != null);
          const reviewed = await payload.update({
            collection: 'quests',
            id: draft.id,
            req,
            overrideAccess: false,
            data: {
              status: 'review',
              revision: draft.revision,
              safetyReviewed: true,
              experienceReviewed: true,
            },
          });
          assert.ok(reviewed.revision != null);
          const published = await payload.update({
            collection: 'quests',
            id: draft.id,
            req,
            overrideAccess: false,
            data: { status: 'published', revision: reviewed.revision },
          });
          const snapshot = questSnapshotSchema.parse(published.publishedSnapshot);
          assert.equal(snapshot.questId, String(draft.id));
          assert.equal(snapshot.title, content.title);
          assert.equal(published.status, 'published');
          ids.push(draft.id);
        }
        await payload.update({
          collection: 'audit-log',
          id: batchAudit.id,
          req,
          overrideAccess: true,
          data: { entityId: JSON.stringify({ digest, ids }) },
        });
        const versions = await payload.count({
          collection: 'quest-versions',
          req,
          overrideAccess: false,
          where: { questId: { in: ids.map(String) } },
        });
        assert.equal(versions.totalDocs, 100);
        const audit = await payload.count({
          collection: 'audit-log',
          req,
          overrideAccess: false,
          where: { entityId: { in: ids.map(String) } },
        });
        assert.equal(audit.totalDocs, 300);
        if (mode === 'apply') await commitTransaction(req);
        else await killTransaction(req);
        // A separate request confirms committed visibility (or rollback) outside the transaction.
        const persisted = await payload.find({
          collection: 'quests',
          overrideAccess: true,
          pagination: false,
          where: { id: { in: ids } },
        });
        assert.equal(persisted.totalDocs, mode === 'apply' ? 100 : 0);
        for (const doc of persisted.docs) {
          assert.equal(doc.status, 'published');
          questSnapshotSchema.parse(doc.publishedSnapshot);
        }
        console.log(
          JSON.stringify({
            status: mode === 'apply' ? 'published' : 'verified-and-rolled-back',
            count: 100,
            versions: versions.totalDocs,
            questAuditEntries: audit.totalDocs,
            ids,
          }),
        );
      } catch (error) {
        await killTransaction(req);
        throw error;
      }
    }
  }
  const catalogEndpoint = publicEndpoints.find((endpoint) => endpoint.path === '/public/catalog')!;
  const publicReq = await createLocalReq({}, payload);
  const response = await catalogEndpoint.handler(publicReq);
  assert.ok(response instanceof Response);
  assert.equal(response.status, 200);
  const catalog = catalogSchema.parse(await response.json());
  if (mode === 'apply' && !marker) {
    for (const content of contents) {
      const published = catalog.tasks.find((task) => task.title === content.title);
      assert.ok(published, `Missing public task: ${content.title}`);
      assert.deepEqual(
        questContentSchema.parse(
          Object.fromEntries(
            Object.entries(published).filter(
              ([key]) => !['questId', 'versionId', 'publishedAt'].includes(key),
            ),
          ),
        ),
        content,
      );
    }
  }
  console.log(
    JSON.stringify({
      publicCatalogCount: catalog.tasks.length,
      publicCatalogRevision: catalog.revision,
    }),
  );
} finally {
  await payload.destroy();
}
