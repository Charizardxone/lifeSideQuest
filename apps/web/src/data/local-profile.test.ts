import { afterEach, describe, expect, it } from 'vitest';
import { LocalDatabase } from './database';
import { getOrCreateLocalProfile, LocalStorageError } from './local-profile';

const databases: LocalDatabase[] = [];
function connect(name = `sidequest-test-${crypto.randomUUID()}`) {
  const db = new LocalDatabase(name);
  databases.push(db);
  return db;
}

afterEach(async () => {
  for (const db of databases) db.close();
  for (const db of databases) await db.delete();
  databases.length = 0;
});

describe('local anonymous identity', () => {
  it('creates a single random identity and reuses it', async () => {
    const db = connect();
    const profile = await getOrCreateLocalProfile(db);
    expect(profile.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(profile.schemaVersion).toBe(1);
    expect(await getOrCreateLocalProfile(db)).toEqual(profile);
    expect(await db.profiles.count()).toBe(1);
  });

  it('persists after closing and opening a new connection', async () => {
    const first = connect();
    const profile = await getOrCreateLocalProfile(first);
    first.close();
    expect(await getOrCreateLocalProfile(connect(first.name))).toEqual(profile);
  });

  it('serializes concurrent initialization across independent connections', async () => {
    const first = connect();
    const second = connect(first.name);
    const profiles = await Promise.all(
      Array.from({ length: 12 }, (_, index) =>
        getOrCreateLocalProfile(index % 2 === 0 ? first : second),
      ),
    );
    expect(new Set(profiles.map((profile) => profile.id)).size).toBe(1);
    expect(await first.profiles.count()).toBe(1);
  });

  it('does not overwrite a malformed stored identity', async () => {
    const db = connect();
    const profile = await getOrCreateLocalProfile(db);
    await db.profiles.update('local', { id: 'broken' });
    await expect(getOrCreateLocalProfile(db)).rejects.toBeInstanceOf(LocalStorageError);
    expect(await db.profiles.get('local')).toEqual({ ...profile, id: 'broken' });
  });

  it('rolls back a write when the enclosing transaction fails', async () => {
    const db = connect();
    await expect(
      db.transaction('rw', db.profiles, async () => {
        await getOrCreateLocalProfile(db);
        throw new Error('injected failure');
      }),
    ).rejects.toThrow('injected failure');
    expect(await db.profiles.count()).toBe(0);
    await expect(getOrCreateLocalProfile(db)).resolves.toHaveProperty('id');
  });

  it('reports a closed connection without silently using ephemeral identity', async () => {
    const db = connect();
    await db.open();
    db.close();
    await expect(getOrCreateLocalProfile(db)).rejects.toBeInstanceOf(LocalStorageError);
  });

  it('keeps the old identity when a later migration fails', async () => {
    const original = connect();
    const profile = await getOrCreateLocalProfile(original);
    original.close();
    const upgrade = connect(original.name);
    upgrade
      .version(3)
      .stores({ profiles: 'key, &id, createdAt' })
      .upgrade(async (transaction) => {
        await transaction.table('profiles').update('local', { id: crypto.randomUUID() });
        throw new Error('injected migration failure');
      });
    await expect(upgrade.open()).rejects.toThrow('injected migration failure');
    upgrade.close();
    const reopened = connect(original.name);
    expect(await getOrCreateLocalProfile(reopened)).toEqual(profile);
    expect(reopened.verno).toBe(2);
  });

  it('closes the old connection and signals the caller before a version upgrade', async () => {
    let notified = false;
    const original = new LocalDatabase(`sidequest-test-${crypto.randomUUID()}`, {
      onVersionChange: () => {
        notified = true;
      },
    });
    databases.push(original);
    const profile = await getOrCreateLocalProfile(original);
    const upgrade = connect(original.name);
    upgrade.version(3).stores({ profiles: 'key, &id, createdAt' });
    await upgrade.open();
    expect(notified).toBe(true);
    expect(original.isOpen()).toBe(false);
    expect(await upgrade.profiles.get('local')).toEqual(profile);
  });
});
