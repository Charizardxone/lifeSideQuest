import { describe, expect, it } from 'vitest';
import { QUEST_CATEGORIES, questContentSchema } from '@sidequest/contracts';
import { SOURCES, STARTER_QUESTS } from './starter-quests';

describe('starter editorial batch', () => {
  it('contains exactly 50 unique, schema-valid tasks across all categories', () => {
    expect(STARTER_QUESTS).toHaveLength(50);
    expect(new Set(STARTER_QUESTS.map((item) => item.key)).size).toBe(50);
    expect(new Set(STARTER_QUESTS.map((item) => item.content.title)).size).toBe(50);
    expect(new Set(STARTER_QUESTS.map((item) => item.content.category))).toEqual(
      new Set(QUEST_CATEGORIES),
    );
    for (const item of STARTER_QUESTS) {
      expect(questContentSchema.safeParse(item.content).success).toBe(true);
      expect(item.content.steps).toHaveLength(3);
      expect(item.content.safetyNotes).toContain('可停止、放弃');
    }
  });

  it('resolves every declared source and contains no mandatory spending', () => {
    for (const item of STARTER_QUESTS) {
      for (const source of item.sources) expect(new URL(SOURCES[source]).protocol).toBe('https:');
      expect(item.content.budget).toContain('0 元');
      expect(item.content.rewards.difficulty).toBeLessThanOrEqual(3);
    }
  });
});
