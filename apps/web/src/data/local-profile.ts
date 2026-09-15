import type { LocalDatabase, LocalProfile } from './database';

export class LocalStorageError extends Error {
  constructor(cause: unknown) {
    super('无法读取或保存本地数据，请检查浏览器存储权限；已有数据不会被自动清除。', { cause });
    this.name = 'LocalStorageError';
  }
}

function validateProfile(profile: LocalProfile): LocalProfile {
  if (
    profile.key !== 'local' ||
    profile.schemaVersion !== 1 ||
    typeof profile.id !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(profile.id) ||
    typeof profile.createdAt !== 'string' ||
    !Number.isFinite(Date.parse(profile.createdAt))
  ) {
    throw new Error('Invalid local profile; refusing to replace existing data');
  }
  return profile;
}

/** The singleton read and insert share a write transaction, including across browser tabs. */
export async function getOrCreateLocalProfile(db: LocalDatabase): Promise<LocalProfile> {
  try {
    return await db.transaction('rw', db.profiles, async () => {
      const existing = await db.profiles.get('local');
      if (existing) return validateProfile(existing);
      const profile: LocalProfile = {
        key: 'local',
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        schemaVersion: 1,
      };
      await db.profiles.add(profile);
      return profile;
    });
  } catch (error) {
    throw new LocalStorageError(error);
  }
}
