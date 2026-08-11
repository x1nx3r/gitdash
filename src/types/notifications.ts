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
}

export interface NotificationEventsResponse {
  /** False until GITHUB_WEBHOOK_SECRET + S3 storage are both configured. */
  configured: boolean;
  events: NotificationEvent[];
}
