import type { RealtimeChannel as SupabaseInnerChannel } from "@supabase/supabase-js";
import { getBrowserClient } from "@/lib/supabase/client";
import type {
  RealtimeChannel,
  RealtimeProvider,
  RealtimeStatus,
  MessageEvent,
  PresencePayload,
  BroadcastPayload,
  FetchMessageById,
  StatusCallback,
  Unsubscribe,
} from "./types";

export class SupabaseChannel implements RealtimeChannel {
  private inner: SupabaseInnerChannel;
  private roomId: string;
  private _status: RealtimeStatus = "connecting";
  private _messageHandlers: Array<(event: MessageEvent) => void> = [];
  private _messageWired = false;
  private _broadcastHandlers = new Map<
    string,
    Array<(payload: BroadcastPayload) => void>
  >();
  private _presenceSyncHandlers: Array<
    (state: Record<string, PresencePayload[]>) => void
  > = [];
  private _presenceSyncWired = false;
  private _subscribeWired = false;

  constructor(inner: SupabaseInnerChannel, roomId: string) {
    this.inner = inner;
    this.roomId = roomId;
  }

  get status(): RealtimeStatus {
    return this._status;
  }

  onMessage(handler: (event: MessageEvent) => void): Unsubscribe {
    if (!this._messageWired) {
      this._messageWired = true;
      this.inner.on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `room_id=eq.${this.roomId}`,
        },
        (payload: { new: Record<string, unknown> }) => {
          const next = payload.new as { id: string };
          const event: MessageEvent = {
            type: "insert",
            roomId: this.roomId,
            messageId: next.id,
            payload: payload.new,
          };
          for (const h of this._messageHandlers) {
            h(event);
          }
        },
      );
    }

    this._messageHandlers.push(handler);
    return () => {
      this._messageHandlers = this._messageHandlers.filter((h) => h !== handler);
    };
  }

  onBroadcast(
    event: string,
    handler: (payload: BroadcastPayload) => void,
  ): Unsubscribe {
    if (!this._broadcastHandlers.has(event)) {
      const handlers: Array<(payload: BroadcastPayload) => void> = [];
      this._broadcastHandlers.set(event, handlers);
      this.inner.on(
        "broadcast",
        { event },
        (data: { payload?: BroadcastPayload }) => {
          const payload = (data.payload ?? {}) as BroadcastPayload;
          for (const h of handlers) {
            h(payload);
          }
        },
      );
    }

    const handlers = this._broadcastHandlers.get(event)!;
    handlers.push(handler);
    return () => {
      const idx = handlers.indexOf(handler);
      if (idx !== -1) handlers.splice(idx, 1);
    };
  }

  onPresenceSync(
    handler: (state: Record<string, PresencePayload[]>) => void,
  ): Unsubscribe {
    if (!this._presenceSyncWired) {
      this._presenceSyncWired = true;
      this.inner.on("presence", { event: "sync" }, () => {
        const state = this.inner.presenceState() as Record<
          string,
          PresencePayload[]
        >;
        for (const h of this._presenceSyncHandlers) {
          h(state);
        }
      });
    }

    this._presenceSyncHandlers.push(handler);
    return () => {
      this._presenceSyncHandlers = this._presenceSyncHandlers.filter(
        (h) => h !== handler,
      );
    };
  }

  broadcast(event: string, payload: BroadcastPayload): void {
    void this.inner.send({ type: "broadcast", event, payload });
  }

  track(payload: PresencePayload): void {
    void this.inner.track({ ...payload });
  }

  untrack(): void {
    void this.inner.untrack();
  }

  presenceState(): Record<string, PresencePayload[]> {
    return this.inner.presenceState() as Record<string, PresencePayload[]>;
  }

  subscribe(onStatus?: StatusCallback): void {
    if (this._subscribeWired) return;
    this._subscribeWired = true;
    this.inner.subscribe((supabaseStatus: string, err?: Error) => {
      let mapped: RealtimeStatus;
      if (supabaseStatus === "SUBSCRIBED") {
        mapped = "subscribed";
      } else if (supabaseStatus === "CHANNEL_ERROR") {
        mapped = "error";
      } else if (supabaseStatus === "TIMED_OUT") {
        mapped = "error";
      } else if (supabaseStatus === "CLOSED") {
        mapped = "closed";
      } else {
        mapped = "connecting";
      }
      this._status = mapped;
      onStatus?.(mapped, err);
    });
  }

  dispose(): void {
    this._status = "closed";
    getBrowserClient().removeChannel(this.inner);
  }
}

export class SupabaseRealtimeProvider implements RealtimeProvider {
  createChannel(roomId: string): RealtimeChannel {
    const inner = getBrowserClient().channel(`room:${roomId}`);
    return new SupabaseChannel(inner, roomId);
  }

  removeChannel(channel: RealtimeChannel): void {
    channel.dispose();
  }
}

let _provider: SupabaseRealtimeProvider | null = null;

export function getDefaultRealtimeProvider(): SupabaseRealtimeProvider {
  if (!_provider) {
    _provider = new SupabaseRealtimeProvider();
  }
  return _provider;
}

export const supabaseFetchMessageById: FetchMessageById = async (
  messageId: string,
): Promise<Record<string, unknown> | null> => {
  const supabase = getBrowserClient();
  const { data, error } = await supabase
    .from("messages")
    .select(
      "id, room_id, sender_id, content, type, created_at, updated_at, deleted_at, sender:profiles!sender_id(id, username, display_name, avatar_url)",
    )
    .eq("id", messageId)
    .single();

  if (error || !data) return null;
  return data as Record<string, unknown>;
};
