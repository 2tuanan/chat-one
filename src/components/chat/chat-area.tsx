"use client";

import { useChatMessages } from "@/hooks/use-chat-messages";
import ChatHeader from "@/components/chat/chat-header";
import MessageList from "@/components/chat/message-list";
import MessageInput from "@/components/chat/message-input";
import TypingIndicator from "@/components/chat/typing-indicator";
import type { Room } from "@/types/rooms";
import type { MessageWithProfile } from "@/types/messages";

type ChatAreaProps = {
  roomId: string;
  room: Room;
  memberCount: number;
  currentUserId: string | null;
  initialMessages: MessageWithProfile[];
};

export default function ChatArea({
  roomId,
  room,
  memberCount,
  currentUserId,
  initialMessages,
}: ChatAreaProps) {
  const { broadcastTyping, typingUsers, onlineCount } = useChatMessages(roomId, currentUserId);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ChatHeader room={room} memberCount={memberCount} onlineCount={onlineCount} />
      <MessageList roomId={roomId} initialMessages={initialMessages} />
      <TypingIndicator typingUsers={typingUsers} />
      <MessageInput roomId={roomId} broadcastTyping={broadcastTyping} />
    </div>
  );
}
