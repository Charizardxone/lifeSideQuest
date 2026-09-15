import { describe, expect, it } from 'vitest';
import { assertCanClaimDailyReward, getBeijingDate, reconcileDailyQuest } from './daily-quest';
import { assertCanAcceptQuest } from './quest-state';
import { calculateCompletionReward } from './rewards';
import type { QuestReward } from '@sidequest/contracts';

const before = new Date('2026-09-15T15:59:59.999Z');
const midnight = new Date('2026-09-15T16:00:00.000Z');

describe('independent daily quest rules', () => {
  it('switches at Beijing midnight', () => {
    expect(getBeijingDate(before)).toBe('2026-09-15');
    expect(getBeijingDate(midnight)).toBe('2026-09-16');
  });
  it('abandons an unfinished daily quest exactly at midnight', () => {
    expect(reconcileDailyQuest('in_progress', '2026-09-15', before)).toBe('in_progress');
    expect(reconcileDailyQuest('in_progress', '2026-09-15', midnight)).toBe('abandoned');
  });
  it.each(['completed', 'abandoned'] as const)('preserves terminal status %s', (status) => {
    expect(reconcileDailyQuest(status, '2026-09-15', midnight)).toBe(status);
  });
  it('reconciles after several days offline', () => {
    expect(reconcileDailyQuest('in_progress', '2026-09-01', midnight)).toBe('abandoned');
  });
  it.each(['2026-09-14', '2026-09-16'])('rejects completion outside %s', (date) => {
    expect(() => assertCanClaimDailyReward(date, [], before)).toThrow(
      expect.objectContaining({ code: 'DAILY_NOT_TODAY' }),
    );
  });
  it('blocks a second claim for the date regardless of quest or schedule replacement', () => {
    expect(() => assertCanClaimDailyReward('2026-09-15', ['2026-09-15'], before)).toThrow(
      expect.objectContaining({ code: 'DAILY_ALREADY_CLAIMED' }),
    );
    expect(() => assertCanClaimDailyReward('2026-09-16', ['2026-09-15'], midnight)).not.toThrow();
  });
  it('allows a daily claim independently of the occupied ordinary slot', () => {
    expect(() => assertCanAcceptQuest(1)).toThrow();
    expect(() => assertCanClaimDailyReward('2026-09-15', [], before)).not.toThrow();
    expect(() => assertCanAcceptQuest(0)).not.toThrow();
  });
  it('uses a shared count for separate ordinary and daily completions of the same quest', () => {
    const base: QuestReward = {
      ruleVersion: 'mvp-v1',
      difficulty: 1,
      xp: 10,
      attributes: {
        exploration: 1,
        courage: 1,
        creativity: 0,
        connection: 0,
        growth: 0,
        vitality: 0,
      },
    };
    expect(calculateCompletionReward(base, 0).xp).toBe(10);
    assertCanClaimDailyReward('2026-09-15', [], before);
    expect(calculateCompletionReward(base, 1).xp).toBe(5);
    expect(calculateCompletionReward(base, 2).xp).toBe(2);
  });
  it.each(['2026-02-30', '2026-9-15', 'garbage'])('rejects invalid business date %s', (date) => {
    expect(() => reconcileDailyQuest('in_progress', date, before)).toThrow();
    expect(() => assertCanClaimDailyReward(date, [], before)).toThrow();
  });
  it('rejects invalid clock and stored state', () => {
    expect(() => getBeijingDate(new Date(NaN))).toThrow();
    expect(() => reconcileDailyQuest('invalid' as 'in_progress', '2026-09-15', before)).toThrow();
  });
});
