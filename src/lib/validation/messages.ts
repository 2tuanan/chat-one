import { z } from "zod";

export const SendMessageSchema = z.object({
  content: z
    .string()
    .trim()
    .min(1, { message: "Message cannot be empty." })
    .max(10000, { message: "Message must be at most 10,000 characters." }),
});

export type SendMessageInput = z.infer<typeof SendMessageSchema>;
export type SendMessageFormValues = z.input<typeof SendMessageSchema>;
