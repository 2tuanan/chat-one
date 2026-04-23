"use server";

import { ZodError } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  SendMessageSchema,
  type SendMessageInput,
} from "@/lib/validation/messages";
import type { MessageWithProfile, PaginatedMessages } from "@/types/messages";

export type SendMessageResult = {
  message?: MessageWithProfile;
  error?: string;
  fieldErrors?: Record<string, string>;
};

type RawMessage = Omit<MessageWithProfile, "sender"> & {
  sender?: MessageWithProfile["sender"] | MessageWithProfile["sender"][];
};

const normalizeMessage = (message: RawMessage): MessageWithProfile => {
  const sender = Array.isArray(message.sender)
    ? message.sender[0]
    : message.sender;

  return { ...message, sender } as MessageWithProfile;
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

export async function sendMessage(
  roomId: string,
  input: SendMessageInput,
): Promise<SendMessageResult> {
  const parsed = SendMessageSchema.safeParse(input);
  if (!parsed.success) {
    return { fieldErrors: toFieldErrors(parsed.error) };
  }

  if (!roomId) {
    return { error: "Room not found." };
  }

  const supabase = await createServerSupabaseClient();
  const { data } = await supabase.auth.getUser();

  if (!data.user) {
    return { error: "You must be signed in to send a message." };
  }

  const { data: message, error } = await supabase
    .from("messages")
    .insert({
      room_id: roomId,
      sender_id: data.user.id,
      content: parsed.data.content,
      type: "text",
    })
    .select(
      "id, room_id, sender_id, content, type, created_at, updated_at, deleted_at, sender:profiles!sender_id(id, username, display_name, avatar_url)",
    )
    .single();

  if (error || !message) {
    return { error: error?.message ?? "Unable to send message." };
  }

  return { message: normalizeMessage(message as RawMessage) };
}

export async function fetchOlderMessages(
  roomId: string,
  cursor: string,
  limit: number = 50,
): Promise<PaginatedMessages> {
  if (!roomId || !cursor) {
    return { messages: [], nextCursor: null, hasMore: false };
  }

  const supabase = await createServerSupabaseClient();
  const { data: authData } = await supabase.auth.getUser();

  if (!authData.user) {
    return { messages: [], nextCursor: null, hasMore: false };
  }

  const { data, error } = await supabase
    .from("messages")
    .select(
      "id, room_id, sender_id, content, type, created_at, updated_at, deleted_at, sender:profiles!sender_id(id, username, display_name, avatar_url)",
    )
    .eq("room_id", roomId)
    .is("deleted_at", null)
    .lt("created_at", cursor)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error || !data) {
    return { messages: [], nextCursor: null, hasMore: false };
  }

  // Reverse to ASC order (oldest first), matching initialMessages order from RSC
  const reversed = (data as RawMessage[]).reverse().map(normalizeMessage);

  // nextCursor = created_at of the oldest message in this page
  // After reversing, reversed[0] is the oldest (was last in DESC result)
  const hasMore = data.length === limit;
  const nextCursor = hasMore ? (reversed[0]?.created_at ?? null) : null;

  return { messages: reversed, nextCursor, hasMore };
}
