import { z } from 'zod';
import { APIError, commitTransaction, initTransaction, killTransaction } from 'payload';
import type { Endpoint } from 'payload';
import { EXAMPLE_QUEST, questContentSchema } from '@sidequest/contracts';
import { administrator, operator } from '../collections/access';

export const operationsEndpoints: Endpoint[] = [
  {
    path: '/ops/quests/template',
    method: 'get',
    handler: async (req) => {
      if (!operator(req)) throw new APIError('需要运营账号。', 403);
      return Response.json({ schemaVersion: 1, dryRun: true, items: [EXAMPLE_QUEST] });
    },
  },
  {
    path: '/ops/quests/export',
    method: 'get',
    handler: async (req) => {
      if (!operator(req)) throw new APIError('需要运营账号。', 403);
      const result = await req.payload.find({
        collection: 'quests',
        req,
        overrideAccess: false,
        pagination: false,
        depth: 0,
      });
      return Response.json(
        {
          schemaVersion: 1,
          dryRun: true,
          items: result.docs.map((doc) => questContentSchema.parse(doc.content)),
        },
        {
          headers: {
            'Content-Disposition': 'attachment; filename="sidequest-content.json"',
            'Cache-Control': 'no-store',
          },
        },
      );
    },
  },
  {
    path: '/ops/quests/import',
    method: 'post',
    handler: async (req) => {
      if (!operator(req)) throw new APIError('需要运营账号。', 403);
      const body = (await req.text?.()) ?? '';
      if (new TextEncoder().encode(body).length > 1024 * 1024)
        throw new APIError('导入文件最多 1MB。', 413);
      let input: unknown;
      try {
        input = JSON.parse(body);
      } catch {
        throw new APIError('JSON 格式无效。', 400);
      }
      const envelope = z
        .strictObject({
          schemaVersion: z.literal(1),
          dryRun: z.boolean().default(true),
          items: z.array(z.unknown()).min(1).max(500),
        })
        .safeParse(input);
      if (!envelope.success)
        return Response.json({ errors: envelope.error.issues }, { status: 400 });
      const results = envelope.data.items.map((item) => questContentSchema.safeParse(item));
      const errors = results.flatMap((result, index) =>
        result.success
          ? []
          : result.error.issues.map((issue) => ({
              item: index + 1,
              field: issue.path.join('.'),
              message: issue.message,
            })),
      );
      const titles = new Set<string>();
      results.forEach((result, index) => {
        if (result.success) {
          if (titles.has(result.data.title))
            errors.push({ item: index + 1, field: 'title', message: '同一导入文件中标题重复。' });
          titles.add(result.data.title);
        }
      });
      if (errors.length) return Response.json({ errors }, { status: 400 });
      if (envelope.data.dryRun)
        return Response.json({
          valid: true,
          count: results.length,
          message: '校验通过；设 dryRun=false 才会创建新草稿。',
        });
      await initTransaction(req);
      try {
        const ids = [];
        for (const result of results) {
          if (!result.success) throw new APIError('内容无效。', 400);
          const created = await req.payload.create({
            collection: 'quests',
            req,
            overrideAccess: false,
            data: { content: result.data, status: 'draft' },
          });
          ids.push(created.id);
        }
        await commitTransaction(req);
        return Response.json({ ids, status: 'draft' });
      } catch (error) {
        await killTransaction(req);
        throw error;
      }
    },
  },
  ...(['publish', 'withdraw'] as const).map((action): Endpoint => ({
    path: `/ops/quests/:id/${action}`,
    method: 'post',
    handler: async (req) => {
      if (!administrator(req)) throw new APIError('仅管理员可操作。', 403);
      const input = z
        .strictObject({
          revision: z.number().int().positive(),
          reason: z.string().optional(),
          emergency: z.boolean().optional(),
        })
        .parse(await req.json?.());
      const doc = await req.payload.update({
        collection: 'quests',
        id: Number(req.routeParams?.id),
        req,
        overrideAccess: false,
        data: {
          revision: input.revision,
          status: action === 'publish' ? 'published' : 'withdrawn',
          ...(input.reason === undefined ? {} : { reason: input.reason }),
          ...(input.emergency === undefined ? {} : { emergency: input.emergency }),
        },
      });
      return Response.json({ id: doc.id, revision: doc.revision, status: doc.status });
    },
  })),
];
