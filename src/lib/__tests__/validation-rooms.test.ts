import { describe, expect, it } from "vitest";
import { AddMemberSchema, CreateRoomSchema } from "@/lib/validation/rooms";

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

describe("AddMemberSchema", () => {
  it("rejects usernames shorter than 3 characters", () => {
    const result = AddMemberSchema.safeParse({ username: "ab" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.username).toBeDefined();
    }
  });

  it("rejects usernames longer than 30 characters", () => {
    const result = AddMemberSchema.safeParse({ username: "a".repeat(31) });
    expect(result.success).toBe(false);
  });

  it("rejects uppercase letters", () => {
    const result = AddMemberSchema.safeParse({ username: "Alice" });
    expect(result.success).toBe(false);
  });

  it("rejects spaces", () => {
    const result = AddMemberSchema.safeParse({ username: "john doe" });
    expect(result.success).toBe(false);
  });

  it("rejects special characters", () => {
    const result = AddMemberSchema.safeParse({ username: "user@name" });
    expect(result.success).toBe(false);
  });

  it("accepts a valid lowercase username", () => {
    const result = AddMemberSchema.safeParse({ username: "alice_99" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.username).toBe("alice_99");
    }
  });

  it("trims whitespace before validating", () => {
    const result = AddMemberSchema.safeParse({ username: "  alice  " });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.username).toBe("alice");
    }
  });

  it("accepts username at exactly 3 characters", () => {
    const result = AddMemberSchema.safeParse({ username: "bob" });
    expect(result.success).toBe(true);
  });

  it("accepts username at exactly 30 characters", () => {
    const result = AddMemberSchema.safeParse({ username: "a".repeat(30) });
    expect(result.success).toBe(true);
  });
});
