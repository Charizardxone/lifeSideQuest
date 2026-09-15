import { z } from 'zod';
import { ATTRIBUTES } from './taxonomy';

export const REWARD_RULE_VERSION = 'mvp-v1' as const;
export const difficultySchema = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
  z.literal(5),
]);
export type Difficulty = z.infer<typeof difficultySchema>;

// Published base rewards only. Repeat/daily eligibility and levels are separate decisions.
export const BASE_REWARDS = {
  1: { xp: 10, attributePoints: 2 },
  2: { xp: 20, attributePoints: 3 },
  3: { xp: 35, attributePoints: 5 },
  4: { xp: 55, attributePoints: 7 },
  5: { xp: 80, attributePoints: 10 },
} as const satisfies Record<Difficulty, { xp: number; attributePoints: number }>;

const points = z.number().int().min(0).max(10);
export const attributeRewardsSchema = z.strictObject({
  exploration: points,
  courage: points,
  creativity: points,
  connection: points,
  growth: points,
  vitality: points,
});
export type AttributeRewards = z.infer<typeof attributeRewardsSchema>;

export const questRewardSchema = z
  .strictObject({
    ruleVersion: z.literal(REWARD_RULE_VERSION),
    difficulty: difficultySchema,
    xp: z.number().int().nonnegative(),
    attributes: attributeRewardsSchema,
  })
  .superRefine((reward, context) => {
    const expected = BASE_REWARDS[reward.difficulty];
    if (reward.xp !== expected.xp) {
      context.addIssue({
        code: 'custom',
        path: ['xp'],
        message: `该难度的基础经验必须为 ${expected.xp} XP`,
      });
    }
    const total = ATTRIBUTES.reduce((sum, attribute) => sum + reward.attributes[attribute], 0);
    if (total !== expected.attributePoints) {
      context.addIssue({
        code: 'custom',
        path: ['attributes'],
        message: `该难度的属性点总额必须为 ${expected.attributePoints}`,
      });
    }
    const rewarded = ATTRIBUTES.filter((attribute) => reward.attributes[attribute] > 0);
    if (rewarded.length < 2 || rewarded.length > 3) {
      context.addIssue({
        code: 'custom',
        path: ['attributes'],
        message: '任务必须分配到 2–3 个属性',
      });
    }
    for (const attribute of rewarded) {
      // Compare integers: exactly 70% is allowed without rounding the limit up.
      if (reward.attributes[attribute] * 10 > expected.attributePoints * 7) {
        context.addIssue({
          code: 'custom',
          path: ['attributes', attribute],
          message: '单项属性不得超过总点数的 70%',
        });
      }
    }
  });
export type QuestReward = z.infer<typeof questRewardSchema>;
