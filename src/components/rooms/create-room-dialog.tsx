"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus } from "lucide-react";
import { createRoom } from "@/actions/rooms";
import { useRoomStore } from "@/store/room-store";
import {
  CreateRoomSchema,
  type CreateRoomFormValues,
  type CreateRoomInput,
} from "@/lib/validation/rooms";

export default function CreateRoomDialog() {
  const [isOpen, setIsOpen] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const addRoom = useRoomStore((state) => state.addRoom);
  const setActiveRoom = useRoomStore((state) => state.setActiveRoom);

  const form = useForm<CreateRoomFormValues, unknown, CreateRoomInput>({
    resolver: zodResolver(CreateRoomSchema),
    defaultValues: {
      name: "",
      description: "",
      type: "group",
    },
  });

  const onSubmit = async (values: CreateRoomInput) => {
    setSubmitError(null);
    const result = await createRoom(values);

    if (result.fieldErrors) {
      Object.entries(result.fieldErrors).forEach(([field, message]) => {
        form.setError(field as keyof CreateRoomFormValues, {
          type: "server",
          message,
        });
      });
      return;
    }

    if (result.error) {
      setSubmitError(result.error);
      return;
    }

    if (result.room) {
      addRoom(result.room);
      setActiveRoom(result.room.id);
      form.reset({ name: "", description: "", type: "group" });
      setIsOpen(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-600 transition hover:border-zinc-300 hover:text-zinc-900"
        aria-label="Create room"
      >
        <Plus className="h-4 w-4" />
      </button>
      {isOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div
            className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl"
            role="dialog"
            aria-modal="true"
            aria-label="Create room"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-zinc-900">New room</h2>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="text-sm text-zinc-500 hover:text-zinc-900"
              >
                Close
              </button>
            </div>
            <p className="mt-1 text-sm text-zinc-500">
              Create a new group conversation.
            </p>
            <form
              onSubmit={form.handleSubmit(onSubmit)}
              className="mt-5 space-y-4"
            >
              <div className="space-y-1">
                <label
                  htmlFor="room-name"
                  className="text-sm font-medium text-zinc-700"
                >
                  Room name
                </label>
                <input
                  id="room-name"
                  type="text"
                  className="w-full rounded-md border border-zinc-200 px-3 py-2 text-sm text-zinc-900 focus:border-zinc-400 focus:outline-none"
                  placeholder="Design sync"
                  {...form.register("name")}
                />
                {form.formState.errors.name ? (
                  <p className="text-xs text-rose-500">
                    {form.formState.errors.name.message}
                  </p>
                ) : null}
              </div>
              <div className="space-y-1">
                <label
                  htmlFor="room-description"
                  className="text-sm font-medium text-zinc-700"
                >
                  Description (optional)
                </label>
                <textarea
                  id="room-description"
                  className="min-h-[80px] w-full resize-none rounded-md border border-zinc-200 px-3 py-2 text-sm text-zinc-900 focus:border-zinc-400 focus:outline-none"
                  placeholder="What should people expect in this room?"
                  {...form.register("description")}
                />
                {form.formState.errors.description ? (
                  <p className="text-xs text-rose-500">
                    {form.formState.errors.description.message}
                  </p>
                ) : null}
              </div>
              <input type="hidden" {...form.register("type")} />
              {submitError ? (
                <p className="text-sm text-rose-600">{submitError}</p>
              ) : null}
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="rounded-md border border-zinc-200 px-4 py-2 text-sm text-zinc-700 hover:border-zinc-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={form.formState.isSubmitting}
                >
                  Create room
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
