"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Hash, UserPlus, Users } from "lucide-react";
import { toast } from "sonner";
import { addRoomMember } from "@/actions/rooms";
import type { Room } from "@/types/rooms";

type ChatHeaderProps = {
  room: Room;
  roomId: string;
  currentUserId: string | null;
  memberCount?: number;
  onlineCount: number;
};

const formatRoomType = (type: Room["type"]) =>
  type === "direct" ? "Direct" : "Group";

export default function ChatHeader({
  room,
  roomId,
  currentUserId,
  memberCount,
  onlineCount,
}: ChatHeaderProps) {
  const router = useRouter();
  const [showAddMember, setShowAddMember] = useState(false);
  const [username, setUsername] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const isOwner = !!currentUserId && room.created_by === currentUserId;

  const handleAddMember = () => {
    setFieldError(null);

    startTransition(async () => {
      const result = await addRoomMember(roomId, { username });

      if (result.fieldErrors?.username) {
        setFieldError(result.fieldErrors.username);
        return;
      }

      if (result.error) {
        setFieldError(result.error);
        return;
      }

      toast.success(`${result.addedUsername} added to the room.`);
      setUsername("");
      setShowAddMember(false);
      router.refresh();
    });
  };

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
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 rounded-full border border-zinc-200 px-3 py-1 text-xs font-medium text-zinc-600">
            <Users className="h-3.5 w-3.5" />
            <span>{memberCount ?? 0} members</span>
          </div>
          <div
            className="flex items-center gap-1.5 rounded-full border border-zinc-200 px-3 py-1 text-xs font-medium text-zinc-600"
            aria-label={`${onlineCount} users online`}
          >
            <span className="inline-block h-2 w-2 rounded-full bg-green-500" aria-hidden="true" />
            <span>{onlineCount} online</span>
          </div>
          {isOwner ? (
            <button
              type="button"
              onClick={() => {
                setShowAddMember((value) => !value);
                setFieldError(null);
              }}
              className="flex items-center gap-1.5 rounded-full border border-zinc-200 px-3 py-1 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-50"
              aria-label="Add member"
            >
              <UserPlus className="h-3.5 w-3.5" />
              Add Member
            </button>
          ) : null}
        </div>
      </div>
      {showAddMember ? (
        <>
          <div className="mt-3 flex items-center gap-2 border-t border-zinc-100 pt-3">
            <input
              type="text"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  handleAddMember();
                }
              }}
              placeholder="Enter username"
              disabled={isPending}
              autoFocus
              className="flex-1 rounded-md border border-zinc-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 disabled:opacity-50"
              aria-label="Username to add"
            />
            <button
              type="button"
              onClick={handleAddMember}
              disabled={isPending || username.trim().length < 3}
              className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50"
            >
              {isPending ? "Adding..." : "Add"}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowAddMember(false);
                setUsername("");
                setFieldError(null);
              }}
              disabled={isPending}
              className="rounded-md border border-zinc-200 px-3 py-1.5 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-50 disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
          {fieldError ? (
            <p className="mt-1 text-xs text-red-600" role="alert">
              {fieldError}
            </p>
          ) : null}
        </>
      ) : null}
    </header>
  );
}
