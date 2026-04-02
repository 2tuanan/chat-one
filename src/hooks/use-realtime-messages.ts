"use client";

import { useEffect } from "react";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { getBrowserClient } from "@/lib/supabase/client";
import { useMessageStore } from "@/store/message-store";
import type { MessageWithProfile } from "@/types/messages";

type MessageInsertPayload = {
  id: string;
  sender_id: string;
};

type RawMessage = Omit<MessageWithProfile, "sender"> & {
  sender?: MessageWithProfile["sender"] | MessageWithProfile["sender"][];
};

const normalizeMessage = (message: RawMessage): MessageWithProfile => {
  const sender = Array.isArray(message.sender)
    ? message.sender[0]
    : message.sender;

  return { ...message, sender } as MessageWithProfile;
};

type UseRealtimeMessagesParams = {
  roomId: string;
  currentUserId: string | null;
};

export function useRealtimeMessages({
  roomId,
  currentUserId,
}: UseRealtimeMessagesParams) {
  const appendNewMessage = useMessageStore((state) => state.appendNewMessage);

  useEffect(() => {
    if (!roomId || !currentUserId) {
      return;
    }

    const supabase = getBrowserClient();
    const channel = supabase.channel(`room:${roomId}`);

    channel
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `room_id=eq.${roomId}`,
        },
        async (
          payload: RealtimePostgresChangesPayload<MessageInsertPayload>,
        ) => {
          const next = payload.new as MessageInsertPayload;

          if (next.sender_id === currentUserId) {
            return;
          }

          const { data, error } = await supabase
            .from("messages")
            .select(
              "id, room_id, sender_id, content, type, created_at, updated_at, deleted_at, sender:profiles!sender_id(id, username, display_name, avatar_url)",
            )
            .eq("id", next.id)
            .single();

          if (error || !data) {
            return;
          }

          appendNewMessage(roomId, normalizeMessage(data as RawMessage));
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId, currentUserId, appendNewMessage]);
}
