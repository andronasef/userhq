import { Injectable, Inject } from "@nestjs/common";
import { DB, type Db, invites, user, workspaces, workspaceMembers } from "@userhq/db";
import { ENV, type Env } from "../env.js";
import { ApiException } from "../common/api-error.filter.js";
import { randomBytes, createHash } from "node:crypto";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import {
  INVITE_TTL_DAYS,
  type InviteRow,
  type InviteCreated,
  type InviteState,
  type InviteLookup,
  InviteLookupSchema,
} from "@userhq/types";
import { z } from "zod";

export function maskEmail(email: string): string {
  const atIdx = email.indexOf("@");
  if (atIdx <= 0) {
    return "•••@unknown";
  }
  const local = email.slice(0, atIdx);
  const domain = email.slice(atIdx + 1);
  return `${local[0]}•••@${domain}`;
}

export function hashInviteToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function generateInviteToken(): { token: string; tokenHash: string } {
  const token = randomBytes(32).toString("base64url");
  const tokenHash = hashInviteToken(token);
  return { token, tokenHash };
}

export function inviteState(
  row: { usedAt: Date | null; revokedAt: Date | null; expiresAt: Date },
  now: Date = new Date()
): InviteState {
  if (row.revokedAt !== null) {
    return "revoked";
  }
  if (row.usedAt !== null) {
    return "used";
  }
  if (row.expiresAt.getTime() <= now.getTime()) {
    return "expired";
  }
  return "pending";
}

@Injectable()
export class InvitesService {
  constructor(
    @Inject(ENV) private readonly env: Env,
    @Inject(DB) private readonly db: Db
  ) {}

  generateInviteToken(): { token: string; tokenHash: string } {
    return generateInviteToken();
  }

  hashInviteToken(token: string): string {
    return hashInviteToken(token);
  }

  inviteState(
    row: { usedAt: Date | null; revokedAt: Date | null; expiresAt: Date },
    now: Date = new Date()
  ): InviteState {
    return inviteState(row, now);
  }

