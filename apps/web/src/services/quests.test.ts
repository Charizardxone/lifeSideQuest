import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { EXAMPLE_QUEST } from '@sidequest/contracts';
import type { Catalog, Daily, QuestSnapshot } from '@sidequest/contracts';
import { LocalDatabase } from '../data/database';
import { getOrCreateLocalProfile } from '../data/local-profile';
import { QuestService } from './quests';
import { deletePersonalData, exportArchive } from './export';
import { unzipSync, strFromU8 } from 'fflate';

const task: QuestSnapshot = {
  ...EXAMPLE_QUEST,
  questId: '1',
  versionId: '1:1',
  publishedAt: '2026-09-15T00:00:00.000Z',
};
const catalog: Catalog = {
  schemaVersion: 1,
  revision: '1',
  serverTime: '2026-09-15T00:00:00.000Z',
  expiresAt: '2026-09-16T00:00:00.000Z',
  tasks: [task, { ...task, questId: '2', versionId: '2:1' }],
  withdrawals: [],
};
const daily: Daily = {
  schemaVersion: 1,
  businessDate: '2026-09-15',
  dailyId: 'daily:2026-09-15',
  timezone: 'Asia/Shanghai',
  revision: '1',
  serverTime: catalog.serverTime,
  snapshot: task,
};
const ordinary = { kind: 'ordinary' } as const;
const dailySource = {
  kind: 'daily',
  dailyId: daily.dailyId,
  businessDate: daily.businessDate,
} as const;
const empty = { note: '', city: '' };
let db: LocalDatabase;
let service: QuestService;
let now: Date;
const connections: LocalDatabase[] = [];
beforeEach(async () => {
  db = new LocalDatabase(`sidequest-test-${crypto.randomUUID()}`);
  connections.push(db);
  now = new Date('2026-09-15T08:00:00.000Z');
  service = new QuestService(db, (await getOrCreateLocalProfile(db)).id, () => now);
  await service.cache(catalog, daily);
});
afterEach(async () => {
  for (const connection of connections) connection.close();
  await db.delete();
  connections.length = 0;
});

