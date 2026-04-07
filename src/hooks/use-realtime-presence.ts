"use client";

import { useEffect, useState } from "react";
import type { RealtimeChannel, PresencePayload } from "@/lib/realtime";
import type { UsePresenceReturn } from "@/types/rooms";

export function usePresence(
  channel: RealtimeChannel | null,
  currentUserId: string | null,
): UsePresenceReturn {
  const [onlineUsers, setOnlineUsers] = useState<PresencePayload[]>([]);

  useEffect(() => {
    if (!channel || !currentUserId) return;

    const unsub = channel.onPresenceSync((state) => {
      const all = Object.values(state).flat();
      const seen = new Set<string>();
      const deduped: PresencePayload[] = [];
      for (const entry of all) {
        if (!seen.has(entry.user_id)) {
          seen.add(entry.user_id);
          deduped.push(entry);
        }
      }
      setOnlineUsers(deduped);
    });

    return () => {
      unsub();
      channel.untrack();
    };
  }, [channel, currentUserId]);

  return { onlineUsers, onlineCount: onlineUsers.length };
}
