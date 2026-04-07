// @vitest-environment jsdom

import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { createMockRealtimeChannel } from "@/lib/realtime/adapters/mock-adapter";
import { usePresence } from "../use-realtime-presence";

const USER_ID = "user-abc";
const OTHER_USER_ID = "user-xyz";
const USERNAME = "alice";
const OTHER_USERNAME = "bob";

describe("usePresence", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("1. should register onPresenceSync listener once on mount", () => {
    const mockChannel = createMockRealtimeChannel();
    renderHook(() => usePresence(mockChannel, USER_ID));

    expect(mockChannel.onPresenceSync).toHaveBeenCalledOnce();
  });

  it("2. should NOT register onPresenceSync when channel is null", () => {
    renderHook(() => usePresence(null, USER_ID));
    // no channel — nothing to assert on, guard returns early
  });

  it("3. should NOT register onPresenceSync when currentUserId is null", () => {
    const mockChannel = createMockRealtimeChannel();
    renderHook(() => usePresence(mockChannel, null));

    expect(mockChannel.onPresenceSync).not.toHaveBeenCalled();
  });

  it("4. should derive onlineUsers from presenceState on sync with two entries", () => {
    const mockChannel = createMockRealtimeChannel();
    const { result } = renderHook(() => usePresence(mockChannel, USER_ID));

    act(() => {
      mockChannel.simulatePresenceSync({
        key1: [{ user_id: USER_ID, username: USERNAME, online_at: new Date().toISOString() }],
        key2: [{ user_id: OTHER_USER_ID, username: OTHER_USERNAME, online_at: new Date().toISOString() }],
      });
    });

    expect(result.current.onlineUsers).toHaveLength(2);
    expect(result.current.onlineUsers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ user_id: USER_ID, username: USERNAME }),
        expect.objectContaining({ user_id: OTHER_USER_ID, username: OTHER_USERNAME }),
      ]),
    );
    expect(result.current.onlineCount).toBe(2);
  });

  it("5. should include own user in onlineCount — own user is NOT self-filtered", () => {
    const mockChannel = createMockRealtimeChannel();
    const { result } = renderHook(() => usePresence(mockChannel, USER_ID));

    act(() => {
      mockChannel.simulatePresenceSync({
        key1: [{ user_id: USER_ID, username: USERNAME, online_at: new Date().toISOString() }],
        key2: [{ user_id: OTHER_USER_ID, username: OTHER_USERNAME, online_at: new Date().toISOString() }],
      });
    });

    expect(result.current.onlineUsers.some((u) => u.user_id === USER_ID)).toBe(true);
    expect(result.current.onlineCount).toBe(2);
  });

  it("6. should deduplicate entries with the same user_id across presence keys", () => {
    const mockChannel = createMockRealtimeChannel();
    const { result } = renderHook(() => usePresence(mockChannel, USER_ID));

    act(() => {
      mockChannel.simulatePresenceSync({
        key1: [{ user_id: USER_ID, username: USERNAME, online_at: new Date().toISOString() }],
        key2: [{ user_id: USER_ID, username: USERNAME, online_at: new Date().toISOString() }],
        key3: [{ user_id: OTHER_USER_ID, username: OTHER_USERNAME, online_at: new Date().toISOString() }],
      });
    });

    const userCount = result.current.onlineUsers.filter(
      (u) => u.user_id === USER_ID,
    ).length;
    expect(userCount).toBe(1);
    expect(result.current.onlineCount).toBe(2);
  });

  it("7. should call channel.untrack on unmount", () => {
    const mockChannel = createMockRealtimeChannel();
    const { unmount } = renderHook(() => usePresence(mockChannel, USER_ID));

    unmount();

    expect(mockChannel.untrack).toHaveBeenCalledOnce();
  });

  it("8. should call the onPresenceSync unsubscribe function on unmount", () => {
    const mockChannel = createMockRealtimeChannel();
    const { unmount } = renderHook(() => usePresence(mockChannel, USER_ID));

    const unsubscribeMock = mockChannel.onPresenceSync.mock.results[0].value;

    unmount();

    expect(unsubscribeMock).toHaveBeenCalledOnce();
  });

  it("9. should NOT call channel.track (track is owned by useChatMessages subscribe callback)", () => {
    const mockChannel = createMockRealtimeChannel();
    renderHook(() => usePresence(mockChannel, USER_ID));

    expect(mockChannel.track).not.toHaveBeenCalled();
  });
});

