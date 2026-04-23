// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useInfiniteMessages } from "@/hooks/use-infinite-messages";
import { useMessageStore, initialMessageState } from "@/store/message-store";
import type { MessageWithProfile } from "@/types/messages";

// Mock the server action module so tests don't hit supabase
vi.mock("@/actions/messages", () => ({
  fetchOlderMessages: vi.fn(),
}));

import { fetchOlderMessages } from "@/actions/messages";
const mockFetch = fetchOlderMessages as ReturnType<typeof vi.fn>;

const ROOM_ID = "room-test-1";
const CURSOR = "2024-01-15T12:00:00.000Z";
const OLDER_CURSOR = "2024-01-14T00:00:00.000Z";

const makeMockMessage = (overrides: Partial<MessageWithProfile> = {}): MessageWithProfile => ({
  id: `msg-${Math.random().toString(36).slice(2)}`,
  room_id: ROOM_ID,
  sender_id: "user-1",
  content: "Hello",
  type: "text",
  created_at: CURSOR,
  updated_at: CURSOR,
  deleted_at: null,
  sender: { id: "user-1", username: "alice", display_name: "Alice", avatar_url: null },
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
  // Reset to clean store state before each test
  useMessageStore.setState({
    messages: new Map(initialMessageState.messages),
    cursors: new Map(initialMessageState.cursors),
    hasMore: new Map(initialMessageState.hasMore),
    pendingIds: new Set(initialMessageState.pendingIds),
  });
});

describe("useInfiniteMessages", () => {
  it("Test 1 — initial state: messages=[], hasMore=true (default), isLoading=false", () => {
    // No store data for this room — all defaults apply
    const { result } = renderHook(() => useInfiniteMessages(ROOM_ID));

    expect(result.current.messages).toEqual([]);
    // hasMore defaults to true when store has no entry (null coalesce ?? true)
    expect(result.current.hasMore).toBe(true);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.cursor).toBeNull();
  });

  it("Test 2 — loadMore() sets isLoading=true during fetch", async () => {
    // Seed store with cursor so loadMore() can proceed past the guard
    useMessageStore.setState({
      messages: new Map([[ROOM_ID, [makeMockMessage()]]]),
      cursors: new Map([[ROOM_ID, CURSOR]]),
      hasMore: new Map([[ROOM_ID, true]]),
      pendingIds: new Set(),
    });

    // Controlled promise: does not resolve immediately
    let resolve!: (v: Awaited<ReturnType<typeof fetchOlderMessages>>) => void;
    const pending = new Promise<Awaited<ReturnType<typeof fetchOlderMessages>>>(
      (r) => { resolve = r; },
    );
    mockFetch.mockReturnValueOnce(pending);

    const { result } = renderHook(() => useInfiniteMessages(ROOM_ID));

    act(() => { void result.current.loadMore(); });

    // isLoading should be true while promise is unresolved
    expect(result.current.isLoading).toBe(true);

    // Resolve the promise to avoid unhandled promise rejection
    await act(async () => {
      resolve({ messages: [], nextCursor: null, hasMore: false });
      await pending;
    });
  });

  it("Test 3 — on success: messages prepended, cursor updated in store", async () => {
    const existingMsg = makeMockMessage({ id: "existing-1", created_at: CURSOR });
    const olderMsg = makeMockMessage({ id: "older-1", created_at: OLDER_CURSOR });

    useMessageStore.setState({
      messages: new Map([[ROOM_ID, [existingMsg]]]),
      cursors: new Map([[ROOM_ID, CURSOR]]),
      hasMore: new Map([[ROOM_ID, true]]),
      pendingIds: new Set(),
    });

    mockFetch.mockResolvedValueOnce({
      messages: [olderMsg],
      nextCursor: OLDER_CURSOR,
      hasMore: true,
    });

    const { result } = renderHook(() => useInfiniteMessages(ROOM_ID));

    await act(async () => { await result.current.loadMore(); });

    // olderMsg should now be at index 0 (prepended before existingMsg)
    expect(result.current.messages[0].id).toBe("older-1");
    expect(result.current.messages[1].id).toBe("existing-1");
    // cursor updated to the nextCursor returned by the action
    expect(result.current.cursor).toBe(OLDER_CURSOR);
    expect(result.current.isLoading).toBe(false);
  });

  it("Test 4 — fetch < page size → hasMore=false, further loadMore() calls do nothing", async () => {
    const existingMsg = makeMockMessage({ created_at: CURSOR });

    useMessageStore.setState({
      messages: new Map([[ROOM_ID, [existingMsg]]]),
      cursors: new Map([[ROOM_ID, CURSOR]]),
      hasMore: new Map([[ROOM_ID, true]]),
      pendingIds: new Set(),
    });

    mockFetch.mockResolvedValueOnce({
      messages: [makeMockMessage({ id: "only-1", created_at: OLDER_CURSOR })],
      nextCursor: null,
      hasMore: false,
    });

    const { result } = renderHook(() => useInfiniteMessages(ROOM_ID));

    await act(async () => { await result.current.loadMore(); });

    expect(result.current.hasMore).toBe(false);
    expect(result.current.isLoading).toBe(false);

    // Subsequent loadMore() calls should be no-ops
    await act(async () => { await result.current.loadMore(); });
    await act(async () => { await result.current.loadMore(); });

    // fetchOlderMessages should have been called exactly once
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("Test 5 — loadMore() is no-op when isLoading=true OR hasMore=false", async () => {
    // Part A: guard against concurrent calls (isLoading guard via isLoadingRef)
    useMessageStore.setState({
      messages: new Map([[ROOM_ID, [makeMockMessage()]]]),
      cursors: new Map([[ROOM_ID, CURSOR]]),
      hasMore: new Map([[ROOM_ID, true]]),
      pendingIds: new Set(),
    });

    let resolveA!: (v: Awaited<ReturnType<typeof fetchOlderMessages>>) => void;
    const pendingA = new Promise<Awaited<ReturnType<typeof fetchOlderMessages>>>(
      (r) => { resolveA = r; },
    );
    mockFetch.mockReturnValueOnce(pendingA);

    const { result, unmount } = renderHook(() => useInfiniteMessages(ROOM_ID));

    // Call loadMore twice in rapid succession
    act(() => { void result.current.loadMore(); });
    act(() => { void result.current.loadMore(); });

    await act(async () => {
      resolveA({ messages: [], nextCursor: null, hasMore: false });
      await pendingA;
    });

    // fetchOlderMessages should only be called once despite two calls
    expect(mockFetch).toHaveBeenCalledTimes(1);

    // Unmount before Part B to prevent stale-mount act() warnings
    unmount();

    // Part B: guard when hasMore=false
    vi.clearAllMocks();
    useMessageStore.setState({
      messages: new Map([[ROOM_ID, [makeMockMessage()]]]),
      cursors: new Map([[ROOM_ID, CURSOR]]),
      hasMore: new Map([[ROOM_ID, false]]),
      pendingIds: new Set(),
    });

    const { result: result2, unmount: unmount2 } = renderHook(
      () => useInfiniteMessages(ROOM_ID),
    );
    await act(async () => { await result2.current.loadMore(); });
    unmount2();

    expect(mockFetch).not.toHaveBeenCalled();
  });
});
