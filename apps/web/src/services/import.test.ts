import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import { EXAMPLE_QUEST } from '@sidequest/contracts';
import type { ArchiveData, Catalog, Daily, QuestSnapshot } from '@sidequest/contracts';
import { LocalDatabase } from '../data/database';
import { getOrCreateLocalProfile } from '../data/local-profile';
import { QuestService } from './quests';
import { exportArchive } from './export';
import { importArchive, previewArchive, readArchive } from './import';

const now = new Date('2026-09-16T08:00:00Z');
const snapshot: QuestSnapshot = {
  ...EXAMPLE_QUEST,
  questId: '1',
  versionId: '1:1',
  publishedAt: '2026-09-15T00:00:00Z',
};
const catalog: Catalog = {
  schemaVersion: 1,
  revision: '1',
  serverTime: now.toISOString(),
  expiresAt: '2026-09-17T08:00:00Z',
  tasks: [snapshot, { ...snapshot, questId: '2', versionId: '2:1' }],
  withdrawals: [],
};
const daily: Daily = {
  schemaVersion: 1,
  dailyId: 'today',
  businessDate: '2026-09-16',
  timezone: 'Asia/Shanghai',
  revision: '1',
  serverTime: now.toISOString(),
  snapshot,
};
let source: LocalDatabase;
let target: LocalDatabase;
let sourceService: QuestService;
let targetService: QuestService;
let backup: Blob;
let completionId: string;
async function database() {
  const db = new LocalDatabase(`import-test-${crypto.randomUUID()}`);
  const p = await getOrCreateLocalProfile(db);
  const service = new QuestService(db, p.id, () => now);
  await service.cache(catalog, daily);
  return { db, service };
}
beforeEach(async () => {
  ({ db: source, service: sourceService } = await database());
  ({ db: target, service: targetService } = await database());
  const id = await sourceService.accept('1', { kind: 'ordinary' }, 'accept');
  completionId = await sourceService.complete(id, 'complete', {
    note: '备份中的记忆',
    city: '杭州',
    photo: {
      id: 'photo-1',
      blob: new Blob([new Uint8Array([255, 216, 255, 217])], { type: 'image/jpeg' }),
      size: 4,
      mimeType: 'image/jpeg',
    },
  });
  await sourceService.favorite('2', true);
  await sourceService.accept('2', { kind: 'ordinary' }, 'active');
  backup = await exportArchive(source);
});
afterEach(async () => {
  await source.delete();
  await target.delete();
});
async function rewrite(mutate: (data: ArchiveData, files: Record<string, Uint8Array>) => void) {
  const files = unzipSync(new Uint8Array(await backup.arrayBuffer()));
  const data = JSON.parse(strFromU8(files['data.json']!)) as ArchiveData;
  mutate(data, files);
  files['data.json'] = strToU8(JSON.stringify(data));
  return new Blob([new Uint8Array(zipSync(files))], { type: 'application/zip' });
}
async function restore(db = target, service = targetService, file = backup, date = now) {
  const prepared = await readArchive(file);
  const preview = await previewArchive(db, prepared, service.profileId);
  return importArchive(db, prepared, service.profileId, preview, date);
}
describe('private ZIP replacement restore', () => {
  it('previews without writes, replaces all personal data, preserves snapshots/photos/cache, and invalidates stale tabs', async () => {
    const old = await targetService.accept('2', { kind: 'ordinary' }, 'old');
    const oldCompletion = await targetService.complete(old, 'old-complete', {
      note: '将被替换',
      city: '',
    });
    const prepared = await readArchive(backup);
    const preview = await previewArchive(target, prepared, targetService.profileId);
    expect(preview.backup).toEqual({ quests: 2, completions: 1, photos: 1, favorites: 1, xp: 10 });
    expect(await target.completions.get(oldCompletion)).toBeDefined();
    expect(await target.completions.get(completionId)).toBeUndefined();
    await importArchive(target, prepared, targetService.profileId, preview, now);
    expect(await target.completions.get(oldCompletion)).toBeUndefined();
    expect((await target.completions.get(completionId))?.note).toBe('备份中的记忆');
    expect(await target.quests.count()).toBe(2);
    expect(await target.favorites.count()).toBe(1);
    expect(new Uint8Array(await (await target.photos.get('photo-1'))!.blob.arrayBuffer())).toEqual(
      new Uint8Array([255, 216, 255, 217]),
    );
    expect(await target.catalog.get('catalog')).toEqual({ ...catalog, key: 'catalog' });
    expect(await target.daily.get('daily')).toEqual({ ...daily, key: 'daily' });
    const profile = (await target.profiles.get('local'))!;
    expect(profile.id).not.toBe(targetService.profileId);
    expect(profile.id).not.toBe(sourceService.profileId);
    expect((await target.completions.toArray()).every((c) => c.profileId === profile.id)).toBe(
      true,
    );
    await expect(targetService.abandon(old, 'stale')).rejects.toThrow('重置');
    const resumed = new QuestService(target, profile.id, () => now);
    const active = (await target.quests.where('status').equals('in_progress').first())!;
    await resumed.complete(active.id, 'after-restore', { note: '', city: '' });
    expect((await resumed.growth()).totalXp).toBe(20);
  });
  it('replacing with the same backup never accumulates rewards or completion rows', async () => {
    await restore();
    const service = new QuestService(target, (await target.profiles.get('local'))!.id, () => now);
    await restore(target, service);
    expect(await target.completions.count()).toBe(1);
    expect((await service.growth()).totalXp).toBe(10);
    expect(await target.xp.count()).toBe(1);
    expect(await target.attributes.count()).toBe(6);
  });
  it('rejects stale previews and stale identities without deleting records', async () => {
    const prepared = await readArchive(backup);
    const preview = await previewArchive(target, prepared, targetService.profileId);
    await targetService.favorite('1', true);
    await expect(
      importArchive(target, prepared, targetService.profileId, preview, now),
    ).rejects.toThrow('预览后');
    expect(await target.favorites.count()).toBe(1);
    await expect(previewArchive(target, prepared, 'old-profile')).rejects.toThrow('身份');
  });
  it('rolls back every cleared table and identity when any restore write fails', async () => {
    const old = await targetService.accept('2', { kind: 'ordinary' }, 'old');
    const originalProfile = await target.profiles.get('local');
    const broken = () => {
      throw new Error('模拟磁盘写入失败');
    };
    target.photos.hook('creating', broken);
    await expect(restore()).rejects.toThrow('模拟磁盘');
    target.photos.hook('creating').unsubscribe(broken);
    expect(await target.profiles.get('local')).toEqual(originalProfile);
    expect((await target.quests.get(old))?.status).toBe('in_progress');
    expect(await target.completions.count()).toBe(0);
    expect(await target.xp.count()).toBe(0);
    await restore();
    expect(await target.completions.count()).toBe(1);
  });
  it('expires old daily quests without granting rewards and applies known safety withdrawals', async () => {
    await sourceService.accept(
      '1',
      { kind: 'daily', dailyId: 'today', businessDate: '2026-09-16' },
      'daily',
    );
    const file = await exportArchive(source);
    await targetService.cache({
      ...catalog,
      revision: '2',
      withdrawals: [{ questId: '2', emergency: true }],
    });
    await restore(target, targetService, file, new Date('2026-09-16T16:00:00Z'));
    const quests = await target.quests.toArray();
    expect(quests.find((q) => q.source.kind === 'daily')?.endReason).toBe('expired');
    expect(quests.find((q) => q.questId === '2')?.endReason).toBe('safety');
    expect(await target.quests.where('status').equals('in_progress').count()).toBe(0);
    expect(await target.claims.count()).toBe(0);
    expect(await target.completions.count()).toBe(1);
    expect((await target.outbox.toArray()).filter((e) => e.name === 'quest_abandon')).toHaveLength(
      2,
    );
  });
  it('restores daily claims and repeat reward history, preventing a second claim', async () => {
    const id = await sourceService.accept(
      '1',
      { kind: 'daily', dailyId: 'today', businessDate: '2026-09-16' },
      'daily',
    );
    await sourceService.complete(id, 'daily-complete', { note: '', city: '' });
    await restore(target, targetService, await exportArchive(source));
    const service = new QuestService(target, (await target.profiles.get('local'))!.id, () => now);
    expect((await service.growth()).totalXp).toBe(15);
    await expect(
      service.accept('1', { kind: 'daily', dailyId: 'today', businessDate: '2026-09-16' }, 'again'),
    ).rejects.toThrow();
  });
  it.each([
    [
      'missing photo',
      (d: ArchiveData, files: Record<string, Uint8Array>) => {
        delete files[d.photos[0]!.path];
      },
    ],
    [
      'mismatched reward',
      (d: ArchiveData) => {
        d.xp[0]!.delta = 999;
      },
    ],
    [
      'dangling completion',
      (d: ArchiveData) => {
        d.completions[0]!.userQuestId = 'missing';
      },
    ],
    [
      'duplicate completion',
      (d: ArchiveData) => {
        d.completions.push(d.completions[0]!);
      },
    ],
    [
      'incomplete history',
      (d: ArchiveData) => {
        d.completions[0]!.reward.previousCompletionCount = 4;
      },
    ],
    [
      'invalid snapshot',
      (d: ArchiveData) => {
        d.quests[0]!.snapshot.safetyNotes = '';
      },
    ],
    [
      'mixed identity',
      (d: ArchiveData) => {
        d.completions[0]!.profileId = 'other';
      },
    ],
    [
      'duplicate active slots',
      (d: ArchiveData) => {
        const active = d.quests.find((q) => q.status === 'in_progress')!;
        d.quests.push({ ...active, id: 'another' });
      },
    ],
    [
      'unexpected file',
      (_d: ArchiveData, files: Record<string, Uint8Array>) => {
        files['../other'] = strToU8('bad');
      },
    ],
  ])('rejects %s before changing current data', async (_name, mutate) => {
    const id = await targetService.accept('2', { kind: 'ordinary' }, 'keep');
    await expect(readArchive(await rewrite(mutate))).rejects.toThrow();
    expect((await target.quests.get(id))?.status).toBe('in_progress');
    expect(await target.profiles.get('local')).toMatchObject({ id: targetService.profileId });
  });
  it('rejects unsupported versions, invalid ZIP and oversized expanded data', async () => {
    await expect(
      readArchive(
        await rewrite((d) => {
          Object.assign(d, { schemaVersion: 99 });
        }),
      ),
    ).rejects.toThrow('版本');
    await expect(readArchive(new Blob(['not a zip']))).rejects.toThrow('ZIP');
    await expect(
      readArchive(
        new Blob([new Uint8Array(zipSync({ 'data.json': new Uint8Array(17 * 1024 * 1024) }))]),
      ),
    ).rejects.toThrow('大小');
  });
});
