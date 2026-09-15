import { describe, expect, it } from 'vitest';
import { getLevelForXp, getLevelProgress, getLevelThreshold } from './levels';

describe('confirmed cumulative level curve', () => {
  it.each([
    [1, 0],
    [2, 50],
    [3, 142],
    [4, 260],
    [5, 400],
    [6, 560],
    [10, 1350],
  ])('level %i requires %i cumulative XP', (level, xp) => {
    expect(getLevelThreshold(level)).toBe(xp);
    expect(getLevelForXp(xp)).toBe(level);
    if (xp > 0) expect(getLevelForXp(xp - 1)).toBe(level - 1);
    expect(getLevelForXp(xp + 1)).toBe(level);
  });

  it('starts at level one with an empty progress bar', () => {
    expect(getLevelProgress(0)).toEqual({
      level: 1,
      totalXp: 0,
      currentLevelXp: 0,
      nextLevelXp: 50,
      xpInLevel: 0,
      xpToNextLevel: 50,
      progress: 0,
    });
  });
  it('measures progress within the current level without spending cumulative XP', () => {
    expect(getLevelProgress(96)).toEqual({
      level: 2,
      totalXp: 96,
      currentLevelXp: 50,
      nextLevelXp: 142,
      xpInLevel: 46,
      xpToNextLevel: 46,
      progress: 0.5,
    });
  });
  it('resets progress at the threshold and computes each XP balance independently', () => {
    expect(getLevelProgress(142)).toMatchObject({ level: 3, xpInLevel: 0, progress: 0 });
    expect(getLevelProgress(142 - 20)).toMatchObject({ level: 2, xpToNextLevel: 20 });
  });
  it('handles a large XP balance without stepping through every level', () => {
    const result = getLevelProgress(50_000_000);
    expect(result.level).toBe(10_001);
    expect(result.xpInLevel).toBe(0);
  });
  it.each([-1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])('rejects invalid XP %s', (xp) => {
    expect(() => getLevelForXp(xp)).toThrow(RangeError);
    expect(() => getLevelProgress(xp)).toThrow(RangeError);
  });
  it.each([0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER])(
    'rejects an invalid or unrepresentable level %s',
    (level) => {
      expect(() => getLevelThreshold(level)).toThrow(RangeError);
    },
  );
});
