import { Injectable, Inject } from "@nestjs/common";
import { eq, and, sql, desc, asc, inArray, or } from "drizzle-orm";
import { ENV, type Env } from "../env.js";
import { ATTRIBUTE_PARAM_VALUE_MAX } from "@userhq/types";
import {
  anchoredRegex,
  attributionCookieName,
  ATTRIBUTION_MAX_BADGES,
  readCookie,
  signAttributionCookie,
  verifyAttributionCookie,
  verifySignedValue,
  type AttributionEntry,
} from "./attribution.js";
import {
  DB,
  type Db,
  productBadges,
  productBadgeRules,
  userProductBadges,
  user,
  posts,
  comments,
  votes,
} from "@userhq/db";
import type {
  Badge,
  BadgeRule,
  CreateBadgeInput,
  UpdateBadgeInput,
  CreateBadgeRuleInput,
  ProductUsersQuery,
  ProductUserListItem,
  AssignUserBadgeInput,
  PublicBadgeChip,
  UserProductBadgeItem,
} from "@userhq/types";
import { ApiException } from "../common/api-error.filter.js";

@Injectable()
export class BadgesService {
  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(ENV) private readonly env: Env,
  ) {}

  async listBadges(productId: string): Promise<Badge[]> {
    const badges = await this.db
      .select()
      .from(productBadges)
      .where(eq(productBadges.productId, productId))
      .orderBy(desc(productBadges.priority), asc(productBadges.createdAt));

    if (badges.length === 0) {
      return [];
    }

    const rules = await this.db
      .select()
      .from(productBadgeRules)
      .where(eq(productBadgeRules.productId, productId))
      .orderBy(asc(productBadgeRules.createdAt));

    const rulesByBadge = new Map<string, BadgeRule[]>();
    for (const rule of rules) {
      const list = rulesByBadge.get(rule.badgeId) ?? [];
      list.push({
        id: rule.id,
        productId: rule.productId,
        badgeId: rule.badgeId,
        paramKey: rule.paramKey,
        matchType: rule.matchType as "exact" | "regex",
        matchValue: rule.matchValue,
        hasSecretToken: Boolean(rule.secretToken),
        createdAt: rule.createdAt.toISOString(),
        updatedAt: rule.updatedAt.toISOString(),
      });
      rulesByBadge.set(rule.badgeId, list);
    }

    return badges.map((b) => {
      const badgeRules = rulesByBadge.get(b.id) ?? [];
      return {
        id: b.id,
        productId: b.productId,
        name: b.name,
        slug: b.slug,
        description: b.description,
        color: b.color,
        textColor: b.textColor,
        icon: b.icon,
        priority: b.priority,
        isActive: b.isActive,
        rulesCount: badgeRules.length,
        rules: badgeRules,
        createdAt: b.createdAt.toISOString(),
        updatedAt: b.updatedAt.toISOString(),
      };
    });
  }

  async createBadge(
    productId: string,
    input: CreateBadgeInput,
  ): Promise<Badge> {
    const [existing] = await this.db
      .select({ id: productBadges.id })
      .from(productBadges)
      .where(
        and(
          eq(productBadges.productId, productId),
          eq(productBadges.slug, input.slug),
        ),
      )
      .limit(1);

    if (existing) {
      throw new ApiException(
        "badge_conflict",
        409,
        `Badge with slug "${input.slug}" already exists for this product.`,
      );
    }

    const [created] = await this.db
      .insert(productBadges)
      .values({
        productId,
        name: input.name,
        slug: input.slug,
        description: input.description ?? null,
        color: input.color,
        textColor: input.textColor,
        icon: input.icon ?? null,
        priority: input.priority,
        isActive: input.isActive,
      })
      .returning();

    return {
      id: created.id,
      productId: created.productId,
      name: created.name,
      slug: created.slug,
      description: created.description,
      color: created.color,
      textColor: created.textColor,
      icon: created.icon,
      priority: created.priority,
      isActive: created.isActive,
      rulesCount: 0,
      rules: [],
      createdAt: created.createdAt.toISOString(),
      updatedAt: created.updatedAt.toISOString(),
    };
  }

  async updateBadge(
    productId: string,
    badgeId: string,
    input: UpdateBadgeInput,
  ): Promise<Badge> {
    const [badge] = await this.db
      .select()
      .from(productBadges)
      .where(
        and(
          eq(productBadges.id, badgeId),
          eq(productBadges.productId, productId),
        ),
      )
      .limit(1);

    if (!badge) {
      throw new ApiException("not_found", 404, "Badge not found.");
    }

    if (input.slug && input.slug !== badge.slug) {
      const [conflict] = await this.db
        .select({ id: productBadges.id })
        .from(productBadges)
        .where(
          and(
            eq(productBadges.productId, productId),
            eq(productBadges.slug, input.slug),
          ),
        )
        .limit(1);

      if (conflict) {
        throw new ApiException(
          "badge_conflict",
          409,
          `Badge with slug "${input.slug}" already exists.`,
        );
      }
    }

    const [updated] = await this.db
      .update(productBadges)
      .set({
        name: input.name ?? badge.name,
        slug: input.slug ?? badge.slug,
        description:
          input.description !== undefined
            ? input.description
            : badge.description,
        color: input.color ?? badge.color,
        textColor: input.textColor ?? badge.textColor,
        icon: input.icon !== undefined ? input.icon : badge.icon,
        priority: input.priority ?? badge.priority,
        isActive:
          input.isActive !== undefined ? input.isActive : badge.isActive,
        updatedAt: new Date(),
      })
      .where(eq(productBadges.id, badgeId))
      .returning();

    return {
      id: updated.id,
      productId: updated.productId,
      name: updated.name,
      slug: updated.slug,
      description: updated.description,
      color: updated.color,
      textColor: updated.textColor,
      icon: updated.icon,
      priority: updated.priority,
      isActive: updated.isActive,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    };
  }

  async deleteBadge(productId: string, badgeId: string): Promise<void> {
    const [badge] = await this.db
      .select({ id: productBadges.id })
      .from(productBadges)
      .where(
        and(
          eq(productBadges.id, badgeId),
          eq(productBadges.productId, productId),
        ),
      )
      .limit(1);

    if (!badge) {
      throw new ApiException("not_found", 404, "Badge not found.");
    }

    await this.db.delete(productBadges).where(eq(productBadges.id, badgeId));
  }

  async addRule(
    productId: string,
    badgeId: string,
    input: CreateBadgeRuleInput,
  ): Promise<BadgeRule> {
    const [badge] = await this.db
      .select({ id: productBadges.id })
      .from(productBadges)
      .where(
        and(
          eq(productBadges.id, badgeId),
          eq(productBadges.productId, productId),
        ),
      )
      .limit(1);

    if (!badge) {
      throw new ApiException("not_found", 404, "Badge not found.");
    }

    if (input.matchType === "regex") {
      try {
        new RegExp(input.matchValue);
      } catch {
        throw new ApiException(
          "badge_rule_invalid",
          400,
          "Invalid regex pattern.",
        );
      }
    }

    const [rule] = await this.db
      .insert(productBadgeRules)
      .values({
        productId,
        badgeId,
        paramKey: input.paramKey,
        matchType: input.matchType,
        matchValue: input.matchValue,
        secretToken: input.secretToken ? input.secretToken : null,
      })
      .returning();

    return {
      id: rule.id,
      productId: rule.productId,
      badgeId: rule.badgeId,
      paramKey: rule.paramKey,
      matchType: rule.matchType as "exact" | "regex",
      matchValue: rule.matchValue,
      hasSecretToken: Boolean(rule.secretToken),
      createdAt: rule.createdAt.toISOString(),
      updatedAt: rule.updatedAt.toISOString(),
    };
  }

  async deleteRule(
    productId: string,
    badgeId: string,
    ruleId: string,
  ): Promise<void> {
    const [rule] = await this.db
      .select({ id: productBadgeRules.id })
      .from(productBadgeRules)
      .where(
        and(
          eq(productBadgeRules.id, ruleId),
          eq(productBadgeRules.badgeId, badgeId),
          eq(productBadgeRules.productId, productId),
        ),
      )
      .limit(1);

    if (!rule) {
      throw new ApiException("not_found", 404, "Rule not found.");
    }

    await this.db
      .delete(productBadgeRules)
      .where(eq(productBadgeRules.id, ruleId));
  }

  async listProductUsers(
    productId: string,
    query: ProductUsersQuery,
  ): Promise<{
    items: ProductUserListItem[];
    total: number;
    page: number;
    limit: number;
  }> {
    const { page, limit, search, badgeId } = query;
    const offset = (page - 1) * limit;

    // Subquery or aggregation of all candidate users in this product
    // Users who have posted, commented, voted, or received a badge in this product
    const candidateQuery = sql`
      SELECT DISTINCT u.id
      FROM ${user} u
      WHERE (
        EXISTS (SELECT 1 FROM ${posts} p WHERE p.product_id = ${productId} AND p.author_id = u.id)
        OR EXISTS (SELECT 1 FROM ${comments} c WHERE c.product_id = ${productId} AND c.author_id = u.id)
        OR EXISTS (
          SELECT 1 FROM ${votes} v
          INNER JOIN ${posts} p2 ON p2.id = v.post_id
          WHERE p2.product_id = ${productId} AND v.user_id = u.id
        )
        OR EXISTS (SELECT 1 FROM ${userProductBadges} upb WHERE upb.product_id = ${productId} AND upb.user_id = u.id)
      )
      ${badgeId ? sql`AND EXISTS (SELECT 1 FROM ${userProductBadges} bsub WHERE bsub.product_id = ${productId} AND bsub.user_id = u.id AND bsub.badge_id = ${badgeId} AND (bsub.expires_at IS NULL OR bsub.expires_at > NOW()))` : sql``}
      ${search ? sql`AND (u.name ILIKE ${"%" + search + "%"} OR u.email ILIKE ${"%" + search + "%"})` : sql``}
    `;

    const countRes = await this.db.execute<{ count: string }>(
      sql`SELECT count(*)::text as count FROM (${candidateQuery}) candidates`,
    );
    const total = parseInt(countRes.rows[0]?.count ?? "0", 10);

    if (total === 0) {
      return { items: [], total: 0, page, limit };
    }

    const pagedUsersRes = await this.db.execute<{
      id: string;
      name: string | null;
      email: string | null;
      image: string | null;
      created_at: string;
    }>(
      sql`
        SELECT u.id, u.name, u.email, u.image, u.created_at
        FROM ${user} u
        INNER JOIN (${candidateQuery}) c ON c.id = u.id
        ORDER BY u.created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `,
    );

    const userIds = pagedUsersRes.rows.map((r) => r.id);
    if (userIds.length === 0) {
      return { items: [], total, page, limit };
    }

    // Load active badges for these users in this product
    const badgesRows = await this.db
      .select({
        id: userProductBadges.id,
        userId: userProductBadges.userId,
        badgeId: productBadges.id,
        name: productBadges.name,
        slug: productBadges.slug,
        description: productBadges.description,
        color: productBadges.color,
        textColor: productBadges.textColor,
        icon: productBadges.icon,
        priority: productBadges.priority,
        source: userProductBadges.source,
        grantedAt: userProductBadges.createdAt,
        expiresAt: userProductBadges.expiresAt,
      })
      .from(userProductBadges)
      .innerJoin(productBadges, eq(userProductBadges.badgeId, productBadges.id))
      .where(
        and(
          eq(userProductBadges.productId, productId),
          inArray(userProductBadges.userId, userIds),
          eq(productBadges.isActive, true),
          or(
            sql`${userProductBadges.expiresAt} IS NULL`,
            sql`${userProductBadges.expiresAt} > NOW()`,
          ),
        ),
      )
      .orderBy(desc(productBadges.priority), asc(userProductBadges.createdAt));

    const userBadgesMap = new Map<string, UserProductBadgeItem[]>();
    for (const b of badgesRows) {
      const list = userBadgesMap.get(b.userId) ?? [];
      list.push({
        id: b.id,
        badgeId: b.badgeId,
        name: b.name,
        slug: b.slug,
        description: b.description,
        color: b.color,
        textColor: b.textColor,
        icon: b.icon,
        priority: b.priority,
        source: b.source as "rule" | "manual",
        grantedAt: b.grantedAt.toISOString(),
        expiresAt: b.expiresAt ? b.expiresAt.toISOString() : null,
      });
      userBadgesMap.set(b.userId, list);
    }

    // Load stats per user
    const statsRes = await this.db.execute<{
      user_id: string;
      posts_count: string;
      comments_count: string;
      votes_count: string;
      last_active: string | null;
    }>(
      sql`
        SELECT
          u_ids.id as user_id,
          COALESCE(p_stat.cnt, 0)::text as posts_count,
          COALESCE(c_stat.cnt, 0)::text as comments_count,
          COALESCE(v_stat.cnt, 0)::text as votes_count,
          GREATEST(p_stat.max_act, c_stat.max_act, v_stat.max_act) as last_active
        FROM (SELECT unnest(${userIds}::text[]) as id) u_ids
        LEFT JOIN (
          SELECT author_id, count(*) as cnt, max(created_at) as max_act
          FROM ${posts}
          WHERE product_id = ${productId}
          GROUP BY author_id
        ) p_stat ON p_stat.author_id = u_ids.id
        LEFT JOIN (
          SELECT author_id, count(*) as cnt, max(created_at) as max_act
          FROM ${comments}
          WHERE product_id = ${productId}
          GROUP BY author_id
        ) c_stat ON c_stat.author_id = u_ids.id
        LEFT JOIN (
          SELECT v.user_id, count(*) as cnt, max(v.created_at) as max_act
          FROM ${votes} v
          INNER JOIN ${posts} p ON p.id = v.post_id
          WHERE p.product_id = ${productId}
          GROUP BY v.user_id
        ) v_stat ON v_stat.user_id = u_ids.id
      `,
    );

    const statsMap = new Map<
      string,
      {
        postsCount: number;
        commentsCount: number;
        votesCount: number;
        lastActiveAt: string;
      }
    >();

    for (const s of statsRes.rows) {
      statsMap.set(s.user_id, {
        postsCount: parseInt(s.posts_count, 10),
        commentsCount: parseInt(s.comments_count, 10),
        votesCount: parseInt(s.votes_count, 10),
        lastActiveAt: s.last_active ?? new Date().toISOString(),
      });
    }

    const items: ProductUserListItem[] = pagedUsersRes.rows.map((u) => {
      const stats = statsMap.get(u.id);
      return {
        id: u.id,
        name: u.name,
        email: u.email,
        image: u.image,
        badges: userBadgesMap.get(u.id) ?? [],
        postsCount: stats?.postsCount ?? 0,
        commentsCount: stats?.commentsCount ?? 0,
        votesCount: stats?.votesCount ?? 0,
        firstSeenAt: new Date(u.created_at).toISOString(),
        lastActiveAt:
          stats?.lastActiveAt ?? new Date(u.created_at).toISOString(),
      };
    });

    return { items, total, page, limit };
  }

  async assignUserBadge(
    productId: string,
    userId: string,
    input: AssignUserBadgeInput,
    grantedByUserId?: string,
  ): Promise<void> {
    const [badge] = await this.db
      .select({ id: productBadges.id })
      .from(productBadges)
      .where(
        and(
          eq(productBadges.id, input.badgeId),
          eq(productBadges.productId, productId),
        ),
      )
      .limit(1);

    if (!badge) {
      throw new ApiException("not_found", 404, "Badge not found.");
    }

    const [u] = await this.db
      .select({ id: user.id })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1);

    if (!u) {
      throw new ApiException("not_found", 404, "User not found.");
    }

    await this.db
      .insert(userProductBadges)
      .values({
        userId,
        productId,
        badgeId: input.badgeId,
        source: "manual",
        expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
        grantedByUserId: grantedByUserId ?? null,
      })
      .onConflictDoUpdate({
        target: [
          userProductBadges.userId,
          userProductBadges.productId,
          userProductBadges.badgeId,
        ],
        set: {
          source: "manual",
          expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
          grantedByUserId: grantedByUserId ?? null,
          updatedAt: new Date(),
        },
      });
  }

  async revokeUserBadge(
    productId: string,
    userId: string,
    badgeId: string,
  ): Promise<void> {
    await this.db
      .delete(userProductBadges)
      .where(
        and(
          eq(userProductBadges.userId, userId),
          eq(userProductBadges.productId, productId),
          eq(userProductBadges.badgeId, badgeId),
        ),
      );
  }

  async getPublicUserBadges(
    productId: string,
    userIds: string[],
  ): Promise<Map<string, PublicBadgeChip[]>> {
    return getPublicBadgesForUsers(this.db, productId, userIds);
  }

  async evaluateAttribution(
    productId: string,
    params: Record<string, string>,
    userId?: string,
  ): Promise<{
    matchedBadges: PublicBadgeChip[];
    matchedEntries: AttributionEntry[];
    scrubKeys: string[];
  }> {
    if (Object.keys(params).length === 0)
      return { matchedBadges: [], matchedEntries: [], scrubKeys: [] };
    const rules = await this.db
      .select({ rule: productBadgeRules, badge: productBadges })
      .from(productBadgeRules)
      .innerJoin(productBadges, eq(productBadgeRules.badgeId, productBadges.id))
      .where(
        and(
          eq(productBadgeRules.productId, productId),
          eq(productBadges.productId, productId),
          eq(productBadges.isActive, true),
        ),
      )
      .orderBy(desc(productBadges.priority), asc(productBadgeRules.createdAt));
    const matched = new Map<
      string,
      { badge: PublicBadgeChip; entry: AttributionEntry }
    >();
    const scrubKeys = new Set<string>();
    for (const { rule, badge } of rules) {
      const key = rule.paramKey;
      if (/_sig$|_ts$/.test(key) || !Object.hasOwn(params, key)) continue;
      const value = params[key];
      if (value.length > ATTRIBUTE_PARAM_VALUE_MAX) continue;
      if (
        rule.secretToken &&
        !verifySignedValue({
          secret: rule.secretToken,
          value,
          sig: params[`${key}_sig`],
          ts: params[`${key}_ts`],
        })
      )
        continue;
      let matches = false;
      try {
        matches =
          rule.matchType === "exact"
            ? value === rule.matchValue
            : anchoredRegex(rule.matchValue).test(value);
      } catch {
        continue;
      }
      if (!matches) continue;
      for (const name of [key, `${key}_sig`, `${key}_ts`])
        if (Object.hasOwn(params, name)) scrubKeys.add(name);
      if (!matched.has(badge.id) && matched.size < ATTRIBUTION_MAX_BADGES)
        matched.set(badge.id, {
          badge: {
            id: badge.id,
            name: badge.name,
            slug: badge.slug,
            color: badge.color,
            textColor: badge.textColor,
            icon: badge.icon,
            priority: badge.priority,
          },
          entry: { badgeId: badge.id, value },
        });
    }
    const matchedEntries = [...matched.values()].map((item) => item.entry);
    if (userId && matchedEntries.length)
      await this.db
        .insert(userProductBadges)
        .values(
          matchedEntries.map((entry) => ({
            userId,
            productId,
            badgeId: entry.badgeId,
            source: "rule",
            matchedParamValue: entry.value,
          })),
        )
        .onConflictDoNothing();
    return {
      matchedBadges: [...matched.values()].map((item) => item.badge),
      matchedEntries,
      scrubKeys: [...scrubKeys],
    };
  }

  async bindPendingAttribution(
    productId: string,
    userId: string,
    cookieHeader?: string,
  ): Promise<{ present: boolean }> {
    const raw = readCookie(cookieHeader, attributionCookieName(productId));
    if (raw === undefined) return { present: false };
    const entries = verifyAttributionCookie(
      this.env.BETTER_AUTH_SECRET,
      productId,
      raw,
    );
    if (entries?.length) {
      const active = await this.db
        .select({ id: productBadges.id })
        .from(productBadges)
        .where(
          and(
            eq(productBadges.productId, productId),
            eq(productBadges.isActive, true),
            inArray(
              productBadges.id,
              entries.map((e) => e.badgeId),
            ),
          ),
        );
      const ids = new Set(active.map((b) => b.id));
      const valid = entries.filter((entry) => ids.has(entry.badgeId));
      if (valid.length)
        await this.db
          .insert(userProductBadges)
          .values(
            valid.map((entry) => ({
              userId,
              productId,
              badgeId: entry.badgeId,
              source: "rule",
              matchedParamValue: entry.value,
            })),
          )
          .onConflictDoNothing();
    }
    return { present: true };
  }

  buildAttributionCookie(
    productId: string,
    entries: AttributionEntry[],
    cookieHeader?: string,
  ): string {
    const raw = readCookie(cookieHeader, attributionCookieName(productId));
    const old = raw
      ? (verifyAttributionCookie(this.env.BETTER_AUTH_SECRET, productId, raw) ??
        [])
      : [];
    const merged = new Map(entries.map((entry) => [entry.badgeId, entry]));
    for (const entry of old)
      if (!merged.has(entry.badgeId)) merged.set(entry.badgeId, entry);
    return signAttributionCookie(this.env.BETTER_AUTH_SECRET, productId, [
      ...merged.values(),
    ]);
  }
}

