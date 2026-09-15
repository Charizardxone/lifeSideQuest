import {
  ATTRIBUTES,
  catalogSchema,
  completionNoteSchema,
  dailySchema,
  questSnapshotSchema,
  questSourceSchema,
} from '@sidequest/contracts';
import {
  assertCanClaimDailyReward,
  calculateCompletionReward,
  getBeijingDate,
  getLevelProgress,
  transitionUserQuest,
} from '@sidequest/domain';
import type { Catalog, Daily } from '@sidequest/contracts';
import type { LocalDatabase } from '../data/database';
import type { Completion, Photo, Source, UserQuest } from '../data/models';

export class QuestServiceError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'QuestServiceError';
  }
}
function fail(code: string, message: string): never {
  throw new QuestServiceError(code, message);
}
function validatePhoto(photo: Photo | null | undefined) {
  if (
    photo &&
    (!photo.id ||
      photo.blob.type !== 'image/jpeg' ||
      photo.mimeType !== 'image/jpeg' ||
      photo.size !== photo.blob.size ||
      photo.size <= 0 ||
      photo.size > 1024 * 1024)
  )
    fail('INVALID_PHOTO', '请重新选择并压缩照片。');
}
const clockDate = (clock: () => Date) => {
  const now = clock();
  now.toISOString();
  return now;
};

export class QuestService {
  constructor(
    readonly db: LocalDatabase,
    readonly profileId: string,
    private readonly clock = () => new Date(),
  ) {}

  private async identity() {
    const current = await this.db.profiles.get('local');
    if (current?.id !== this.profileId)
      fail('IDENTITY_CHANGED', '本地数据已在其他页面重置，请刷新后继续。');
  }

  async recordView(
    name:
      | 'home_view'
      | 'recommend_request'
      | 'quest_impression'
      | 'quest_reroll'
      | 'daily_quest_view'
      | 'profile_view',
    eventId: string,
    questId?: string,
  ) {
    await this.db.transaction('rw', [this.db.profiles, this.db.outbox], async () => {
      await this.identity();
      if (await this.db.outbox.get(eventId)) return;
      await this.db.outbox.add({
        eventId,
        profileId: this.profileId,
        name,
        occurredAt: clockDate(this.clock).toISOString(),
        ...(questId ? { questId } : {}),
      });
    });
  }

  private async expire(now: Date) {
    const today = getBeijingDate(now);
    for (const quest of await this.db.quests.where('status').equals('in_progress').toArray()) {
      if (quest.source.kind === 'daily' && quest.source.businessDate < today) {
        const endedAt = new Date(`${quest.source.businessDate}T00:00:00+08:00`);
        endedAt.setTime(endedAt.getTime() + 86_400_000);
        await this.end(quest, 'expired', endedAt.toISOString());
      }
    }
  }

  private async end(quest: UserQuest, reason: 'user' | 'expired' | 'safety', at: string) {
    const ended = { ...quest, status: 'abandoned' as const, endedAt: at, endReason: reason };
    delete ended.activeSlot;
    await this.db.quests.put(ended);
    await this.db.outbox.add({
      eventId: crypto.randomUUID(),
      profileId: this.profileId,
      name: 'quest_abandon',
      userQuestId: quest.id,
      questId: quest.questId,
      occurredAt: at,
    });
  }

  async reconcile() {
    await this.db.transaction(
      'rw',
      [this.db.profiles, this.db.quests, this.db.outbox],
      async () => {
        await this.identity();
        await this.expire(clockDate(this.clock));
      },
    );
  }

  private async operation(
    operationId: string,
    fingerprint: string,
    work: (now: Date) => Promise<string>,
  ) {
    if (!operationId.trim()) fail('INVALID_OPERATION', '操作标识不能为空。');
    await this.reconcile();
    return this.db.transaction('rw', this.db.tables, async () => {
      await this.identity();
      const previous = await this.db.operations.get(operationId);
      if (previous) {
        if (previous.profileId !== this.profileId || previous.fingerprint !== fingerprint)
          fail('OPERATION_CONFLICT', '此操作标识已用于不同请求，请重新发起。');
        return previous.resultId;
      }
      const resultId = await work(clockDate(this.clock));
      await this.db.operations.add({
        operationId,
        fingerprint,
        resultId,
        profileId: this.profileId,
      });
      return resultId;
    });
  }

