// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import MessageInput from "@/components/chat/message-input";
import { useAuthStore } from "@/store/auth-store";
import { useMessageStore, initialMessageState } from "@/store/message-store";
import type { MessageWithProfile } from "@/types/messages";

const sendMessageMock = vi.fn();

vi.mock("@/actions/messages", () => ({
  sendMessage: (...args: unknown[]) => sendMessageMock(...args),
}));

describe("MessageInput", () => {
  beforeEach(() => {
    vi.stubGlobal("crypto", {
      randomUUID: vi.fn(() => "temp-1"),
    });

    useAuthStore.setState({
      user: { id: "user-1", email: "user@example.com" },
      profile: {
        id: "user-1",
        username: "user_1",
        display_name: "User One",
        avatar_url: null,
        created_at: "2026-04-01T00:00:00Z",
        updated_at: "2026-04-01T00:00:00Z",
      },
      isLoading: false,
    });

    useMessageStore.setState({
      messages: new Map(initialMessageState.messages),
      cursors: new Map(initialMessageState.cursors),
      hasMore: new Map(initialMessageState.hasMore),
      pendingIds: new Set(initialMessageState.pendingIds),
    });

    sendMessageMock.mockReset();
  });

  it("submits on Enter", async () => {
    const message: MessageWithProfile = {
      id: "message-1",
      room_id: "room-1",
      sender_id: "user-1",
      content: "Hello",
      type: "text",
      created_at: "2026-04-01T00:00:00Z",
      updated_at: "2026-04-01T00:00:00Z",
      deleted_at: null,
      sender: {
        id: "user-1",
        username: "user_1",
        display_name: "User One",
        avatar_url: null,
      },
    };

    sendMessageMock.mockResolvedValue({ message });

    render(<MessageInput roomId="room-1" />);

    const textarea = screen.getByLabelText("Message");
    await userEvent.type(textarea, "Hello");
    await userEvent.keyboard("{Enter}");

    await waitFor(() => {
      expect(sendMessageMock).toHaveBeenCalledWith("room-1", {
        content: "Hello",
      });
    });
  });

  it("inserts a newline on Shift+Enter", async () => {
    render(<MessageInput roomId="room-1" />);

    const textarea = screen.getByLabelText("Message");
    await userEvent.type(textarea, "Hello");
    await userEvent.keyboard("{Shift>}{Enter}{/Shift}");

    expect(sendMessageMock).not.toHaveBeenCalled();
    expect((textarea as HTMLTextAreaElement).value).toBe("Hello\n");
  });

  it("refocuses the textarea after submit", async () => {
    const focusSpy = vi.spyOn(HTMLTextAreaElement.prototype, "focus");
    const message: MessageWithProfile = {
      id: "message-2",
      room_id: "room-1",
      sender_id: "user-1",
      content: "Hello",
      type: "text",
      created_at: "2026-04-01T00:00:00Z",
      updated_at: "2026-04-01T00:00:00Z",
      deleted_at: null,
      sender: {
        id: "user-1",
        username: "user_1",
        display_name: "User One",
        avatar_url: null,
      },
    };

    sendMessageMock.mockResolvedValue({ message });

    render(<MessageInput roomId="room-1" />);

    const textarea = screen.getByLabelText("Message");
    await userEvent.type(textarea, "Hello");
    await userEvent.keyboard("{Enter}");

    await waitFor(() => {
      expect(sendMessageMock).toHaveBeenCalled();
    });

    expect(focusSpy).toHaveBeenCalled();
  });
});
