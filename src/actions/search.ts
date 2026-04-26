"use server";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Room, SearchUser } from "@/types/rooms";

const MAX_QUERY_LENGTH = 80;
const MIN_QUERY_LENGTH = 2;

const normalizeQuery = (query: string): string => query.trim().slice(0, MAX_QUERY_LENGTH);
const normalizeOrQuery = (query: string): string =>
  normalizeQuery(query).replace(/[^a-zA-Z0-9_\s-]/g, "");

export type SearchRoomsResult = {
  rooms: Room[];
  error?: string;
};

export type SearchUsersResult = {
  users: SearchUser[];
  error?: string;
};

export async function searchRooms(query: string): Promise<SearchRoomsResult> {
  const normalizedQuery = normalizeQuery(query);
  if (normalizedQuery.length < MIN_QUERY_LENGTH) {
    return { rooms: [] };
  }

  const supabase = await createServerSupabaseClient();
  const { data } = await supabase.auth.getUser();

  if (!data.user) {
    return { rooms: [], error: "Unauthorized" };
  }

  const { data: rooms, error } = await supabase
    .from("rooms")
    .select("id, name, description, type, created_by, created_at, updated_at")
    .ilike("name", `%${normalizedQuery}%`)
    .order("updated_at", { ascending: false })
    .limit(20);

  if (error) {
    return { rooms: [], error: error.message };
  }

  return { rooms: (rooms ?? []) as Room[] };
}

export async function searchUsers(query: string): Promise<SearchUsersResult> {
  const normalizedQuery = normalizeOrQuery(query);
  if (normalizedQuery.length < MIN_QUERY_LENGTH) {
    return { users: [] };
  }

  const supabase = await createServerSupabaseClient();
  const { data } = await supabase.auth.getUser();

  if (!data.user) {
    return { users: [], error: "Unauthorized" };
  }

  const { data: users, error } = await supabase
    .from("profiles")
    .select("id, username, display_name, avatar_url")
    .or(`username.ilike.%${normalizedQuery}%,display_name.ilike.%${normalizedQuery}%`)
    .neq("id", data.user.id)
    .order("username", { ascending: true })
    .limit(20);

  if (error) {
    return { users: [], error: error.message };
  }

  return { users: (users ?? []) as SearchUser[] };
}
