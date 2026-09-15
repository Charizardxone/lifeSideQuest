import type {
  Attribute,
  Catalog,
  Daily,
  QuestSnapshot,
  UserQuestStatus,
} from '@sidequest/contracts';
import type { CompletionReward } from '@sidequest/domain';

export type Source =
  { kind: 'ordinary' } | { kind: 'daily'; businessDate: string; dailyId: string };
export interface UserQuest {
  id: string;
  profileId: string;
  questId: string;
  snapshot: QuestSnapshot;
  source: Source;
  status: UserQuestStatus;
  acceptedAt: string;
  endedAt?: string;
  endReason?: 'user' | 'expired' | 'safety';
  activeSlot?: 'ordinary' | 'daily';
}
export interface Completion {
  id: string;
  profileId: string;
  userQuestId: string;
  questId: string;
  completedAt: string;
  note: string;
  city: string;
  photoId?: string;
  reward: CompletionReward;
  hasNoteAtCompletion: boolean;
  hasImageAtCompletion: boolean;
}
export interface Photo {
  id: string;
  blob: Blob;
  mimeType: string;
  size: number;
}
export interface XpEntry {
  completionId: string;
  delta: number;
}
export interface AttributeEntry {
  completionId: string;
  attribute: Attribute;
  delta: number;
}
export interface Claim {
  businessDate: string;
  completionId: string;
}
export interface Favorite {
  questId: string;
  snapshot: QuestSnapshot;
  createdAt: string;
}
export interface Operation {
  operationId: string;
  profileId: string;
  fingerprint: string;
  resultId: string;
}
export interface LocalEvent {
  eventId: string;
  profileId: string;
  name:
    | 'quest_accept'
    | 'quest_abandon'
    | 'quest_complete'
    | 'home_view'
    | 'recommend_request'
    | 'quest_impression'
    | 'quest_reroll'
    | 'daily_quest_view'
    | 'profile_view';
  userQuestId?: string;
  questId?: string;
  occurredAt: string;
  hasNote?: boolean;
  hasImage?: boolean;
}
export interface CatalogRow extends Catalog {
  key: 'catalog';
}
export interface DailyRow extends Daily {
  key: 'daily';
}
