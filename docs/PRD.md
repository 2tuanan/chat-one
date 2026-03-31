# Chat App — Product Requirements Document (MVP)

> **Version:** 1.0  
> **Date:** 2026-03-30  
> **Author:** Morgan (@pm)  
> **Architect:** Aria (@architect)  
> **Source:** [ARCHITECTURE.md](./ARCHITECTURE.md)  
> **Timeline:** 2 weeks (solo developer)

---

## Table of Contents

1. [Product Overview](#1-product-overview)
2. [Scope](#2-scope)
3. [Tech Stack & Constraints](#3-tech-stack--constraints)
4. [Priority & Timeline](#4-priority--timeline)
5. [Feature Specifications](#5-feature-specifications)
   - [F-01 Authentication](#f-01-authentication)
   - [F-02 Room List & Create Room](#f-02-room-list--create-room)
   - [F-03 Real-time Messaging](#f-03-real-time-messaging)
   - [F-04 Cursor Pagination & Infinite Scroll](#f-04-cursor-pagination--infinite-scroll)
   - [F-05 Typing Indicators](#f-05-typing-indicators)
   - [F-06 Online Presence](#f-06-online-presence)
   - [F-07 Debounced Room & User Search](#f-07-debounced-room--user-search)
   - [F-08 Virtualized Message List](#f-08-virtualized-message-list)
   - [F-09 Zustand Typed Stores](#f-09-zustand-typed-stores)
   - [F-10 Custom Hooks Library](#f-10-custom-hooks-library)
6. [TypeScript Interface Catalogue](#6-typescript-interface-catalogue)
7. [Database Requirements](#7-database-requirements)
8. [Testing Strategy](#8-testing-strategy)
9. [Out of Scope (MVP)](#9-out-of-scope-mvp)
10. [Open Risks](#10-open-risks)

---

## 1. Product Overview

A real-time group chat application built on Next.js 15 (App Router) and Supabase. The MVP delivers a complete, production-quality chat loop: auth → join a room → send and receive messages instantly → scroll through history — with a strong emphasis on TypeScript correctness, custom hook composition, and test coverage that doubles as a portfolio/interview showcase.

**North-star metric:** A solo developer can sign up, create a room, and exchange messages in real time with zero page reloads within 2 minutes of first visit.

---

## 2. Scope

### In Scope

| # | Feature |
|---|---------|
| F-01 | JWT auth (email/password) via Supabase SSR · middleware route protection · token refresh |
| F-02 | Room list sidebar · create room dialog |
| F-03 | Real-time messaging · optimistic UI · soft-delete |
| F-04 | Cursor-based pagination · infinite scroll (load older messages) |
| F-05 | Typing indicators (throttled broadcast, no DB persistence) |
| F-06 | Online presence per room (Supabase Realtime Presence) |
| F-07 | Debounced room + user search (trigram, 300 ms) |
| F-08 | Virtualized message list via `@tanstack/react-virtual` |
| F-09 | Three typed Zustand stores: auth, room, message |
| F-10 | Custom hooks: `useDebounce`, `useThrottle`, `useChatMessages`, `usePresence`, `useTyping`, `useInfiniteMessages`, `useLocalStorage` |

### Explicitly Out of Scope (MVP)

- File upload / media messages
- Message reactions
- Message threading / reply-in-thread
- Push notifications (browser or mobile)
- Read receipts UI (schema exists, no UI)
- OAuth / social login
- Mobile-native app
- End-to-end encryption
- Admin panel

---

## 3. Tech Stack & Constraints

| Layer | Package | Version | Constraint |
|-------|---------|---------|------------|
| Framework | `next` | **15.x** (not 16 — arch doc typo) | App Router, React Compiler enabled |
| Language | TypeScript | 5.x | `strict: true` throughout |
| React | `react` | 19.x | React Compiler enabled via `babel-plugin-react-compiler` |
| Auth + DB | `@supabase/ssr` | 0.10.x | Cookie-based sessions; `createBrowserClient` singleton |
| Realtime | `@supabase/supabase-js` | 2.x | Realtime v2 channels only |
| State | `zustand` | 5.x | Vanilla store pattern; no `immer` middleware for MVP |
| Forms | `react-hook-form` | 7.x | Uncontrolled inputs |
| Validation | `zod` | **4.x** | `z.object` still valid in v4; note `z.string().min()` message arg changed to object `{ message: '...' }` |
| Virtualization | `@tanstack/react-virtual` | **^3.13.0** (npm, not GitHub ref) | `useVirtualizer` API |
| Styles | `tailwindcss` | 4.x | `@import "tailwindcss"` syntax; no `tailwind.config.js` needed |
| Toasts | `sonner` | 2.x | `<Toaster />` in root layout |
| Dark mode | `next-themes` | 0.4.x | `ThemeProvider` wraps root layout |
| CSS utils | `clsx` + `tailwind-merge` | latest | Combine via `cn()` helper |

**Hard constraints from architecture:**
1. `pg_trgm` extension must be enabled in Supabase before first deploy (search index dependency).
2. All server-side Supabase calls use `createServerClient()` from `lib/supabase/server.ts` — never the browser client.
3. `SUPABASE_SERVICE_ROLE_KEY` is server-only — must never appear in client bundles.
4. Middleware must run on every request matching the protected route pattern; `config.matcher` excludes static assets.

---

## 4. Priority & Timeline

```
Week 1 (Days 1–7)
├── Day 1–2  │ F-01  Auth (login, signup, middleware, session refresh)
├── Day 3    │ F-09  Zustand stores skeleton (auth, room, message)
├── Day 4    │ F-02  Room list + create room + join room
├── Day 5–6  │ F-03  Real-time messaging + optimistic UI
└── Day 7    │ F-10  useDebounce, useThrottle, useChatMessages (unit tests)

Week 2 (Days 8–14)
├── Day 8–9  │ F-04  Cursor pagination + F-08 Virtualized list
├── Day 10   │ F-05  Typing indicators + F-06 Presence
├── Day 11   │ F-07  Debounced search
├── Day 12   │ F-10  Remaining hooks + unit tests
├── Day 13   │ Polish: dark mode, skeletons, error states, a11y
└── Day 14   │ Buffer: test coverage to 80%+, README, env docs
```

**Priority order:** Auth → Rooms → Messaging → Pagination → Search → Polish

---

## 5. Feature Specifications

---

### F-01 Authentication

**Goal:** Secure, SSR-safe email/password auth with automatic JWT refresh and middleware-enforced route protection.

#### User Stories

| ID | Story |
|----|-------|
| US-01.1 | As a new user, I can sign up with email, password, and a username so I can access the chat. |
| US-01.2 | As a returning user, I can log in with email and password so I can resume my conversations. |
| US-01.3 | As a logged-in user, I can log out from any page so my session is terminated. |
| US-01.4 | As an unauthenticated user, navigating to any `/chat/*` route redirects me to `/login`. |
| US-01.5 | As a logged-in user, navigating to `/login` or `/signup` redirects me to `/chat`. |
| US-01.6 | As a logged-in user with an expired access token, my session is refreshed transparently on the next request with no re-login required. |

#### Acceptance Criteria

- [ ] `POST /login` (Server Action): `signInWithPassword` success sets `sb-access-token` and `sb-refresh-token` as `httpOnly`, `SameSite=Lax` cookies, then redirects to `/chat`.
- [ ] `POST /signup` (Server Action): `signUp` creates account + triggers `handle_new_user` DB function to create `profiles` row, then redirects to `/chat`.
- [ ] `POST /logout` (Server Action): calls `supabase.auth.signOut()`, clears cookies, redirects to `/login`.
- [ ] Middleware calls `supabase.auth.getUser()` on every matched request. If the token is expired, `@supabase/ssr` exchanges the refresh token and sets new cookies on the response.
- [ ] Unauthenticated request to `/chat` → 302 to `/login?redirectTo=/chat`.
- [ ] Authenticated request to `/login` → 302 to `/chat`.
- [ ] Login form shows field-level validation errors from Zod before submission.
- [ ] Failed login (wrong credentials) shows a Sonner toast: `"Invalid email or password"`.
- [ ] Signup form validates: email format, password ≥ 8 chars, username 3–30 chars, alphanumeric + underscores only.
- [ ] Profile is auto-created in `public.profiles` via `handle_new_user` trigger on `auth.users` INSERT.

#### TypeScript Interfaces

```typescript
// types/auth.ts
export interface AuthUser {
  id: string
  email: string
}

export interface Profile {
  id: string
  username: string
  display_name: string
  avatar_url: string | null
  created_at: string
  updated_at: string
}

export interface AuthState {
  user: AuthUser | null
  profile: Profile | null
  isLoading: boolean
}

// Zod schemas (actions/auth.ts)
// LoginSchema: { email: string, password: string }
// SignupSchema: { email: string, password: string (min 8), username: string (3-30, /^[a-z0-9_]+$/) }
```

#### Hook Demonstrated
`useLocalStorage` — persist last-used email for login form pre-fill (optional UX polish).

#### React Concept Showcased
**Server Actions + `useFormState`/`useActionState`**: Form submission wired to a Server Action with progressive enhancement. The login/signup forms work without JS (graceful degradation) and re-hydrate client-side for validation UX.

---

### F-02 Room List & Create Room

**Goal:** Display the current user's rooms in a sidebar. Allow creation of new group rooms.

#### User Stories

| ID | Story |
|----|-------|
| US-02.1 | As a logged-in user, I see a list of all rooms I am a member of in a sidebar. |
| US-02.2 | As a logged-in user, I can click a room to open it and view its messages. |
| US-02.3 | As a logged-in user, I can create a new group room with a name and optional description. |
| US-02.4 | As a room creator, I am automatically added as `owner` when the room is created. |
| US-02.5 | As a logged-in user, I can see an unread message count badge on each room. |

#### Acceptance Criteria

- [ ] Room list fetches from `rooms` joined with `room_members` for `user_id = auth.uid()` via RSC on initial page load.
- [ ] Active room is highlighted in the sidebar.
- [ ] Create room dialog uses React Hook Form + Zod schema: `name` (1–80 chars, required), `description` (0–255 chars, optional), `type` (defaults to `'group'`).
- [ ] On create room submit: Server Action inserts into `rooms`, then inserts into `room_members` with `role: 'owner'`, then redirects to `/chat/[newRoomId]`.
- [ ] Newly created room appears at the top of the list immediately (optimistic update via room store).
- [ ] RLS enforces that `SELECT` on `rooms` returns only rooms where the user is a member.
- [ ] Empty state displayed when user has no rooms: "No rooms yet. Create one to get started."
- [ ] Room name is truncated with ellipsis if longer than sidebar width.

#### TypeScript Interfaces

```typescript
// types/rooms.ts
export type RoomType = 'direct' | 'group'
export type MemberRole = 'owner' | 'admin' | 'member'

export interface Room {
  id: string
  name: string
  description: string | null
  type: RoomType
  created_by: string
  created_at: string
  updated_at: string
}

export interface RoomMember {
  room_id: string
  user_id: string
  role: MemberRole
  joined_at: string
}

export interface RoomWithMeta extends Room {
  member_count: number
  unread_count?: number
}

// Zod schema (actions/rooms.ts)
// CreateRoomSchema: { name: string (1-80), description?: string (max 255), type: RoomType }
```

#### Hook Demonstrated
`useDebounce` — room name availability check in the create room form (future-friendly; scaffold the hook here).

#### React Concept Showcased
**RSC + Client Component boundary**: Room list page is an RSC that fetches and passes initial room data as props. `room-list.tsx` is a Client Component that hydrates the Zustand room store and renders reactively thereafter. Demonstrates correct `"use client"` placement and the RSC→CC data handoff pattern.

---

### F-03 Real-time Messaging

**Goal:** Send and receive messages in real time with optimistic UI and deduplication.

#### User Stories

| ID | Story |
|----|-------|
| US-03.1 | As a room member, I can type a message and send it by pressing Enter or clicking Send. |
| US-03.2 | As a room member, my sent message appears immediately (optimistically) before the server confirms. |
| US-03.3 | As a room member, I see messages from other users appear in real time without refreshing. |
| US-03.4 | As a room member, if my message fails to send, it shows an error state with a retry button. |
| US-03.5 | As a room member, I cannot send an empty message or one exceeding 10 000 characters. |

#### Acceptance Criteria

- [ ] Message compose bar uses React Hook Form + Zod: `content` (1–10 000 chars).
- [ ] On submit: `addOptimisticMessage()` called immediately with `status: 'sending'`, temp UUID as ID. Visual indicator (spinner or muted color) shown on optimistic messages.
- [ ] Server Action `sendMessage` inserts into `messages` table. On success: `confirmMessage(tempId, realMsg)` replaces optimistic entry.
- [ ] On Server Action failure: `failMessage(tempId)` sets `status: 'error'`. Retry button re-invokes the Server Action.
- [ ] Realtime CDC subscription on `room:{roomId}`.`postgres_changes` (INSERT) active while room is open.
- [ ] Deduplication: incoming CDC event with `sender_id === currentUser.id` is silently ignored.
- [ ] Realtime subscription is cleaned up (channel removed) on component unmount or room change.
- [ ] Messages display: sender avatar (initials fallback), display name, timestamp (relative, e.g. "2 min ago"), content.
- [ ] Soft-deleted messages (`deleted_at IS NOT NULL`) are filtered by RLS — they never reach the client.
- [ ] Pressing Enter submits; Shift+Enter inserts newline.

#### TypeScript Interfaces

```typescript
// types/messages.ts
export type MessageStatus = 'sending' | 'sent' | 'error'
export type MessageType = 'text' | 'system'

export interface Message {
  id: string
  room_id: string
  sender_id: string
  content: string
  type: MessageType
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export interface MessageWithProfile extends Message {
  sender: Pick<Profile, 'id' | 'username' | 'display_name' | 'avatar_url'>
}

export interface OptimisticMessage extends MessageWithProfile {
  status: MessageStatus
  temp_id: string
}

// Zod schema
// SendMessageSchema: { content: string (1-10000) }
```

#### Hook Demonstrated
`useChatMessages` — encapsulates the subscription lifecycle, deduplication, and store writes. Returns `{ messages, sendMessage, retryMessage }`.

#### React Concept Showcased
**Optimistic UI with `useOptimistic`** (React 19): Demonstrates the canonical React 19 pattern for optimistic updates, layered on top of Zustand for cross-component consistency.

---

### F-04 Cursor-based Pagination & Infinite Scroll

**Goal:** Load the most recent 50 messages on room entry, then fetch older pages on demand as the user scrolls up to the top sentinel.

#### User Stories

| ID | Story |
|----|-------|
| US-04.1 | As a room member opening a room, I see the 50 most recent messages immediately. |
| US-04.2 | As a room member scrolled to the top, older messages load automatically as I scroll up. |
| US-04.3 | As a room member, a loading spinner appears at the top of the list while fetching older messages. |
| US-04.4 | As a room member, when all messages are loaded, I see "Beginning of conversation" and no more loading occurs. |
| US-04.5 | As a room member, loading older messages does not jump the scroll position. |

#### Acceptance Criteria

- [ ] Initial fetch: Server Component queries `messages` with `ORDER BY created_at DESC LIMIT 50` — no cursor on first load.
- [ ] Cursor = `created_at` ISO string of the oldest loaded message.
- [ ] Subsequent pages: `WHERE created_at < $cursor ORDER BY created_at DESC LIMIT 50` via Server Action.
- [ ] `useInfiniteMessages` returns `{ messages, hasMore, isLoading, loadMore, cursor }`.
- [ ] `IntersectionObserver` watches a sentinel `div` at the top of the list. When `intersecting === true` and `!isLoading && hasMore`, calls `loadMore()`.
- [ ] On page load: scroll position jumps to bottom (newest messages). `useEffect` + `scrollToIndex` on virtualizer.
- [ ] On older page load: scroll offset is preserved (calculate delta and correct with `scrollBy`).
- [ ] When `hasMore === false`: sentinel is removed from DOM; "Beginning of conversation" label rendered.
- [ ] The cursor pagination index `idx_messages_room_cursor` on `(room_id, created_at DESC) WHERE deleted_at IS NULL` must exist.

#### TypeScript Interfaces

```typescript
// Extended on types/messages.ts
export interface PaginatedMessages {
  messages: MessageWithProfile[]
  nextCursor: string | null
  hasMore: boolean
}

export interface UseInfiniteMessagesReturn {
  messages: MessageWithProfile[]
  cursor: string | null
  hasMore: boolean
  isLoading: boolean
  loadMore: () => void
}
```

#### Hook Demonstrated
`useInfiniteMessages(roomId: string): UseInfiniteMessagesReturn` — owns the cursor state, triggers fetches, merges pages into the message store.

#### React Concept Showcased
**`IntersectionObserver` + `useEffect` cleanup**: The sentinel ref pattern demonstrates imperative DOM integration within the React lifecycle, including correct cleanup to prevent memory leaks. Pairs with the React 19 `ref` callback form.

---

### F-05 Typing Indicators

**Goal:** Show who is currently typing in a room without any database persistence, using throttled Realtime broadcast.

#### User Stories

| ID | Story |
|----|-------|
| US-05.1 | As a room member, I see "{username} is typing..." when another member is composing a message. |
| US-05.2 | As a room member, the typing indicator disappears automatically 3 seconds after the last typing event. |
| US-05.3 | As a user typing, my own indicator is never shown to myself. |
| US-05.4 | As a room member, if multiple users type simultaneously, I see "{A} and {B} are typing...". |

#### Acceptance Criteria

- [ ] Outbound: on every `onChange` in the message input, `useThrottle` (1 500 ms) controls broadcast frequency. Broadcast payload: `{ user_id, username, is_typing: true }`.
- [ ] Outbound: on input blur or message submit, broadcast `{ user_id, username, is_typing: false }` immediately (bypasses throttle).
- [ ] Inbound: listeners accumulate a `Map<userId, { username, expiresAt }>` in component state. `expiresAt = Date.now() + 3000`.
- [ ] A `setInterval` (200 ms) prunes expired entries from the map.
- [ ] Typing indicator text: 0 typists → hidden; 1 → `"{name} is typing..."`; 2 → `"{A} and {B} are typing..."`; 3+ → `"Several people are typing..."`.
- [ ] Own `user_id` events are filtered from display.
- [ ] Broadcast uses existing `room:{roomId}` channel — no new channel created.
- [ ] No DB writes for typing state.

#### TypeScript Interfaces

```typescript
// types/messages.ts (extend)
export interface TypingPayload {
  user_id: string
  username: string
  is_typing: boolean
}

export interface TypingUser {
  user_id: string
  username: string
  expires_at: number
}

export interface UseTypingReturn {
  typingUsers: TypingUser[]
  broadcastTyping: (isTyping: boolean) => void
}
```

#### Hook Demonstrated
`useTyping(roomId: string, channel: RealtimeChannel): UseTypingReturn` — combines `useThrottle` internally for outbound throttling, manages the expiry map, cleans up on unmount.

#### React Concept Showcased
**`useThrottle` custom hook composition**: `useTyping` consumes `useThrottle` — demonstrates hook composition over inheritance. The interval-based expiry also surfaces `useEffect` cleanup discipline (clear interval on unmount).

---

### F-06 Online Presence

**Goal:** Show which members of the current room are online via Supabase Realtime Presence.

#### User Stories

| ID | Story |
|----|-------|
| US-06.1 | As a room member, I see green dot avatars for users currently online in the room. |
| US-06.2 | As a room member, I see the count of online users in the chat header. |
| US-06.3 | As a room member, when another user leaves or closes the tab, their presence clears within 10 seconds. |

#### Acceptance Criteria

- [ ] On room entry, `channel.track({ user_id, username, online_at: new Date().toISOString() })` is called.
- [ ] `channel.on('presence', { event: 'sync' })` listener keeps `onlineUsers` state current.
- [ ] `onlineUsers` is derived from `channel.presenceState()` on each sync event.
- [ ] Chat header displays: `{count} online` badge next to room name.
- [ ] Avatar components receive an `isOnline: boolean` prop and render a green border/dot accordingly.
- [ ] On component unmount: `channel.untrack()` is called and the channel is removed.
- [ ] Own user is included in the online count.

#### TypeScript Interfaces

```typescript
// types/rooms.ts (extend)
export interface PresencePayload {
  user_id: string
  username: string
  online_at: string
}

export interface UsePresenceReturn {
  onlineUsers: PresencePayload[]
  onlineCount: number
}
```

#### Hook Demonstrated
`usePresence(roomId: string, channel: RealtimeChannel): UsePresenceReturn` — subscribes to presence sync events, derives state, cleans up on unmount.

#### React Concept Showcased
**Shared channel ref across hooks**: `useRealtimeMessages`, `useTyping`, and `usePresence` all consume the same `RealtimeChannel` instance. The channel is created once in the parent `useChatMessages` hook and passed down — demonstrates prop-drilling avoidance via hook parameter passing vs. context.

---

### F-07 Debounced Room & User Search

**Goal:** A search input in the sidebar that finds rooms by name and users by username, debounced to avoid request spam.

#### User Stories

| ID | Story |
|----|-------|
| US-07.1 | As a user, I can type in the search box and see matching rooms filtered in real time. |
| US-07.2 | As a user, I can search by username and see matching user profiles. |
| US-07.3 | As a user, search results appear only after I stop typing for 300 ms. |
| US-07.4 | As a user, clearing the search box restores my full room list. |
| US-07.5 | As a user, if no results are found, I see "No rooms found" or "No users found". |

#### Acceptance Criteria

- [ ] Search input is debounced with `useDebounce(value, 300)`.
- [ ] When debounced value is empty string: no search is triggered; room list shows all user rooms.
- [ ] When debounced value is ≥ 2 chars: Server Action `searchRooms(query)` and `searchUsers(query)` are called in parallel.
- [ ] `searchRooms` uses `WHERE name ILIKE '%{query}%'` (trigram index); scoped to rooms the current user is a member of.
- [ ] `searchUsers` uses `WHERE username ILIKE '%{query}%' OR display_name ILIKE '%{query}%'`; excludes self.
- [ ] Results are displayed in two sections: "Rooms" and "People".
- [ ] Loading state: skeleton rows shown during fetch.
- [ ] Min query length enforced at 2 chars to avoid over-broad searches.
- [ ] `pg_trgm` extension must be enabled; deployment checklist item.

#### TypeScript Interfaces

```typescript
// types/rooms.ts (extend)
export interface SearchResult {
  rooms: Room[]
  users: Pick<Profile, 'id' | 'username' | 'display_name' | 'avatar_url'>[]
}

export interface UseDebounceReturn<T> {
  debouncedValue: T
}
// Generic: useDebounce<T>(value: T, delay: number): T
```

#### Hook Demonstrated
`useDebounce<T>(value: T, delay: number): T` — generic hook. `room-search.tsx` consumes `useDebounce(searchQuery, 300)`.

#### React Concept Showcased
**Generic custom hooks with TypeScript generics**: `useDebounce<T>` demonstrates writing type-safe utility hooks that work across use cases (`string`, `number`, object payloads). Also demonstrates `useEffect` + `setTimeout` cleanup pattern.

---

### F-08 Virtualized Message List

**Goal:** Render thousands of messages with constant DOM node count using `@tanstack/react-virtual`.

#### User Stories

| ID | Story |
|----|-------|
| US-08.1 | As a user in a room with 5 000 messages, the list scrolls smoothly at 60 fps. |
| US-08.2 | As a user, I can scroll to the bottom of the list with a single "Jump to latest" button. |
| US-08.3 | As a user reading old messages, a "New messages ↓" badge appears when a new message arrives. |
| US-08.4 | As a user, messages occupy variable height (multi-line content) without layout glitches. |

#### Acceptance Criteria

- [ ] `useVirtualizer` from `@tanstack/react-virtual` (`^3.13.0`) is used with `count: messages.length`, `estimateSize: () => 72`, `overscan: 10`.
- [ ] `measureElement` is wired to the row container ref for dynamic height measurement.
- [ ] Container `div` uses `style={{ height: virtualizer.getTotalSize() }}` as the spacer.
- [ ] Only `virtualizer.getVirtualItems()` rows are rendered in the DOM at any time.
- [ ] On initial load: `virtualizer.scrollToIndex(messages.length - 1, { align: 'end' })` called after data hydration.
- [ ] On new own message: auto-scroll to bottom.
- [ ] On new other-user message when scrolled up (not at bottom): "New messages ↓" floating badge appears. Clicking it scrolls to bottom and clears badge.
- [ ] On load-older-messages: scroll offset preserved via `virtualizer.scrollToOffset(prevOffset + delta)`.
- [ ] Each `MessageItem` wrapped in `React.memo` to prevent re-renders on parent state changes.

#### TypeScript Interfaces

```typescript
// Extends message types — no new interfaces needed beyond F-03.
// Component props:

export interface MessageItemProps {
  message: OptimisticMessage | MessageWithProfile
  isOwn: boolean
  measureRef: (el: HTMLElement | null) => void
}

export interface MessageListProps {
  roomId: string
  initialMessages: MessageWithProfile[]
}
```

#### Hook Demonstrated
`useInfiniteMessages` (from F-04) drives the data source; `useVirtualizer` from `@tanstack/react-virtual` is the rendering primitive.

#### React Concept Showcased
**`React.memo` + stable callback refs**: `MessageItem` is memoized with `React.memo`. The `measureRef` is stable via `useCallback` to prevent the virtualizer from remeasuring on every render. Demonstrates performance optimization patterns with referential stability.

---

### F-09 Zustand Typed Stores

**Goal:** Three strictly-typed Zustand 5 stores covering auth state, room list, and message management including optimistic queue.

#### User Stories

No direct user stories — this is an infrastructure feature. Correctness is verified through the features it powers.

#### Acceptance Criteria

**`auth-store.ts`**
- [ ] State: `{ user: AuthUser | null, profile: Profile | null, isLoading: boolean }`.
- [ ] Actions: `hydrate(user, profile)`, `clear()`.
- [ ] `hydrate` called once from `(protected)/layout.tsx` after server session read.

**`room-store.ts`**
- [ ] State: `{ rooms: Map<string, Room>, activeRoomId: string | null, unreadCounts: Map<string, number> }`.
- [ ] Actions: `setRooms(rooms[])`, `addRoom(room)`, `setActiveRoom(id)`, `updateUnreadCount(roomId, delta)`, `resetUnreadCount(roomId)`.
- [ ] Selectors: `selectRoomList()` returns `Room[]` sorted by `updated_at DESC`, `selectActiveRoom()`.

**`message-store.ts`**
- [ ] State: `{ messages: Map<string, (MessageWithProfile | OptimisticMessage)[]>, cursors: Map<string, string | null>, hasMore: Map<string, boolean>, pendingIds: Set<string> }`.
- [ ] Actions: `addOptimisticMessage(roomId, msg)`, `confirmMessage(tempId, realMsg)`, `failMessage(tempId)`, `retryMessage(tempId)`, `prependMessages(roomId, msgs, cursor)`, `appendNewMessage(roomId, msg)`, `clearRoom(roomId)`.
- [ ] `pendingIds` tracks temp UUIDs. `confirmMessage` swaps temp entry with real entry and removes from `pendingIds`.

#### TypeScript Interfaces

```typescript
// store/auth-store.ts
interface AuthStore extends AuthState {
  hydrate: (user: AuthUser, profile: Profile) => void
  clear: () => void
}

// store/room-store.ts
interface RoomStore {
  rooms: Map<string, Room>
  activeRoomId: string | null
  unreadCounts: Map<string, number>
  setRooms: (rooms: Room[]) => void
  addRoom: (room: Room) => void
  setActiveRoom: (id: string | null) => void
  updateUnreadCount: (roomId: string, delta: number) => void
  resetUnreadCount: (roomId: string) => void
  selectRoomList: () => Room[]
  selectActiveRoom: () => Room | undefined
}

// store/message-store.ts
interface MessageStore {
  messages: Map<string, (MessageWithProfile | OptimisticMessage)[]>
  cursors: Map<string, string | null>
  hasMore: Map<string, boolean>
  pendingIds: Set<string>
  addOptimisticMessage: (roomId: string, msg: OptimisticMessage) => void
  confirmMessage: (tempId: string, realMsg: MessageWithProfile) => void
  failMessage: (tempId: string) => void
  retryMessage: (tempId: string) => void
  prependMessages: (roomId: string, msgs: MessageWithProfile[], cursor: string | null) => void
  appendNewMessage: (roomId: string, msg: MessageWithProfile) => void
  clearRoom: (roomId: string) => void
}
```

#### React Concept Showcased
**Zustand 5 vanilla store + selector pattern**: Using `useStore(store, selector)` with stable selectors (not inline arrow functions) to prevent unnecessary re-renders. Demonstrates the performance-correct way to subscribe to Zustand in React 19.

---

### F-10 Custom Hooks Library

All hooks live in `src/hooks/` with co-located test files in `src/hooks/__tests__/`.

#### Hook Specifications

| Hook | Signature | Purpose |
|------|-----------|---------|
| `useDebounce` | `<T>(value: T, delay: number): T` | Delays value update. Uses `useEffect` + `setTimeout` cleanup. |
| `useThrottle` | `<T>(value: T, interval: number): T` | Limits update frequency. Uses `useRef` + `Date.now()`. |
| `useChatMessages` | `(roomId: string): ChatMessagesReturn` | Orchestrator: creates channel, delegates to `usePresence`, `useTyping`, `useInfiniteMessages`. Returns combined API. |
| `usePresence` | `(roomId: string, channel: RealtimeChannel): UsePresenceReturn` | Tracks online users via Supabase Presence. |
| `useTyping` | `(roomId: string, channel: RealtimeChannel): UseTypingReturn` | Manages typing broadcast + display. |
| `useInfiniteMessages` | `(roomId: string): UseInfiniteMessagesReturn` | Cursor pagination state machine. |
| `useLocalStorage` | `<T>(key: string, initialValue: T): [T, (v: T) => void]` | Type-safe `localStorage` wrapper with SSR guard. |

#### Acceptance Criteria — `useDebounce`
- [ ] Returns the initial value synchronously.
- [ ] After rapid changes, only emits the final value after `delay` ms of inactivity.
- [ ] `clearTimeout` called in `useEffect` cleanup to prevent memory leaks.

#### Acceptance Criteria — `useThrottle`
- [ ] On first call, returns the value immediately.
- [ ] Subsequent calls within `interval` ms return the previous throttled value.
- [ ] After `interval` ms, the next call returns the new value.

#### Acceptance Criteria — `useLocalStorage`
- [ ] Returns `initialValue` when `localStorage` is unavailable (SSR / server render guard).
- [ ] Reads value on mount; parses JSON safely with try/catch.
- [ ] Setter writes to `localStorage` and updates React state atomically.
- [ ] Invalid JSON in storage falls back to `initialValue`.

#### React Concept Showcased

| Hook | Concept |
|------|---------|
| `useDebounce` | `useEffect` cleanup, closure over `delay` |
| `useThrottle` | `useRef` for mutable non-reactive state |
| `useChatMessages` | Hook composition, single-responsibility principle |
| `usePresence` | External subscription cleanup pattern |
| `useTyping` | Multiple hooks composed, interval management |
| `useInfiniteMessages` | Async state machine in a hook |
| `useLocalStorage` | SSR safety, error boundaries in hooks |

---

## 6. TypeScript Interface Catalogue

All interfaces are collected here for reference. Source of truth is the `src/types/` directory.

```
types/
├── auth.ts       → AuthUser, Profile, AuthState
├── rooms.ts      → Room, RoomType, RoomMember, MemberRole, RoomWithMeta,
│                    RoomWithMeta, CreateRoomInput, SearchResult,
│                    PresencePayload, UsePresenceReturn
├── messages.ts   → Message, MessageWithProfile, OptimisticMessage,
│                    MessageStatus, MessageType, PaginatedMessages,
│                    UseInfiniteMessagesReturn, TypingPayload,
│                    TypingUser, UseTypingReturn, MessageItemProps,
│                    MessageListProps
└── database.ts   → Generated by `supabase gen types typescript`
                    (source of truth for raw DB row types)
```

**Rule:** Application code uses `types/*.ts` app types. Raw Supabase DB types from `database.ts` are only used in `lib/supabase/` and `actions/` — never in components or stores.

---

## 7. Database Requirements

Refer to [ARCHITECTURE.md § 3](./ARCHITECTURE.md#3-database-schema) for full DDL and RLS policies.

**Pre-deployment checklist:**

- [ ] `CREATE EXTENSION IF NOT EXISTS pg_trgm;` — required for `idx_rooms_name_trgm`
- [ ] `CREATE EXTENSION IF NOT EXISTS pgcrypto;` — for `gen_random_uuid()` if < PG 13
- [ ] `ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;` — enables CDC
- [ ] Verify `handle_new_user` trigger fires on `auth.users` INSERT in staging
- [ ] Verify RLS enabled on all 5 tables: profiles, rooms, room_members, messages, read_receipts
- [ ] Run `EXPLAIN ANALYZE` on pagination query with 10 000 message fixture

---

## 8. Testing Strategy

### Philosophy

No E2E or integration tests in MVP scope. All tests are pure unit tests using Vitest. Test files are **co-located** with the code they test.

### Framework

```
Vitest + @testing-library/react + @testing-library/user-event
```

Add to `package.json` (dev deps; not yet installed):
```json
{
  "vitest": "^3.x",
  "@testing-library/react": "^16.x",
  "@testing-library/user-event": "^14.x",
  "@vitejs/plugin-react": "^4.x",
  "jsdom": "^26.x"
}
```

### File Locations

```
src/
├── hooks/
│   └── __tests__/
│       ├── useDebounce.test.ts
│       ├── useThrottle.test.ts
│       ├── useLocalStorage.test.ts
│       ├── useInfiniteMessages.test.ts
│       ├── usePresence.test.ts
│       └── useTyping.test.ts
├── store/
│   └── __tests__/
│       ├── auth-store.test.ts
│       ├── room-store.test.ts
│       └── message-store.test.ts
└── lib/
    └── __tests__/
        └── middleware.test.ts
```

### Coverage Targets

| Domain | Target | Notes |
|--------|--------|-------|
| `hooks/` | ≥ 80% | All 7 custom hooks covered |
| `store/` | ≥ 80% | All actions and state transitions |
| `lib/supabase/` (middleware logic) | ≥ 80% | Redirect logic, session refresh |
| `actions/` Zod schemas | ≥ 80% | Schema validation edge cases |
| `components/` | Not targeted | No component tests in MVP |

### Test Cases by Domain

#### hooks/__tests__/useDebounce.test.ts
- Returns initial value synchronously
- Debounces rapid changes; emits only final value after delay
- Clears timeout on unmount (no state update after unmount)
- Responds to delay change

#### hooks/__tests__/useThrottle.test.ts
- Returns value immediately on first call
- Ignores updates within interval window
- Accepts update after interval has elapsed

#### hooks/__tests__/useLocalStorage.test.ts
- Returns `initialValue` when localStorage is empty
- Reads and parses stored JSON on mount
- Setter updates both state and localStorage
- Falls back to `initialValue` on JSON parse error
- Handles SSR (no `window` object): returns `initialValue` without error

#### hooks/__tests__/useInfiniteMessages.test.ts
- Initial state: `messages = []`, `hasMore = true`, `isLoading = false`
- `loadMore()` sets `isLoading = true` during fetch
- On fetch success: messages appended, cursor updated
- When fetch returns fewer than page size: `hasMore = false`
- `loadMore()` is a no-op when `isLoading === true` or `hasMore === false`

#### store/__tests__/message-store.test.ts
- `addOptimisticMessage`: adds to messages array with `status: 'sending'`, adds to `pendingIds`
- `confirmMessage`: replaces temp entry with real entry, removes from `pendingIds`
- `failMessage`: sets `status: 'error'` on matching temp entry, removes from `pendingIds`
- `prependMessages`: prepends without duplicating existing messages (by ID)
- `appendNewMessage`: appends to end of array
- `clearRoom`: removes all entries for a roomId

#### store/__tests__/room-store.test.ts
- `setRooms`: populates Map from array
- `addRoom`: inserts into Map
- `setActiveRoom`: updates `activeRoomId`
- `updateUnreadCount`: increments by delta
- `resetUnreadCount`: sets to 0
- `selectRoomList()`: returns sorted array

#### store/__tests__/auth-store.test.ts
- Initial state: `user = null`, `profile = null`
- `hydrate(user, profile)`: sets both fields
- `clear()`: resets to null

#### lib/__tests__/middleware.test.ts
- Unauthenticated request to `/chat` → redirect to `/login`
- Unauthenticated request to `/login` → passes through
- Authenticated request to `/login` → redirect to `/chat`
- Authenticated request to `/chat` → passes through
- Static asset path (`/_next/static/...`) → not matched by middleware

### Running Tests

```bash
# Add to package.json scripts:
"test": "vitest run",
"test:watch": "vitest",
"test:coverage": "vitest run --coverage"
```

---

## 9. Out of Scope (MVP)

The following are explicitly deferred. **Do not implement stubs or placeholders for these** — they create dead code and maintenance burden.

| Item | Reason |
|------|--------|
| File upload | Requires Supabase Storage setup, presigned URLs, mime-type validation |
| Message reactions | Requires new `reactions` table, RLS, and UI component set |
| Message threading | Requires `parent_message_id` FK, recursive query, separate UI |
| Push notifications | Requires service worker, Web Push API, and server-side subscription management |
| Read receipts UI | Schema exists (`read_receipts` table) but no UI surface; upsert logic deferred |
| OAuth / social login | Requires callback URL configuration per provider |

---

## 10. Open Risks

| ID | Risk | Severity | Owner | Mitigation |
|----|------|----------|-------|------------|
| R1 | Realtime disconnect on mobile/flaky network | HIGH | F-03 | On reconnect, fetch missed messages from cursor; Supabase client auto-reconnects |
| R2 | Message ordering inconsistency (optimistic vs CDC) | MEDIUM | F-03 | Canonical order = server `created_at`; reorder on confirm |
| R3 | Stale JWT in long-lived SPA tab | HIGH | F-01 | `onAuthStateChange` handles client refresh; middleware handles server refresh |
| R4 | Variable-height message virtualizer jank | MEDIUM | F-08 | Use `measureElement`; stable `useCallback` refs on `MessageItem` |
| R5 | `pg_trgm` not enabled pre-deploy | HIGH | F-07 | Deploy checklist item; migration script must include extension creation |
| R6 | Zod v4 breaking changes | MEDIUM | F-01, F-02, F-03 | Audit: `z.string().min(n, msg)` → `z.string().min(n, { message: msg })`; `z.object` still valid |
| R7 | Vitest + Next.js 15 App Router mocking | MEDIUM | Testing | Use `vitest` with `jsdom` env; mock `@/lib/supabase/client` in all hook tests via `vi.mock` |
| R8 | Typing indicator broadcast spam at scale | LOW | F-05 | 1.5 s throttle; Supabase enforces 10 msg/s per client per channel |