  async create(input: {
    kind: "platform" | "workspace";
    workspaceId: string | null;
    email: string;
    createdById: string | null;
  }): Promise<InviteCreated> {
    const email = input.email.trim().toLowerCase();
    const lockKey = `${input.kind}:${input.workspaceId ?? ""}:${email}`;

    return await this.db.transaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`);

      const pendingConditions = [
        eq(invites.kind, input.kind),
        eq(invites.email, email),
        isNull(invites.usedAt),
        isNull(invites.revokedAt),
        sql`${invites.expiresAt} > now()`,
      ];

      if (input.kind === "workspace") {
        pendingConditions.push(eq(invites.workspaceId, input.workspaceId!));
      }

      const existingPending = await tx
        .select({ id: invites.id })
        .from(invites)
        .where(and(...pendingConditions))
        .limit(1);

      if (existingPending.length > 0) {
        throw new ApiException(
          "invite_pending",
          409,
          "An invite is already pending for this email."
        );
      }

      const { token, tokenHash } = generateInviteToken();
      const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000);

      await tx.insert(invites).values({
        kind: input.kind,
        workspaceId: input.workspaceId,
        email,
        tokenHash,
        createdById: input.createdById,
        expiresAt,
      });

      return {
        link: `${this.env.PUBLIC_URL}/invite/${token}`,
        email,
        expiresAt: expiresAt.toISOString(),
      };
    });
  }

  async list(
    kind: "platform" | "workspace",
    workspaceId: string | null
  ): Promise<InviteRow[]> {
    const whereConditions = [eq(invites.kind, kind)];
    if (kind === "workspace") {
      whereConditions.push(eq(invites.workspaceId, workspaceId!));
    }

    const rows = await this.db
      .select({
        id: invites.id,
        email: invites.email,
        createdAt: invites.createdAt,
        expiresAt: invites.expiresAt,
        usedAt: invites.usedAt,
        revokedAt: invites.revokedAt,
        usedByName: user.name,
        workspaceName: workspaces.name,
      })
      .from(invites)
      .leftJoin(user, eq(invites.usedById, user.id))
      .leftJoin(workspaces, eq(invites.workspaceId, workspaces.id))
      .where(and(...whereConditions))
      .orderBy(desc(invites.createdAt), desc(invites.id));

    const now = new Date();
    return rows.map((row) => ({
      id: row.id,
      email: row.email,
      state: inviteState(row, now),
      createdAt: row.createdAt.toISOString(),
      expiresAt: row.expiresAt.toISOString(),
      usedAt: row.usedAt ? row.usedAt.toISOString() : null,
      revokedAt: row.revokedAt ? row.revokedAt.toISOString() : null,
      usedByName: row.usedByName ?? null,
      workspaceName: row.workspaceName ?? null,
    }));
  }

  async revoke(
    kind: "platform" | "workspace",
    workspaceId: string | null,
    id: string
  ): Promise<void> {
    if (!z.uuid().safeParse(id).success) {
      throw new ApiException("not_found", 404, "Not found.");
    }

    const conditions = [
      eq(invites.id, id),
      eq(invites.kind, kind),
      isNull(invites.usedAt),
      isNull(invites.revokedAt),
      sql`${invites.expiresAt} > now()`,
    ];

    if (kind === "workspace") {
      conditions.push(eq(invites.workspaceId, workspaceId!));
    }

    const res = await this.db
      .update(invites)
      .set({ revokedAt: new Date() })
      .where(and(...conditions))
      .returning({ id: invites.id });

    if (res.length === 0) {
      throw new ApiException("not_found", 404, "Not found.");
    }
  }

  maskEmail(email: string): string {
    return maskEmail(email);
  }

  async lookup(
    token: string,
    user: { id: string; email: string; emailVerified: boolean }
  ): Promise<InviteLookup> {
    if (!/^[A-Za-z0-9_-]{43}$/.test(token)) {
      throw new ApiException("not_found", 404, "This invite link isn't valid.");
    }

    const tokenHash = hashInviteToken(token);

    const [row] = await this.db
      .select({
        id: invites.id,
        kind: invites.kind,
        workspaceId: invites.workspaceId,
        email: invites.email,
        createdAt: invites.createdAt,
        expiresAt: invites.expiresAt,
        usedAt: invites.usedAt,
        revokedAt: invites.revokedAt,
        workspaceName: workspaces.name,
        workspaceSlug: workspaces.slug,
        workspaceSuspendedAt: workspaces.suspendedAt,
      })
      .from(invites)
      .leftJoin(workspaces, eq(invites.workspaceId, workspaces.id))
      .where(eq(invites.tokenHash, tokenHash))
      .limit(1);

    if (!row) {
      throw new ApiException("not_found", 404, "This invite link isn't valid.");
    }

    const state = inviteState(row);
    const emailMatches =
      user.emailVerified === true &&
      user.email.trim().toLowerCase() === row.email.toLowerCase();

    const masked = emailMatches ? null : maskEmail(row.email);

    let workspaceName: string | null = null;
    let workspaceSlug: string | null = null;
    let workspaceSuspended = false;
    let alreadyMember = false;

    if (emailMatches && row.kind === "workspace") {
      workspaceName = row.workspaceName ?? null;
      workspaceSlug = row.workspaceSlug ?? null;
      workspaceSuspended = row.workspaceSuspendedAt !== null;
      if (row.workspaceId) {
        const [member] = await this.db
          .select({ userId: workspaceMembers.userId })
          .from(workspaceMembers)
          .where(
            and(
              eq(workspaceMembers.workspaceId, row.workspaceId),
              eq(workspaceMembers.userId, user.id)
            )
          )
          .limit(1);
        alreadyMember = !!member;
      }
    }

    return InviteLookupSchema.parse({
      kind: row.kind,
      state,
      emailMatches,
      maskedEmail: masked,
      workspaceName,
      workspaceSlug,
      alreadyMember,
      workspaceSuspended,
    });
  }

  async hasPendingPlatformInvite(
    user: { email: string; emailVerified: boolean } | null | undefined
  ): Promise<boolean> {
    if (!user || user.emailVerified !== true) {
      return false;
    }
    const email = user.email.trim().toLowerCase();
    const [row] = await this.db
      .select({ id: invites.id })
      .from(invites)
      .where(
        and(
          eq(invites.kind, "platform"),
          eq(invites.email, email),
          isNull(invites.usedAt),
          isNull(invites.revokedAt),
          sql`${invites.expiresAt} > now()`
        )
      )
      .limit(1);
    return !!row;
  }

  async claimPlatformInvite(
    tx: any,
    user: { id: string; email: string; emailVerified: boolean },
    workspaceId: string
  ): Promise<string> {
    if (user.emailVerified !== true) {
      throw new ApiException(
        "not_allowed",
        403,
        "Workspace creation is invite-only."
      );
    }

    const email = user.email.trim().toLowerCase();
    const res = await tx.execute(sql`
      UPDATE invites
      SET used_at = now(), used_by_id = ${user.id}, workspace_id = ${workspaceId}
      WHERE id = (
        SELECT id FROM invites
        WHERE kind = 'platform'
          AND email = ${email}
          AND used_at IS NULL
          AND revoked_at IS NULL
          AND expires_at > now()
        ORDER BY created_at
        LIMIT 1
        FOR UPDATE SKIP LOCKED
      )
      RETURNING id
    `);

    const rows = (res as any).rows ?? res;
    if (!rows || rows.length === 0) {
      throw new ApiException(
        "not_allowed",
        403,
        "Workspace creation is invite-only."
      );
    }

    return rows[0].id;
  }
}
