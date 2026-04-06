import type { Profile } from "@/types/auth";

export type MessageStatus = "sending" | "sent" | "error";
export type MessageType = "text" | "system";

export interface Message {
  id: string;
  room_id: string;
  sender_id: string;
  content: string;
  type: MessageType;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface MessageWithProfile extends Message {
  sender: Pick<Profile, "id" | "username" | "display_name" | "avatar_url">;
}

export interface OptimisticMessage extends MessageWithProfile {
  status: MessageStatus;
  temp_id: string;
}

export interface TypingUser {
  user_id: string;
  username: string;
  expires_at: number;
}

export interface UseTypingReturn {
  typingUsers: TypingUser[];
  broadcastTyping: (isTyping: boolean) => void;
}

export interface ChatMessagesReturn {
  broadcastTyping: (isTyping: boolean) => void;
  typingUsers: TypingUser[];
}
