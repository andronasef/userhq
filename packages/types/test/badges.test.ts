import { describe, expect, it } from "vitest";
import {
  CreateBadgeInputSchema,
  CreateBadgeRuleInputSchema,
  ProductUsersQuerySchema,
  AttributeInputSchema,
} from "../src/badges.js";

describe("Badges Schemas", () => {
  it("defaults key matching and limits regexes and reserved keys", () => {
    expect(
      CreateBadgeRuleInputSchema.parse({ paramKey: "plan", matchValue: "pro" })
        .keyMatchType,
    ).toBe("exact");
    for (const rule of [
      { paramKey: "plan_sig", matchValue: "pro" },
      { paramKey: "plan_ts", matchValue: "pro" },
      { paramKey: "plan", matchType: "regex", matchValue: "x".repeat(201) },
      { paramKey: "plan", matchValue: "x".repeat(257) },
      { paramKey: "x".repeat(201), keyMatchType: "regex", matchValue: "pro" },
    ])
      expect(CreateBadgeRuleInputSchema.safeParse(rule).success).toBe(false);
  });

  it("bounds public attribution parameters", () => {
    const searchParams = Object.fromEntries(
      Array.from({ length: 50 }, (_, i) => [`key${i}`, "x".repeat(256)]),
    );
    expect(AttributeInputSchema.safeParse({ searchParams }).success).toBe(true);
    expect(
      AttributeInputSchema.safeParse({
        searchParams: { ...searchParams, extra: "x" },
      }).success,
    ).toBe(false);
    expect(
      AttributeInputSchema.safeParse({ searchParams: { key: "x".repeat(257) } })
        .success,
    ).toBe(false);
    expect(
      AttributeInputSchema.safeParse({
        searchParams: { ["x".repeat(105)]: "x" },
      }).success,
    ).toBe(false);
    // a max-length rule key plus its _sig / _ts companions must be accepted
    expect(
      AttributeInputSchema.safeParse({
        searchParams: {
          ["a".repeat(100)]: "x",
          ["a".repeat(100) + "_sig"]: "x",
          ["a".repeat(100) + "_ts"]: "1",
        },
      }).success,
    ).toBe(true);
  });
  it("validates valid badge creation input", () => {
    const input = {
      name: "PRO Member",
      slug: "pro-member",
      description: "Subscribers who purchased Pro tier",
      color: "#0284c7",
      textColor: "#ffffff",
      priority: 10,
    };
    const parsed = CreateBadgeInputSchema.parse(input);
    expect(parsed.name).toBe("PRO Member");
    expect(parsed.slug).toBe("pro-member");
    expect(parsed.priority).toBe(10);
    expect(parsed.isActive).toBe(true);
  });

  it("rejects invalid slugs and colors", () => {
    expect(() =>
      CreateBadgeInputSchema.parse({
        name: "Test",
        slug: "Invalid Slug!",
        color: "#123",
      }),
    ).toThrow();
  });

  it("validates rule creation input", () => {
    const rule = CreateBadgeRuleInputSchema.parse({
      paramKey: "pro_id",
      matchType: "regex",
      matchValue: "^g_sub_[a-z0-9]+$",
      secretToken: "hmac_secret_key_123",
    });
    expect(rule.paramKey).toBe("pro_id");
    expect(rule.matchType).toBe("regex");
    expect(rule.secretToken).toBe("hmac_secret_key_123");
  });

  it("defaults rule matchType to exact", () => {
    const rule = CreateBadgeRuleInputSchema.parse({
      paramKey: "plan",
      matchValue: "pro",
    });
    expect(rule.matchType).toBe("exact");
  });

  it("validates users query pagination defaults", () => {
    const query = ProductUsersQuerySchema.parse({});
    expect(query.page).toBe(1);
    expect(query.limit).toBe(25);
  });
});
