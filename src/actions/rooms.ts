"use server";

import { ZodError } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  CreateRoomSchema,
  type CreateRoomInput,
} from "@/lib/validation/rooms";
import type { Room } from "@/types/rooms";

export type CreateRoomResult = {
  room?: Room;
  error?: string;
  fieldErrors?: Record<string, string>;
};

const toFieldErrors = (error: ZodError): Record<string, string> => {
  const fieldErrors: Record<string, string> = {};

  error.issues.forEach((issue) => {
    const field = issue.path[0];
    if (typeof field === "string" && !fieldErrors[field]) {
      fieldErrors[field] = issue.message;
    }
  });

  return fieldErrors;
};

export async function createRoom(
  input: CreateRoomInput,
): Promise<CreateRoomResult> {
  const parsed = CreateRoomSchema.safeParse(input);
  if (!parsed.success) {
    return { fieldErrors: toFieldErrors(parsed.error) };
  }

  const supabase = await createServerSupabaseClient();
  const { data } = await supabase.auth.getUser();

  if (!data.user) {
    return { error: "You must be signed in to create a room." };
  }

  const name = parsed.data.name.trim();
  const description = parsed.data.description?.trim() ?? "";
  const normalizedDescription = description.length > 0 ? description : null;

  const { data: room, error: roomError } = await supabase
    .from("rooms")
    .insert({
      name,
      description: normalizedDescription,
      type: parsed.data.type,
      created_by: data.user.id,
    })
    .select("id, name, description, type, created_by, created_at, updated_at")
    .single();

  if (roomError || !room) {
    return { error: roomError?.message ?? "Unable to create room." };
  }

  const { error: membershipError } = await supabase
    .from("room_members")
    .insert({
      room_id: room.id,
      user_id: data.user.id,
      role: "owner",
    });

  if (membershipError) {
    return { error: membershipError.message };
  }

  return { room: room as Room };
}
