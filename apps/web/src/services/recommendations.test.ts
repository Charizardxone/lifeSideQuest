import { describe, expect, it } from 'vitest';
import { EXAMPLE_QUEST } from '@sidequest/contracts';
import {
  chooseRecommendation,
  clearRecommendation,
  currentRecommendation,
  restartRecommendations,
} from './recommendations';

function storage() {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
    removeItem: (key: string) => {
      data.delete(key);
    },
  } as Storage;
}
const tasks = ['one', 'two'].map((questId) => ({
  ...EXAMPLE_QUEST,
  questId,
  versionId: `${questId}:1`,
  publishedAt: '2026-09-15T00:00:00Z',
}));
describe('home recommendation session', () => {
  it('automatically selects once, survives rerenders and route remounts, and changes only on request', () => {
    const session = storage();
    const first = currentRecommendation(tasks, session);
    expect(first).toBeTruthy();
    expect(currentRecommendation(tasks, session)).toEqual(first);
    expect(currentRecommendation([...tasks], session)).toEqual(first);
    expect(chooseRecommendation(tasks, session)?.questId).not.toBe(first?.questId);
    expect(chooseRecommendation(tasks, session)).toBeNull();
    expect(currentRecommendation(tasks, session)).toBeNull();
    restartRecommendations(session);
    expect(chooseRecommendation(tasks, session)).toBeTruthy();
  });
  it('does not quietly substitute a withdrawn quest or keep a stale public version', () => {
    const session = storage();
    const first = currentRecommendation(tasks, session)!;
    expect(
      currentRecommendation(
        tasks.filter((q) => q.questId !== first.questId),
        session,
      ),
    ).toBeNull();
    expect(
      currentRecommendation(
        tasks.map((q) => ({ ...q, versionId: 'updated' })),
        session,
      )?.versionId,
    ).toBe('updated');
    clearRecommendation(session);
    expect(currentRecommendation(tasks, session)?.questId).not.toBe(first.questId);
  });
});
