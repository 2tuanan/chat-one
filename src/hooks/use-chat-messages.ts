"use client";

import { useEffect, useRef, useState } from "react";
import {
  getDefaultRealtimeProvider,
  supabaseFetchMessageById,
} from "@/lib/realtime";
import type { RealtimeChannel } from "@/lib/realtime";
import { useRealtimeMessages } from "./use-realtime-messages";
import { useTyping } from "./use-typing-indicator";
import { usePresence } from "./use-realtime-presence";
import { useAuthStore } from "@/store/auth-store";
import type { ChatMessagesReturn } from "@/types/messages";

export function useChatMessages(
  roomId: string,
  currentUserId: string | null,
): ChatMessagesReturn {
  const [channel, setChannel] = useState<RealtimeChannel | null>(null);
  // Tracks whether the current channel has been disposed (removed during cleanup).
  // Prevents logging CHANNEL_ERROR status events that fire during normal teardown
  // when navigating between rooms.
  const disposedRef = useRef(false);

  const username = useAuthStore((state) => state.profile?.username ?? null);

  // Effect A: create channel. Deps include currentUserId and username so the
  // channel is recreated if auth identity changes. No subscribe yet — all
  // .on() listeners must be registered before .subscribe() is called (Supabase
  // requirement). The sub-hooks below wire their listeners; Effect B subscribes.
  useEffect(() => {
    if (!roomId || !currentUserId || !username) return;

    const provider = getDefaultRealtimeProvider();
    // Reset disposed flag — this is a fresh channel, not a teardown
    disposedRef.current = false;
    const ch = provider.createChannel(roomId);
    setChannel(ch);

    return () => {
      // Mark as disposed BEFORE removeChannel so the subscribe status callback
      // ignores any CHANNEL_ERROR events fired during teardown
      disposedRef.current = true;
      provider.removeChannel(ch);
      setChannel(null);
    };
  }, [roomId, currentUserId, username]);

  // useRealtimeMessages registers inner.on('postgres_changes') here.
  // React guarantees this effect runs before Effect B in the same render pass.
  useRealtimeMessages({
    roomId,
    currentUserId,
    channel,
    fetchMessage: supabaseFetchMessageById,
  });

  const { typingUsers, broadcastTyping } = useTyping(channel, currentUserId, username);
  const { onlineUsers, onlineCount } = usePresence(channel, currentUserId);

  // Effect B: subscribe AFTER all sub-hooks have registered their listeners.
  // React guarantees effects run in hook-call order so useRealtimeMessages,
  // useTyping, and usePresence effects all fire before this one.
  // track() is called inside the 'subscribed' callback — the only safe point
  // after Supabase confirms the channel is joined.
  useEffect(() => {
    if (!channel || !currentUserId || !username) return;

    channel.subscribe((status, err) => {
      // Ignore all status events after the channel has been disposed — these are
      // teardown artifacts (e.g. CHANNEL_ERROR fired by Supabase during removal)
      // and not real errors.
      if (disposedRef.current) return;
      if (status === "subscribed") {
        console.debug("[realtime] subscribed to room:", roomId);
        channel.track({
          user_id: currentUserId,
          username,
          online_at: new Date().toISOString(),
        });
      }
      if (status === "error") {
        console.error("[realtime] channel error:", err ?? "connection failed");
        // TODO Sprint 2: add exponential backoff reconnect (R1 in risk matrix)
      }
    });
  }, [channel, currentUserId, username, roomId]);

  return { broadcastTyping, typingUsers, onlineUsers, onlineCount };
}

