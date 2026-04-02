import { describe, expect, it } from "vitest";
import { SendMessageSchema } from "@/lib/validation/messages";

describe("SendMessageSchema", () => {
  it("rejects empty content", () => {
    const result = SendMessageSchema.safeParse({ content: "" });
    expect(result.success).toBe(false);
  });

  it("rejects whitespace-only content", () => {
    const result = SendMessageSchema.safeParse({ content: "   " });
    expect(result.success).toBe(false);
  });

  it("rejects content longer than 10,000 characters", () => {
    const result = SendMessageSchema.safeParse({ content: "a".repeat(10001) });
    expect(result.success).toBe(false);
  });

  it("accepts content of length 1", () => {
    const result = SendMessageSchema.safeParse({ content: "a" });
    expect(result.success).toBe(true);
  });

  it("accepts content of length 10,000", () => {
    const result = SendMessageSchema.safeParse({ content: "a".repeat(10000) });
    expect(result.success).toBe(true);
  });
});
