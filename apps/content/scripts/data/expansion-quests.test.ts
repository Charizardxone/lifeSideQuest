import { describe, expect, it } from 'vitest';
import { QUEST_CATEGORIES, questContentSchema } from '@sidequest/contracts';
import { EXPANSION_QUESTS, EXPANSION_SOURCES } from './expansion-quests';
import { STARTER_QUESTS } from './starter-quests';

describe('second editorial batch', () => {
  it('adds 100 unique complete tasks without reusing starter titles or steps', () => {
    expect(EXPANSION_QUESTS).toHaveLength(100);
    expect(new Set(EXPANSION_QUESTS.map((item) => item.key)).size).toBe(100);
    const all = [...STARTER_QUESTS, ...EXPANSION_QUESTS];
    expect(new Set(all.map((item) => item.content.title)).size).toBe(150);
    expect(new Set(all.map((item) => item.content.steps.join('\n'))).size).toBe(150);
    expect(new Set(EXPANSION_QUESTS.map((item) => item.content.category))).toEqual(
      new Set(QUEST_CATEGORIES),
    );
    for (const { content } of EXPANSION_QUESTS) {
      expect(questContentSchema.safeParse(content).success).toBe(true);
      expect(content.steps).toHaveLength(3);
      expect(new Set(content.steps).size).toBe(3);
      expect(content.safetyNotes).toContain('可停止、放弃');
      expect(content.budget).toContain('0 元');
      expect(content.rewards.difficulty).toBeLessThanOrEqual(2);
      if (content.category === 'encounter') expect(content.people).toContain('征得同意');
    }
  });

  it('links each attributed inspiration to an explicit research source', () => {
    const used = new Set<string>();
    for (const { sources } of EXPANSION_QUESTS) {
      for (const source of sources) {
        const url = EXPANSION_SOURCES[source];
        expect(url).not.toBeNull();
        expect(new URL(url!).protocol).toBe('https:');
        used.add(source);
      }
    }
    expect(used.size).toBe(6);
  });
});