  async accept(questId: string, source: Source, operationId: string) {
    source = questSourceSchema.parse(source);
    return this.operation(operationId, JSON.stringify(['accept', questId, source]), async (now) => {
      const catalog = await this.db.catalog.get('catalog');
      if (!catalog || Date.parse(catalog.expiresAt) <= now.getTime())
        fail('CATALOG_EXPIRED', '任务缓存已过期，请联网刷新后接取。');
      let snapshot = catalog.tasks.find((task) => task.questId === questId);
      if (source.kind === 'daily') {
        const daily = await this.db.daily.get('daily');
        if (
          !daily ||
          daily.businessDate !== source.businessDate ||
          daily.dailyId !== source.dailyId ||
          daily.snapshot?.questId !== questId
        )
          fail('DAILY_CHANGED', '今日任务已变化，请刷新后重试。');
        assertCanClaimDailyReward(
          source.businessDate,
          await this.db.claims.toCollection().primaryKeys(),
          now,
        );
        snapshot = daily.snapshot ?? undefined;
      }
      if (!snapshot || catalog.withdrawals.some((item) => item.questId === questId))
        fail('UNAVAILABLE', '该任务已下架或不可接取。');
      if (await this.db.quests.where('activeSlot').equals(source.kind).count())
        fail(
          'ACTIVE_QUEST_EXISTS',
          source.kind === 'daily' ? '今日支线已在进行中。' : '请先完成或放弃当前普通支线。',
        );
      const id = crypto.randomUUID();
      await this.db.quests.add({
        id,
        profileId: this.profileId,
        questId,
        snapshot: questSnapshotSchema.parse(snapshot),
        source,
        status: 'in_progress',
        activeSlot: source.kind,
        acceptedAt: now.toISOString(),
      });
      await this.db.outbox.add({
        eventId: crypto.randomUUID(),
        profileId: this.profileId,
        name: 'quest_accept',
        userQuestId: id,
        questId,
        occurredAt: now.toISOString(),
      });
      return id;
    });
  }

  async abandon(id: string, operationId: string) {
    return this.operation(operationId, JSON.stringify(['abandon', id]), async (now) => {
      const quest = await this.db.quests.get(id);
      if (!quest) fail('NOT_FOUND', '找不到这次支线。');
      transitionUserQuest(quest.status, 'abandon');
      await this.end(quest, 'user', now.toISOString());
      return id;
    });
  }

  async complete(
    id: string,
    operationId: string,
    input: { note: string; city: string; photo?: Photo },
  ) {
    const note = completionNoteSchema.parse(input.note);
    validatePhoto(input.photo);
    return this.operation(
      operationId,
      JSON.stringify(['complete', id, note, input.city, input.photo?.id]),
      async (now) => {
        const quest = await this.db.quests.get(id);
        if (!quest) fail('NOT_FOUND', '找不到这次支线。');
        transitionUserQuest(quest.status, 'complete');
        if (quest.source.kind === 'daily')
          assertCanClaimDailyReward(
            quest.source.businessDate,
            await this.db.claims.toCollection().primaryKeys(),
            now,
          );
        const count = await this.db.completions.where('questId').equals(quest.questId).count();
        const reward = calculateCompletionReward(quest.snapshot.rewards, count);
        const completionId = crypto.randomUUID();
        const completion: Completion = {
          id: completionId,
          profileId: this.profileId,
          userQuestId: id,
          questId: quest.questId,
          completedAt: now.toISOString(),
          note,
          city: input.city.trim(),
          reward,
          hasNoteAtCompletion: note.trim().length > 0,
          hasImageAtCompletion: Boolean(input.photo),
        };
        if (input.photo) {
          await this.db.photos.add(input.photo);
          completion.photoId = input.photo.id;
        }
        await this.db.completions.add(completion);
        await this.db.xp.add({ completionId, delta: reward.xp });
        await this.db.attributes.bulkAdd(
          ATTRIBUTES.map((attribute) => ({
            completionId,
            attribute,
            delta: reward.attributes[attribute],
          })),
        );
        if (quest.source.kind === 'daily')
          await this.db.claims.add({ businessDate: quest.source.businessDate, completionId });
        const ended = { ...quest, status: 'completed' as const, endedAt: now.toISOString() };
        delete ended.activeSlot;
        await this.db.quests.put(ended);
        await this.db.outbox.add({
          eventId: crypto.randomUUID(),
          profileId: this.profileId,
          name: 'quest_complete',
          userQuestId: id,
          questId: quest.questId,
          occurredAt: now.toISOString(),
          hasNote: completion.hasNoteAtCompletion,
          hasImage: completion.hasImageAtCompletion,
        });
        return completionId;
      },
    );
  }

