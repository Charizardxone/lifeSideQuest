import { questRewardSchema } from '@sidequest/contracts';
import type { AttributeRewards, QuestReward } from '@sidequest/contracts';

export const REPEAT_REWARD_RULE_VERSION = 'repeat-v1' as const;

/** Calculation only: eligibility and atomic completion counting belong to the caller. */
export function calculateCompletionReward(
  baseReward: QuestReward,
  previousCompletionCount: number,
) {
  if (!Number.isSafeInteger(previousCompletionCount) || previousCompletionCount < 0) {
    throw new RangeError('previousCompletionCount must be a nonnegative safe integer');
  }
  const base = questRewardSchema.parse(baseReward);
  const percentage =
    previousCompletionCount === 0
      ? 100
      : previousCompletionCount === 1
        ? 50
        : previousCompletionCount === 2
          ? 25
          : 10;
  const scale = (points: number): number =>
    points === 0 ? 0 : Math.max(1, Math.floor((points * percentage) / 100));
  const attributes: AttributeRewards = {
    exploration: scale(base.attributes.exploration),
    courage: scale(base.attributes.courage),
    creativity: scale(base.attributes.creativity),
    connection: scale(base.attributes.connection),
    growth: scale(base.attributes.growth),
    vitality: scale(base.attributes.vitality),
  };

  // Settled rewards need not satisfy the published base total or allocation ratio.
  return {
    ruleVersion: REPEAT_REWARD_RULE_VERSION,
    baseRuleVersion: base.ruleVersion,
    previousCompletionCount,
    percentage,
    xp: scale(base.xp),
    attributes,
  };
}

export type CompletionReward = ReturnType<typeof calculateCompletionReward>;
