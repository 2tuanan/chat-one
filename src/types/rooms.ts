import type { PresencePayload } from "@/lib/realtime/types";
import type { Profile } from "@/types/auth";

export type RoomType = "direct" | "group";
export type MemberRole = "owner" | "admin" | "member";

export interface Room {
  id: string;
  name: string;
  description: string | null;
  type: RoomType;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface RoomMember {
  room_id: string;
  user_id: string;
  role: MemberRole;
  joined_at: string;
}

export interface RoomWithMeta extends Room {
  member_count: number;
  unread_count?: number;
}

export interface UsePresenceReturn {
  onlineUsers: PresencePayload[];
  onlineCount: number;
}

export type AddMemberResult = {
  success?: true;
  addedUsername?: string;
  newMemberCount?: number;
  error?: string;
  fieldErrors?: Record<string, string>;
};

export type SearchUser = Pick<
  Profile,
  "id" | "username" | "display_name" | "avatar_url"
>;

export interface SearchResult {
  rooms: Room[];
  users: SearchUser[];
}
