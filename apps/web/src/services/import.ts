import { ATTRIBUTES, archiveSchema } from '@sidequest/contracts';
import type { ArchiveData } from '@sidequest/contracts';
import { calculateCompletionReward, getBeijingDate } from '@sidequest/domain';
import type { LocalDatabase } from '../data/database';
import type {
  AttributeEntry,
  Claim,
  Completion,
  Favorite,
  LocalEvent,
  Operation,
  Photo,
  UserQuest,
  XpEntry,
} from '../data/models';

export const MAX_ARCHIVE_BYTES = 64 * 1024 * 1024;
const MAX_EXPANDED_BYTES = 128 * 1024 * 1024;
const MAX_JSON_BYTES = 16 * 1024 * 1024;
function fail(message: string): never {
  throw new Error(message);
}
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value !== null && typeof value === 'object')
    return `{${Object.entries(value)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`)
      .join(',')}}`;
  return JSON.stringify(value) ?? 'null';
}
function unique<T>(rows: T[], key: (row: T) => string, name: string) {
  const map = new Map<string, T>();
  for (const row of rows) {
    const value = key(row);
    if (map.has(value)) fail(`备份包含重复的${name}，无法导入。`);
    map.set(value, row);
  }
  return map;
}
export interface PersonalRows {
  quests: UserQuest[];
  completions: Completion[];
  photos: Photo[];
  xp: XpEntry[];
  attributes: AttributeEntry[];
  claims: Claim[];
  favorites: Favorite[];
  operations: Operation[];
  events: LocalEvent[];
}
function validateRelations(data: PersonalRows) {
  const quests = unique(data.quests, (q) => q.id, '任务');
  const completions = unique(data.completions, (c) => c.id, '存档');
  const byExecution = unique(data.completions, (c) => c.userQuestId, '任务完成记录');
  const photos = unique(data.photos, (p) => p.id, '照片');
  const xp = unique(data.xp, (x) => x.completionId, '经验流水');
  const attributes = unique(
    data.attributes,
    (a) => JSON.stringify([a.completionId, a.attribute]),
    '属性流水',
  );
  const claims = unique(data.claims, (c) => c.businessDate, '今日领奖日期');
  unique(data.claims, (c) => c.completionId, '今日领奖记录');
  unique(data.favorites, (f) => f.questId, '想做记录');
  unique(data.operations, (o) => o.operationId, '操作记录');
  unique(data.events, (e) => e.eventId, '统计事件');
  unique(
    data.quests.filter((q) => q.status === 'in_progress'),
    (q) => q.source.kind,
    '进行中名额',
  );
  const usedPhotos = new Set<string>();
  for (const q of data.quests) {
    if (q.questId !== q.snapshot.questId) fail('任务与快照关联不一致。');
    if (
      q.source.kind === 'daily' &&
      getBeijingDate(new Date(q.acceptedAt)) !== q.source.businessDate
    )
      fail('今日支线接取日期不一致。');
    if (
      q.status === 'in_progress' &&
      q.source.kind === 'daily' &&
      claims.has(q.source.businessDate)
    )
      fail('今日奖励已领取，不能同时存在同日进行中的支线。');
    if (q.status === 'in_progress') {
      if (q.activeSlot !== q.source.kind || q.endedAt || q.endReason || byExecution.has(q.id))
        fail('进行中任务状态不一致。');
    } else {
      if (q.activeSlot || !q.endedAt || Date.parse(q.endedAt) < Date.parse(q.acceptedAt))
        fail('已结束任务状态或时间不一致。');
      if (
        q.status === 'completed'
          ? !byExecution.has(q.id) || Boolean(q.endReason)
          : byExecution.has(q.id) || !q.endReason
      )
        fail('任务终态与存档不一致。');
    }
  }
  const groups = new Map<string, Completion[]>();
  for (const c of data.completions) {
    const q = quests.get(c.userQuestId);
    if (!q || q.status !== 'completed' || q.questId !== c.questId || q.endedAt !== c.completedAt)
      fail('存档缺少对应任务或完成时间不一致。');
    const group = groups.get(c.questId) ?? [];
    group.push(c);
    groups.set(c.questId, group);
    const expected = calculateCompletionReward(
      q.snapshot.rewards,
      c.reward.previousCompletionCount,
    );
    if (
      canonical(c.reward) !== canonical(expected) ||
      xp.get(c.id)?.delta !== c.reward.xp ||
      ATTRIBUTES.some(
        (a) => attributes.get(JSON.stringify([c.id, a]))?.delta !== c.reward.attributes[a],
      )
    )
      fail('存档奖励与规则或流水不一致，无法导入。');
    if (
      q.source.kind === 'daily' &&
      (claims.get(q.source.businessDate)?.completionId !== c.id ||
        getBeijingDate(new Date(c.completedAt)) !== q.source.businessDate)
    )
      fail('今日支线日期或领奖记录不一致。');
    if (c.photoId) {
      if (!photos.has(c.photoId) || usedPhotos.has(c.photoId)) fail('存档照片缺失或关联重复。');
      usedPhotos.add(c.photoId);
    }
  }
  for (const group of groups.values()) {
    group.sort((a, b) => a.reward.previousCompletionCount - b.reward.previousCompletionCount);
    if (group.some((c, i) => c.reward.previousCompletionCount !== i))
      fail('同一任务的完成次数冲突或历史不完整；不会重新计算或覆盖已发奖励。');
  }
  if (
    xp.size !== completions.size ||
    attributes.size !== completions.size * ATTRIBUTES.length ||
    usedPhotos.size !== photos.size
  )
    fail('备份包含未关联的照片或奖励流水。');
  for (const claim of data.claims) {
    const q = quests.get(completions.get(claim.completionId)?.userQuestId ?? '');
    if (!q || q.source.kind !== 'daily' || q.source.businessDate !== claim.businessDate)
      fail('今日领奖记录缺少对应存档。');
  }
  for (const favorite of data.favorites)
    if (favorite.questId !== favorite.snapshot.questId) fail('想做记录与快照不一致。');
  for (const operation of data.operations) {
    if (!quests.has(operation.resultId) && !completions.has(operation.resultId))
      fail('操作记录缺少对应任务或存档。');
    let value: unknown;
    try {
      value = JSON.parse(operation.fingerprint);
    } catch {
      fail('操作记录格式不正确。');
    }
    if (!Array.isArray(value) || !['accept', 'complete', 'abandon'].includes(value[0] as string))
      fail('操作记录类型不支持。');
    if (
      value[0] === 'complete'
        ? completions.get(operation.resultId)?.userQuestId !== value[1]
        : value[0] === 'abandon'
          ? operation.resultId !== value[1]
          : quests.get(operation.resultId)?.questId !== value[1]
    )
      fail('操作记录关联不一致。');
  }
  for (const event of data.events)
    if (
      event.userQuestId &&
      (!quests.has(event.userQuestId) || quests.get(event.userQuestId)?.questId !== event.questId)
    )
      fail('统计事件关联不一致。');
}
export interface PreparedArchive {
  exportedAt: string;
  createdAt: string;
  data: PersonalRows;
}
/** Parse and validate in memory only. No upload or database writes. */
export async function readArchive(file: Blob): Promise<PreparedArchive> {
  if (!file.size || file.size > MAX_ARCHIVE_BYTES) fail('请选择不超过 64MB 的人生支线 ZIP 备份。');
  const { unzip } = await import('fflate');
  const bytes = new Uint8Array(await file.arrayBuffer());
  let expanded = 0;
  const names = new Set<string>();
  let invalid = false;
  let files: Record<string, Uint8Array>;
  try {
    files = await new Promise((resolve, reject) =>
      unzip(
        bytes,
        {
          filter: (entry) => {
            expanded += entry.originalSize;
            const allowed =
              entry.name === 'data.json' ||
              entry.name === 'README.txt' ||
              /^photos\/[a-zA-Z0-9_-]+\.jpg$/.test(entry.name);
            if (
              !allowed ||
              names.has(entry.name) ||
              names.size >= 10002 ||
              expanded > MAX_EXPANDED_BYTES ||
              entry.originalSize >
                (entry.name === 'data.json'
                  ? MAX_JSON_BYTES
                  : entry.name === 'README.txt'
                    ? 65536
                    : 1024 * 1024)
            )
              invalid = true;
            names.add(entry.name);
            return !invalid;
          },
        },
        (error, result) => (error ? reject(error) : resolve(result)),
      ),
    );
  } catch {
    fail('ZIP 无法解压或已损坏，请重新选择原始导出文件。');
  }
  if (invalid)
    fail('备份包含重复/不支持的文件，或解压大小超出限制（总计 128MB，数据 16MB，单张照片 1MB）。');
  if (!files['data.json']) fail('备份缺少 data.json，请选择人生支线导出的 ZIP 文件。');
  let parsed: ArchiveData;
  try {
    parsed = archiveSchema.parse(
      JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(files['data.json'])),
    );
  } catch {
    fail('备份数据格式、版本或字段不合法。目前仅支持人生支线 schemaVersion 1 的 ZIP 导出。');
  }
  const profileId = parsed.profile[0]!.id;
  for (const row of [
    ...parsed.quests,
    ...parsed.completions,
    ...parsed.operations,
    ...parsed.events,
  ])
    if (row.profileId !== profileId) fail('备份中混有不同身份的数据。');
  const photos = parsed.photos.map((photo) => {
    const bytes = files[photo.path];
    if (
      photo.path !== `photos/${photo.id}.jpg` ||
      !bytes ||
      bytes.byteLength !== photo.size ||
      bytes[0] !== 255 ||
      bytes[1] !== 216 ||
      bytes[bytes.length - 2] !== 255 ||
      bytes[bytes.length - 1] !== 217
    )
      fail('照片文件缺失、格式错误或大小不符。');
    return {
      id: photo.id,
      size: photo.size,
      mimeType: photo.mimeType,
      blob: new Blob([new Uint8Array(bytes)], { type: photo.mimeType }),
    };
  });
  if (Object.keys(files).filter((name) => name.startsWith('photos/')).length !== photos.length)
    fail('备份包含未关联的照片文件。');
  if (typeof createImageBitmap === 'function') {
    for (const photo of photos) {
      try {
        const image = await createImageBitmap(photo.blob);
        const oversized = Math.max(image.width, image.height) > 1920;
        image.close();
        if (oversized) fail('照片尺寸超过限制。');
      } catch {
        fail('照片无法解码或尺寸超过 1920px，请使用原始导出文件。');
      }
    }
  }
  const data = { ...parsed, photos } as PersonalRows;
  validateRelations(data);
  return { exportedAt: parsed.exportedAt, createdAt: parsed.profile[0]!.createdAt, data };
}

async function readLocal(db: LocalDatabase): Promise<PersonalRows> {
  return {
    quests: await db.quests.toArray(),
    completions: await db.completions.toArray(),
    photos: await db.photos.toArray(),
    xp: await db.xp.toArray(),
    attributes: await db.attributes.toArray(),
    claims: await db.claims.toArray(),
    favorites: await db.favorites.toArray(),
    operations: await db.operations.toArray(),
    events: await db.outbox.toArray(),
  };
}
function remap(data: PersonalRows, profileId: string): PersonalRows {
  return {
    ...data,
    quests: data.quests.map((q) => ({ ...q, profileId })),
    completions: data.completions.map((c) => ({ ...c, profileId })),
    operations: data.operations.map((o) => ({ ...o, profileId })),
    events: data.events.map((e) => ({ ...e, profileId })),
  };
}
export interface ImportSummary {
  quests: number;
  completions: number;
  photos: number;
  favorites: number;
  xp: number;
}
export interface ImportPreview {
  backup: ImportSummary;
  current: ImportSummary;
  signature: string;
}
function summarize(data: PersonalRows): ImportSummary {
  return {
    quests: data.quests.length,
    completions: data.completions.length,
    photos: data.photos.length,
    favorites: data.favorites.length,
    xp: data.xp.reduce((sum, row) => sum + row.delta, 0),
  };
}
/** A read-only preview. The signature prevents replacing data changed since confirmation was prepared. */
export async function previewArchive(
  db: LocalDatabase,
  prepared: PreparedArchive,
  expectedProfileId: string,
): Promise<ImportPreview> {
  validateRelations(prepared.data);
  return db.transaction('r', db.tables, async () => {
    if ((await db.profiles.get('local'))?.id !== expectedProfileId)
      fail('身份已变化，请刷新页面后重新选择备份。');
    const current = await readLocal(db);
    return {
      backup: summarize(prepared.data),
      current: summarize(current),
      signature: canonical(current),
    };
  });
}
/** Called only after explicit replacement confirmation. Any failed write rolls back the entire restore. */
export async function importArchive(
  db: LocalDatabase,
  prepared: PreparedArchive,
  expectedProfileId: string,
  preview: ImportPreview,
  now = new Date(),
): Promise<ImportSummary> {
  validateRelations(prepared.data);
  return db.transaction('rw', db.tables, async () => {
    if ((await db.profiles.get('local'))?.id !== expectedProfileId)
      fail('身份已变化，请刷新页面后重新选择备份。');
    if (canonical(await readLocal(db)) !== preview.signature)
      fail('当前记录在预览后发生了变化，请重新选择备份，核对新的预览后再确认。');
    const profileId = crypto.randomUUID();
    const incoming = remap(prepared.data, profileId);
    const catalog = await db.catalog.get('catalog');
    const today = getBeijingDate(now);
    incoming.quests = incoming.quests.map((q) => {
      if (q.status !== 'in_progress') return q;
      const expired = q.source.kind === 'daily' && q.source.businessDate < today;
      const unsafe = catalog?.withdrawals.some((w) => w.questId === q.questId && w.emergency);
      if (!expired && !unsafe) return q;
      const { activeSlot: _slot, ...rest } = q;
      void _slot;
      const endedAt =
        expired && q.source.kind === 'daily'
          ? new Date(Date.parse(`${q.source.businessDate}T00:00:00+08:00`) + 86400000).toISOString()
          : now.toISOString();
      incoming.events.push({
        eventId: crypto.randomUUID(),
        profileId,
        name: 'quest_abandon',
        userQuestId: q.id,
        questId: q.questId,
        occurredAt: endedAt,
      });
      return { ...rest, status: 'abandoned', endReason: expired ? 'expired' : 'safety', endedAt };
    });
    validateRelations(incoming);
    for (const table of [
      db.profiles,
      db.quests,
      db.completions,
      db.photos,
      db.xp,
      db.attributes,
      db.claims,
      db.favorites,
      db.operations,
      db.outbox,
    ])
      await table.clear();
    await db.profiles.add({
      key: 'local',
      id: profileId,
      createdAt: prepared.createdAt,
      schemaVersion: 1,
    });
    await db.quests.bulkAdd(incoming.quests);
    await db.completions.bulkAdd(incoming.completions);
    await db.photos.bulkAdd(incoming.photos);
    await db.xp.bulkAdd(incoming.xp);
    await db.attributes.bulkAdd(incoming.attributes);
    await db.claims.bulkAdd(incoming.claims);
    await db.favorites.bulkAdd(incoming.favorites);
    await db.operations.bulkAdd(incoming.operations);
    await db.outbox.bulkAdd(incoming.events);
    return summarize(incoming);
  });
}
