import type { QuestSnapshot } from '@sidequest/contracts';

const key = 'sidequest-recommendations-v1';
export function readSeen(storage: Storage): string[] {
  try {
    const value: unknown = JSON.parse(storage.getItem(key) ?? '[]');
    return Array.isArray(value) && value.every((id) => typeof id === 'string') ? value : [];
  } catch {
    return [];
  }
}
export function recommend(tasks: QuestSnapshot[], storage: Storage, random = Math.random) {
  const seen = readSeen(storage);
  const pool = tasks.filter((quest) => !seen.includes(quest.questId));
  if (!pool.length) return null;
  const value = random();
  if (value < 0 || value >= 1 || !Number.isFinite(value))
    throw new RangeError('Invalid random input');
  const quest = pool[Math.floor(value * pool.length)];
  if (!quest) return null;
  storage.setItem(key, JSON.stringify([...seen, quest.questId]));
  return quest;
}
export function restartRecommendations(storage: Storage) {
  storage.removeItem(key);
}
