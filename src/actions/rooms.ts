"use server";

import { ZodError } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  AddMemberSchema,
  type AddMemberInput,
  CreateRoomSchema,
  type CreateRoomInput,
} from "@/lib/validation/rooms";
import type { AddMemberResult, Room } from "@/types/rooms";

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

export async function addRoomMember(
  roomId: string,
  input: AddMemberInput,
): Promise<AddMemberResult> {
  const parsed = AddMemberSchema.safeParse(input);
  if (!parsed.success) {
    return { fieldErrors: toFieldErrors(parsed.error) };
  }

  const supabase = await createServerSupabaseClient();
  const { data: authData } = await supabase.auth.getUser();

  if (!authData.user) {
    return { error: "You must be signed in." };
  }

  // Ensure room exists and allow room.creator to act as owner
  const { data: roomRow, error: roomRowError } = await supabase
    .from("rooms")
    .select("created_by")
    .eq("id", roomId)
    .maybeSingle();

  if (roomRowError) {
    return { error: roomRowError.message };
  }

  if (!roomRow) {
    return { error: "Room not found." };
  }

  const isCreatorOwner = roomRow.created_by === authData.user.id;

  let callerIsPrivileged = isCreatorOwner;

  if (!callerIsPrivileged) {
    const { data: callerMembership, error: callerMembershipError } = await supabase
      .from("room_members")
      .select("role")
      .eq("room_id", roomId)
      .eq("user_id", authData.user.id)
      .maybeSingle();

    if (callerMembershipError) {
      return { error: callerMembershipError.message };
    }

    if (callerMembership && (callerMembership.role === "owner" || callerMembership.role === "admin")) {
      callerIsPrivileged = true;
    }
  }

  if (!callerIsPrivileged) {
    return { error: "Only room owners and admins can add members." };
  }

  const targetUsername = parsed.data.username.trim();
  const normalizedUsername = targetUsername.toLowerCase();

  // Case-insensitive lookup to be forgiving of case differences
  const { data: targetProfile, error: targetProfileError } = await supabase
    .from("profiles")
    .select("id")
    .ilike("username", normalizedUsername)
    .maybeSingle();

  if (targetProfileError) {
    return { error: targetProfileError.message };
  }

  if (!targetProfile) {
    return {
      error:
        `No profile found for username "${normalizedUsername}". ` +
        "Make sure the user has completed signup through the app.",
    };
  }

  const { data: existingMembership, error: existingMembershipError } = await supabase
    .from("room_members")
    .select("room_id")
    .eq("room_id", roomId)
    .eq("user_id", targetProfile.id)
    .maybeSingle();

  if (existingMembershipError) {
    return { error: existingMembershipError.message };
  }

  if (existingMembership) {
    return { error: "User is already a member of this room." };
  }

  const { error: insertError } = await supabase.from("room_members").insert({
    room_id: roomId,
    user_id: targetProfile.id,
    role: "member",
  });

  if (insertError) {
    return { error: insertError.message };
  }

  const { count: newMemberCount } = await supabase
    .from("room_members")
    .select("*", { count: "exact", head: true })
    .eq("room_id", roomId);

  return {
    success: true,
    addedUsername: targetUsername,
    newMemberCount: newMemberCount ?? 0,
  };
}
