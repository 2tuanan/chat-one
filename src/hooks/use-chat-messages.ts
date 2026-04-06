"use client";

import { useEffect, useState } from "react";
import {
  getDefaultRealtimeProvider,
  supabaseFetchMessageById,
} from "@/lib/realtime";
import type { RealtimeChannel } from "@/lib/realtime";
import { useRealtimeMessages } from "./use-realtime-messages";

export function useChatMessages(
  roomId: string,
  currentUserId: string | null,
): void {
  const [channel, setChannel] = useState<RealtimeChannel | null>(null);

  // Effect A: create channel, no subscribe yet — subscribe must happen after
  // useRealtimeMessages wires its inner.on() listener (Effect B below).
  useEffect(() => {
    if (!roomId) return;

    const provider = getDefaultRealtimeProvider();
    const ch = provider.createChannel(roomId);
    setChannel(ch);

    return () => {
      provider.removeChannel(ch);
      setChannel(null);
    };
  }, [roomId]);

  // useRealtimeMessages registers inner.on('postgres_changes') here.
  // React guarantees this effect runs before Effect B in the same render pass.
  useRealtimeMessages({
    roomId,
    currentUserId,
    channel,
    fetchMessage: supabaseFetchMessageById,
  });

  // Effect B: subscribe only after useRealtimeMessages has wired its listener.
  // SupabaseChannel.subscribe() is idempotent — safe to call on stale channels
  // during roomId-change transitions (disposed channels ignore the call).
  useEffect(() => {
    if (!channel) return;

    channel.subscribe((status, err) => {
      if (status === "subscribed") {
        console.debug("[realtime] subscribed to room:", roomId);
      }
      if (status === "error") {
        console.error("[realtime] channel error:", err);
        // TODO Sprint 2: add exponential backoff reconnect (R1 in risk matrix)
      }
    });
  }, [channel, roomId]);
}
