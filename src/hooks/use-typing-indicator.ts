"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { RealtimeChannel, TypingPayload } from "@/lib/realtime";
import { useThrottle } from "./use-throttle";
import type { TypingUser, UseTypingReturn } from "@/types/messages";

type TypingMapEntry = { username: string; expiresAt: number };

function deriveTypingUsers(
  map: Map<string, TypingMapEntry>,
): TypingUser[] {
  return Array.from(map.entries()).map(([user_id, { username, expiresAt }]) => ({
    user_id,
    username,
    expires_at: expiresAt,
  }));
}

export function useTyping(
  channel: RealtimeChannel | null,
  currentUserId: string | null,
  username: string | null,
): UseTypingReturn {
  const [isTypingInternal, setIsTypingInternal] = useState(false);
  const throttledIsTyping = useThrottle(isTypingInternal, 1500);

  const typingMapRef = useRef<Map<string, TypingMapEntry>>(new Map());
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);

  // Outbound: throttled true broadcasts
  useEffect(() => {
    if (!channel || !currentUserId || !username || !throttledIsTyping) return;
    channel.broadcast("typing", {
      user_id: currentUserId,
      username,
      is_typing: true,
    } satisfies TypingPayload);
  }, [throttledIsTyping, channel, currentUserId, username]);

  // Inbound: register onBroadcast listener
  useEffect(() => {
    if (!channel) return;

    const unsubscribe = channel.onBroadcast("typing", (raw) => {
      const payload = raw as unknown as TypingPayload;
      const { user_id, username: senderUsername, is_typing } = payload;

      if (user_id === currentUserId) return;

      if (is_typing) {
        typingMapRef.current.set(user_id, {
          username: senderUsername,
          expiresAt: Date.now() + 3000,
        });
      } else {
        typingMapRef.current.delete(user_id);
      }

      setTypingUsers(deriveTypingUsers(typingMapRef.current));
    });

    return () => {
      unsubscribe();
    };
  }, [channel, currentUserId]);

  // Prune: 200 ms interval clears expired entries
  useEffect(() => {
    const id = setInterval(() => {
      const before = typingMapRef.current.size;
      const now = Date.now();
      for (const [userId, entry] of typingMapRef.current) {
        if (entry.expiresAt < now) {
          typingMapRef.current.delete(userId);
        }
      }
      if (typingMapRef.current.size !== before) {
        setTypingUsers(deriveTypingUsers(typingMapRef.current));
      }
    }, 200);

    return () => {
      clearInterval(id);
    };
  }, []);

  const broadcastTyping = useCallback(
    (isTyping: boolean) => {
      if (isTyping) {
        setIsTypingInternal(true);
      } else {
        setIsTypingInternal(false);
        if (!channel || !currentUserId || !username) return;
        channel.broadcast("typing", {
          user_id: currentUserId,
          username,
          is_typing: false,
        } satisfies TypingPayload);
      }
    },
    [channel, currentUserId, username],
  );

  return { typingUsers, broadcastTyping };
}
