import assert from 'node:assert/strict';
import { createLocalReq, getPayload, initTransaction, killTransaction } from 'payload';
import config from '../src/payload.config';
import { EXAMPLE_QUEST, questSnapshotSchema } from '@sidequest/contracts';

const payload = await getPayload({ config });
try {
  const admin = (
    await payload.find({
      collection: 'admins',
      where: { role: { equals: 'admin' } },
      limit: 1,
      overrideAccess: true,
    })
  ).docs[0];
  assert.ok(admin, 'An existing administrator is required');
  const req = await createLocalReq({ user: { ...admin, collection: 'admins' } }, payload);
  await initTransaction(req);
  try {
    const draft = await payload.create({
      collection: 'quests',
      req,
      overrideAccess: false,
      data: { content: EXAMPLE_QUEST, status: 'draft' },
    });
    assert.equal(draft.publishedSnapshot, null);
    const reviewed = await payload.update({
      collection: 'quests',
      id: draft.id,
      req,
      overrideAccess: false,
      data: {
        status: 'review',
        safetyReviewed: true,
        experienceReviewed: true,
        revision: draft.revision,
      },
    });
    assert.equal(reviewed.safetyReviewed, true);
    assert.equal(reviewed.experienceReviewed, true);
    const published = await payload.update({
      collection: 'quests',
      id: draft.id,
      req,
      overrideAccess: false,
      data: { status: 'published', revision: reviewed.revision },
    });
    const snapshot = questSnapshotSchema.parse(published.publishedSnapshot);
    const versions = await payload.find({
      collection: 'quest-versions',
      req,
      overrideAccess: false,
      where: { questId: { equals: String(draft.id) } },
    });
    assert.equal(versions.totalDocs, 1);
    assert.equal(snapshot.versionId, versions.docs[0]?.versionId);
    const scheduled = await payload.create({
      collection: 'daily-quests',
      req,
      overrideAccess: false,
      data: { businessDate: '2099-12-31', version: versions.docs[0]!.id },
    });
    assert.equal(scheduled.revision, 1);
    const edited = await payload.update({
      collection: 'quests',
      id: draft.id,
      req,
      overrideAccess: false,
      data: {
        status: 'draft',
        content: { ...EXAMPLE_QUEST, title: '验证用新草稿' },
        revision: published.revision,
      },
    });
    assert.deepEqual(edited.publishedSnapshot, snapshot);
    assert.equal(edited.safetyReviewed, false);
    const withdrawn = await payload.update({
      collection: 'quests',
      id: draft.id,
      req,
      overrideAccess: false,
      data: {
        status: 'withdrawn',
        emergency: true,
        reason: '验证安全下架',
        revision: edited.revision,
      },
    });
    assert.equal(withdrawn.status, 'withdrawn');
    assert.ok(
      (
        await payload.find({
          collection: 'audit-log',
          req,
          overrideAccess: false,
          where: { entityId: { equals: String(draft.id) } },
        })
      ).totalDocs >= 4,
    );
    console.log(
      'PASS: draft, review, publication, immutable version, scheduling, preserved snapshot, withdrawal and audit.',
    );
  } finally {
    await killTransaction(req);
  }
  const anonymous = await createLocalReq({ user: null }, payload);
  await assert.rejects(() =>
    payload.find({ collection: 'quests', req: anonymous, overrideAccess: false }),
  );
  const editor = await createLocalReq(
    { user: { ...admin, collection: 'admins', role: 'editor' } },
    payload,
  );
  await assert.rejects(() =>
    payload.create({
      collection: 'quests',
      req: editor,
      overrideAccess: false,
      data: { content: EXAMPLE_QUEST, status: 'published' },
    }),
  );
  await assert.rejects(() =>
    payload.create({
      collection: 'quest-versions',
      req: editor,
      overrideAccess: false,
      data: { versionId: 'forbidden', questId: 'forbidden', title: 'forbidden', snapshot: {} },
    }),
  );
  console.log(
    'PASS: anonymous content access and editor publication/version creation denied. All synthetic content rolled back.',
  );
} finally {
  await payload.destroy();
}
