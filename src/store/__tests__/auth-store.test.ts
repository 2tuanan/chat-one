import { beforeEach, describe, expect, it } from "vitest";
import { initialAuthState, useAuthStore } from "@/store/auth-store";

describe("auth store", () => {
  beforeEach(() => {
    useAuthStore.setState(initialAuthState);
  });

  it("starts empty", () => {
    const state = useAuthStore.getState();

    expect(state.user).toBeNull();
    expect(state.profile).toBeNull();
    expect(state.isLoading).toBe(false);
  });

  it("hydrates user and profile", () => {
    const user = { id: "user-1", email: "user@example.com" };
    const profile = {
      id: "user-1",
      username: "user_1",
      display_name: "User One",
      avatar_url: null,
      created_at: "2026-03-31T00:00:00Z",
      updated_at: "2026-03-31T00:00:00Z",
    };

    useAuthStore.getState().hydrate({ user, profile });

    const state = useAuthStore.getState();
    expect(state.user).toEqual(user);
    expect(state.profile).toEqual(profile);
    expect(state.isLoading).toBe(false);
  });

  it("clears state", () => {
    useAuthStore
      .getState()
      .hydrate({ user: { id: "user-2", email: "u@ex.com" }, profile: null });

    useAuthStore.getState().clear();

    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.profile).toBeNull();
    expect(state.isLoading).toBe(false);
  });
});
