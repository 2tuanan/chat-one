"use client";

import { useRoomStore } from "@/store/room-store";
import { useDebouncedSearch } from "@/hooks/use-debounced-search";
import RoomItem from "@/components/rooms/room-item";

type RoomSearchProps = {
  query: string;
};

function SearchSkeletonRows() {
  return (
    <div className="space-y-2" aria-hidden="true">
      <div className="h-9 rounded-lg bg-zinc-100 animate-pulse" />
      <div className="h-9 rounded-lg bg-zinc-100 animate-pulse" />
      <div className="h-9 rounded-lg bg-zinc-100 animate-pulse" />
    </div>
  );
}

export default function RoomSearch({ query }: RoomSearchProps) {
  const { results, isLoading } = useDebouncedSearch(query);
  const activeRoomId = useRoomStore((state) => state.activeRoomId);
  const unreadCounts = useRoomStore((state) => state.unreadCounts);
  const setActiveRoom = useRoomStore((state) => state.setActiveRoom);

  const rooms = results?.rooms ?? [];
  const users = results?.users ?? [];

  return (
    <div className="space-y-4 px-1 pb-2">
      <section className="space-y-2">
        <p className="px-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Rooms
        </p>
        {isLoading ? (
          <SearchSkeletonRows />
        ) : rooms.length === 0 ? (
          <p className="px-2 text-sm text-zinc-500">No rooms found</p>
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
      </section>

      <section className="space-y-2">
        <p className="px-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
          People
        </p>
        {isLoading ? (
          <SearchSkeletonRows />
        ) : users.length === 0 ? (
          <p className="px-2 text-sm text-zinc-500">No users found</p>
        ) : (
          <ul className="space-y-1">
            {users.map((user) => (
              <li
                key={user.id}
                className="rounded-lg border border-zinc-200 px-3 py-2"
              >
                <p className="truncate text-sm font-medium text-zinc-800">
                  @{user.username}
                </p>
                <p className="truncate text-xs text-zinc-500">
                  {user.display_name}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
