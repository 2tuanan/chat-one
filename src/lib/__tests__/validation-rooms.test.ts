import { describe, expect, it } from "vitest";
import { CreateRoomSchema } from "@/lib/validation/rooms";

describe("CreateRoomSchema", () => {
  describe("name", () => {
    it("rejects an empty name", () => {
      const result = CreateRoomSchema.safeParse({ name: "" });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.flatten().fieldErrors.name).toBeDefined();
      }
    });

    it("rejects a name exceeding 80 characters", () => {
      const result = CreateRoomSchema.safeParse({ name: "a".repeat(81) });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.flatten().fieldErrors.name).toBeDefined();
      }
    });

    it("trims whitespace before validating", () => {
      const result = CreateRoomSchema.safeParse({ name: "  " });
      expect(result.success).toBe(false);
    });

    it("accepts a valid name", () => {
      const result = CreateRoomSchema.safeParse({ name: "general" });
      expect(result.success).toBe(true);
    });

    it("accepts a name at the 80-character limit", () => {
      const result = CreateRoomSchema.safeParse({ name: "a".repeat(80) });
      expect(result.success).toBe(true);
    });
  });

  describe("description", () => {
    it("is optional — omitting it is valid", () => {
      const result = CreateRoomSchema.safeParse({ name: "general" });
      expect(result.success).toBe(true);
    });

    it("rejects a description exceeding 255 characters", () => {
      const result = CreateRoomSchema.safeParse({
        name: "general",
        description: "x".repeat(256),
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.flatten().fieldErrors.description).toBeDefined();
      }
    });

    it("accepts a description at the 255-character limit", () => {
      const result = CreateRoomSchema.safeParse({
        name: "general",
        description: "x".repeat(255),
      });
      expect(result.success).toBe(true);
    });
  });

  describe("type", () => {
    it("defaults to 'group' when omitted", () => {
      const result = CreateRoomSchema.safeParse({ name: "general" });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.type).toBe("group");
      }
    });

    it("accepts 'direct' as a valid type", () => {
      const result = CreateRoomSchema.safeParse({
        name: "general",
        type: "direct",
      });
      expect(result.success).toBe(true);
    });

    it("rejects an unknown type value", () => {
      const result = CreateRoomSchema.safeParse({
        name: "general",
        type: "channel",
      });
      expect(result.success).toBe(false);
    });
  });
});
