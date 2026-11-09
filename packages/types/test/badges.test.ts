import { describe, expect, it } from "vitest";
import {
  CreateBadgeInputSchema,
  CreateBadgeRuleInputSchema,
  ProductUsersQuerySchema,
  UpdateBadgeInputSchema,
} from "../src/badges.js";

describe("Badges Schemas", () => {
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
      })
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
