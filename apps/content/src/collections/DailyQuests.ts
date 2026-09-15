import { APIError } from 'payload';
import type { CollectionConfig, GlobalConfig } from 'payload';
import { businessDateSchema } from '@sidequest/contracts';
import { isAdministrator, isOperator } from './access';

export const DailyQuests: CollectionConfig = {
  slug: 'daily-quests',
  labels: { singular: '今日排期', plural: '今日排期' },
  admin: { useAsTitle: 'businessDate', defaultColumns: ['businessDate', 'version', 'revision'] },
  access: {
    read: isOperator,
    create: isAdministrator,
    update: isAdministrator,
    delete: () => false,
  },
  fields: [
    {
      name: 'businessDate',
      label: '北京时间日期 YYYY-MM-DD',
      type: 'text',
      unique: true,
      required: true,
      validate: (value: unknown) =>
        businessDateSchema.safeParse(value).success || '日期必须为有效的 YYYY-MM-DD',
    },
    {
      name: 'version',
      label: '已审核发布版本',
      type: 'relationship',
      relationTo: 'quest-versions',
      required: true,
    },
    { name: 'reason', label: '调整原因', type: 'textarea' },
    { name: 'revision', type: 'number', defaultValue: 0, admin: { readOnly: true } },
  ],
  hooks: {
    beforeChange: [
      async ({ data, originalDoc, req }) => {
        if (
          originalDoc?.id !== undefined &&
          data.businessDate &&
          data.businessDate !== originalDoc.businessDate
        )
          throw new APIError('不能改变已存在排期的日期，请新建另一天。', 400);
        if (
          originalDoc?.id !== undefined &&
          data.revision !== undefined &&
          data.revision !== originalDoc.revision
        )
          throw new APIError('排期已变化，请刷新。', 409);
        if (originalDoc?.id !== undefined && !(data.reason ?? '').trim())
          throw new APIError('替换排期需填写原因。', 400);
        const version = await req.payload.findByID({
          collection: 'quest-versions',
          id:
            typeof data.version === 'object'
              ? data.version.id
              : (data.version ?? originalDoc?.version),
          req,
          overrideAccess: false,
        });
        const quest = await req.payload.findByID({
          collection: 'quests',
          id: Number(version.questId),
          req,
          overrideAccess: false,
        });
        if (!quest.publishedSnapshot || quest.status === 'withdrawn')
          throw new APIError('下架任务不能用于新排期。', 400);
        return { ...data, revision: (originalDoc?.revision ?? 0) + 1 };
      },
    ],
    afterChange: [
      async ({ doc, req }) => {
        await req.payload.create({
          collection: 'audit-log',
          req,
          overrideAccess: true,
          data: {
            key: `daily:${doc.businessDate}:${doc.revision}`,
            actorId: String(req.user?.id),
            action: 'schedule',
            entityId: doc.businessDate,
            revision: doc.revision,
          },
        });
        return doc;
      },
    ],
  },
};
export const ContentSettings: GlobalConfig = {
  slug: 'content-settings',
  label: '今日备用设置',
  access: { read: isOperator, update: isAdministrator },
  fields: [
    {
      name: 'fallback',
      label: '缺排期时使用的已发布版本',
      type: 'relationship',
      relationTo: 'quest-versions',
      admin: { description: '不设置或任务已下架时，公开接口返回暂无今日任务。' },
    },
  ],
};
