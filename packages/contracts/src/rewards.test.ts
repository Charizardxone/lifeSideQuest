import { describe, expect, it } from 'vitest';
import { ATTRIBUTE_LABELS, ATTRIBUTES, attributeSchema, questCategorySchema } from './taxonomy';
import { questRewardSchema } from './rewards';

function reward(difficulty: number, xp: number, allocations: number[]) {
  return {
    ruleVersion: 'mvp-v1',
    difficulty,
    xp,
    attributes: Object.fromEntries(
      ATTRIBUTES.map((attribute, index) => [attribute, allocations[index] ?? 0]),
    ),
  };
}

describe('confirmed base reward contract', () => {
  it.each([
    [1, 10, [1, 1]],
    [2, 20, [2, 1]],
    [3, 35, [3, 2]],
    [4, 55, [4, 3]],
    [5, 80, [7, 3]],
    [3, 35, [2, 2, 1]],
  ] as const)(
    'accepts difficulty %i / %i XP and a valid distribution',
    (difficulty, xp, allocation) => {
      expect(questRewardSchema.safeParse(reward(difficulty, xp, [...allocation])).success).toBe(
        true,
      );
    },
  );

  it.each([
    ['nonstandard XP', reward(2, 15, [2, 1])],
    ['wrong total', reward(2, 20, [1, 1])],
    ['only one attribute', reward(1, 10, [2])],
    ['four attributes', reward(3, 35, [2, 1, 1, 1])],
    ['over 70 percent', reward(5, 80, [8, 2])],
    ['integer cap cannot round up', reward(4, 55, [5, 2])],
    ['negative point', reward(2, 20, [2, 2, -1])],
    ['fractional points', reward(2, 20, [1.5, 1.5])],
    ['invalid difficulty', reward(6, 80, [7, 3])],
    ['string difficulty', { ...reward(1, 10, [1, 1]), difficulty: '1' }],
    ['unknown version', { ...reward(1, 10, [1, 1]), ruleVersion: 'future' }],
    ['unknown field', { ...reward(1, 10, [1, 1]), bonusXp: 100 }],
    ['missing attribute', { ...reward(1, 10, [1, 1]), attributes: { exploration: 1, courage: 1 } }],
    [
      'unknown attribute',
      {
        ...reward(1, 10, [1, 1]),
        attributes: { ...reward(1, 10, [1, 1]).attributes, intelligence: 0 },
      },
    ],
  ])('rejects %s', (_reason, input) => {
    expect(questRewardSchema.safeParse(input).success).toBe(false);
  });

  it('reports an actionable attribute path without modifying input', () => {
    const input = reward(5, 80, [8, 2]);
    const before = structuredClone(input);
    const result = questRewardSchema.safeParse(input);
    expect(input).toEqual(before);
    expect(result.success).toBe(false);
    if (!result.success)
      expect(result.error.issues.map((issue) => issue.path)).toContainEqual([
        'attributes',
        'exploration',
      ]);
  });

  it('keeps category names separate from attribute names and fixes display order', () => {
    expect(ATTRIBUTES.map((attribute) => ATTRIBUTE_LABELS[attribute])).toEqual([
      '探索',
      '勇气',
      '创造',
      '连接',
      '成长',
      '活力',
    ]);
    expect(questCategorySchema.safeParse('encounter').success).toBe(true);
    expect(attributeSchema.safeParse('encounter').success).toBe(false);
    expect(questCategorySchema.safeParse('connection').success).toBe(false);
  });
});
