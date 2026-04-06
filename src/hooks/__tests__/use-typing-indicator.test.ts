// @vitest-environment jsdom

import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createMockRealtimeChannel } from "@/lib/realtime/adapters/mock-adapter";
import { useTyping } from "../use-typing-indicator";

const USER_ID = "user-abc";
const OTHER_USER_ID = "user-xyz";
const USERNAME = "alice";
const OTHER_USERNAME = "bob";

describe("useTyping", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("should call channel.broadcast with is_typing:false immediately when broadcastTyping(false) is called", () => {
    const mockChannel = createMockRealtimeChannel();
    const { result } = renderHook(() =>
      useTyping(mockChannel, USER_ID, USERNAME),
    );

    act(() => {
      result.current.broadcastTyping(false);
    });

    expect(mockChannel.broadcast).toHaveBeenCalledWith("typing", {
      user_id: USER_ID,
      username: USERNAME,
      is_typing: false,
    });
  });

  it("should call channel.broadcast with is_typing:true when broadcastTyping(true) is called after throttle interval", () => {
    const mockChannel = createMockRealtimeChannel();
    const { result, rerender } = renderHook(() =>
      useTyping(mockChannel, USER_ID, USERNAME),
    );

    act(() => {
      result.current.broadcastTyping(true);
    });

    // Advance past the 1500ms throttle interval and force re-render
    act(() => {
      vi.advanceTimersByTime(1600);
    });
    rerender();

    expect(mockChannel.broadcast).toHaveBeenCalledWith("typing", {
      user_id: USER_ID,
      username: USERNAME,
      is_typing: true,
    });
  });

  it("should add a TypingUser to typingUsers when onBroadcast fires with is_typing:true from another user", () => {
    const mockChannel = createMockRealtimeChannel();
    const { result } = renderHook(() =>
      useTyping(mockChannel, USER_ID, USERNAME),
    );

    act(() => {
      mockChannel.simulateBroadcast("typing", {
        user_id: OTHER_USER_ID,
        username: OTHER_USERNAME,
        is_typing: true,
      });
    });

    expect(result.current.typingUsers).toHaveLength(1);
    expect(result.current.typingUsers[0]).toMatchObject({
      user_id: OTHER_USER_ID,
      username: OTHER_USERNAME,
    });
  });

  it("should not add self to typingUsers when own user_id arrives in broadcast", () => {
    const mockChannel = createMockRealtimeChannel();
    const { result } = renderHook(() =>
      useTyping(mockChannel, USER_ID, USERNAME),
    );

    act(() => {
      mockChannel.simulateBroadcast("typing", {
        user_id: USER_ID,
        username: USERNAME,
        is_typing: true,
      });
    });

    expect(result.current.typingUsers).toHaveLength(0);
  });

  it("should remove user from typingUsers when is_typing:false broadcast received", () => {
    const mockChannel = createMockRealtimeChannel();
    const { result } = renderHook(() =>
      useTyping(mockChannel, USER_ID, USERNAME),
    );

    act(() => {
      mockChannel.simulateBroadcast("typing", {
        user_id: OTHER_USER_ID,
        username: OTHER_USERNAME,
        is_typing: true,
      });
    });

    expect(result.current.typingUsers).toHaveLength(1);

    act(() => {
      mockChannel.simulateBroadcast("typing", {
        user_id: OTHER_USER_ID,
        username: OTHER_USERNAME,
        is_typing: false,
      });
    });

    expect(result.current.typingUsers).toHaveLength(0);
  });

  it("should remove user from typingUsers after 3000 ms with no follow-up event", () => {
    const mockChannel = createMockRealtimeChannel();
    const { result } = renderHook(() =>
      useTyping(mockChannel, USER_ID, USERNAME),
    );

    act(() => {
      mockChannel.simulateBroadcast("typing", {
        user_id: OTHER_USER_ID,
        username: OTHER_USERNAME,
        is_typing: true,
      });
    });

    expect(result.current.typingUsers).toHaveLength(1);

    act(() => {
      vi.advanceTimersByTime(3200);
    });

    expect(result.current.typingUsers).toHaveLength(0);
  });

  it("should not throw when channel is null", () => {
    const { result } = renderHook(() => useTyping(null, USER_ID, USERNAME));

    expect(() => {
      act(() => {
        result.current.broadcastTyping(true);
      });
    }).not.toThrow();

    expect(() => {
      act(() => {
        result.current.broadcastTyping(false);
      });
    }).not.toThrow();
  });
});
