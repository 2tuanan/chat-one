"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { searchRooms, searchUsers } from "@/actions/search";
import { useDebounce } from "@/hooks/use-debounce";
import type { SearchResult } from "@/types/rooms";

const MIN_QUERY_LENGTH = 2;

type UseDebouncedSearchReturn = {
  results: SearchResult | null;
  isLoading: boolean;
};

export function useDebouncedSearch(query: string): UseDebouncedSearchReturn {
  const [results, setResults] = useState<SearchResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isPending, startTransition] = useTransition();
  const debouncedQuery = useDebounce(query, 300);
  const requestIdRef = useRef(0);

  useEffect(() => {
    const normalized = debouncedQuery.trim();

    if (normalized.length < MIN_QUERY_LENGTH) {
      setIsLoading(false);
      setResults(null);
      return;
    }

    const requestId = ++requestIdRef.current;

    setIsLoading(true);

    const run = async () => {
      const [roomsResult, usersResult] = await Promise.allSettled([
        searchRooms(normalized),
        searchUsers(normalized),
      ]);

      if (requestIdRef.current !== requestId) {
        return;
      }

      const rooms =
        roomsResult.status === "fulfilled" ? roomsResult.value.rooms : [];
      const users =
        usersResult.status === "fulfilled" ? usersResult.value.users : [];
      const hasError =
        roomsResult.status === "rejected" ||
        usersResult.status === "rejected" ||
        (roomsResult.status === "fulfilled" && !!roomsResult.value.error) ||
        (usersResult.status === "fulfilled" && !!usersResult.value.error);

      startTransition(() => {
        setResults({ rooms, users });
      });

      if (hasError) {
        toast.error("Search failed. Please try again.");
      }

      setIsLoading(false);
    };

    void run();
  }, [debouncedQuery]);

  useEffect(() => {
    if (query.trim().length === 0) {
      setIsLoading(false);
      setResults(null);
      requestIdRef.current += 1;
    }
  }, [query]);

  return {
    results,
    isLoading: isLoading || isPending,
  };
}
