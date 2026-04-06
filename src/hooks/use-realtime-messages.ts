"use client";

import { useEffect } from "react";
import type { RealtimeChannel, FetchMessageById, MessageEvent } from "@/lib/realtime";
import { useMessageStore } from "@/store/message-store";
import type { MessageWithProfile } from "@/types/messages";

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
  channel: RealtimeChannel | null;
  fetchMessage: FetchMessageById;
};

export function useRealtimeMessages({
  roomId,
  currentUserId,
  channel,
  fetchMessage,
}: UseRealtimeMessagesParams) {
  const appendNewMessage = useMessageStore((state) => state.appendNewMessage);

  useEffect(() => {
    if (!roomId || !currentUserId || !channel) {
      return;
    }

    console.debug("[realtime] subscribing to room:", roomId);

    const unsubscribe = channel.onMessage(async (event: MessageEvent) => {
      console.debug("[realtime] payload received:", event);

      const data = await fetchMessage(event.messageId);

      if (!data) {
        console.warn("[realtime] fetch message failed for:", event.messageId);
        return;
      }

      appendNewMessage(roomId, normalizeMessage(data as RawMessage));
    });

    return () => {
      console.debug("[realtime] removing message listener for room:", roomId);
      unsubscribe();
    };
  }, [roomId, currentUserId, channel, fetchMessage, appendNewMessage]);
}
