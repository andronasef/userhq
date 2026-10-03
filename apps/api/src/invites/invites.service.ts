import { Injectable, Inject } from "@nestjs/common";
import { DB, type Db, invites, user, workspaces } from "@userhq/db";
import { ENV, type Env } from "../env.js";
import { ApiException } from "../common/api-error.filter.js";
import { randomBytes, createHash } from "node:crypto";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import {
  INVITE_TTL_DAYS,
  type InviteRow,
  type InviteCreated,
  type InviteState,
} from "@userhq/types";
import { z } from "zod";

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
}
