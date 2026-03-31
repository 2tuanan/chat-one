# Chat App — Full-Stack Architecture

> **Version:** 1.0  
> **Date:** 2026-03-30  
> **Author:** Aria (@architect)  
> **Stack:** Next.js 16 (App Router, React Compiler) · Supabase · Zustand · Tailwind CSS v4

---

## Table of Contents

1. [System Architecture Overview](#1-system-architecture-overview)
2. [Folder Structure](#2-folder-structure)
3. [Database Schema](#3-database-schema)
4. [Auth Flow](#4-auth-flow)
5. [Real-time Messaging Architecture](#5-real-time-messaging-architecture)
6. [Message Send Flow (Optimistic UI)](#6-message-send-flow-optimistic-ui)
7. [Cursor-based Pagination & Virtualization](#7-cursor-based-pagination--virtualization)
8. [State Management](#8-state-management)
9. [Search Architecture](#9-search-architecture)
10. [Integration Points & Risks](#10-integration-points--risks)
11. [Dependency Notes](#11-dependency-notes)

---

## 1. System Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                          BROWSER                                    │
│                                                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────────────────┐ │
│  │  next-themes  │  │    Sonner    │  │  React Components (RSC +  │ │
│  │  (dark mode)  │  │  (toasts)    │  │  Client Components)       │ │
│  └──────────────┘  └──────────────┘  └─────────┬─────────────────┘ │
│                                                  │                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────▼────────────────┐ │
│  │ React Hook   │  │  @tanstack/  │  │  Zustand Stores           │ │
│  │ Form + Zod   │  │  virtual     │  │  (messages, rooms, auth)  │ │
│  └──────────────┘  └──────────────┘  └──────────┬────────────────┘ │
│                                                  │                   │
│  ┌───────────────────────────────────────────────▼──────────────┐   │
│  │         Supabase Browser Client (@supabase/ssr)              │   │
│  │    ┌─────────────┐  ┌──────────────────────────────────┐     │   │
│  │    │  Auth (JWT)  │  │  Realtime (WebSocket channels)   │     │   │
│  │    └─────────────┘  └──────────────────────────────────┘     │   │
│  └──────────────────────────────────────────────────────────────┘   │
└───────────────────────────────────┬─────────────────────────────────┘
                                    │ HTTPS / WSS
┌───────────────────────────────────▼─────────────────────────────────┐
│                       NEXT.JS SERVER                                 │
│                                                                      │
│  ┌──────────────┐  ┌──────────────────┐  ┌───────────────────────┐  │
│  │  Middleware   │  │  Server Actions   │  │  Route Handlers      │  │
│  │  (auth guard) │  │  (actions/)       │  │  (API routes)        │  │
│  └──────┬───────┘  └────────┬─────────┘  └──────────┬───────────┘  │
│         │                   │                        │               │
│  ┌──────▼───────────────────▼────────────────────────▼───────────┐  │
│  │           Supabase Server Client (@supabase/ssr)              │  │
│  └───────────────────────────────┬───────────────────────────────┘  │
└──────────────────────────────────┬──────────────────────────────────┘
                                   │ TCP (pooled)
┌──────────────────────────────────▼──────────────────────────────────┐
│                         SUPABASE                                     │
│                                                                      │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────┐  ┌───────────┐  │
│  │  Auth        │  │  Realtime    │  │  PostgreSQL │  │  Storage  │  │
│  │  (GoTrue)    │  │  (Phoenix)   │  │  + RLS      │  │  (future) │  │
│  └─────────────┘  └──────────────┘  └────────────┘  └───────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

**Key Architectural Decisions:**

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Rendering | RSC for data-fetching pages, Client Components for interactive UI | Minimize JS bundle; keep real-time & forms client-side |
| Auth | Supabase SSR with middleware | Cookie-based sessions, automatic token refresh, SSR-safe |
| Realtime | Supabase Realtime channels | Built-in Postgres CDC, presence, no extra infra |
| State | Zustand (client) + RSC cache (server) | Zustand for real-time mutable state; RSC for initial loads |
| Pagination | Cursor-based on `created_at` | Stable under concurrent inserts, no offset drift |
| Virtualization | @tanstack/react-virtual | Handles 10K+ messages with constant DOM node count |
| Forms | React Hook Form + Zod | Uncontrolled inputs (perf), schema-first validation |

---

## 2. Folder Structure

```
src/
├── app/
│   ├── layout.tsx                 # Root layout (ThemeProvider, Toaster, AuthProvider)
│   ├── page.tsx                   # Landing / redirect to /chat
│   ├── globals.css
│   ├── (auth)/
│   │   ├── login/
│   │   │   └── page.tsx           # Login page (RSC shell + LoginForm client)
│   │   ├── signup/
│   │   │   └── page.tsx           # Signup page
│   │   └── callback/
│   │       └── route.ts           # OAuth callback handler (code exchange)
│   └── (protected)/
│       ├── layout.tsx             # Auth-guarded layout (reads session, passes to context)
│       └── chat/
│           ├── page.tsx           # Room list + empty state (default view)
│           └── [roomId]/
│               └── page.tsx       # Single room view with message list
│
├── components/
│   ├── chat/
│   │   ├── message-list.tsx       # Virtualized message list (client)
│   │   ├── message-item.tsx       # Single message row
│   │   ├── message-input.tsx      # Compose bar with RHF + Zod
│   │   ├── typing-indicator.tsx   # "X is typing..." (client)
│   │   └── chat-header.tsx        # Room name, members, actions
│   ├── rooms/
│   │   ├── room-list.tsx          # Sidebar room list
│   │   ├── room-item.tsx          # Single room row (unread badge)
│   │   ├── room-search.tsx        # Debounced room/user search
│   │   └── create-room-dialog.tsx # Create room form
│   └── ui/
│       ├── avatar.tsx
│       ├── button.tsx
│       ├── input.tsx
│       ├── dialog.tsx
│       ├── skeleton.tsx
│       └── spinner.tsx
│
├── hooks/
│   ├── use-realtime-messages.ts   # Subscribe to room channel, sync to store
│   ├── use-realtime-presence.ts   # Track online users in room
│   ├── use-typing-indicator.ts    # Throttled typing broadcast + listener
│   ├── use-infinite-messages.ts   # Cursor pagination + infinite scroll trigger
│   └── use-debounced-search.ts    # Generic debounced search hook
│
├── store/
│   ├── message-store.ts           # Messages per room, optimistic queue
│   ├── room-store.ts              # Room list, active room, unread counts
│   └── auth-store.ts              # Client-side user state (hydrated from server)
│
├── types/
│   ├── database.ts                # Supabase generated types (supabase gen types)
│   ├── messages.ts                # Message-related app types
│   ├── rooms.ts                   # Room-related app types
│   └── auth.ts                    # Auth-related app types
│
├── lib/
│   └── supabase/
│       ├── client.ts              # createBrowserClient() singleton
│       ├── server.ts              # createServerClient() (per-request, cookies)
│       ├── middleware.ts          # createServerClient() for middleware context
│       └── admin.ts               # createClient() with service_role (server-only)
│
├── actions/
│   ├── auth.ts                    # login, signup, logout server actions
│   ├── messages.ts                # sendMessage, deleteMessage server actions
│   ├── rooms.ts                   # createRoom, joinRoom, leaveRoom
│   └── search.ts                  # searchRooms, searchUsers server actions
│
└── middleware.ts                   # Root middleware — session refresh + route protection
```

---

## 3. Database Schema

### 3.1 Entity Relationship Diagram

```
┌──────────────┐       ┌──────────────────┐       ┌──────────────┐
│  auth.users  │       │    profiles       │       │    rooms     │
│──────────────│       │──────────────────│       │──────────────│
│  id (PK)     │◄──1:1─│  id (PK, FK)     │       │  id (PK)     │
│  email       │       │  username         │       │  name        │
│  ...         │       │  display_name     │       │  description │
└──────────────┘       │  avatar_url       │       │  type        │
                       │  created_at       │       │  created_by  │──FK──► profiles.id
                       │  updated_at       │       │  created_at  │
                       └────────┬─────────┘       │  updated_at  │
                                │                  └──────┬───────┘
                                │                         │
                          ┌─────▼─────────────────────────▼──────┐
                          │          room_members                 │
                          │──────────────────────────────────────│
                          │  room_id  (PK, FK ► rooms.id)        │
                          │  user_id  (PK, FK ► profiles.id)     │
                          │  role                                 │
                          │  joined_at                            │
                          └──────────────────────────────────────┘
                                         │
                   ┌─────────────────────┼───────────────────────┐
                   │                     │                        │
           ┌───────▼──────┐    ┌─────────▼────────┐    ┌─────────▼────────┐
           │   messages    │    │  read_receipts    │    │                  │
           │──────────────│    │──────────────────│    │                  │
           │  id (PK)      │    │  room_id (PK,FK)  │    │                  │
           │  room_id (FK) │    │  user_id (PK,FK)  │    │                  │
           │  sender_id(FK)│    │  last_read_msg_id │    │                  │
           │  content      │    │  last_read_at     │    │                  │
           │  type         │    └──────────────────┘    │                  │
           │  created_at   │                             │                  │
           │  updated_at   │                             │                  │
           │  deleted_at   │                             │                  │
           └──────────────┘                             └──────────────────┘
```

### 3.2 DDL

```sql
-- ============================================================
-- PROFILES
-- ============================================================
CREATE TABLE public.profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username    TEXT NOT NULL,
  display_name TEXT NOT NULL,
  avatar_url  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT profiles_username_unique UNIQUE (username),
  CONSTRAINT profiles_username_length CHECK (char_length(username) BETWEEN 3 AND 30),
  CONSTRAINT profiles_username_format CHECK (username ~ '^[a-z0-9_]+$')
);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, username, display_name)
  VALUES (
    NEW.id,
    LOWER(REPLACE(COALESCE(NEW.raw_user_meta_data ->> 'username', split_part(NEW.email, '@', 1)), ' ', '_')),
    COALESCE(NEW.raw_user_meta_data ->> 'display_name', split_part(NEW.email, '@', 1))
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Indexes
CREATE INDEX idx_profiles_username ON public.profiles USING btree (username);

-- ============================================================
-- ROOMS
-- ============================================================
CREATE TABLE public.rooms (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  description TEXT,
  type        TEXT NOT NULL DEFAULT 'group' CHECK (type IN ('direct', 'group')),
  created_by  UUID NOT NULL REFERENCES public.profiles(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER rooms_updated_at
  BEFORE UPDATE ON public.rooms
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- GIN index for room name search
CREATE INDEX idx_rooms_name_trgm ON public.rooms USING gin (name gin_trgm_ops);
-- Requires: CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ============================================================
-- ROOM MEMBERS
-- ============================================================
CREATE TABLE public.room_members (
  room_id   UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  user_id   UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role      TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  PRIMARY KEY (room_id, user_id)
);

-- Fast "my rooms" lookup
CREATE INDEX idx_room_members_user ON public.room_members USING btree (user_id);

-- ============================================================
-- MESSAGES
-- ============================================================
CREATE TABLE public.messages (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id     UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  sender_id   UUID NOT NULL REFERENCES public.profiles(id),
  content     TEXT NOT NULL CHECK (char_length(content) BETWEEN 1 AND 10000),
  type        TEXT NOT NULL DEFAULT 'text' CHECK (type IN ('text', 'system')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at  TIMESTAMPTZ  -- soft delete
);

CREATE TRIGGER messages_updated_at
  BEFORE UPDATE ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Cursor-based pagination index (critical for performance)
CREATE INDEX idx_messages_room_cursor ON public.messages
  USING btree (room_id, created_at DESC)
  WHERE deleted_at IS NULL;

-- Sender lookup
CREATE INDEX idx_messages_sender ON public.messages USING btree (sender_id);

-- ============================================================
-- READ RECEIPTS
-- ============================================================
CREATE TABLE public.read_receipts (
  room_id             UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  user_id             UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  last_read_message_id UUID REFERENCES public.messages(id),
  last_read_at        TIMESTAMPTZ NOT NULL DEFAULT now(),

  PRIMARY KEY (room_id, user_id)
);
```

### 3.3 RLS Policies

```sql
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.read_receipts ENABLE ROW LEVEL SECURITY;

-- Helper: check if current user is a member of a room
CREATE OR REPLACE FUNCTION public.is_room_member(p_room_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.room_members
    WHERE room_id = p_room_id AND user_id = auth.uid()
  );
$$;

-- PROFILES -------------------------------------------------------
CREATE POLICY "Profiles are viewable by authenticated users"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- ROOMS ----------------------------------------------------------
CREATE POLICY "Rooms visible to members"
  ON public.rooms FOR SELECT
  TO authenticated
  USING (public.is_room_member(id));

CREATE POLICY "Authenticated users can create rooms"
  ON public.rooms FOR INSERT
  TO authenticated
  WITH CHECK (created_by = auth.uid());

-- ROOM MEMBERS ---------------------------------------------------
CREATE POLICY "Members can see room membership"
  ON public.room_members FOR SELECT
  TO authenticated
  USING (public.is_room_member(room_id));

CREATE POLICY "Room owner/admin can add members"
  ON public.room_members FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.room_members
      WHERE room_id = room_members.room_id
        AND user_id = auth.uid()
        AND role IN ('owner', 'admin')
    )
    -- OR user is creating the room (first member = owner)
    OR (user_id = auth.uid() AND role = 'owner')
  );

CREATE POLICY "Members can leave (delete own membership)"
  ON public.room_members FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- MESSAGES -------------------------------------------------------
CREATE POLICY "Messages visible to room members"
  ON public.messages FOR SELECT
  TO authenticated
  USING (public.is_room_member(room_id) AND deleted_at IS NULL);

CREATE POLICY "Room members can send messages"
  ON public.messages FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_room_member(room_id)
    AND sender_id = auth.uid()
  );

CREATE POLICY "Sender can soft-delete own messages"
  ON public.messages FOR UPDATE
  TO authenticated
  USING (sender_id = auth.uid())
  WITH CHECK (sender_id = auth.uid());

-- READ RECEIPTS --------------------------------------------------
CREATE POLICY "Users can read own receipts"
  ON public.read_receipts FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can upsert own receipts"
  ON public.read_receipts FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own receipts"
  ON public.read_receipts FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
```

### 3.4 Supabase Realtime Configuration

Enable Realtime on the `messages` table for CDC (Change Data Capture):

```sql
-- In Supabase Dashboard → Database → Replication
-- Or via SQL:
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
```

Presence and typing indicators use **Realtime Broadcast** (no DB table needed).

---

## 4. Auth Flow

```
┌──────────┐     ┌──────────────┐     ┌─────────────────┐     ┌──────────┐
│  Browser  │     │  Middleware   │     │  Server Action   │     │ Supabase │
│           │     │  middleware.ts│     │  actions/auth.ts │     │  Auth    │
└─────┬─────┘     └──────┬───────┘     └────────┬────────┘     └────┬─────┘
      │                  │                      │                    │
      │  GET /login      │                      │                    │
      │─────────────────►│                      │                    │
      │                  │ No session cookie    │                    │
      │                  │ Allow through        │                    │
      │◄─────────────────│                      │                    │
      │                  │                      │                    │
      │  Submit login form (Server Action)      │                    │
      │────────────────────────────────────────►│                    │
      │                                         │  signInWithPassword│
      │                                         │───────────────────►│
      │                                         │                    │
      │                                         │◄── JWT + Refresh ──│
      │                                         │                    │
      │                                         │  Set cookies via   │
      │                                         │  cookieStore       │
      │◄──── redirect /chat ────────────────────│                    │
      │                  │                      │                    │
      │  GET /chat       │                      │                    │
      │─────────────────►│                      │                    │
      │                  │ Read session cookie   │                    │
      │                  │ Refresh if expired────│───────────────────►│
      │                  │◄─────────────────────│◄── New tokens ─────│
      │                  │ Update cookies        │                    │
      │                  │ Allow through         │                    │
      │◄─────────────────│                      │                    │
      │                  │                      │                    │

  ── Token Refresh (automated by @supabase/ssr) ──

  Middleware runs on EVERY request to protected routes.
  It calls supabase.auth.getUser() which:
  1. Reads access_token from cookies
  2. If expired, uses refresh_token to get new pair
  3. Sets updated cookies on the response
```

### Middleware Implementation Pattern

```typescript
// src/middleware.ts
import { type NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/middleware'

const publicRoutes = ['/login', '/signup', '/callback']

export async function middleware(request: NextRequest) {
  const { supabase, response } = createServerClient(request)

  // This refreshes the session if needed and sets cookies
  const { data: { user } } = await supabase.auth.getUser()

  const isPublicRoute = publicRoutes.some(route =>
    request.nextUrl.pathname.startsWith(route)
  )

  if (!user && !isPublicRoute) {
    const loginUrl = new URL('/login', request.url)
    return NextResponse.redirect(loginUrl)
  }

  if (user && isPublicRoute) {
    const chatUrl = new URL('/chat', request.url)
    return NextResponse.redirect(chatUrl)
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg)$).*)'],
}
```

---

## 5. Real-time Messaging Architecture

### Channel Topology

```
Per-Room Channel: room:{roomId}
├── postgres_changes (INSERT on messages where room_id = {roomId})
├── broadcast: typing   → { user_id, username, is_typing }
└── presence            → { user_id, online_at }
```

Each active chat room subscribes to **one channel** carrying three event types:

| Event Type | Source | Purpose |
|-----------|--------|---------|
| `postgres_changes` | CDC | New messages via DB insert |
| `broadcast:typing` | Client→Client | Typing indicators (no DB) |
| `presence` | Client→Client | Who's online in this room |

### Hook: `use-realtime-messages.ts`

```
┌──────────────────────────────────────────────────────┐
│  useRealtimeMessages(roomId)                         │
│                                                       │
│  1. Subscribe to channel `room:{roomId}`             │
│  2. On postgres_changes INSERT:                       │
│     - If sender ≠ current user → add to store        │
│     - If sender = current user → ignore (already     │
│       added optimistically)                          │
│  3. On presence sync:                                 │
│     - Update online users in room store              │
│  4. Cleanup: unsubscribe on unmount or roomId change │
└──────────────────────────────────────────────────────┘
```

### Typing Indicators — Throttled Broadcast

```
User types → throttle(1500ms) → broadcast { user_id, is_typing: true }
                                             │
User stops → debounce(2000ms) → broadcast { user_id, is_typing: false }
                                             │
                                    ┌────────▼────────┐
                                    │  Other clients   │
                                    │  accumulate      │
                                    │  typing state    │
                                    │  with 3s timeout │
                                    └─────────────────┘
```

**Rules:**
- Throttle outbound typing events to max 1 per 1.5s
- Client-side timeout: if no `is_typing: false` received after 3s, auto-clear
- Never persist typing state to DB

---

## 6. Message Send Flow (Optimistic UI)

```
┌──────────┐     ┌──────────────┐     ┌────────────────┐     ┌──────────┐
│  User     │     │ message-store │     │ Server Action   │     │ Supabase │
│  (input)  │     │ (Zustand)    │     │ actions/msgs.ts │     │ DB + RT  │
└─────┬─────┘     └──────┬───────┘     └────────┬───────┘     └────┬─────┘
      │                  │                      │                   │
      │ Submit message   │                      │                   │
      │─────────────────►│                      │                   │
      │                  │                      │                   │
      │                  │ Add optimistic msg   │                   │
      │                  │ id: temp_uuid        │                   │
      │                  │ status: 'sending'    │                   │
      │                  │─ ─ (render now) ─ ─ ►│                   │
      │                  │                      │                   │
      │                  │ Call server action    │                   │
      │                  │─────────────────────►│                   │
      │                  │                      │ INSERT message    │
      │                  │                      │──────────────────►│
      │                  │                      │                   │
      │                  │                      │◄── { id, ... } ───│
      │                  │                      │                   │
      │                  │◄─ success ───────────│                   │
      │                  │                      │                   │
      │                  │ Replace temp_uuid    │                   │
      │                  │ with real id         │                   │
      │                  │ status: 'sent'       │                   │
      │◄── re-render ────│                      │                   │
      │                  │                      │                   │
      │      ── Meanwhile, Realtime CDC ──      │                   │
      │                  │                      │   CDC broadcast   │
      │                  │◄─────────────────────│◄──────────────────│
      │                  │                      │                   │
      │                  │ sender_id = me?      │                   │
      │                  │ → SKIP (deduplicate) │                   │
      │                  │                      │                   │

      ── Error path ──

      │                  │◄─ error ─────────────│                   │
      │                  │ status: 'error'       │                   │
      │◄── show retry ───│                      │                   │
```

### Deduplication Strategy

The store maintains a `Set<string>` of pending optimistic message temp IDs mapped to their real IDs once confirmed. When a Realtime CDC event arrives:

1. Check if `sender_id === currentUser.id`
2. If yes → message already in store optimistically → skip
3. If no → new message from another user → add to store

---

## 7. Cursor-based Pagination & Virtualization

### Pagination Query

```sql
SELECT m.*, p.username, p.display_name, p.avatar_url
FROM messages m
JOIN profiles p ON p.id = m.sender_id
WHERE m.room_id = $1
  AND m.deleted_at IS NULL
  AND m.created_at < $cursor    -- cursor = oldest loaded message timestamp
ORDER BY m.created_at DESC
LIMIT 50;
```

**Why cursor-based:**
- Offset-based breaks when new messages arrive (items shift)
- `created_at DESC` with btree index = index-only scan, very fast
- The cursor (`created_at` of the oldest loaded message) is stable

### Infinite Scroll + Virtualization Architecture

```
┌──────────────────────────────────────────────┐
│  message-list.tsx (Client Component)          │
│                                               │
│  ┌─────────────────────────────────────────┐ │
│  │  @tanstack/react-virtual Virtualizer     │ │
│  │                                          │ │
│  │  estimateSize: ~72px per message         │ │
│  │  overscan: 10                            │ │
│  │  direction: reverse (newest at bottom)   │ │
│  │                                          │ │
│  │  ┌─────────────────────────────────┐     │ │
│  │  │  Sentinel element (top)         │     │ │
│  │  │  IntersectionObserver watches   │     │ │
│  │  │  → triggers loadMore()          │     │ │
│  │  └─────────────────────────────────┘     │ │
│  │                                          │ │
│  │  ... virtual rows (only visible) ...     │ │
│  │                                          │ │
│  │  [Message N-2]                           │ │
│  │  [Message N-1]                           │ │
│  │  [Message N  ]  ← latest                │ │
│  └─────────────────────────────────────────┘ │
│                                               │
│  useInfiniteMessages(roomId)                  │
│  ├── pages: Message[][]                       │
│  ├── cursor: string | null                    │
│  ├── hasMore: boolean                         │
│  ├── isLoading: boolean                       │
│  └── loadMore() → fetch next page             │
└──────────────────────────────────────────────┘
```

**Scroll behavior:**
- On initial load: scroll to bottom (latest messages)
- On new message (own): scroll to bottom
- On new message (other): show "New messages ↓" indicator if scrolled up
- On load older: maintain scroll position (preserve offset)

---

## 8. State Management

### Store Architecture

```
┌───────────────────────────────────────────────────────────┐
│                    Zustand Stores                          │
│                                                           │
│  ┌─────────────────────────────────────────────────────┐  │
│  │  auth-store.ts                                      │  │
│  │  ├── user: User | null                              │  │
│  │  ├── profile: Profile | null                        │  │
│  │  └── hydrate(user, profile)  ← called from layout   │  │
│  └─────────────────────────────────────────────────────┘  │
│                                                           │
│  ┌─────────────────────────────────────────────────────┐  │
│  │  room-store.ts                                      │  │
│  │  ├── rooms: Map<string, Room>                       │  │
│  │  ├── activeRoomId: string | null                    │  │
│  │  ├── unreadCounts: Map<string, number>              │  │
│  │  ├── setActiveRoom(id)                              │  │
│  │  ├── addRoom(room)                                  │  │
│  │  └── updateUnreadCount(roomId, count)               │  │
│  └─────────────────────────────────────────────────────┘  │
│                                                           │
│  ┌─────────────────────────────────────────────────────┐  │
│  │  message-store.ts                                   │  │
│  │  ├── messages: Map<roomId, Message[]>               │  │
│  │  ├── cursors: Map<roomId, string | null>            │  │
│  │  ├── hasMore: Map<roomId, boolean>                  │  │
│  │  ├── pendingIds: Set<string>  ← optimistic tracking │  │
│  │  ├── addMessage(roomId, msg)                        │  │
│  │  ├── addOptimisticMessage(roomId, msg)              │  │
│  │  ├── confirmMessage(tempId, realMsg)                │  │
│  │  ├── failMessage(tempId)                            │  │
│  │  ├── prependMessages(roomId, msgs, cursor)          │  │
│  │  └── retryMessage(tempId)                           │  │
│  └─────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────┘
```

**Hydration pattern:**
- Server Components fetch initial data (rooms, recent messages)
- Pass as props to Client Components
- Client Components call `store.hydrate(data)` on mount (once)
- After hydration, Realtime keeps stores in sync

---

## 9. Search Architecture

### Debounced Search Flow

```
┌──────────┐    ┌──────────────────────┐    ┌──────────────┐    ┌──────────┐
│  Input   │    │ useDebounceSearch     │    │ Server Action │    │ Supabase │
│  (user)  │    │ (300ms debounce)     │    │ actions/      │    │          │
└────┬─────┘    └──────────┬───────────┘    │ search.ts     │    │          │
     │                     │                └──────┬────────┘    └────┬─────┘
     │ onChange("hel")     │                       │                  │
     │────────────────────►│                       │                  │
     │                     │ debounce...           │                  │
     │ onChange("hell")    │                       │                  │
     │────────────────────►│                       │                  │
     │                     │ debounce reset...     │                  │
     │ onChange("hello")   │                       │                  │
     │────────────────────►│                       │                  │
     │                     │                       │                  │
     │                     │ ── 300ms elapsed ──   │                  │
     │                     │                       │                  │
     │                     │ searchRooms("hello")  │                  │
     │                     │──────────────────────►│                  │
     │                     │                       │  SELECT ... WHERE│
     │                     │                       │  name ILIKE '%hel│
     │                     │                       │  lo%' AND member │
     │                     │                       │─────────────────►│
     │                     │                       │◄─── results ─────│
     │                     │◄── results ───────────│                  │
     │◄── render results ──│                       │                  │
```

**Search targets:**
- **Rooms:** trigram search on `rooms.name` (requires `pg_trgm` extension)
- **Users:** `profiles.username ILIKE` or `profiles.display_name ILIKE`
- **Combined:** server action merges both result sets

---

## 10. Integration Points & Risks

### Integration Points

| # | Integration | Components | Protocol |
|---|-------------|-----------|----------|
| 1 | Supabase Auth ↔ Next.js | `@supabase/ssr` + middleware | HTTP cookies (httpOnly, SameSite=Lax) |
| 2 | Supabase Realtime ↔ Client | Supabase JS client | WebSocket (WSS) |
| 3 | Supabase DB ↔ Server Actions | Supabase server client | TCP (connection pooling via Supavisor) |
| 4 | Zustand ↔ Server Components | Hydration pattern | Props → `store.hydrate()` |
| 5 | React Hook Form ↔ Server Actions | Form action binding | `useActionState` + RHF |
| 6 | Virtualizer ↔ Infinite Scroll | Sentinel + IntersectionObserver | DOM events |

### Risk Matrix

| # | Risk | Severity | Likelihood | Mitigation |
|---|------|----------|------------|------------|
| R1 | **Realtime connection drops** (mobile, flaky network) | HIGH | MEDIUM | Implement reconnection logic with exponential backoff. On reconnect, fetch missed messages via cursor query to fill gaps. Supabase client has built-in reconnect but add gap-detection. |
| R2 | **Message ordering inconsistency** between optimistic + CDC | MEDIUM | MEDIUM | Use `created_at` (server-generated) as canonical order. Optimistic messages use client timestamp but reorder once server confirms. Store deduplicates by checking `sender_id === me`. |
| R3 | **Stale JWT in long-lived tabs** | HIGH | LOW | Middleware refreshes on navigation. For SPA-like behavior inside `/chat`, the Supabase client auto-refreshes via `onAuthStateChange`. Add a periodic health check (every 10 min). |
| R4 | **Virtualization scroll jank** with variable-height messages | MEDIUM | MEDIUM | Use `estimateSize` with a reasonable default (72px). Measure actual rendered height and cache. Consider `measureElement` from @tanstack/virtual for dynamic measurement. |
| R5 | **Thundering herd on room load** (many users join at once) | LOW | LOW | Supabase handles this server-side. Client-side: debounce initial fetch, use `staleTime` to avoid refetching within short windows. |
| R6 | **`pg_trgm` not enabled** in Supabase project | HIGH | MEDIUM | Must enable extension before deploying: `CREATE EXTENSION IF NOT EXISTS pg_trgm;`. Without it, room search index creation fails. Verify in migration script. |
| R7 | **@tanstack/react-virtual wrong installation** | HIGH | CERTAIN | Current `package.json` has `"root": "github:tanstack/react-virtual"` — this installs from GitHub default branch, not the expected npm package. Must fix to `"@tanstack/react-virtual": "^3.x"`. |
| R8 | **Typing indicator broadcast spam** | LOW | MEDIUM | Throttle to max 1 event per 1.5s. Server-side: Supabase Realtime rate-limits broadcast by default (10 msg/s per client per channel). |
| R9 | **RLS performance on large room membership** | MEDIUM | LOW | `is_room_member()` function uses `EXISTS` subquery (short-circuits). The `idx_room_members_user` index covers this. Monitor with `EXPLAIN ANALYZE` once data grows. |

---

## 11. Dependency Notes

### Package Fix Required

```diff
# package.json — fix @tanstack/react-virtual installation
- "root": "github:tanstack/react-virtual",
+ "@tanstack/react-virtual": "^3.13.0",
```

### Required Supabase Extensions

```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;   -- trigram search for rooms
CREATE EXTENSION IF NOT EXISTS pgcrypto;   -- gen_random_uuid() if not using uuid-ossp
```

### Environment Variables

```env
# .env.local
NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>  # server-only, NEVER expose to client
```

### Key Version Constraints

| Package | Version | Notes |
|---------|---------|-------|
| `next` | 16.x | App Router, React Compiler built-in |
| `react` | 19.x | Required for React Compiler |
| `@supabase/ssr` | 0.10.x | Cookie-based auth for App Router |
| `@supabase/supabase-js` | 2.x | Realtime v2, `@supabase/ssr` peer dep |
| `zustand` | 5.x | React 19 compatible, vanilla store pattern |
| `zod` | 4.x | Schema validation (breaking changes from 3.x: `z.object` → `z.interface` optional) |
| `@tanstack/react-virtual` | 3.x | Virtualizer with dynamic measurement |
