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
    subscribe: vi.fn(() => channel),
  };

  beforeEach(() => {
    useMessageStore.setState({
      messages: new Map(initialMessageState.messages),
      cursors: new Map(initialMessageState.cursors),
      hasMore: new Map(initialMessageState.hasMore),
      pendingIds: new Set(initialMessageState.pendingIds),
    });

    onHandler = null;
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

  it("ignores CDC events from the current user", async () => {
    const appendSpy = vi.spyOn(useMessageStore.getState(), "appendNewMessage");

    renderHook(() =>
      useRealtimeMessages({ roomId: "room-1", currentUserId: "user-1" }),
    );

    await act(async () => {
      await onHandler?.({ new: { id: "message-1", sender_id: "user-1" } });
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
});
