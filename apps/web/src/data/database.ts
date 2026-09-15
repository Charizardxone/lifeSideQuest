import Dexie from 'dexie';
import type { Table } from 'dexie';
import type {
  AttributeEntry,
  CatalogRow,
  Claim,
  Completion,
  DailyRow,
  Favorite,
  LocalEvent,
  Operation,
  Photo,
  UserQuest,
  XpEntry,
} from './models';

export interface LocalProfile {
  key: 'local';
  id: string;
  createdAt: string;
  schemaVersion: 1;
}

export interface DatabaseEvents {
  onBlocked?: () => void;
  onVersionChange?: () => void;
}

/** No eager connection or destructive fallback. Extend through explicit version migrations. */
export class LocalDatabase extends Dexie {
  readonly profiles: Table<LocalProfile, 'local'>;
  readonly quests: Table<UserQuest, string>;
  readonly completions: Table<Completion, string>;
  readonly photos: Table<Photo, string>;
  readonly xp: Table<XpEntry, string>;
  readonly attributes: Table<AttributeEntry, [string, string]>;
  readonly claims: Table<Claim, string>;
  readonly favorites: Table<Favorite, string>;
  readonly operations: Table<Operation, string>;
  readonly outbox: Table<LocalEvent, string>;
  readonly catalog: Table<CatalogRow, 'catalog'>;
  readonly daily: Table<DailyRow, 'daily'>;

  constructor(name = 'sidequest-local', events: DatabaseEvents = {}) {
    super(name);
    this.version(1).stores({ profiles: 'key, &id' });
    this.version(2).stores({
      quests: 'id, questId, status, &activeSlot, acceptedAt',
      completions: 'id, &userQuestId, questId, completedAt',
      photos: 'id',
      xp: 'completionId',
      attributes: '[completionId+attribute], completionId',
      claims: 'businessDate, &completionId',
      favorites: 'questId, createdAt',
      operations: 'operationId',
      outbox: 'eventId, occurredAt',
      catalog: 'key',
      daily: 'key',
    });
    this.profiles = this.table('profiles');
    this.quests = this.table('quests');
    this.completions = this.table('completions');
    this.photos = this.table('photos');
    this.xp = this.table('xp');
    this.attributes = this.table('attributes');
    this.claims = this.table('claims');
    this.favorites = this.table('favorites');
    this.operations = this.table('operations');
    this.outbox = this.table('outbox');
    this.catalog = this.table('catalog');
    this.daily = this.table('daily');
    this.on('blocked', () => events.onBlocked?.());
    this.on('versionchange', () => {
      this.close();
      events.onVersionChange?.();
    });
  }
}
