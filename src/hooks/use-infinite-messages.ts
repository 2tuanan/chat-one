"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { useMessageStore } from "@/store/message-store";
import { fetchOlderMessages } from "@/actions/messages";
import type { UseInfiniteMessagesReturn } from "@/types/messages";

export function useInfiniteMessages(roomId: string): UseInfiniteMessagesReturn {
  // Read messages from store — do not duplicate state
  const messages = useMessageStore(
    useShallow((state) => state.messages.get(roomId) ?? []),
  );

  // Read pagination state from store
  const cursor = useMessageStore(
    (state) => state.cursors.get(roomId) ?? null,
  );
  const hasMore = useMessageStore(
    // Default true: no hydration yet means we don't know if there are older messages
    (state) => state.hasMore.get(roomId) ?? true,
  );
  const prependMessages = useMessageStore((state) => state.prependMessages);

  // isLoadingRef: used as the async guard inside loadMore to prevent stale closure.
  // useState alone would be stale because the callback captures the value at render time.
  const isLoadingRef = useRef(false);
  const [isLoading, setIsLoading] = useState(false);

  // Reset loading state when roomId changes (cleanup on navigation)
  useEffect(() => {
    return () => {
      isLoadingRef.current = false;
      setIsLoading(false);
    };
  }, [roomId]);

  const loadMore = useCallback(async () => {
    // isLoadingRef.current is the authoritative guard — not isLoading state —
    // because the async callback may close over a stale isLoading value.
    if (isLoadingRef.current || !hasMore || !cursor) return;

    isLoadingRef.current = true;
    setIsLoading(true);

    try {
      const result = await fetchOlderMessages(roomId, cursor);
      prependMessages(roomId, result.messages, result.nextCursor);
    } finally {
      isLoadingRef.current = false;
      setIsLoading(false);
    }
  }, [roomId, cursor, hasMore, prependMessages]);

  return { messages, cursor, hasMore, isLoading, loadMore };
}
