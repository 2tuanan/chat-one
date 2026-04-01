"use client";

import { useEffect } from "react";
import { useShallow } from "zustand/react/shallow";
import { useRoomStore } from "@/store/room-store";
import type { Room } from "@/types/rooms";
import RoomItem from "@/components/rooms/room-item";
import CreateRoomDialog from "@/components/rooms/create-room-dialog";

type RoomListClientProps = {
  initialRooms: Room[];
};

export default function RoomListClient({ initialRooms }: RoomListClientProps) {
  const setRooms = useRoomStore((state) => state.setRooms);
  const rooms = useRoomStore(
    useShallow((state) =>
      Array.from(state.rooms.values()).sort(
        (a, b) =>
          new Date(b.updated_at).getTime() -
          new Date(a.updated_at).getTime(),
      ),
    ),
  );
  const activeRoomId = useRoomStore((state) => state.activeRoomId);
  const unreadCounts = useRoomStore((state) => state.unreadCounts);
  const setActiveRoom = useRoomStore((state) => state.setActiveRoom);

  useEffect(() => {
    setRooms(initialRooms);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Rooms
          </p>
          <p className="text-sm text-zinc-700">Your conversations</p>
        </div>
        <CreateRoomDialog />
      </div>
      <div className="flex-1 overflow-y-auto px-2 py-3">
        {rooms.length === 0 ? (
          <p className="px-3 py-6 text-sm text-zinc-500">
            No rooms yet. Create one to get started.
          </p>
        ) : (
          <ul className="space-y-1">
            {rooms.map((room) => (
              <li key={room.id}>
                <RoomItem
                  room={room}
                  unreadCount={unreadCounts.get(room.id) ?? 0}
                  isActive={room.id === activeRoomId}
                  onSelect={() => setActiveRoom(room.id)}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
