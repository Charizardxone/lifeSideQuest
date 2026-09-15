export const LEVEL_RULE_VERSION = 'mvp-v1' as const;

function requireInteger(value: number, minimum: number, name: string): void {
  if (!Number.isSafeInteger(value) || value < minimum) {
    throw new RangeError(`${name} must be a safe integer greater than or equal to ${minimum}`);
  }
}

function threshold(level: number): number {
  return Math.ceil(50 * (level - 1) ** 1.5);
}

/** Cumulative XP required to reach a level, not XP earned within that level. */
export function getLevelThreshold(level: number): number {
  requireInteger(level, 1, 'level');
  const xp = threshold(level);
  requireInteger(xp, 0, 'level threshold');
  return xp;
}

/** Derive levels from accumulated XP; do not maintain a separate mutable level counter. */
export function getLevelForXp(totalXp: number): number {
  requireInteger(totalXp, 0, 'totalXp');
  let lower = 1;
  let upper = 2;
  while (threshold(upper) <= totalXp) upper *= 2;

  // Search by the forward threshold; inverse floating-point rounding can misgrade boundaries.
  while (upper - lower > 1) {
    const middle = Math.floor((lower + upper) / 2);
    if (threshold(middle) <= totalXp) lower = middle;
    else upper = middle;
  }
  return lower;
}

export function getLevelProgress(totalXp: number) {
  const level = getLevelForXp(totalXp);
  const currentLevelXp = getLevelThreshold(level);
  const nextLevelXp = getLevelThreshold(level + 1);
  const xpInLevel = totalXp - currentLevelXp;
  return {
    level,
    totalXp,
    currentLevelXp,
    nextLevelXp,
    xpInLevel,
    xpToNextLevel: nextLevelXp - totalXp,
    progress: xpInLevel / (nextLevelXp - currentLevelXp),
  };
}

export type LevelProgress = ReturnType<typeof getLevelProgress>;
