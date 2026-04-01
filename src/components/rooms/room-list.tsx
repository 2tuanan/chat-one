import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Room } from "@/types/rooms";
import RoomListClient from "@/components/rooms/room-list-client";

type RoomRow = Room & {
  room_members?: { user_id: string }[];
};

export default async function RoomList() {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase.auth.getUser();

  if (!data.user) {
    return <RoomListClient initialRooms={[]} />;
  }

  const { data: roomsData, error } = await supabase
    .from("rooms")
    .select(
      "id, name, description, type, created_by, created_at, updated_at, room_members!inner(user_id)",
    )
    .eq("room_members.user_id", data.user.id)
    .order("updated_at", { ascending: false });

  if (error || !roomsData) {
    return <RoomListClient initialRooms={[]} />;
  }

  const rooms: Room[] = (roomsData as RoomRow[]).map((room) => ({
    id: room.id,
    name: room.name,
    description: room.description,
    type: room.type,
    created_by: room.created_by,
    created_at: room.created_at,
    updated_at: room.updated_at,
  }));

  return <RoomListClient initialRooms={rooms} />;
}
