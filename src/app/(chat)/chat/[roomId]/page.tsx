import { redirect } from "next/navigation";
import ChatHeader from "@/components/chat/chat-header";
import MessageInput from "@/components/chat/message-input";
import MessageList from "@/components/chat/message-list";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { MessageWithProfile } from "@/types/messages";
import type { Room } from "@/types/rooms";

type RoomRow = Room & { room_members?: { user_id: string }[] };

type RawMessage = Omit<MessageWithProfile, "sender"> & {
  sender?: MessageWithProfile["sender"] | MessageWithProfile["sender"][];
};

type RoomPageProps = {
  params: Promise<{ roomId: string }>;
};

const isValidRoomId = (roomId: string) =>
  /^[0-9a-fA-F-]{36}$/.test(roomId);

const normalizeMessage = (message: RawMessage): MessageWithProfile => {
  const sender = Array.isArray(message.sender)
    ? message.sender[0]
    : message.sender;

  return { ...message, sender } as MessageWithProfile;
};

export default async function RoomPage({ params }: RoomPageProps) {
  const { roomId } = await params;

  if (!isValidRoomId(roomId)) {
    redirect("/chat");
  }

  const supabase = await createServerSupabaseClient();
  const { data: authData } = await supabase.auth.getUser();

  if (!authData.user) {
    redirect("/login");
  }

  const { data: roomData, error: roomError } = await supabase
    .from("rooms")
    .select(
      "id, name, description, type, created_by, created_at, updated_at, room_members!inner(user_id)",
    )
    .eq("id", roomId)
    .eq("room_members.user_id", authData.user.id)
    .single();

  if (roomError || !roomData) {
    redirect("/chat");
  }

  const { data: messagesData, error: messagesError } = await supabase
    .from("messages")
    .select(
      "id, room_id, sender_id, content, type, created_at, updated_at, deleted_at, sender:profiles!sender_id(id, username, display_name, avatar_url)",
    )
    .eq("room_id", roomId)
    .order("created_at", { ascending: false })
    .limit(50);

  const room = roomData as RoomRow;
  const memberCount = room.room_members?.length ?? 0;
  const messages = messagesError || !messagesData
    ? []
    : (messagesData as RawMessage[])
      .map((message) => normalizeMessage(message))
        .reverse();

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ChatHeader room={room} memberCount={memberCount} />
      <MessageList roomId={roomId} initialMessages={messages} />
      <MessageInput roomId={roomId} />
    </div>
  );
}
