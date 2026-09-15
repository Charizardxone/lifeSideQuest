import { z } from 'zod';

export const QUEST_CATEGORIES = [
  'exploration',
  'encounter',
  'learning',
  'creation',
  'random',
  'special',
] as const;
export const questCategorySchema = z.enum(QUEST_CATEGORIES);
export type QuestCategory = z.infer<typeof questCategorySchema>;
export const QUEST_CATEGORY_LABELS = {
  exploration: '探索',
  encounter: '相遇',
  learning: '学习',
  creation: '创造',
  random: '随机',
  special: '特殊',
} as const satisfies Record<QuestCategory, string>;

// Display order is part of the shared contract, not chosen independently by each UI.
export const ATTRIBUTES = [
  'exploration',
  'courage',
  'creativity',
  'connection',
  'growth',
  'vitality',
] as const;
export const attributeSchema = z.enum(ATTRIBUTES);
export type Attribute = z.infer<typeof attributeSchema>;
export const ATTRIBUTE_LABELS = {
  exploration: '探索',
  courage: '勇气',
  creativity: '创造',
  connection: '连接',
  growth: '成长',
  vitality: '活力',
} as const satisfies Record<Attribute, string>;
