import type { ReactNode } from "react";
import AuthHydration from "@/components/auth/auth-hydration";
import RoomList from "@/components/rooms/room-list";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { AuthUser, Profile } from "@/types/auth";

export default async function ChatLayout({
  children,
}: {
  children: ReactNode;
}) {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase.auth.getUser();
  const authUser: AuthUser | null = data.user
    ? { id: data.user.id, email: data.user.email ?? "" }
    : null;

  let profile: Profile | null = null;

  if (data.user) {
    const { data: profileData } = await supabase
      .from("profiles")
      .select("id, username, display_name, avatar_url, created_at, updated_at")
      .eq("id", data.user.id)
      .single();

    profile = profileData ? (profileData as Profile) : null;
  }

  return (
    <AuthHydration user={authUser} profile={profile}>
      <div className="flex min-h-screen bg-white text-zinc-950">
        <aside className="w-full max-w-xs border-r border-zinc-200 bg-zinc-50">
          <RoomList />
        </aside>
        <main className="flex min-w-0 flex-1 flex-col h-screen">{children}</main>
      </div>
    </AuthHydration>
  );
}
