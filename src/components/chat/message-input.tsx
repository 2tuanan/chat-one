"use client";

import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Send } from "lucide-react";
import { sendMessage } from "@/actions/messages";
import { useAuthStore } from "@/store/auth-store";
import { useMessageStore } from "@/store/message-store";
import {
  SendMessageSchema,
  type SendMessageFormValues,
  type SendMessageInput,
} from "@/lib/validation/messages";
import type { OptimisticMessage } from "@/types/messages";

type MessageInputProps = {
  roomId: string;
};

export default function MessageInput({ roomId }: MessageInputProps) {
  const [submitError, setSubmitError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const user = useAuthStore((state) => state.user);
  const profile = useAuthStore((state) => state.profile);
  const addOptimisticMessage = useMessageStore(
    (state) => state.addOptimisticMessage,
  );
  const confirmMessage = useMessageStore((state) => state.confirmMessage);
  const failMessage = useMessageStore((state) => state.failMessage);

  const form = useForm<SendMessageFormValues, unknown, SendMessageInput>({
    resolver: zodResolver(SendMessageSchema),
    defaultValues: {
      content: "",
    },
  });

  const contentValue = form.watch("content");
  const contentField = form.register("content");

  const onSubmit = async (values: SendMessageInput) => {
    setSubmitError(null);

    if (!user || !profile) {
      setSubmitError("You must be signed in to send messages.");
      return;
    }

    const tempId = crypto.randomUUID();
    const now = new Date().toISOString();
    const optimistic: OptimisticMessage = {
      id: tempId,
      temp_id: tempId,
      room_id: roomId,
      sender_id: user.id,
      content: values.content,
      type: "text",
      created_at: now,
      updated_at: now,
      deleted_at: null,
      status: "sending",
      sender: {
        id: profile.id,
        username: profile.username,
        display_name: profile.display_name,
        avatar_url: profile.avatar_url,
      },
    };

    addOptimisticMessage(roomId, optimistic);

    try {
      const result = await sendMessage(roomId, values);

      if (result.fieldErrors) {
        const message =
          result.fieldErrors.content ?? "Message is invalid.";
        form.setError("content", {
          type: "server",
          message,
        });
        failMessage(tempId);
        return;
      }

      if (result.error || !result.message) {
        setSubmitError(result.error ?? "Unable to send message.");
        failMessage(tempId);
        return;
      }

      confirmMessage(tempId, result.message);
      form.reset({ content: "" });
    } catch {
      failMessage(tempId);
    } finally {
      textareaRef.current?.focus();
    }
  };

  return (
    <div className="border-t border-zinc-200 bg-white px-6 py-4">
      <form
        className="flex items-end gap-3"
        onSubmit={form.handleSubmit(onSubmit)}
      >
        <div className="flex-1">
          <label className="sr-only" htmlFor="message-content">
            Message
          </label>
          <textarea
            id="message-content"
            rows={2}
            className="min-h-[48px] w-full resize-none rounded-xl border border-zinc-200 px-4 py-3 text-sm text-zinc-900 focus:border-zinc-400 focus:outline-none"
            placeholder="Write a message..."
            {...contentField}
            ref={(element) => {
              contentField.ref(element);
              textareaRef.current = element;
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                form.handleSubmit(onSubmit)();
              }
            }}
          />
          {form.formState.errors.content ? (
            <p className="mt-1 text-xs text-rose-500">
              {form.formState.errors.content.message}
            </p>
          ) : null}
          {submitError ? (
            <p className="mt-1 text-xs text-rose-500">{submitError}</p>
          ) : null}
        </div>
        <button
          type="submit"
          className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-zinc-900 px-4 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={form.formState.isSubmitting || !contentValue?.trim()}
        >
          {form.formState.isSubmitting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
          Send
        </button>
      </form>
    </div>
  );
}
