import { z } from 'zod';

// Ordinary quests only; daily quests do not consume this slot.
export const ACTIVE_QUEST_LIMIT = 1 as const;
export const businessDateSchema = z.iso.date();

// Favorites are independent of executions. Terminal executions are never reopened.
export const userQuestStatusSchema = z.enum(['in_progress', 'completed', 'abandoned']);
export const questActionSchema = z.enum(['complete', 'abandon']);

export type UserQuestStatus = z.infer<typeof userQuestStatusSchema>;
export type QuestAction = z.infer<typeof questActionSchema>;
