import { z } from "zod";

export const CreateRoomSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, { message: "Room name is required." })
    .max(80, { message: "Room name must be at most 80 characters." }),
  description: z
    .string()
    .trim()
    .max(255, { message: "Description must be at most 255 characters." })
    .optional(),
  type: z.enum(["direct", "group"]).default("group"),
});

export const AddMemberSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3, { message: "Username must be at least 3 characters." })
    .max(30, { message: "Username must be at most 30 characters." })
    .regex(/^[a-z0-9_]+$/, {
      message:
        "Username may only contain lowercase letters, numbers, and underscores.",
    }),
});

export type CreateRoomInput = z.infer<typeof CreateRoomSchema>;
export type CreateRoomFormValues = z.input<typeof CreateRoomSchema>;
export type AddMemberInput = z.infer<typeof AddMemberSchema>;
