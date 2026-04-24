import { redirect } from "next/navigation";
import ChatArea from "@/components/chat/chat-area";
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

  const { count: memberCount, error: memberCountError } = await supabase
    .from("room_members")
    .select("*", { count: "exact", head: true })
    .eq("room_id", roomId);

  if (memberCountError) {
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
  const initialMessages =
    messagesError || !messagesData
      ? []
      : (messagesData as RawMessage[])
          .reverse()
          .map((message) => normalizeMessage(message));

  return (
    <ChatArea
      roomId={roomId}
      room={room}
      memberCount={memberCount ?? 0}
      currentUserId={authData.user.id}
      initialMessages={initialMessages}
    />
  );
}
