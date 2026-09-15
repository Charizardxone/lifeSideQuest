import { describe, expect, it } from 'vitest';
import { ATTRIBUTES, questRewardSchema } from '@sidequest/contracts';
import type { QuestReward } from '@sidequest/contracts';
import { calculateCompletionReward } from './rewards';

const base: QuestReward = {
  ruleVersion: 'mvp-v1',
  difficulty: 3,
  xp: 35,
  attributes: { exploration: 3, courage: 2, creativity: 0, connection: 0, growth: 0, vitality: 0 },
};

describe('repeated completion rewards', () => {
  it.each([
    [0, 100, 35, 3, 2],
    [1, 50, 17, 1, 1],
    [2, 25, 8, 1, 1],
    [3, 10, 3, 1, 1],
    [4, 10, 3, 1, 1],
    [Number.MAX_SAFE_INTEGER, 10, 3, 1, 1],
  ])(
    'calculates rewards after %i prior completions',
    (count, percentage, xp, exploration, courage) => {
      expect(calculateCompletionReward(base, count)).toEqual({
        ruleVersion: 'repeat-v1',
        baseRuleVersion: 'mvp-v1',
        previousCompletionCount: count,
        percentage,
        xp,
        attributes: { exploration, courage, creativity: 0, connection: 0, growth: 0, vitality: 0 },
      });
    },
  );

  it.each([-1, 0.5, NaN, Infinity, -Infinity, Number.MAX_SAFE_INTEGER + 1])(
    'rejects invalid previous count %s',
    (count) => expect(() => calculateCompletionReward(base, count)).toThrow(RangeError),
  );

  it('keeps XP and positive attributes at a minimum of one', () => {
    const reward = calculateCompletionReward(
      {
        ...base,
        difficulty: 1,
        xp: 10,
        attributes: { ...base.attributes, exploration: 1, courage: 1 },
      },
      100,
    );
    expect(reward.xp).toBe(1);
    expect(reward.attributes).toEqual({ ...base.attributes, exploration: 1, courage: 1 });
  });

  it('scales all six axes independently and never introduces a new rewarded axis', () => {
    for (const axis of ATTRIBUTES) {
      const attributes = {
        exploration: 0,
        courage: 0,
        creativity: 0,
        connection: 0,
        growth: 0,
        vitality: 0,
      };
      attributes[axis] = 7;
      attributes[axis === 'exploration' ? 'courage' : 'exploration'] = 3;
      const reward = calculateCompletionReward({ ...base, difficulty: 5, xp: 80, attributes }, 1);
      for (const key of ATTRIBUTES) {
        expect(reward.attributes[key]).toBe(
          attributes[key] === 7 ? 3 : attributes[key] === 3 ? 1 : 0,
        );
      }
    }
  });

  it('validates base rewards without applying base constraints to settled rewards', () => {
    expect(() => calculateCompletionReward({ ...base, xp: 34 }, 0)).toThrow();
    const result = calculateCompletionReward(base, 1);
    expect(
      questRewardSchema.safeParse({ ...base, xp: result.xp, attributes: result.attributes })
        .success,
    ).toBe(false);
  });

  it('does not mutate the snapshot and returns independent results', () => {
    const snapshot = structuredClone(base);
    const first = calculateCompletionReward(base, 1);
    first.attributes.courage = 9;
    expect(base).toEqual(snapshot);
    expect(calculateCompletionReward(base, 1).attributes.courage).toBe(1);
  });
});
