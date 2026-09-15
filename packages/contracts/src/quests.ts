import { z } from 'zod';
import { questCategorySchema } from './taxonomy';
import { questRewardSchema } from './rewards';
import { businessDateSchema } from './quest-state';

const text = z.string().trim().min(1);
export const questSourceSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('ordinary') }),
  z.strictObject({ kind: z.literal('daily'), businessDate: businessDateSchema, dailyId: text }),
]);
export const questContentSchema = z.strictObject({
  title: text,
  subtitle: text,
  description: text,
  category: questCategorySchema,
  steps: z.array(text).min(1).max(5),
  duration: text,
  budget: text,
  people: text,
  indoorOutdoor: text,
  timeOfDay: text,
  environment: text,
  preparation: z.string(),
  safetyNotes: text,
  tags: z.array(text),
  rewards: questRewardSchema,
});
export const questSnapshotSchema = questContentSchema.extend({
  questId: text,
  versionId: text,
  publishedAt: z.iso.datetime(),
});
export type QuestContent = z.infer<typeof questContentSchema>;
export type QuestSnapshot = z.infer<typeof questSnapshotSchema>;

export const catalogSchema = z.strictObject({
  schemaVersion: z.literal(1),
  revision: text,
  serverTime: z.iso.datetime(),
  expiresAt: z.iso.datetime(),
  tasks: z.array(questSnapshotSchema),
  withdrawals: z.array(z.strictObject({ questId: text, emergency: z.boolean() })),
});
export type Catalog = z.infer<typeof catalogSchema>;
export const dailySchema = z.strictObject({
  schemaVersion: z.literal(1),
  businessDate: businessDateSchema,
  timezone: z.literal('Asia/Shanghai'),
  dailyId: text,
  revision: text,
  serverTime: z.iso.datetime(),
  snapshot: questSnapshotSchema.nullable(),
});
export type Daily = z.infer<typeof dailySchema>;
export const dailyHistorySchema = z.strictObject({
  entries: z.array(
    z.strictObject({ businessDate: businessDateSchema, snapshot: questSnapshotSchema }),
  ),
  page: z.number().int().positive(),
  hasNextPage: z.boolean(),
});

export const noteLength = (value: string): number =>
  Array.from(new Intl.Segmenter('zh', { granularity: 'grapheme' }).segment(value)).length;
export const completionNoteSchema = z.string().refine((value) => noteLength(value) <= 300, {
  message: '记录最多 300 个可见字符。',
});