export async function getPublicBadgesForUsers(
  db: Db,
  productId: string,
  userIds: string[],
): Promise<Map<string, PublicBadgeChip[]>> {
  const result = new Map<string, PublicBadgeChip[]>();
  if (userIds.length === 0) return result;

  const rows = await db
    .select({
      userId: userProductBadges.userId,
      id: productBadges.id,
      name: productBadges.name,
      slug: productBadges.slug,
      color: productBadges.color,
      textColor: productBadges.textColor,
      icon: productBadges.icon,
      priority: productBadges.priority,
    })
    .from(userProductBadges)
    .innerJoin(productBadges, eq(userProductBadges.badgeId, productBadges.id))
    .where(
      and(
        eq(userProductBadges.productId, productId),
        inArray(userProductBadges.userId, userIds),
        eq(productBadges.isActive, true),
        or(
          sql`${userProductBadges.expiresAt} IS NULL`,
          sql`${userProductBadges.expiresAt} > NOW()`,
        ),
      ),
    )
    .orderBy(desc(productBadges.priority), asc(userProductBadges.createdAt));

  for (const r of rows) {
    const list = result.get(r.userId) ?? [];
    list.push({
      id: r.id,
      name: r.name,
      slug: r.slug,
      color: r.color,
      textColor: r.textColor,
      icon: r.icon,
      priority: r.priority,
    });
    result.set(r.userId, list);
  }

  return result;
}
