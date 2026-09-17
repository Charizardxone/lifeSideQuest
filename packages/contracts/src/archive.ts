import { z } from 'zod';
import { ATTRIBUTES } from './taxonomy';
import { attributeRewardsSchema } from './rewards';
import { businessDateSchema, userQuestStatusSchema } from './quest-state';
import { completionNoteSchema, questSnapshotSchema, questSourceSchema } from './quests';

const id = z.string().min(1).max(200);
const at = z.iso.datetime();
const count = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const rows = <T extends z.ZodType>(item: T) => z.array(item).max(100_000);
const reward = z.strictObject({
  ruleVersion: z.literal('repeat-v1'),
  baseRuleVersion: z.literal('mvp-v1'),
  previousCompletionCount: count,
  percentage: z.union([z.literal(100), z.literal(50), z.literal(25), z.literal(10)]),
  xp: z.number().int().min(1).max(80),
  attributes: attributeRewardsSchema,
});
/** Version 1 of the existing private ZIP export, independent of any database implementation. */
export const archiveSchema = z.strictObject({
  schemaVersion: z.literal(1),
  exportedAt: at,
  profile: z
    .array(
      z.strictObject({
        key: z.literal('local'),
        id: z.uuid(),
        createdAt: at,
        schemaVersion: z.literal(1),
      }),
    )
    .length(1),
  quests: rows(
    z.strictObject({
      id,
      profileId: id,
      questId: id,
      snapshot: questSnapshotSchema,
      source: questSourceSchema,
      status: userQuestStatusSchema,
      acceptedAt: at,
      endedAt: at.optional(),
      endReason: z.enum(['user', 'expired', 'safety']).optional(),
      activeSlot: z.enum(['ordinary', 'daily']).optional(),
    }),
  ),
  completions: rows(
    z.strictObject({
      id,
      profileId: id,
      userQuestId: id,
      questId: id,
      completedAt: at,
      note: completionNoteSchema,
      city: z.string(),
      photoId: id.optional(),
      reward,
      hasNoteAtCompletion: z.boolean(),
      hasImageAtCompletion: z.boolean(),
    }),
  ),
  photos: rows(
    z.strictObject({
      id: id.regex(/^[a-zA-Z0-9_-]+$/),
      size: z
        .number()
        .int()
        .min(1)
        .max(1024 * 1024),
      mimeType: z.literal('image/jpeg'),
      path: z.string(),
    }),
  ),
  xp: rows(z.strictObject({ completionId: id, delta: count })),
  attributes: rows(
    z.strictObject({ completionId: id, attribute: z.enum(ATTRIBUTES), delta: count }),
  ),
  claims: rows(z.strictObject({ businessDate: businessDateSchema, completionId: id })),
  favorites: rows(z.strictObject({ questId: id, snapshot: questSnapshotSchema, createdAt: at })),
  operations: rows(
    z.strictObject({ operationId: id, profileId: id, fingerprint: z.string(), resultId: id }),
  ),
  events: rows(
    z.strictObject({
      eventId: id,
      profileId: id,
      name: z.enum([
        'quest_accept',
        'quest_abandon',
        'quest_complete',
        'home_view',
        'recommend_request',
        'quest_impression',
        'quest_reroll',
        'daily_quest_view',
        'profile_view',
      ]),
      userQuestId: id.optional(),
      questId: id.optional(),
      occurredAt: at,
      hasNote: z.boolean().optional(),
      hasImage: z.boolean().optional(),
    }),
  ),
});
export type ArchiveData = z.infer<typeof archiveSchema>;
