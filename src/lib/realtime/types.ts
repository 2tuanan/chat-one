export type RealtimeStatus = "connecting" | "subscribed" | "error" | "closed";

export type MessageEventType = "insert" | "update" | "delete";

export interface MessageEvent {
  type: MessageEventType;
  roomId: string;
  messageId: string;
  payload?: Record<string, unknown>;
}

export interface PresencePayload {
  user_id: string;
  username: string;
  online_at: string;
}

export interface TypingPayload {
  user_id: string;
  username: string;
  is_typing: boolean;
}

export type BroadcastPayload = Record<string, unknown>;

export type Unsubscribe = () => void;

export type StatusCallback = (status: RealtimeStatus, error?: Error) => void;

export type FetchMessageById = (
  messageId: string,
) => Promise<Record<string, unknown> | null>;

export interface RealtimeChannel {
  readonly status: RealtimeStatus;
  onMessage(handler: (event: MessageEvent) => void): Unsubscribe;
  onBroadcast(
    event: string,
    handler: (payload: BroadcastPayload) => void,
  ): Unsubscribe;
  onPresenceSync(
    handler: (state: Record<string, PresencePayload[]>) => void,
  ): Unsubscribe;
  broadcast(event: string, payload: BroadcastPayload): void;
  track(payload: PresencePayload): void;
  untrack(): void;
  presenceState(): Record<string, PresencePayload[]>;
  subscribe(onStatus?: StatusCallback): void;
  dispose(): void;
}

export interface RealtimeProvider {
  createChannel(roomId: string): RealtimeChannel;
  removeChannel(channel: RealtimeChannel): void;
}
