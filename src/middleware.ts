import { NextRequest, NextResponse } from "next/server";
import { createMiddlewareSupabaseClient } from "@/lib/supabase/middleware";

const AUTH_ROUTES = new Set(["/login", "/signup"]);
const PROTECTED_PREFIXES = ["/chat"];
const PUBLIC_FILE = /\.(.*)$/;

export const isPublicAssetPath = (pathname: string) =>
  pathname.startsWith("/_next") ||
  pathname.startsWith("/favicon.ico") ||
  pathname.startsWith("/robots.txt") ||
  pathname.startsWith("/sitemap.xml") ||
  PUBLIC_FILE.test(pathname);

const isProtectedPath = (pathname: string) =>
  PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );

export const getRedirectPath = (pathname: string, hasUser: boolean) => {
  if (hasUser && AUTH_ROUTES.has(pathname)) {
    return "/chat";
  }

  if (!hasUser && isProtectedPath(pathname)) {
    return "/login";
  }

  return null;
};

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isPublicAssetPath(pathname)) {
    return NextResponse.next();
  }

  const { supabase, response } = createMiddlewareSupabaseClient(request);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const redirectPath = getRedirectPath(pathname, Boolean(user));
  if (redirectPath) {
    const redirectUrl = request.nextUrl.clone();
    const redirectTo = `${pathname}${request.nextUrl.search}`;

    redirectUrl.pathname = redirectPath;

    if (redirectPath === "/login") {
      redirectUrl.searchParams.set("redirectTo", redirectTo);
    }

    const redirectResponse = NextResponse.redirect(redirectUrl);
    response.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie);
    });
    return redirectResponse;
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map)$).*)",
  ],
};