  async favorite(questId: string, wanted: boolean) {
    await this.db.transaction(
      'rw',
      [this.db.profiles, this.db.catalog, this.db.favorites],
      async () => {
        await this.identity();
        if (!wanted) {
          await this.db.favorites.delete(questId);
          return;
        }
        const snapshot = (await this.db.catalog.get('catalog'))?.tasks.find(
          (task) => task.questId === questId,
        );
        if (!snapshot) fail('UNAVAILABLE', '任务已不可用。');
        if (!(await this.db.favorites.get(questId)))
          await this.db.favorites.add({
            questId,
            snapshot,
            createdAt: clockDate(this.clock).toISOString(),
          });
      },
    );
  }

  async saveRecord(id: string, note: string, city: string, photo: Photo | null | undefined) {
    completionNoteSchema.parse(note);
    validatePhoto(photo);
    await this.db.transaction(
      'rw',
      [this.db.profiles, this.db.completions, this.db.photos],
      async () => {
        await this.identity();
        const record = await this.db.completions.get(id);
        if (!record) fail('NOT_FOUND', '存档不存在。');
        if (photo !== undefined) {
          if (photo) await this.db.photos.add(photo);
          if (record.photoId) await this.db.photos.delete(record.photoId);
          delete record.photoId;
          if (photo) record.photoId = photo.id;
        }
        await this.db.completions.put({ ...record, note, city: city.trim() });
      },
    );
  }

  async cache(catalogInput: Catalog, dailyInput?: Daily) {
    const catalog = catalogSchema.parse(catalogInput);
    const daily = dailyInput ? dailySchema.parse(dailyInput) : undefined;
    await this.db.transaction('rw', this.db.tables, async () => {
      await this.identity();
      const old = await this.db.catalog.get('catalog');
      if (old && old.serverTime > catalog.serverTime) return;
      await this.db.catalog.put({ ...catalog, key: 'catalog' });
      if (daily) {
        const oldDaily = await this.db.daily.get('daily');
        if (!oldDaily || oldDaily.serverTime <= daily.serverTime)
          await this.db.daily.put({ ...daily, key: 'daily' });
      }
      const now = clockDate(this.clock);
      await this.expire(now);
      for (const quest of await this.db.quests.where('status').equals('in_progress').toArray()) {
        if (catalog.withdrawals.some((item) => item.questId === quest.questId && item.emergency))
          await this.end(quest, 'safety', now.toISOString());
      }
    });
  }

  async growth() {
    return this.db.transaction(
      'r',
      [this.db.xp, this.db.attributes, this.db.completions],
      async () => {
        const totalXp = (await this.db.xp.toArray()).reduce((sum, entry) => sum + entry.delta, 0);
        const attributes = {
          exploration: 0,
          courage: 0,
          creativity: 0,
          connection: 0,
          growth: 0,
          vitality: 0,
        };
        for (const entry of await this.db.attributes.toArray())
          attributes[entry.attribute] += entry.delta;
        return {
          ...getLevelProgress(totalXp),
          attributes,
          completed: await this.db.completions.count(),
        };
      },
    );
  }
}