describe('transactional quest lifecycle', () => {
  it('deduplicates page statistics and never stores note bodies in events', async () => {
    await Promise.all([
      service.recordView('home_view', 'page-1'),
      service.recordView('home_view', 'page-1'),
    ]);
    expect(await db.outbox.count()).toBe(1);
    const id = await service.accept('1', ordinary, 'a');
    await service.complete(id, 'b', { note: '不能进入统计的正文', city: '不能进入统计的城市' });
    const events = JSON.stringify(await db.outbox.toArray());
    expect(events).not.toContain('不能进入统计');
    expect(events).toContain('hasNote');
  });
  it('serializes two tabs accepting ordinary quests', async () => {
    const otherDb = new LocalDatabase(db.name);
    connections.push(otherDb);
    const other = new QuestService(otherDb, service.profileId, () => now);
    const result = await Promise.allSettled([
      service.accept('1', ordinary, 'a'),
      other.accept('2', ordinary, 'b'),
    ]);
    expect(result.filter((item) => item.status === 'fulfilled')).toHaveLength(1);
    expect(await db.quests.count()).toBe(1);
  });
  it('allows same quest across sources and shares actual completion counts', async () => {
    const first = await service.accept('1', ordinary, 'a');
    const second = await service.accept('1', dailySource, 'b');
    const one = await service.complete(first, 'c', empty);
    const two = await service.complete(second, 'd', empty);
    expect((await db.completions.get(one))?.reward.xp).toBe(10);
    expect((await db.completions.get(two))?.reward.xp).toBe(5);
    expect((await service.growth()).totalXp).toBe(15);
    expect(await db.claims.count()).toBe(1);
    await expect(service.accept('1', dailySource, 'again')).rejects.toThrow();
    const third = await service.accept('1', ordinary, 'e');
    expect((await db.completions.get(await service.complete(third, 'f', empty)))?.reward.xp).toBe(
      2,
    );
  });
  it('uses the same count when daily finishes first, and serializes concurrent completions', async () => {
    const ordinaryId = await service.accept('1', ordinary, 'a');
    const dailyId = await service.accept('1', dailySource, 'b');
    await Promise.all([
      service.complete(dailyId, 'c', empty),
      service.complete(ordinaryId, 'd', empty),
    ]);
    expect(
      (await db.completions.toArray()).map((record) => record.reward.xp).sort((a, b) => a - b),
    ).toEqual([5, 10]);
  });
  it('makes retries idempotent but rejects reused keys and different completion attempts', async () => {
    const id = await service.accept('1', ordinary, 'accept');
    expect(await service.accept('1', ordinary, 'accept')).toBe(id);
    await expect(service.accept('2', ordinary, 'accept')).rejects.toThrow();
    const result = await service.complete(id, 'complete', empty);
    expect(await service.complete(id, 'complete', empty)).toBe(result);
    await expect(service.complete(id, 'different', empty)).rejects.toThrow();
    await expect(service.abandon(id, 'abandon')).rejects.toThrow();
    expect(await db.completions.count()).toBe(1);
    expect(await db.xp.count()).toBe(1);
    expect(await db.attributes.count()).toBe(6);
  });
  it('rolls back every completion write if reward storage fails', async () => {
    const id = await service.accept('1', ordinary, 'a');
    const inject = () => {
      throw new Error('injected failure');
    };
    db.xp.hook('creating', inject);
    await expect(service.complete(id, 'c', empty)).rejects.toThrow('injected failure');
    expect(await db.completions.count()).toBe(0);
    expect((await db.quests.get(id))?.status).toBe('in_progress');
    expect(await db.operations.get('c')).toBeUndefined();
    expect(await db.attributes.count()).toBe(0);
    db.xp.hook('creating').unsubscribe(inject);
    await service.complete(id, 'c', empty);
    expect(await db.completions.count()).toBe(1);
  });
  it('preserves task snapshots and does not reset counts across versions', async () => {
    const id = await service.accept('1', ordinary, 'a');
    await service.cache({
      ...catalog,
      revision: '2',
      serverTime: '2026-09-15T09:00:00.000Z',
      tasks: [{ ...task, title: '新标题', versionId: '1:2' }],
    });
    expect((await db.quests.get(id))?.snapshot.title).toBe(task.title);
    await service.complete(id, 'b', empty);
    const next = await service.accept('1', ordinary, 'c');
    const record = await db.completions.get(await service.complete(next, 'd', empty));
    expect(record?.reward.previousCompletionCount).toBe(1);
  });
  it('abandonment and daily expiry never add completion counts', async () => {
    const id = await service.accept('1', ordinary, 'a');
    await service.abandon(id, 'b');
    const dailyId = await service.accept('1', dailySource, 'c');
    now = new Date('2026-09-15T16:00:00.000Z');
    await expect(service.complete(dailyId, 'd', empty)).rejects.toThrow();
    expect((await db.quests.get(dailyId))?.endReason).toBe('expired');
    expect(await db.completions.count()).toBe(0);
    expect(await db.claims.count()).toBe(0);
    expect((await service.growth()).totalXp).toBe(0);
  });
  it('blocks expired catalog acceptance but allows existing ordinary completion', async () => {
    const id = await service.accept('1', ordinary, 'a');
    now = new Date('2026-09-17T00:00:00Z');
    await service.complete(id, 'b', empty);
    await expect(service.accept('1', ordinary, 'c')).rejects.toThrow();
  });
  it.each([false, true])(
    'applies withdrawal emergency=%s without rewriting history',
    async (emergency) => {
      const id = await service.accept('1', ordinary, 'a');
      await service.cache({
        ...catalog,
        revision: '2',
        serverTime: '2026-09-15T09:00:00.000Z',
        tasks: [],
        withdrawals: [{ questId: '1', emergency }],
      });
      expect((await db.quests.get(id))?.status).toBe(emergency ? 'abandoned' : 'in_progress');
      if (!emergency) await service.complete(id, 'b', empty);
    },
  );
  it('keeps completion-time flags and rewards unchanged during record editing', async () => {
    const id = await service.accept('1', ordinary, 'a');
    const completionId = await service.complete(id, 'b', empty);
    const before = await db.completions.get(completionId);
    await service.saveRecord(completionId, '后来补记', '杭州', undefined);
    expect(await db.completions.get(completionId)).toEqual({
      ...before,
      note: '后来补记',
      city: '杭州',
    });
    expect((await service.growth()).totalXp).toBe(10);
    await expect(
      service.saveRecord(completionId, '字'.repeat(301), '', undefined),
    ).rejects.toThrow();
  });
  it('deletes private data atomically and rejects stale tabs without deleting public cache', async () => {
    const id = await service.accept('1', ordinary, 'a');
    await service.complete(id, 'b', empty);
    const profile = await deletePersonalData(db, service.profileId);
    expect(profile.id).not.toBe(service.profileId);
    expect(await db.completions.count()).toBe(0);
    expect(await db.xp.count()).toBe(0);
    expect(await db.outbox.count()).toBe(0);
    expect(await db.catalog.count()).toBe(1);
    await expect(service.accept('1', ordinary, 'old')).rejects.toThrow();
  });
  it('exports a parseable ZIP with records, snapshots and ledger links', async () => {
    const id = await service.accept('1', ordinary, 'a');
    const completionId = await service.complete(id, 'b', { note: '私密正文', city: '' });
    const files = unzipSync(new Uint8Array(await (await exportArchive(db)).arrayBuffer()));
    const json = files['data.json'];
    expect(json).toBeDefined();
    const data = JSON.parse(strFromU8(json!));
    expect(data.completions[0].id).toBe(completionId);
    expect(data.quests[0].snapshot).toEqual(task);
    expect(data.xp[0].completionId).toBe(completionId);
  });
});
