/* eslint-disable @typescript-eslint/no-unused-vars */
import { vi } from "vitest";
import type {
  RealtimeChannel,
  RealtimeStatus,
  MessageEvent,
  PresencePayload,
  BroadcastPayload,
  StatusCallback,
  Unsubscribe,
} from "../types";

export class MockRealtimeChannel implements RealtimeChannel {
  private _messageHandlers: Array<(event: MessageEvent) => void | Promise<void>> = [];
  private _broadcastHandlers: Map<string, Array<(payload: BroadcastPayload) => void>> = new Map();
  private _status: RealtimeStatus = "connecting";

  get status(): RealtimeStatus {
    return this._status;
  }

  onMessage = vi.fn(
    (handler: (event: MessageEvent) => void): Unsubscribe => {
      this._messageHandlers.push(handler);
      const unsubscribe = vi.fn(() => {
        this._messageHandlers = this._messageHandlers.filter(
          (h) => h !== handler,
        );
      });
      return unsubscribe;
    },
  );

  onBroadcast = vi.fn(
    (
      event: string,
      handler: (payload: BroadcastPayload) => void,
    ): Unsubscribe => {
      const handlers = this._broadcastHandlers.get(event) ?? [];
      handlers.push(handler);
      this._broadcastHandlers.set(event, handlers);
      const unsubscribe = vi.fn(() => {
        const current = this._broadcastHandlers.get(event) ?? [];
        this._broadcastHandlers.set(
          event,
          current.filter((h) => h !== handler),
        );
      });
      return unsubscribe;
    },
  );

  onPresenceSync = vi.fn(
    (
      _handler: (state: Record<string, PresencePayload[]>) => void,
    ): Unsubscribe => {
      return vi.fn();
    },
  );

  broadcast = vi.fn((_event: string, _payload: BroadcastPayload): void => {});

  track = vi.fn((_payload: PresencePayload): void => {});

  untrack = vi.fn((): void => {});

  presenceState = vi.fn((): Record<string, PresencePayload[]> => ({}));

  subscribe = vi.fn((_onStatus?: StatusCallback): void => {});

  dispose = vi.fn((): void => {});

  async simulateMessage(event: MessageEvent): Promise<void> {
    await Promise.all(this._messageHandlers.map((h) => h(event)));
  }

  simulateBroadcast(event: string, payload: BroadcastPayload): void {
    const handlers = this._broadcastHandlers.get(event) ?? [];
    for (const handler of handlers) {
      handler(payload);
    }
  }
}

export function createMockRealtimeChannel(): MockRealtimeChannel {
  return new MockRealtimeChannel();
}
