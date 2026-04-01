"use client";

import type { KeyboardEvent } from "react";
import { Hash } from "lucide-react";
import type { Room } from "@/types/rooms";

type RoomItemProps = {
  room: Room;
  isActive: boolean;
  unreadCount: number;
  onSelect: () => void;
};

export default function RoomItem({
  room,
  isActive,
  unreadCount,
  onSelect,
}: RoomItemProps) {
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onSelect();
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={handleKeyDown}
      className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm transition ${
        isActive
          ? "bg-zinc-900 text-white"
          : "text-zinc-700 hover:bg-zinc-200"
      }`}
    >
      <div className="flex min-w-0 items-center gap-2">
        <Hash
          className={`h-4 w-4 flex-shrink-0 ${
            isActive ? "text-white" : "text-zinc-500"
          }`}
        />
        <span className="truncate">{room.name}</span>
      </div>
      {unreadCount > 0 ? (
        <span className="ml-2 inline-flex min-w-6 items-center justify-center rounded-full bg-emerald-500 px-2 text-xs font-semibold text-white">
          {unreadCount}
        </span>
      ) : null}
    </div>
  );
}
