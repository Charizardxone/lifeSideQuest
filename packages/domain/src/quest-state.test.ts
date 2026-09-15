import { describe, expect, it } from 'vitest';
import { ACTIVE_QUEST_LIMIT, questActionSchema } from '@sidequest/contracts';
import type { QuestAction, UserQuestStatus } from '@sidequest/contracts';
import { assertCanAcceptQuest, QuestStateError, transitionUserQuest } from './quest-state';

describe('one active quest, irreversible completion', () => {
  it('permits acceptance only when there is no active quest', () => {
    expect(ACTIVE_QUEST_LIMIT).toBe(1);
    expect(() => assertCanAcceptQuest(0)).not.toThrow();
  });
  it.each([1, 2, 5])('rejects accepting another quest when %i are active', (count) => {
    expect(() => assertCanAcceptQuest(count)).toThrow(QuestStateError);
    expect(() => assertCanAcceptQuest(count)).toThrow(
      expect.objectContaining({ code: 'ACTIVE_QUEST_EXISTS' }),
    );
  });
  it.each([-1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])(
    'rejects an invalid count %s',
    (count) => {
      expect(() => assertCanAcceptQuest(count)).toThrow(RangeError);
    },
  );
  it.each([
    ['complete', 'completed'],
    ['abandon', 'abandoned'],
  ] as const)('%s ends an active execution as %s', (action, expected) => {
    expect(transitionUserQuest('in_progress', action)).toBe(expected);
  });
  it.each([
    ['completed', 'complete'],
    ['completed', 'abandon'],
    ['abandoned', 'complete'],
    ['abandoned', 'abandon'],
  ] as const)('prevents transition from %s via %s', (status, action) => {
    expect(() => transitionUserQuest(status, action)).toThrow(
      expect.objectContaining({ code: 'QUEST_ALREADY_ENDED' }),
    );
  });
  it.each(['revoke', 'accept', 'switch'])(
    'rejects unsupported action %s without reopening a record',
    (action) => {
      expect(questActionSchema.safeParse(action).success).toBe(false);
      expect(() => transitionUserQuest('completed', action as QuestAction)).toThrow(
        expect.objectContaining({ code: 'INVALID_QUEST_ACTION' }),
      );
    },
  );
  it('rejects malformed persisted state rather than silently treating it as active', () => {
    expect(() => transitionUserQuest('unknown' as UserQuestStatus, 'complete')).toThrow(
      expect.objectContaining({ code: 'INVALID_QUEST_STATUS' }),
    );
  });
});
