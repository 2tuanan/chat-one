import { create } from "zustand";
import type { Room } from "@/types/rooms";

export interface RoomStore {
  rooms: Map<string, Room>;
  activeRoomId: string | null;
  unreadCounts: Map<string, number>;
  setRooms: (rooms: Room[]) => void;
  addRoom: (room: Room) => void;
  setActiveRoom: (id: string | null) => void;
  updateUnreadCount: (roomId: string, delta: number) => void;
  resetUnreadCount: (roomId: string) => void;
  selectRoomList: () => Room[];
  selectActiveRoom: () => Room | undefined;
}

export const initialRoomState: Pick<
  RoomStore,
  "rooms" | "activeRoomId" | "unreadCounts"
> = {
  rooms: new Map(),
  activeRoomId: null,
  unreadCounts: new Map(),
};

export const useRoomStore = create<RoomStore>((set, get) => ({
  ...initialRoomState,
  setRooms: (rooms) => {
    const roomMap = new Map(rooms.map((room) => [room.id, room]));
    set({ rooms: roomMap });
  },
  addRoom: (room) =>
    set((state) => {
      const rooms = new Map(state.rooms);
      rooms.set(room.id, room);
      return { rooms };
    }),
  setActiveRoom: (id) => set({ activeRoomId: id }),
  updateUnreadCount: (roomId, delta) =>
    set((state) => {
      const unreadCounts = new Map(state.unreadCounts);
      const current = unreadCounts.get(roomId) ?? 0;
      unreadCounts.set(roomId, current + delta);
      return { unreadCounts };
    }),
  resetUnreadCount: (roomId) =>
    set((state) => {
      const unreadCounts = new Map(state.unreadCounts);
      unreadCounts.set(roomId, 0);
      return { unreadCounts };
    }),
  selectRoomList: () => {
    const rooms = Array.from(get().rooms.values());
    return rooms.sort(
      (a, b) =>
        new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
    );
  },
  selectActiveRoom: () => {
    const activeRoomId = get().activeRoomId;
    if (!activeRoomId) {
      return undefined;
    }
    return get().rooms.get(activeRoomId);
  },
}));
