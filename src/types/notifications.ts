export interface PrSnapshot {
  id: number | string;
  number: number;
  title: string;
  url: string;
  repository: { name: string; fullName: string };
  author: { login: string; avatarUrl?: string };
}

export type NotificationEventType =
  | 'new_pr'
  | 'ready_to_merge'
  | 'merged'
  | 'changes_requested';

export type ToneId = 'chime' | 'bell' | 'pop' | 'none';

export interface NotificationEvent {
  type: NotificationEventType;
  pr: PrSnapshot;
  message: string;
  timestamp: number;
}

export interface NotificationItem extends NotificationEvent {
  id: string;
  read: boolean;
}

export interface NotificationSettings {
  /** Master toggle for sound. The bell badge still counts events when off. */
  enabled: boolean;
  /** Master volume, 0..1. */
  volume: number;
  /** Default tone used when no per-event override exists. */
  sound: ToneId;
  /** Per-event master toggles. */
  events: Record<NotificationEventType, boolean>;
  /** Optional per-event tone override. */
  soundByEvent: Partial<Record<NotificationEventType, ToneId>>;
  /** Optional per-event uploaded sound files (S3 keys). */
  customSounds: Partial<Record<NotificationEventType, CustomSoundFile | null>>;
}

/** A sound file the admin uploaded for a GitHub user, stored on S3. */
export interface CustomSoundFile {
  /** Sound library entry id, e.g. a UUID. */
  id: string;
  /** Display name from the library, for showing in the UI. */
  name: string;
}

/** One entry in the shared sound library. */
export interface SoundLibraryEntry {
  /** Unique id, also used to build the S3 key. */
  id: string;
  /** Original upload filename. */
  name: string;
  /** S3 object key, e.g. sounds/library/{id}.mp3. */
  key: string;
}

export interface NotificationEventsResponse {
  /** False until GITHUB_WEBHOOK_SECRET + S3 storage are both configured. */
  configured: boolean;
  events: NotificationEvent[];
}
