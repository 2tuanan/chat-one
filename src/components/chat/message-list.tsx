"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Loader2 } from "lucide-react";
import { useAuthStore } from "@/store/auth-store";
import { useMessageStore } from "@/store/message-store";
import { useRoomStore } from "@/store/room-store";
import { useInfiniteMessages } from "@/hooks/use-infinite-messages";
import type { MessageWithProfile, OptimisticMessage } from "@/types/messages";
import MessageItem from "@/components/chat/message-item";
import { sendMessage } from "@/actions/messages";

type MessageListProps = {
  roomId: string;
  initialMessages: MessageWithProfile[];
};

const getMessageId = (message: MessageWithProfile | OptimisticMessage) =>
  "temp_id" in message ? message.temp_id : message.id;

export default function MessageList({ roomId, initialMessages }: MessageListProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const hydratedRoomId = useRef<string | null>(null);
  // Tracks whether we've done the initial scroll-to-bottom for the CURRENT room.
  // Must be reset to null on every room switch (by the room-reset effect below) so
  // that re-entering a previously-visited room scrolls to bottom again.
  // NOTE: MessageList reconciles (not remounts) on room switch in Next.js App Router,
  // so all useRef values persist across navigations unless explicitly reset.
  const scrolledForRoomRef = useRef<string | null>(null);

  // Scroll preservation refs
  const prevScrollHeightRef = useRef<number>(0);
  const prevMessagesLengthRef = useRef<number>(0);
  // Tracks the first message id to distinguish prepend (load older) from append (realtime)
  const firstMessageIdRef = useRef<string | null>(null);
  // Tracks previous length for own-message auto-scroll delta guard
  const prevLengthForAutoScrollRef = useRef(0);

  // "New messages ↓" badge state
  const [isScrolledUp, setIsScrolledUp] = useState(false);
  const [newMessageCount, setNewMessageCount] = useState(0);
  const prevLengthRef = useRef(0);

  // IntersectionObserver ref — must be disconnected in ALL paths
  const observerRef = useRef<IntersectionObserver | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const currentUserId = useAuthStore((state) => state.user?.id ?? null);
  const prependMessages = useMessageStore((state) => state.prependMessages);
  const retryMessage = useMessageStore((state) => state.retryMessage);
  const confirmMessage = useMessageStore((state) => state.confirmMessage);
  const failMessage = useMessageStore((state) => state.failMessage);
  const setActiveRoom = useRoomStore((state) => state.setActiveRoom);

  // Pagination + messages from store via useInfiniteMessages
  const { messages, hasMore, isLoading, loadMore } = useInfiniteMessages(roomId);

  // Virtualizer setup — must reference containerRef for scroll element
  const virtualizer = useVirtualizer({
    count: messages.length,
    getScrollElement: () => containerRef.current,
    estimateSize: () => 72,
    overscan: 10,
  });

  // Phase 4.2: Initial hydration — fix cursor to oldest message's created_at
  // initialMessages is in ASC order (RSC reverses DESC result), so [0] is oldest.
  // Only pass a non-null cursor when a FULL page (50) was loaded — if fewer arrived,
  // there are no older messages and hasMore must start as false.
  useEffect(() => {
    if (hydratedRoomId.current === roomId) {
      return;
    }

    const initialCursor =
      initialMessages.length >= 50
        ? (initialMessages[0]?.created_at ?? null)
        : null;
    prependMessages(roomId, initialMessages, initialCursor);
    setActiveRoom(roomId);
    hydratedRoomId.current = roomId;
    // Seed the first-message tracker so the first loadMore correctly detects prepend
    firstMessageIdRef.current = initialMessages[0]?.id ?? null;
    // Seed auto-scroll length baseline so the delta guard skips initial hydration
    prevLengthForAutoScrollRef.current = initialMessages.length;
  }, [roomId, initialMessages, prependMessages, setActiveRoom]);

  // handleRetry must be a stable useCallback so React.memo on MessageItem is effective
  const handleRetry = useCallback(
    async (tempId: string, content: string) => {
      if (!roomId) {
        return;
      }

      retryMessage(tempId);
      const result = await sendMessage(roomId, { content });

      if (result.error || result.fieldErrors || !result.message) {
        failMessage(tempId);
        return;
      }

      confirmMessage(tempId, result.message);
    },
    [roomId, retryMessage, failMessage, confirmMessage],
  );

  // Room-change reset — declared BEFORE the observer effect so React runs it first
  // when roomId changes. Clears all per-room transient state so every room entry
  // starts clean: scroll guard, badge, prevLength counter, and scroll position state.
  // Without this, isScrolledUp / prevLengthRef / scrolledForRoomRef bleed across rooms
  // because the component reconciles (not remounts) in Next.js App Router.
  useEffect(() => {
    scrolledForRoomRef.current = null;
    setIsScrolledUp(false);
    setNewMessageCount(0);
    prevLengthRef.current = 0;
  }, [roomId]);

  // Phase 5.2: IntersectionObserver sentinel — disconnect in ALL paths (unmount + hasMore=false)
  // The observer callback guards with autoScrolledRoomId.current === roomId so it only
  // fires AFTER the initial scroll-to-bottom has placed the sentinel off-screen.
  // This is a synchronous ref check (always current) — avoids the useState race where
  // setIsAutoScrollComplete(false) is async and the observer fires before state lands.
  useEffect(() => {
    if (!sentinelRef.current || !hasMore) {
      observerRef.current?.disconnect();
      observerRef.current = null;
      return;
    }

    observerRef.current?.disconnect();
    observerRef.current = new IntersectionObserver(
      ([entry]) => {
        // Guard: only load when the initial scroll-to-bottom for THIS room has run.
        // autoScrolledRoomId.current is set synchronously inside the scroll effect,
        // so it's always accurate regardless of React render batching.
        if (
          entry.isIntersecting &&
          !isLoading &&
          hasMore &&
          scrolledForRoomRef.current === roomId
        ) {
          if (containerRef.current) {
            prevScrollHeightRef.current = containerRef.current.scrollHeight;
          }
          void loadMore();
        }
      },
      { threshold: 0 },
    );
    observerRef.current.observe(sentinelRef.current);

    return () => {
      observerRef.current?.disconnect();
      observerRef.current = null;
    };
  }, [hasMore, isLoading, loadMore, roomId]);

  // Phase 5.3: Scroll-position preservation on prepend — useLayoutEffect (NOT useEffect)
  // useLayoutEffect fires synchronously before paint, preventing visible scroll jump.
  // Uses firstMessageIdRef to distinguish prepend (load older) from append (realtime new
  // message) — only prepend should compensate scrollTop, not append.
  useLayoutEffect(() => {
    if (!containerRef.current) return;

    const newLength = messages.length;
    const prevLength = prevMessagesLengthRef.current;

    if (newLength > prevLength) {
      // Detect prepend: the first message id has changed, meaning older messages
      // were inserted at the top of the list
      const currentFirstId = messages[0]
        ? ("temp_id" in messages[0] ? messages[0].temp_id : messages[0].id)
        : null;

      const isPrepend =
        firstMessageIdRef.current !== null &&
        currentFirstId !== firstMessageIdRef.current;

      if (isPrepend && prevScrollHeightRef.current > 0) {
        const scrollDelta =
          containerRef.current.scrollHeight - prevScrollHeightRef.current;
        if (scrollDelta > 0) {
          containerRef.current.scrollTop += scrollDelta;
        }
      }

      firstMessageIdRef.current = currentFirstId;
    }

    // Always update baselines for the next render
    prevScrollHeightRef.current = containerRef.current.scrollHeight;
    prevMessagesLengthRef.current = newLength;
  }, [messages]);

  // Phase 5.4: Scroll-to-bottom on initial room entry.
  // Guard uses scrolledForRoomRef which is reset to null by the room-reset effect
  // above on every roomId change — guaranteeing this fires on every room entry,
  // including re-entries to previously-visited rooms.
  useEffect(() => {
    if (!containerRef.current) return;
    if (scrolledForRoomRef.current === roomId) return;
    if (messages.length === 0) return;

    virtualizer.scrollToIndex(messages.length - 1, { align: "end" });
    scrolledForRoomRef.current = roomId;
  }, [messages.length, roomId, virtualizer]);

  // Phase 5.4: Auto-scroll on own new message.
  // Uses delta guard to fire only for a single new message (delta === 1),
  // NOT for prepend batches of ~50 (which would jump to bottom incorrectly).
  // prevLen === 0 guard skips initial hydration (handled by autoScrolledRoomId effect).
  // 'temp_id' guard: only scroll for optimistic messages created by THIS tab's send.
  // A CDC realtime event delivers a plain MessageWithProfile (no temp_id), even if
  // it came from the same user on another tab — that must NOT trigger auto-scroll.
  useEffect(() => {
    if (messages.length === 0) return;

    const prevLen = prevLengthForAutoScrollRef.current;
    const delta = messages.length - prevLen;
    prevLengthForAutoScrollRef.current = messages.length;

    if (delta !== 1 || prevLen === 0) return;

    const lastMsg = messages[messages.length - 1];
    // 'temp_id' in lastMsg is true only for OptimisticMessage (this tab's own send)
    if ("temp_id" in lastMsg && lastMsg.sender.id === currentUserId) {
      virtualizer.scrollToIndex(messages.length - 1, { align: "end" });
    }
  }, [messages, currentUserId, virtualizer]);

  // Phase 5.5: Detect scroll position to show "New messages ↓" badge
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const handleScroll = () => {
      const threshold = 100; // px from bottom
      const distanceFromBottom =
        el.scrollHeight - el.scrollTop - el.clientHeight;
      const scrolledUp = distanceFromBottom > threshold;
      setIsScrolledUp(scrolledUp);

      // Clear badge when user manually scrolls back to bottom
      if (!scrolledUp) {
        setNewMessageCount(0);
      }
    };

    el.addEventListener("scroll", handleScroll, { passive: true });
    return () => el.removeEventListener("scroll", handleScroll);
  }, []);

  // Phase 5.5: Count new messages from other users while scrolled up
  useEffect(() => {
    const prevLen = prevLengthRef.current;
    if (messages.length > prevLen && isScrolledUp) {
      const added = messages.slice(prevLen);
      const hasOtherUserMsg = added.some((m) => m.sender.id !== currentUserId);
      if (hasOtherUserMsg) {
        setNewMessageCount((c) => c + 1);
      }
    }
    prevLengthRef.current = messages.length;
  }, [messages, isScrolledUp, currentUserId]);

  return (
    <div className="relative flex flex-1 flex-col overflow-hidden">
            <div
        ref={containerRef}
        className="flex-1 overflow-y-auto bg-zinc-50 px-6 py-5"
      >
        {/* Phase 5.6: Loading spinner at top while fetching older messages */}
        {isLoading && (
          <div className="flex justify-center py-3">
            <Loader2 className="h-4 w-4 animate-spin text-zinc-400" />
          </div>
        )}

        {/* Phase 5.2: Sentinel or "Beginning of conversation" label */}
        {hasMore ? (
          <div ref={sentinelRef} style={{ height: 1 }} />
        ) : (
          <p className="py-4 text-center text-xs text-zinc-400">
            Beginning of conversation
          </p>
        )}

        {messages.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-zinc-500">
            No messages yet. Start the conversation.
          </div>
        ) : (
          /* Phase 5.1: Virtualized list — spacer div with absolute-positioned rows */
          <div
            style={{
              height: `${virtualizer.getTotalSize()}px`,
              position: "relative",
            }}
          >
            {virtualizer.getVirtualItems().map((virtualRow) => (
              // data-index AND ref={virtualizer.measureElement} BOTH required
              // for dynamic height measurement — missing either breaks measurement
              <div
                key={virtualRow.key}
                data-index={virtualRow.index}
                ref={virtualizer.measureElement}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  transform: `translateY(${virtualRow.start}px)`,
                  paddingBottom: "1rem",
                }}
              >
                <MessageItem
                  key={getMessageId(messages[virtualRow.index])}
                  message={messages[virtualRow.index]}
                  isOwn={messages[virtualRow.index].sender.id === currentUserId}
                  onRetry={handleRetry}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Phase 5.5: "New messages ↓" floating badge */}
      {isScrolledUp && newMessageCount > 0 && (
        <button
          onClick={() => {
            virtualizer.scrollToIndex(messages.length - 1, { align: "end" });
            setIsScrolledUp(false);
            setNewMessageCount(0);
          }}
          className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-zinc-900 px-4 py-1.5 text-xs text-white shadow-lg"
        >
          {newMessageCount} new message{newMessageCount > 1 ? "s" : ""} ↓
        </button>
      )}
    </div>
  );
}

