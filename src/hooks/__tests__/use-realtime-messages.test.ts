// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useRealtimeMessages } from "@/hooks/use-realtime-messages";
import { useMessageStore, initialMessageState } from "@/store/message-store";
import type { MessageWithProfile } from "@/types/messages";

const channelMock = vi.fn();
const removeChannelMock = vi.fn();
const fromMock = vi.fn();
const getBrowserClientMock = vi.fn(() => ({
  channel: channelMock,
  removeChannel: removeChannelMock,
  from: fromMock,
}));

vi.mock("@/lib/supabase/client", () => ({
  getBrowserClient: () => getBrowserClientMock(),
}));

describe("useRealtimeMessages", () => {
  let onHandler:
    | ((payload: { new: { id: string; sender_id: string } }) => void)
    | null = null;
  let subscribeCallback: ((status: string, err?: Error) => void) | null = null;

  const query = {
    select: vi.fn(),
    eq: vi.fn(),
    single: vi.fn(),
  };

  const channel = {
    on: vi.fn(
      (
        _event: string,
        _filter: Record<string, string>,
        callback: (payload: { new: { id: string; sender_id: string } }) => void,
      ) => {
        onHandler = callback;
        return channel;
      },
    ),
    subscribe: vi.fn((cb: (status: string, err?: Error) => void) => {
      subscribeCallback = cb;
      return channel;
    }),
  };

  beforeEach(() => {
    useMessageStore.setState({
      messages: new Map(initialMessageState.messages),
      cursors: new Map(initialMessageState.cursors),
      hasMore: new Map(initialMessageState.hasMore),
      pendingIds: new Set(initialMessageState.pendingIds),
    });

    onHandler = null;
    subscribeCallback = null;
    channelMock.mockReturnValue(channel);
    removeChannelMock.mockClear();
    fromMock.mockReturnValue(query);

    query.select.mockReturnValue(query);
    query.eq.mockReturnValue(query);
    query.single.mockResolvedValue({ data: null, error: null });
  });

  it("subscribes to the room channel on mount", () => {
    renderHook(() =>
      useRealtimeMessages({ roomId: "room-1", currentUserId: "user-1" }),
    );

    expect(channelMock).toHaveBeenCalledWith("room:room-1");
    expect(channel.on).toHaveBeenCalled();
  });

  it("does not append when secondary fetch returns no data", async () => {
    const appendSpy = vi.spyOn(useMessageStore.getState(), "appendNewMessage");

    query.single.mockResolvedValue({ data: null, error: null });

    renderHook(() =>
      useRealtimeMessages({ roomId: "room-1", currentUserId: "user-1" }),
    );

    await act(async () => {
      await onHandler?.({ new: { id: "message-99", sender_id: "user-1" } });
    });

    expect(appendSpy).not.toHaveBeenCalled();
  });

  it("appends messages from other users", async () => {
    const appendSpy = vi.spyOn(useMessageStore.getState(), "appendNewMessage");
    const message: MessageWithProfile = {
      id: "message-2",
      room_id: "room-1",
      sender_id: "user-2",
      content: "Hello",
      type: "text",
      created_at: "2026-04-01T00:00:00Z",
      updated_at: "2026-04-01T00:00:00Z",
      deleted_at: null,
      sender: {
        id: "user-2",
        username: "user_2",
        display_name: "User Two",
        avatar_url: null,
      },
    };

    query.single.mockResolvedValue({ data: message, error: null });

    renderHook(() =>
      useRealtimeMessages({ roomId: "room-1", currentUserId: "user-1" }),
    );

    await act(async () => {
      await onHandler?.({ new: { id: "message-2", sender_id: "user-2" } });
    });

    expect(appendSpy).toHaveBeenCalledWith("room-1", message);
  });

  it("removes channel on unmount", () => {
    const { unmount } = renderHook(() =>
      useRealtimeMessages({ roomId: "room-1", currentUserId: "user-1" }),
    );

    unmount();

    expect(removeChannelMock).toHaveBeenCalledWith(channel);
  });

  it("re-subscribes when roomId changes", async () => {
    const { rerender } = renderHook(
      ({ roomId, currentUserId }) =>
        useRealtimeMessages({ roomId, currentUserId }),
      {
        initialProps: { roomId: "room-1", currentUserId: "user-1" },
      },
    );

    await act(async () => {
      rerender({ roomId: "room-2", currentUserId: "user-1" });
    });

    expect(channelMock).toHaveBeenCalledWith("room:room-2");
    expect(removeChannelMock).toHaveBeenCalledWith(channel);
  });

  it("delivers message from same user in second tab (BUG-1)", async () => {
    const appendSpy = vi.spyOn(useMessageStore.getState(), "appendNewMessage");
    const message: MessageWithProfile = {
      id: "message-3",
      room_id: "room-1",
      sender_id: "user-1",
      content: "sent from tab A",
      type: "text",
      created_at: "2026-04-01T00:00:00Z",
      updated_at: "2026-04-01T00:00:00Z",
      deleted_at: null,
      sender: {
        id: "user-1",
        username: "user_1",
        display_name: "User One",
        avatar_url: null,
      },
    };

    query.single.mockResolvedValue({ data: message, error: null });

    renderHook(() =>
      useRealtimeMessages({ roomId: "room-1", currentUserId: "user-1" }),
    );

    // CDC event where the sender IS the current user — must still be appended
    // (multi-tab: Tab B receives its own user's message from Tab A)
    await act(async () => {
      await onHandler?.({ new: { id: "message-3", sender_id: "user-1" } });
    });

    expect(appendSpy).toHaveBeenCalledWith("room-1", message);
  });

  it("logs CHANNEL_ERROR without throwing (BUG-5)", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    renderHook(() =>
      useRealtimeMessages({ roomId: "room-1", currentUserId: "user-1" }),
    );

    act(() => {
      subscribeCallback?.("CHANNEL_ERROR", new Error("realtime error"));
    });

    expect(errorSpy).toHaveBeenCalledWith(
      "[realtime] channel error:",
      expect.any(Error),
    );

    errorSpy.mockRestore();
  });

  it("skips duplicate message id already in store (TD-10)", async () => {
    const message: MessageWithProfile = {
      id: "message-5",
      room_id: "room-1",
      sender_id: "user-2",
      content: "duplicate test",
      type: "text",
      created_at: "2026-04-01T00:00:00Z",
      updated_at: "2026-04-01T00:00:00Z",
      deleted_at: null,
      sender: {
        id: "user-2",
        username: "user_2",
        display_name: "User Two",
        avatar_url: null,
      },
    };

    // Pre-populate the store with the message (simulates confirmMessage already ran)
    useMessageStore.setState({
      messages: new Map([["room-1", [message]]]),
      cursors: new Map(initialMessageState.cursors),
      hasMore: new Map(initialMessageState.hasMore),
      pendingIds: new Set(initialMessageState.pendingIds),
    });

    query.single.mockResolvedValue({ data: message, error: null });

    const appendSpy = vi.spyOn(useMessageStore.getState(), "appendNewMessage");

    renderHook(() =>
      useRealtimeMessages({ roomId: "room-1", currentUserId: "user-1" }),
    );

    await act(async () => {
      await onHandler?.({ new: { id: "message-5", sender_id: "user-2" } });
    });

    // appendNewMessage is called but the store guard deduplicates internally
    // — verify the room still only contains one copy of the message
    const stored = useMessageStore.getState().messages.get("room-1");
    expect(stored).toHaveLength(1);
  });
});
