import { create } from "zustand";
import type { MessageWithProfile, OptimisticMessage } from "@/types/messages";

export interface MessageStore {
  messages: Map<string, (MessageWithProfile | OptimisticMessage)[]>;
  cursors: Map<string, string | null>;
  hasMore: Map<string, boolean>;
  pendingIds: Set<string>;
  addOptimisticMessage: (roomId: string, msg: OptimisticMessage) => void;
  confirmMessage: (tempId: string, realMsg: MessageWithProfile) => void;
  failMessage: (tempId: string) => void;
  retryMessage: (tempId: string) => void;
  prependMessages: (
    roomId: string,
    msgs: MessageWithProfile[],
    cursor: string | null,
  ) => void;
  appendNewMessage: (roomId: string, msg: MessageWithProfile) => void;
  clearRoom: (roomId: string) => void;
}

const isOptimisticMessage = (
  message: MessageWithProfile | OptimisticMessage,
): message is OptimisticMessage => "temp_id" in message;

export const initialMessageState: Pick<
  MessageStore,
  "messages" | "cursors" | "hasMore" | "pendingIds"
> = {
  messages: new Map(),
  cursors: new Map(),
  hasMore: new Map(),
  pendingIds: new Set(),
};

export const useMessageStore = create<MessageStore>((set) => ({
  ...initialMessageState,
  addOptimisticMessage: (roomId, msg) =>
    set((state) => {
      const messages = new Map(state.messages);
      const roomMessages = messages.get(roomId) ?? [];
      messages.set(roomId, [...roomMessages, msg]);

      const pendingIds = new Set(state.pendingIds);
      pendingIds.add(msg.temp_id);

      return { messages, pendingIds };
    }),
  confirmMessage: (tempId, realMsg) =>
    set((state) => {
      let updatedMessages = state.messages;
      let found = false;

      for (const [roomId, roomMessages] of state.messages.entries()) {
        const index = roomMessages.findIndex(
          (message) => isOptimisticMessage(message) && message.temp_id === tempId,
        );

        if (index === -1) {
          continue;
        }

        const nextRoomMessages = [...roomMessages];
        nextRoomMessages[index] = realMsg;

        if (!found) {
          updatedMessages = new Map(state.messages);
          found = true;
        }

        updatedMessages.set(roomId, nextRoomMessages);
        break;
      }

      const pendingIds = new Set(state.pendingIds);
      pendingIds.delete(tempId);

      return { messages: updatedMessages, pendingIds };
    }),
  failMessage: (tempId) =>
    set((state) => {
      let updatedMessages = state.messages;
      let found = false;

      for (const [roomId, roomMessages] of state.messages.entries()) {
        const index = roomMessages.findIndex(
          (message) => isOptimisticMessage(message) && message.temp_id === tempId,
        );

        if (index === -1) {
          continue;
        }

        const target = roomMessages[index];
        if (!isOptimisticMessage(target)) {
          break;
        }

        const nextRoomMessages = [...roomMessages];
        nextRoomMessages[index] = { ...target, status: "error" };

        if (!found) {
          updatedMessages = new Map(state.messages);
          found = true;
        }

        updatedMessages.set(roomId, nextRoomMessages);
        break;
      }

      const pendingIds = new Set(state.pendingIds);
      pendingIds.delete(tempId);

      return { messages: updatedMessages, pendingIds };
    }),
  retryMessage: (tempId) =>
    set((state) => {
      let updatedMessages = state.messages;
      let found = false;

      for (const [roomId, roomMessages] of state.messages.entries()) {
        const index = roomMessages.findIndex(
          (message) => isOptimisticMessage(message) && message.temp_id === tempId,
        );

        if (index === -1) {
          continue;
        }

        const target = roomMessages[index];
        if (!isOptimisticMessage(target)) {
          break;
        }

        const nextRoomMessages = [...roomMessages];
        nextRoomMessages[index] = { ...target, status: "sending" };

        if (!found) {
          updatedMessages = new Map(state.messages);
          found = true;
        }

        updatedMessages.set(roomId, nextRoomMessages);
        break;
      }

      if (!found) {
        return { messages: updatedMessages, pendingIds: state.pendingIds };
      }

      const pendingIds = new Set(state.pendingIds);
      pendingIds.add(tempId);

      return { messages: updatedMessages, pendingIds };
    }),
  prependMessages: (roomId, msgs, cursor) =>
    set((state) => {
      const messages = new Map(state.messages);
      const existing = messages.get(roomId) ?? [];
      const existingIds = new Set(existing.map((message) => message.id));
      const deduped = msgs.filter((message) => !existingIds.has(message.id));

      messages.set(roomId, [...deduped, ...existing]);

      const cursors = new Map(state.cursors);
      cursors.set(roomId, cursor);

      const hasMore = new Map(state.hasMore);
      hasMore.set(roomId, cursor !== null);

      return { messages, cursors, hasMore };
    }),
  appendNewMessage: (roomId, msg) =>
    set((state) => {
      const messages = new Map(state.messages);
      const roomMessages = messages.get(roomId) ?? [];
      messages.set(roomId, [...roomMessages, msg]);
      return { messages };
    }),
  clearRoom: (roomId) =>
    set((state) => {
      const messages = new Map(state.messages);
      const roomMessages = messages.get(roomId) ?? [];
      messages.delete(roomId);

      const cursors = new Map(state.cursors);
      cursors.delete(roomId);

      const hasMore = new Map(state.hasMore);
      hasMore.delete(roomId);

      const pendingIds = new Set(state.pendingIds);
      roomMessages.forEach((message) => {
        if (isOptimisticMessage(message)) {
          pendingIds.delete(message.temp_id);
        }
      });

      return {
        messages,
        cursors,
        hasMore,
        pendingIds,
      };
    }),
}));
