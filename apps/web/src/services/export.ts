import type { LocalDatabase } from '../data/database';
import { getOrCreateLocalProfile } from '../data/local-profile';

export async function exportArchive(db: LocalDatabase): Promise<Blob> {
  const { strToU8, zip } = await import('fflate');
  const snapshot = await db.transaction('r', db.tables, async () => ({
    profile: await db.profiles.toArray(),
    quests: await db.quests.toArray(),
    completions: await db.completions.toArray(),
    photos: await db.photos.toArray(),
    xp: await db.xp.toArray(),
    attributes: await db.attributes.toArray(),
    claims: await db.claims.toArray(),
    favorites: await db.favorites.toArray(),
    operations: await db.operations.toArray(),
    events: await db.outbox.toArray(),
  }));
  const files: Record<string, Uint8Array> = {};
  for (const photo of snapshot.photos)
    files[`photos/${photo.id}.jpg`] = new Uint8Array(await photo.blob.arrayBuffer());
  files['data.json'] = strToU8(
    JSON.stringify(
      {
        schemaVersion: 1,
        exportedAt: new Date().toISOString(),
        ...snapshot,
        photos: snapshot.photos.map(({ id, size, mimeType }) => ({
          id,
          size,
          mimeType,
          path: `photos/${id}.jpg`,
        })),
      },
      null,
      2,
    ),
  );
  files['README.txt'] = strToU8(
    '人生支线私密本地导出。data.json 保存身份、任务快照、存档、流水和关联标识；photos/ 保存照片。请妥善保管。可在人生支线设置页选择此 ZIP，预览并明确确认后替换恢复全部个人记录；导入前请先导出当前需要保留的数据。',
  );
  const bytes = await new Promise<Uint8Array>((resolve, reject) =>
    zip(files, { level: 1 }, (error, result) => (error ? reject(error) : resolve(result))),
  );
  return new Blob([new Uint8Array(bytes)], { type: 'application/zip' });
}

/** UI must obtain explicit confirmation. Serialization and identity checks prevent stale-tab writes. */
export async function deletePersonalData(db: LocalDatabase, expectedProfileId: string) {
  return db.transaction('rw', db.tables, async () => {
    if ((await db.profiles.get('local'))?.id !== expectedProfileId)
      throw new Error('身份已变化，请刷新页面。');
    for (const table of db.tables) {
      if (!['catalog', 'daily'].includes(table.name)) await table.clear();
    }
    return getOrCreateLocalProfile(db);
  });
}
