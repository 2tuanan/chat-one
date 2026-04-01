"use client";

import { useEffect, useRef } from "react";
import type { AuthUser, Profile } from "@/types/auth";
import { useAuthStore } from "@/store/auth-store";

type AuthHydrationProps = {
  user: AuthUser | null;
  profile: Profile | null;
  children: React.ReactNode;
};

export default function AuthHydration({
  user,
  profile,
  children,
}: AuthHydrationProps) {
  const hydrate = useAuthStore((state) => state.hydrate);
  const hasHydrated = useRef(false);

  useEffect(() => {
    if (hasHydrated.current) {
      return;
    }

    hydrate({ user, profile });
    hasHydrated.current = true;
  }, [hydrate, user, profile]);

  return <>{children}</>;
}
