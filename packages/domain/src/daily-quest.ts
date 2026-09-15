import { businessDateSchema, userQuestStatusSchema } from '@sidequest/contracts';
import type { UserQuestStatus } from '@sidequest/contracts';

/** Explicit clock input; Beijing day boundaries never depend on the device timezone. */
export function getBeijingDate(now: Date): string {
  if (!Number.isFinite(now.getTime())) throw new RangeError('Invalid current time');
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

/** Persist this reconciliation on startup/resume and before mutations; no reward for expiry. */
export function reconcileDailyQuest(
  status: UserQuestStatus,
  businessDate: string,
  now: Date,
): UserQuestStatus {
  userQuestStatusSchema.parse(status);
  businessDateSchema.parse(businessDate);
  const today = getBeijingDate(now);
  return status === 'in_progress' && businessDate < today ? 'abandoned' : status;
}

export class DailyQuestError extends Error {
  constructor(public readonly code: 'DAILY_NOT_TODAY' | 'DAILY_ALREADY_CLAIMED') {
    super(code === 'DAILY_NOT_TODAY' ? '今日支线只能在指定当天完成。' : '今天的支线奖励已经领取。');
    this.name = 'DailyQuestError';
  }
}

/** Also check execution state and claim uniqueness in the same completion transaction. */
export function assertCanClaimDailyReward(
  businessDate: string,
  claimedBusinessDates: readonly string[],
  now: Date,
): void {
  businessDateSchema.parse(businessDate);
  for (const date of claimedBusinessDates) businessDateSchema.parse(date);
  if (businessDate !== getBeijingDate(now)) throw new DailyQuestError('DAILY_NOT_TODAY');
  if (claimedBusinessDates.includes(businessDate))
    throw new DailyQuestError('DAILY_ALREADY_CLAIMED');
}
