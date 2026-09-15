import { describe, expect, it } from 'vitest';
import { EXAMPLE_QUEST } from './example';
import {
  completionNoteSchema,
  noteLength,
  questContentSchema,
  questSnapshotSchema,
} from './quests';

describe('public content and private note contracts', () => {
  it('validates the editable template and required immutable version identity', () => {
    expect(questContentSchema.parse(EXAMPLE_QUEST)).toEqual(EXAMPLE_QUEST);
    expect(questSnapshotSchema.safeParse(EXAMPLE_QUEST).success).toBe(false);
  });
  it('rejects leaked internal metadata and more than five steps', () => {
    expect(
      questContentSchema.safeParse({ ...EXAMPLE_QUEST, reviewerEmail: 'private' }).success,
    ).toBe(false);
    expect(
      questContentSchema.safeParse({ ...EXAMPLE_QUEST, steps: Array(6).fill('step') }).success,
    ).toBe(false);
  });
  it('counts graphemes rather than UTF-16 units, including composed emoji', () => {
    expect(noteLength('👨‍👩‍👧‍👦你好e\u0301')).toBe(4);
    expect(completionNoteSchema.safeParse('👨‍👩‍👧‍👦'.repeat(300)).success).toBe(true);
    expect(completionNoteSchema.safeParse('字'.repeat(301)).success).toBe(false);
    expect(completionNoteSchema.safeParse('').success).toBe(true);
  });
});
