import { beforeEach, describe, expect, it } from "vitest";
import { initialRoomState, useRoomStore } from "@/store/room-store";
import type { Room } from "@/types/rooms";

describe("room store", () => {
  const roomA: Room = {
    id: "room-a",
    name: "Room A",
    description: "First room",
    type: "group",
    created_by: "user-1",
    created_at: "2026-04-01T00:00:00Z",
    updated_at: "2026-04-02T00:00:00Z",
  };

  const roomB: Room = {
    id: "room-b",
    name: "Room B",
    description: null,
    type: "direct",
    created_by: "user-2",
    created_at: "2026-04-01T00:00:00Z",
    updated_at: "2026-04-01T00:00:00Z",
  };

  beforeEach(() => {
    useRoomStore.setState({
      rooms: new Map(initialRoomState.rooms),
      activeRoomId: initialRoomState.activeRoomId,
      unreadCounts: new Map(initialRoomState.unreadCounts),
    });
  });

  it("starts empty", () => {
    const state = useRoomStore.getState();

    expect(state.rooms.size).toBe(0);
    expect(state.activeRoomId).toBeNull();
    expect(state.unreadCounts.size).toBe(0);
  });

  it("sets rooms from an array", () => {
    useRoomStore.getState().setRooms([roomB, roomA]);

    const state = useRoomStore.getState();
    expect(state.rooms.size).toBe(2);
    expect(state.rooms.get("room-a")).toEqual(roomA);
    expect(state.rooms.get("room-b")).toEqual(roomB);
  });

  it("adds a room without clearing existing rooms", () => {
    useRoomStore.getState().setRooms([roomA]);
    useRoomStore.getState().addRoom(roomB);

    const state = useRoomStore.getState();
    expect(state.rooms.size).toBe(2);
    expect(state.rooms.get("room-b")).toEqual(roomB);
  });

  it("sets and selects the active room", () => {
    useRoomStore.getState().setRooms([roomA, roomB]);
    useRoomStore.getState().setActiveRoom("room-b");

    const state = useRoomStore.getState();
    expect(state.activeRoomId).toBe("room-b");
    expect(state.selectActiveRoom()).toEqual(roomB);
  });

  it("updates and resets unread counts", () => {
    useRoomStore.getState().updateUnreadCount("room-a", 2);
    useRoomStore.getState().updateUnreadCount("room-a", 3);

    let state = useRoomStore.getState();
    expect(state.unreadCounts.get("room-a")).toBe(5);

    useRoomStore.getState().resetUnreadCount("room-a");
    state = useRoomStore.getState();
    expect(state.unreadCounts.get("room-a")).toBe(0);
  });
});
