// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useDebouncedSearch } from "@/hooks/use-debounced-search";

vi.mock("@/actions/search", () => ({
  searchRooms: vi.fn(),
  searchUsers: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
  },
}));

import { searchRooms, searchUsers } from "@/actions/search";
import { toast } from "sonner";

const mockSearchRooms = vi.mocked(searchRooms);
const mockSearchUsers = vi.mocked(searchUsers);
const mockToastError = vi.mocked(toast.error);

const flushMicrotasks = async () => {
  await act(async () => {
    await Promise.resolve();
  });
};

describe("useDebouncedSearch", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("does not call server actions when query length is below 2", () => {
    const { result, rerender } = renderHook(({ query }) => useDebouncedSearch(query), {
      initialProps: { query: "" },
    });

    act(() => {
      rerender({ query: "a" });
    });

    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(mockSearchRooms).not.toHaveBeenCalled();
    expect(mockSearchUsers).not.toHaveBeenCalled();
    expect(result.current.results).toBeNull();
  });

  it("calls both server actions with debounced query", async () => {
    mockSearchRooms.mockResolvedValue({ rooms: [] });
    mockSearchUsers.mockResolvedValue({ users: [] });

    const { rerender } = renderHook(({ query }) => useDebouncedSearch(query), {
      initialProps: { query: "" },
    });

    act(() => {
      rerender({ query: "gen" });
    });

    act(() => {
      vi.advanceTimersByTime(299);
    });

    expect(mockSearchRooms).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(1);
    });

    await flushMicrotasks();

    expect(mockSearchRooms).toHaveBeenCalledWith("gen");
    expect(mockSearchUsers).toHaveBeenCalledWith("gen");
  });

  it("returns merged rooms and users results on success", async () => {
    mockSearchRooms.mockResolvedValue({
      rooms: [
        {
          id: "room-1",
          name: "General",
          description: null,
          type: "group",
          created_by: "user-1",
          created_at: "2026-01-01T00:00:00.000Z",
          updated_at: "2026-01-01T00:00:00.000Z",
        },
      ],
    });
    mockSearchUsers.mockResolvedValue({
      users: [
        {
          id: "user-2",
          username: "genie",
          display_name: "Genie",
          avatar_url: null,
        },
      ],
    });

    const { result, rerender } = renderHook(
      ({ query }) => useDebouncedSearch(query),
      { initialProps: { query: "" } },
    );

    act(() => {
      rerender({ query: "gen" });
    });

    act(() => {
      vi.advanceTimersByTime(300);
    });

    await flushMicrotasks();

    expect(result.current.results).toEqual({
      rooms: [
        {
          id: "room-1",
          name: "General",
          description: null,
          type: "group",
          created_by: "user-1",
          created_at: "2026-01-01T00:00:00.000Z",
          updated_at: "2026-01-01T00:00:00.000Z",
        },
      ],
      users: [
        {
          id: "user-2",
          username: "genie",
          display_name: "Genie",
          avatar_url: null,
        },
      ],
    });
  });

  it("shows toast on action error and falls back to empty list", async () => {
    mockSearchRooms.mockResolvedValue({ rooms: [], error: "boom" });
    mockSearchUsers.mockRejectedValue(new Error("failed"));

    const { result, rerender } = renderHook(
      ({ query }) => useDebouncedSearch(query),
      { initialProps: { query: "" } },
    );

    act(() => {
      rerender({ query: "gen" });
    });

    act(() => {
      vi.advanceTimersByTime(300);
    });

    await flushMicrotasks();

    expect(result.current.results).toEqual({ rooms: [], users: [] });

    expect(mockToastError).toHaveBeenCalledWith("Search failed. Please try again.");
  });

  it("resets results to null when query becomes empty", async () => {
    mockSearchRooms.mockResolvedValue({
      rooms: [
        {
          id: "room-1",
          name: "General",
          description: null,
          type: "group",
          created_by: "user-1",
          created_at: "2026-01-01T00:00:00.000Z",
          updated_at: "2026-01-01T00:00:00.000Z",
        },
      ],
    });
    mockSearchUsers.mockResolvedValue({ users: [] });

    const { result, rerender } = renderHook(
      ({ query }) => useDebouncedSearch(query),
      { initialProps: { query: "" } },
    );

    act(() => {
      rerender({ query: "gen" });
    });

    act(() => {
      vi.advanceTimersByTime(300);
    });

    await flushMicrotasks();

    expect(result.current.results?.rooms.length).toBe(1);

    act(() => {
      rerender({ query: "" });
    });

    expect(result.current.results).toBeNull();
  });

  it("exposes loading state while searching", async () => {
    let resolveRooms!: (value: { rooms: [] }) => void;
    let resolveUsers!: (value: { users: [] }) => void;

    const roomsPromise = new Promise<{ rooms: [] }>((resolve) => {
      resolveRooms = resolve;
    });
    const usersPromise = new Promise<{ users: [] }>((resolve) => {
      resolveUsers = resolve;
    });

    mockSearchRooms.mockReturnValueOnce(roomsPromise);
    mockSearchUsers.mockReturnValueOnce(usersPromise);

    const { result, rerender } = renderHook(
      ({ query }) => useDebouncedSearch(query),
      { initialProps: { query: "" } },
    );

    act(() => {
      rerender({ query: "gen" });
    });

    act(() => {
      vi.advanceTimersByTime(300);
    });

    await flushMicrotasks();

    expect(result.current.isLoading).toBe(true);

    await act(async () => {
      resolveRooms({ rooms: [] });
      resolveUsers({ users: [] });
      await roomsPromise;
      await usersPromise;
    });

    await flushMicrotasks();

    expect(result.current.isLoading).toBe(false);
  });
});
