import { createHash } from 'node:crypto';
import type { Endpoint, PayloadRequest } from 'payload';
import { catalogSchema, dailySchema, questSnapshotSchema } from '@sidequest/contracts';

const beijingDate = () =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
const headers = { 'Cache-Control': 'no-store' };

async function catalog(req: PayloadRequest) {
  // Internal read intentionally bypasses CMS permissions; strict public projection follows.
  const result = await req.payload.find({
    collection: 'quests',
    overrideAccess: true,
    pagination: false,
    depth: 0,
    req,
  });
  const tasks = result.docs
    .filter((doc) => doc.status !== 'withdrawn' && doc.publishedSnapshot)
    .map((doc) => questSnapshotSchema.parse(doc.publishedSnapshot));
  const withdrawals = result.docs
    .filter((doc) => doc.status === 'withdrawn')
    .map((doc) => ({ questId: String(doc.id), emergency: Boolean(doc.emergency) }));
  const revision = createHash('sha256')
    .update(JSON.stringify({ tasks, withdrawals }))
    .digest('hex');
  const now = new Date();
  return catalogSchema.parse({
    schemaVersion: 1,
    revision,
    serverTime: now.toISOString(),
    expiresAt: new Date(now.getTime() + 86400000).toISOString(),
    tasks,
    withdrawals,
  });
}
export const publicEndpoints: Endpoint[] = [
  {
    path: '/public/daily/history',
    method: 'get',
    handler: async (req) => {
      const requestedPage = Number(req.query.page ?? 1);
      const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
      const result = await req.payload.find({
        collection: 'daily-quests',
        where: { businessDate: { less_than: beijingDate() } },
        page,
        limit: 20,
        sort: '-businessDate',
        depth: 1,
        overrideAccess: true,
        req,
      });
      const entries = [];
      for (const plan of result.docs) {
        if (typeof plan.version !== 'object') continue;
        const snapshot = questSnapshotSchema.parse(plan.version.snapshot);
        const quest = await req.payload.findByID({
          collection: 'quests',
          id: Number(snapshot.questId),
          overrideAccess: true,
          req,
          depth: 0,
        });
        if (quest.status !== 'withdrawn')
          entries.push({ businessDate: plan.businessDate, snapshot });
      }
      return Response.json(
        { entries, page: result.page, hasNextPage: result.hasNextPage },
        { headers },
      );
    },
  },
  {
    path: '/public/catalog',
    method: 'get',
    handler: async (req) => {
      const value = await catalog(req);
      if (req.headers.get('if-none-match') === `"${value.revision}"`)
        return new Response(null, {
          status: 304,
          headers: { ...headers, ETag: `"${value.revision}"` },
        });
      return Response.json(value, { headers: { ...headers, ETag: `"${value.revision}"` } });
    },
  },
  {
    path: '/public/daily',
    method: 'get',
    handler: async (req) => {
      const date = beijingDate();
      const scheduled = await req.payload.find({
        collection: 'daily-quests',
        where: { businessDate: { equals: date } },
        limit: 1,
        depth: 1,
        overrideAccess: true,
        req,
      });
      const plan = scheduled.docs[0];
      const settings = plan
        ? null
        : await req.payload.findGlobal({
            slug: 'content-settings',
            depth: 1,
            overrideAccess: true,
            req,
          });
      const version = plan?.version ?? settings?.fallback;
      let snapshot =
        typeof version === 'object' && version ? questSnapshotSchema.parse(version.snapshot) : null;
      if (snapshot) {
        const quest = await req.payload.findByID({
          collection: 'quests',
          id: Number(snapshot.questId),
          depth: 0,
          overrideAccess: true,
          req,
        });
        if (quest.status === 'withdrawn') snapshot = null;
      }
      return Response.json(
        dailySchema.parse({
          schemaVersion: 1,
          businessDate: date,
          timezone: 'Asia/Shanghai',
          dailyId: `daily:${date}`,
          revision: `${plan?.revision ?? 0}:${snapshot?.versionId ?? 'none'}`,
          serverTime: new Date().toISOString(),
          snapshot,
        }),
        { headers },
      );
    },
  },
];
