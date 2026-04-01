import { describe, expect, it } from "vitest";
import { getRedirectPath, isPublicAssetPath } from "@/middleware";

describe("middleware route guards", () => {
  it("redirects unauthenticated users from protected routes", () => {
    expect(getRedirectPath("/chat", false)).toBe("/login");
    expect(getRedirectPath("/chat/rooms", false)).toBe("/login");
  });

  it("redirects authenticated users away from auth routes", () => {
    expect(getRedirectPath("/login", true)).toBe("/chat");
    expect(getRedirectPath("/signup", true)).toBe("/chat");
  });

  it("does not redirect public routes", () => {
    expect(getRedirectPath("/", false)).toBeNull();
    expect(getRedirectPath("/about", true)).toBeNull();
  });

  it("skips public asset paths", () => {
    expect(isPublicAssetPath("/_next/static/chunk.js")).toBe(true);
    expect(isPublicAssetPath("/favicon.ico")).toBe(true);
    expect(isPublicAssetPath("/images/logo.png")).toBe(true);
    expect(isPublicAssetPath("/chat")).toBe(false);
  });
});
