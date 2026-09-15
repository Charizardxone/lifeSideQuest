import { APIError } from 'payload';
import type { CollectionConfig } from 'payload';
import { EXAMPLE_QUEST, questContentSchema, questSnapshotSchema } from '@sidequest/contracts';
import { administrator, isAdministrator, isOperator } from './access';

export const Quests: CollectionConfig = {
  slug: 'quests',
  labels: { singular: '任务', plural: '任务库' },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'status', 'revision', 'updatedAt'],
    description:
      '填写任务内容 JSON，保存草稿；提交审核后由管理员勾选安全/体验复核，再选择发布。编辑草稿不会覆盖已发布快照。',
  },
  access: { create: isOperator, read: isOperator, update: isOperator, delete: () => false },
  fields: [
    { name: 'title', label: '标题（从内容自动生成）', type: 'text', admin: { readOnly: true } },
    {
      name: 'content',
      label: '任务内容 JSON',
      type: 'json',
      required: true,
      defaultValue: EXAMPLE_QUEST,
      validate: (value: unknown) => {
        const result = questContentSchema.safeParse(value);
        return (
          result.success ||
          result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ')
        );
      },
    },
    {
      name: 'status',
      label: '工作流',
      type: 'select',
      defaultValue: 'draft',
      required: true,
      options: [
        { label: '草稿', value: 'draft' },
        { label: '待审核', value: 'review' },
        { label: '发布', value: 'published' },
        { label: '下架', value: 'withdrawn' },
      ],
    },
    {
      name: 'safetyReviewed',
      label: '已完成人工安全复核（适合公开随机）',
      type: 'checkbox',
      defaultValue: false,
      access: { update: ({ req }) => administrator(req), create: ({ req }) => administrator(req) },
    },
    {
      name: 'experienceReviewed',
      label: '已完成人工体验复核',
      type: 'checkbox',
      defaultValue: false,
      access: { update: ({ req }) => administrator(req), create: ({ req }) => administrator(req) },
    },
    {
      name: 'emergency',
      label: '安全紧急下架（已接取任务也将放弃）',
      type: 'checkbox',
      defaultValue: false,
      access: { update: ({ req }) => administrator(req), create: ({ req }) => administrator(req) },
    },
    { name: 'reason', label: '下架 / 调整原因', type: 'textarea' },
    { name: 'revision', type: 'number', defaultValue: 0, admin: { readOnly: true } },
    {
      name: 'publishedSnapshot',
      label: '当前发布快照',
      type: 'json',
      admin: { readOnly: true },
      access: { create: () => false, update: () => false },
    },
  ],
  hooks: {
    beforeChange: [
      ({ data, originalDoc, req }) => {
        const content = questContentSchema.parse(data.content ?? originalDoc?.content);
        const changed =
          originalDoc?.id !== undefined &&
          JSON.stringify(content) !== JSON.stringify(questContentSchema.parse(originalDoc.content));
        if (
          originalDoc?.id !== undefined &&
          data.revision !== undefined &&
          data.revision !== originalDoc.revision
        )
          throw new APIError('内容已被其他编辑修改，请刷新后重试。', 409);
        const status = data.status ?? originalDoc?.status ?? 'draft';
        if (originalDoc?.status === 'withdrawn' && !['withdrawn', 'published'].includes(status)) {
          throw new APIError(
            '下架记录只能保持下架，或经管理员重新审核发布；不能用草稿状态恢复公开。',
            400,
          );
        }
        if (['published', 'withdrawn'].includes(status) && !administrator(req))
          throw new APIError('只有管理员可以发布或下架。', 403);
        data.content = content;
        data.title = content.title;
        data.revision = (originalDoc?.revision ?? 0) + 1;
        data.publishedSnapshot = originalDoc?.publishedSnapshot ?? null;
        if (changed) {
          data.safetyReviewed = false;
          data.experienceReviewed = false;
        }
        if (status === 'published') {
          if (
            changed ||
            !(data.safetyReviewed ?? originalDoc?.safetyReviewed) ||
            !(data.experienceReviewed ?? originalDoc?.experienceReviewed)
          )
            throw new APIError('请先保存内容，并完成安全与体验复核后发布。', 400);
          const questId = String(originalDoc?.id ?? data.id ?? '');
          if (!questId) throw new APIError('请先保存草稿，再发布。', 400);
          data.publishedSnapshot = questSnapshotSchema.parse({
            ...content,
            questId,
            versionId: `${questId}:${data.revision}`,
            publishedAt: new Date().toISOString(),
          });
          data.emergency = false;
        }
        if (status === 'withdrawn' && !(data.reason ?? originalDoc?.reason)?.trim())
          throw new APIError('下架需填写原因。', 400);
        return data;
      },
    ],
    afterChange: [
      async ({ doc, req }) => {
        // Unique revision audit key makes competing stale writes fail atomically, even via direct REST.
        await req.payload.create({
          collection: 'audit-log',
          req,
          overrideAccess: true,
          data: {
            key: `quest:${doc.id}:${doc.revision}`,
            actorId: String(req.user?.id ?? ''),
            action: doc.status,
            entityId: String(doc.id),
            revision: doc.revision,
          },
        });
        if (doc.status === 'published') {
          const snapshot = questSnapshotSchema.parse(doc.publishedSnapshot);
          await req.payload.create({
            collection: 'quest-versions',
            req,
            overrideAccess: true,
            data: {
              versionId: snapshot.versionId,
              questId: snapshot.questId,
              title: snapshot.title,
              snapshot,
            },
          });
        }
        return doc;
      },
    ],
  },
};

export const QuestVersions: CollectionConfig = {
  slug: 'quest-versions',
  labels: { singular: '任务版本', plural: '已发布版本' },
  admin: { useAsTitle: 'title' },
  access: { read: isOperator, create: () => false, update: () => false, delete: () => false },
  fields: [
    { name: 'versionId', type: 'text', required: true, unique: true },
    { name: 'questId', type: 'text', required: true, index: true },
    { name: 'title', type: 'text', required: true },
    { name: 'snapshot', type: 'json', required: true },
  ],
};
export const AuditLog: CollectionConfig = {
  slug: 'audit-log',
  labels: { singular: '审计日志', plural: '审计日志' },
  admin: { useAsTitle: 'key' },
  access: { read: isAdministrator, create: () => false, update: () => false, delete: () => false },
  fields: [
    { name: 'key', type: 'text', unique: true, required: true },
    { name: 'actorId', type: 'text', required: true },
    { name: 'action', type: 'text', required: true },
    { name: 'entityId', type: 'text', required: true },
    { name: 'revision', type: 'number', required: true },
  ],
};
