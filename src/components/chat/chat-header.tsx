"use client";

import { Hash, Users } from "lucide-react";
import type { Room } from "@/types/rooms";

type ChatHeaderProps = {
  room: Room;
  memberCount?: number;
};

const formatRoomType = (type: Room["type"]) =>
  type === "direct" ? "Direct" : "Group";

export default function ChatHeader({ room, memberCount }: ChatHeaderProps) {
  return (
    <header className="border-b border-zinc-200 bg-white px-6 py-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-900 text-white">
            <Hash className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-zinc-900">
              {room.name}
            </h1>
            <p className="text-sm text-zinc-500">
              {formatRoomType(room.type)} room
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-zinc-200 px-3 py-1 text-xs font-medium text-zinc-600">
          <Users className="h-3.5 w-3.5" />
          <span>{memberCount ?? 0} members</span>
        </div>
      </div>
    </header>
  );
}
