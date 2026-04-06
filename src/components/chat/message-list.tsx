"use client";

import { useEffect, useRef } from "react";
import { useShallow } from "zustand/react/shallow";
import { useAuthStore } from "@/store/auth-store";
import { useMessageStore } from "@/store/message-store";
import { useRoomStore } from "@/store/room-store";
import type { MessageWithProfile, OptimisticMessage } from "@/types/messages";
import MessageItem from "@/components/chat/message-item";
import { sendMessage } from "@/actions/messages";

type MessageListProps = {
  roomId: string;
  initialMessages: MessageWithProfile[];
};

const getMessageId = (message: MessageWithProfile | OptimisticMessage) =>
  "temp_id" in message ? message.temp_id : message.id;

export default function MessageList({ roomId, initialMessages }: MessageListProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const hydratedRoomId = useRef<string | null>(null);
  const scrolledRoomId = useRef<string | null>(null);

  const currentUserId = useAuthStore((state) => state.user?.id ?? null);
  const prependMessages = useMessageStore((state) => state.prependMessages);
  const retryMessage = useMessageStore((state) => state.retryMessage);
  const confirmMessage = useMessageStore((state) => state.confirmMessage);
  const failMessage = useMessageStore((state) => state.failMessage);
  const setActiveRoom = useRoomStore((state) => state.setActiveRoom);

  const messages = useMessageStore(
    useShallow((state) => state.messages.get(roomId) ?? []),
  );

  useEffect(() => {
    if (hydratedRoomId.current === roomId) {
      return;
    }

    prependMessages(roomId, initialMessages, null);
    setActiveRoom(roomId);
    hydratedRoomId.current = roomId;
  }, [roomId, initialMessages, prependMessages, setActiveRoom]);

  useEffect(() => {
    if (!containerRef.current) {
      return;
    }

    if (scrolledRoomId.current === roomId) {
      return;
    }

    if (messages.length === 0) {
      return;
    }

    containerRef.current.scrollTop = containerRef.current.scrollHeight;
    scrolledRoomId.current = roomId;
  }, [messages.length, roomId]);

  const handleRetry = async (tempId: string, content: string) => {
    if (!roomId) {
      return;
    }

    retryMessage(tempId);
    const result = await sendMessage(roomId, { content });

    if (result.error || result.fieldErrors || !result.message) {
      failMessage(tempId);
      return;
    }

    confirmMessage(tempId, result.message);
  };

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto bg-zinc-50 px-6 py-5"
      >
        {messages.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-zinc-500">
            No messages yet. Start the conversation.
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((message) => (
              <MessageItem
                key={getMessageId(message)}
                message={message}
                isOwn={message.sender.id === currentUserId}
                onRetry={handleRetry}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
