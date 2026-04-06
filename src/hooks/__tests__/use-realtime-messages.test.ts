// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useRealtimeMessages } from "@/hooks/use-realtime-messages";
import {
  createMockRealtimeChannel,
  type MockRealtimeChannel,
} from "@/lib/realtime/adapters/mock-adapter";
import { useMessageStore, initialMessageState } from "@/store/message-store";
import type { MessageWithProfile } from "@/types/messages";
import type { FetchMessageById } from "@/lib/realtime";

describe("useRealtimeMessages", () => {
  let mockChannel: MockRealtimeChannel;
  let fetchMessage: Mock<FetchMessageById>;

  beforeEach(() => {
    useMessageStore.setState({
      messages: new Map(initialMessageState.messages),
      cursors: new Map(initialMessageState.cursors),
      hasMore: new Map(initialMessageState.hasMore),
      pendingIds: new Set(initialMessageState.pendingIds),
    });

    mockChannel = createMockRealtimeChannel();
    fetchMessage = vi.fn<FetchMessageById>().mockResolvedValue(null);
  });

  it("subscribes to the room channel on mount", () => {
    renderHook(() =>
      useRealtimeMessages({
        roomId: "room-1",
        currentUserId: "user-1",
        channel: mockChannel,
        fetchMessage,
      }),
    );

    expect(mockChannel.onMessage).toHaveBeenCalled();
  });

  it("does not append when secondary fetch returns no data", async () => {
    const appendSpy = vi.spyOn(useMessageStore.getState(), "appendNewMessage");

    fetchMessage.mockResolvedValue(null);

    renderHook(() =>
      useRealtimeMessages({
        roomId: "room-1",
        currentUserId: "user-1",
        channel: mockChannel,
        fetchMessage,
      }),
    );

    await act(async () => {
      await mockChannel.simulateMessage({
        type: "insert",
        roomId: "room-1",
        messageId: "message-99",
      });
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

    fetchMessage.mockResolvedValue(message as unknown as Record<string, unknown>);

    renderHook(() =>
      useRealtimeMessages({
        roomId: "room-1",
        currentUserId: "user-1",
        channel: mockChannel,
        fetchMessage,
      }),
    );

    await act(async () => {
      await mockChannel.simulateMessage({
        type: "insert",
        roomId: "room-1",
        messageId: "message-2",
      });
    });

    expect(appendSpy).toHaveBeenCalledWith("room-1", message);
  });

  it("removes listener on unmount", () => {
    const { unmount } = renderHook(() =>
      useRealtimeMessages({
        roomId: "room-1",
        currentUserId: "user-1",
        channel: mockChannel,
        fetchMessage,
      }),
    );

    unmount();

    const unsubscribeSpy = mockChannel.onMessage.mock.results[0]?.value as ReturnType<typeof vi.fn>;
    expect(unsubscribeSpy).toHaveBeenCalled();
  });

  it("re-subscribes when roomId changes", async () => {
    const { rerender } = renderHook(
      ({ roomId }: { roomId: string }) =>
        useRealtimeMessages({
          roomId,
          currentUserId: "user-1",
          channel: mockChannel,
          fetchMessage,
        }),
      {
        initialProps: { roomId: "room-1" },
      },
    );

    await act(async () => {
      rerender({ roomId: "room-2" });
    });

    expect(mockChannel.onMessage).toHaveBeenCalledTimes(2);
    const firstUnsubscribe = mockChannel.onMessage.mock.results[0]?.value as ReturnType<typeof vi.fn>;
    expect(firstUnsubscribe).toHaveBeenCalled();
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

    fetchMessage.mockResolvedValue(message as unknown as Record<string, unknown>);

    renderHook(() =>
      useRealtimeMessages({
        roomId: "room-1",
        currentUserId: "user-1",
        channel: mockChannel,
        fetchMessage,
      }),
    );

    // CDC event where the sender IS the current user — must still be appended
    // (multi-tab: Tab B receives its own user's message from Tab A)
    await act(async () => {
      await mockChannel.simulateMessage({
        type: "insert",
        roomId: "room-1",
        messageId: "message-3",
      });
    });

    expect(appendSpy).toHaveBeenCalledWith("room-1", message);
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

    fetchMessage.mockResolvedValue(message as unknown as Record<string, unknown>);

    const appendSpy = vi.spyOn(useMessageStore.getState(), "appendNewMessage");

    renderHook(() =>
      useRealtimeMessages({
        roomId: "room-1",
        currentUserId: "user-1",
        channel: mockChannel,
        fetchMessage,
      }),
    );

    await act(async () => {
      await mockChannel.simulateMessage({
        type: "insert",
        roomId: "room-1",
        messageId: "message-5",
      });
    });

    // appendNewMessage is called but the store guard deduplicates internally
    // — verify the room still only contains one copy of the message
    expect(appendSpy).toHaveBeenCalled();
    const stored = useMessageStore.getState().messages.get("room-1");
    expect(stored).toHaveLength(1);
  });

  it("appends normalized MessageWithProfile when simulateMessage receives INSERT event", async () => {
    const appendSpy = vi.spyOn(useMessageStore.getState(), "appendNewMessage");
    const message: MessageWithProfile = {
      id: "message-10",
      room_id: "room-1",
      sender_id: "user-2",
      content: "Hello from behavioral AC test",
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

    fetchMessage.mockResolvedValue(message as unknown as Record<string, unknown>);

    renderHook(() =>
      useRealtimeMessages({
        roomId: "room-1",
        currentUserId: "user-1",
        channel: mockChannel,
        fetchMessage,
      }),
    );

    await act(async () => {
      await mockChannel.simulateMessage({
        type: "insert",
        roomId: "room-1",
        messageId: "message-10",
      });
    });

    expect(fetchMessage).toHaveBeenCalledWith("message-10");
    expect(appendSpy).toHaveBeenCalledWith("room-1", message);
  });
});
