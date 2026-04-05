import { beforeEach, describe, expect, it } from "vitest";
import { initialMessageState, useMessageStore } from "@/store/message-store";
import type {
  MessageWithProfile,
  OptimisticMessage,
} from "@/types/messages";

const baseProfile = {
  id: "user-1",
  username: "user_1",
  display_name: "User One",
  avatar_url: null,
};

const buildMessage = (
  overrides: Partial<MessageWithProfile> = {},
): MessageWithProfile => ({
  id: "message-1",
  room_id: "room-1",
  sender_id: "user-1",
  content: "Hello",
  type: "text",
  created_at: "2026-04-01T00:00:00Z",
  updated_at: "2026-04-01T00:00:00Z",
  deleted_at: null,
  sender: baseProfile,
  ...overrides,
});

const buildOptimisticMessage = (
  overrides: Partial<OptimisticMessage> = {},
): OptimisticMessage => ({
  ...buildMessage(),
  status: "sending",
  temp_id: "temp-1",
  ...overrides,
});

describe("message store", () => {
  beforeEach(() => {
    useMessageStore.setState({
      messages: new Map(initialMessageState.messages),
      cursors: new Map(initialMessageState.cursors),
      hasMore: new Map(initialMessageState.hasMore),
      pendingIds: new Set(initialMessageState.pendingIds),
    });
  });

  it("starts empty", () => {
    const state = useMessageStore.getState();

    expect(state.messages.size).toBe(0);
    expect(state.cursors.size).toBe(0);
    expect(state.hasMore.size).toBe(0);
    expect(state.pendingIds.size).toBe(0);
  });

  it("adds optimistic messages and tracks pending ids", () => {
    const optimistic = buildOptimisticMessage({ temp_id: "temp-1" });
    useMessageStore.getState().addOptimisticMessage("room-1", optimistic);

    const state = useMessageStore.getState();
    expect(state.messages.get("room-1")).toEqual([optimistic]);
    expect(state.pendingIds.has("temp-1")).toBe(true);
  });

  it("confirms optimistic messages by replacement", () => {
    const optimistic = buildOptimisticMessage({
      temp_id: "temp-2",
      id: "temp-id",
    });
    useMessageStore.getState().addOptimisticMessage("room-1", optimistic);

    const confirmed = buildMessage({ id: "message-2" });
    useMessageStore.getState().confirmMessage("temp-2", confirmed);

    const state = useMessageStore.getState();
    const roomMessages = state.messages.get("room-1") ?? [];

    expect(roomMessages).toHaveLength(1);
    expect(roomMessages[0]).toEqual(confirmed);
    expect(state.pendingIds.has("temp-2")).toBe(false);
  });

  it("marks optimistic messages as failed", () => {
    const optimistic = buildOptimisticMessage({ temp_id: "temp-3" });
    useMessageStore.getState().addOptimisticMessage("room-1", optimistic);
    useMessageStore.getState().failMessage("temp-3");

    const state = useMessageStore.getState();
    const roomMessages = state.messages.get("room-1") ?? [];
    const failed = roomMessages[0] as OptimisticMessage;

    expect(failed.status).toBe("error");
    expect(state.pendingIds.has("temp-3")).toBe(false);
  });

  it("retries failed messages", () => {
    const optimistic = buildOptimisticMessage({ temp_id: "temp-4" });
    useMessageStore.getState().addOptimisticMessage("room-1", optimistic);
    useMessageStore.getState().failMessage("temp-4");
    useMessageStore.getState().retryMessage("temp-4");

    const state = useMessageStore.getState();
    const roomMessages = state.messages.get("room-1") ?? [];
    const retried = roomMessages[0] as OptimisticMessage;

    expect(retried.status).toBe("sending");
    expect(state.pendingIds.has("temp-4")).toBe(true);
  });

  it("prepends messages without duplicates and updates cursor", () => {
    const newer = buildMessage({ id: "message-2" });
    const older = buildMessage({ id: "message-1", created_at: "2026-03-31T00:00:00Z" });

    useMessageStore.getState().appendNewMessage("room-1", newer);
    useMessageStore
      .getState()
      .prependMessages("room-1", [older, newer], "cursor-1");

    const state = useMessageStore.getState();
    const roomMessages = state.messages.get("room-1") ?? [];

    expect(roomMessages.map((message) => message.id)).toEqual([
      "message-1",
      "message-2",
    ]);
    expect(state.cursors.get("room-1")).toBe("cursor-1");
    expect(state.hasMore.get("room-1")).toBe(true);
  });

  it("appends new messages to the end", () => {
    const first = buildMessage({ id: "message-1" });
    const second = buildMessage({ id: "message-2" });

    useMessageStore.getState().appendNewMessage("room-1", first);
    useMessageStore.getState().appendNewMessage("room-1", second);

    const state = useMessageStore.getState();
    const roomMessages = state.messages.get("room-1") ?? [];

    expect(roomMessages.map((message) => message.id)).toEqual([
      "message-1",
      "message-2",
    ]);
  });

  it("clears room state and pending ids", () => {
    const optimistic = buildOptimisticMessage({ temp_id: "temp-5" });
    const message = buildMessage({ id: "message-3" });

    useMessageStore.getState().addOptimisticMessage("room-1", optimistic);
    useMessageStore.getState().appendNewMessage("room-2", message);
    useMessageStore.getState().prependMessages("room-1", [message], null);

    useMessageStore.getState().clearRoom("room-1");

    const state = useMessageStore.getState();
    expect(state.messages.has("room-1")).toBe(false);
    expect(state.cursors.has("room-1")).toBe(false);
    expect(state.hasMore.has("room-1")).toBe(false);
    expect(state.pendingIds.has("temp-5")).toBe(false);
    expect(state.messages.has("room-2")).toBe(true);
  });

  it("confirmMessage deduplicates CDC-appended duplicate (Q3 race condition)", () => {
    // Simulate: CDC fires before confirmMessage — real message already in store
    const tempId = "temp-race";
    const optimistic = buildOptimisticMessage({
      id: tempId,
      temp_id: tempId,
    });
    const confirmed = buildMessage({ id: "message-real" });

    // Step 1: optimistic message added
    useMessageStore.getState().addOptimisticMessage("room-1", optimistic);

    // Step 2: CDC fires first — appends the real message (temp id not present, dedup misses)
    useMessageStore.getState().appendNewMessage("room-1", confirmed);

    // Step 3: confirmMessage runs — must replace optimistic AND remove CDC duplicate
    useMessageStore.getState().confirmMessage(tempId, confirmed);

    const roomMessages = useMessageStore.getState().messages.get("room-1") ?? [];
    expect(roomMessages).toHaveLength(1);
    expect(roomMessages[0]).toEqual(confirmed);
  });

  it("appendNewMessage is a true no-op (no state change) when message id is already present", () => {
    const message = buildMessage({ id: "message-dupe" });
    useMessageStore.getState().appendNewMessage("room-1", message);

    const stateBefore = useMessageStore.getState();
    useMessageStore.getState().appendNewMessage("room-1", message);
    const stateAfter = useMessageStore.getState();

    // Zustand state reference must be unchanged — true no-op
    expect(stateAfter).toBe(stateBefore);
  });
});
