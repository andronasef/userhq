import { describe, it, expect } from "vitest";
import {
  generateKeyBetween,
  RoadmapInternalTitleSchema,
  RoadmapPublicTitleSchema,
  AdminRoadmapItemSchema,
  PublicRoadmapItemSchema,
  API_ERROR_CODES,
} from "../src/index.js";

describe("fractional indexing (generateKeyBetween)", () => {
  it("generates initial key when both bounds are null", () => {
    const key = generateKeyBetween(null, null);
    expect(key).toBe("a0");
  });

  it("generates key before head (null, 'a0')", () => {
    const key = generateKeyBetween(null, "a0");
    expect(key < "a0").toBe(true);
    expect(key).toBe("Zz");
  });

  it("generates key after tail ('a0', null)", () => {
    const key = generateKeyBetween("a0", null);
    expect(key > "a0").toBe(true);
    expect(key).toBe("a1");
  });

  it("generates key between ('a0', 'a1')", () => {
    const key = generateKeyBetween("a0", "a1");
    expect(key > "a0").toBe(true);
    expect(key < "a1").toBe(true);
    expect(key).toBe("a0V");
  });

  it("handles out-of-order bounds gracefully", () => {
    const key = generateKeyBetween("a1", "a0");
    expect(key > "a0").toBe(true);
    expect(key < "a1").toBe(true);
  });

  it("supports 100 consecutive mid-insertions with strictly ascending order", () => {
    let lower = "a0";
    const upper = "a1";
    for (let i = 0; i < 100; i++) {
      const mid = generateKeyBetween(lower, upper);
      expect(mid > lower).toBe(true);
      expect(mid < upper).toBe(true);
      lower = mid;
    }
  });

  it("supports consecutive prepends and appends", () => {
    let head = "a0";
    for (let i = 0; i < 20; i++) {
      const nextHead = generateKeyBetween(null, head);
      expect(nextHead < head).toBe(true);
      head = nextHead;
    }

    let tail = "a0";
    for (let i = 0; i < 20; i++) {
      const nextTail = generateKeyBetween(tail, null);
      expect(nextTail > tail).toBe(true);
      tail = nextTail;
    }
  });
});

describe("roadmap title schemas", () => {
  it("validates RoadmapInternalTitleSchema requirements", () => {
    // Valid title
    const res = RoadmapInternalTitleSchema.safeParse("  Feature Alpha  ");
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data).toBe("Feature Alpha");
    }

    // Required error when empty
    const emptyRes = RoadmapInternalTitleSchema.safeParse("   ");
    expect(emptyRes.success).toBe(false);
    if (!emptyRes.success) {
      expect(emptyRes.error.issues[0]?.message).toBe("item_title_required");
    }

    // Too short
    const shortRes = RoadmapInternalTitleSchema.safeParse("ab");
    expect(shortRes.success).toBe(false);
    if (!shortRes.success) {
      expect(shortRes.error.issues[0]?.message).toBe("item_title_length");
    }

    // Too long
    const longRes = RoadmapInternalTitleSchema.safeParse("a".repeat(121));
    expect(longRes.success).toBe(false);
    if (!longRes.success) {
      expect(longRes.error.issues[0]?.message).toBe("item_title_length");
    }
  });

  it("validates RoadmapPublicTitleSchema requirements", () => {
    // Valid public title
    const res = RoadmapPublicTitleSchema.safeParse("Public Roadmap Feature");
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data).toBe("Public Roadmap Feature");
    }

    // Required when empty
    const emptyRes = RoadmapPublicTitleSchema.safeParse("  ");
    expect(emptyRes.success).toBe(false);
    if (!emptyRes.success) {
      expect(emptyRes.error.issues[0]?.message).toBe("public_title_required");
    }

    // Too short
    const shortRes = RoadmapPublicTitleSchema.safeParse("x");
    expect(shortRes.success).toBe(false);
    if (!shortRes.success) {
      expect(shortRes.error.issues[0]?.message).toBe("public_title_length");
    }
  });
});

describe("roadmap item DTO schemas", () => {
  it("parses valid AdminRoadmapItemSchema payload", () => {
    const payload = {
      id: "550e8400-e29b-41d4-a716-446655440000",
      statusId: "550e8400-e29b-41d4-a716-446655440001",
      internalTitle: "Internal Project Spec",
      internalDescription: "Internal description notes",
      internalNotes: "Private leadership notes",
      publicTitle: "Public Roadmap Launch",
      publicDescription: "Public customer-facing description",
      isPublic: true,
      rank: "a0",
      assignee: {
        id: "usr_123",
        name: "Jane Doe",
        image: null,
      },
      deadlineText: "Q4 2026",
      deadlineDate: "2026-12-31T23:59:59.000Z",
      linkedPostCount: 3,
      createdAt: "2026-10-11T12:00:00.000Z",
      updatedAt: "2026-10-11T12:00:00.000Z",
    };

    const parsed = AdminRoadmapItemSchema.safeParse(payload);
    expect(parsed.success).toBe(true);
  });

  it("parses valid PublicRoadmapItemSchema payload", () => {
    const payload = {
      id: "550e8400-e29b-41d4-a716-446655440000",
      statusId: "550e8400-e29b-41d4-a716-446655440001",
      title: "Public Feature",
      description: "Feature details",
      postCount: 5,
      createdAt: "2026-10-11T12:00:00.000Z",
    };

    const parsed = PublicRoadmapItemSchema.safeParse(payload);
    expect(parsed.success).toBe(true);
  });

  it("contains all required Phase 4 API_ERROR_CODES", () => {
    const requiredCodes = [
      "item_title_required",
      "item_title_length",
      "public_title_required",
      "public_title_length",
      "notes_too_long",
      "post_already_linked",
      "item_not_found",
      "move_failed",
    ] as const;

    for (const code of requiredCodes) {
      expect(API_ERROR_CODES).toContain(code);
    }
  });
});
