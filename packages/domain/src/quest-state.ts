import { ACTIVE_QUEST_LIMIT, questActionSchema, userQuestStatusSchema } from '@sidequest/contracts';
import type { QuestAction, UserQuestStatus } from '@sidequest/contracts';

type QuestStateErrorCode =
  'ACTIVE_QUEST_EXISTS' | 'INVALID_QUEST_STATUS' | 'INVALID_QUEST_ACTION' | 'QUEST_ALREADY_ENDED';

export class QuestStateError extends Error {
  constructor(
    public readonly code: QuestStateErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'QuestStateError';
  }
}

/** Count ordinary quests only, inside the acceptance transaction. Daily quests use an independent slot. */
export function assertCanAcceptQuest(activeQuestCount: number): void {
  if (!Number.isSafeInteger(activeQuestCount) || activeQuestCount < 0) {
    throw new RangeError('activeQuestCount must be a nonnegative safe integer');
  }
  if (activeQuestCount >= ACTIVE_QUEST_LIMIT) {
    throw new QuestStateError('ACTIVE_QUEST_EXISTS', '请先完成或放弃当前支线，再接取下一条。');
  }
}

/** Duplicate operations must return their stored result before attempting another transition. */
export function transitionUserQuest(status: UserQuestStatus, action: QuestAction): UserQuestStatus {
  if (!userQuestStatusSchema.safeParse(status).success) {
    throw new QuestStateError('INVALID_QUEST_STATUS', '任务状态无效。');
  }
  if (!questActionSchema.safeParse(action).success) {
    throw new QuestStateError('INVALID_QUEST_ACTION', '不支持此操作；任务完成后不可撤销。');
  }
  if (status !== 'in_progress') {
    throw new QuestStateError('QUEST_ALREADY_ENDED', '该次任务已经结束，不能再次修改执行状态。');
  }
  return action === 'complete' ? 'completed' : 'abandoned';
}
