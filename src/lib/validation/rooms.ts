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

export type CreateRoomInput = z.infer<typeof CreateRoomSchema>;
export type CreateRoomFormValues = z.input<typeof CreateRoomSchema>;
