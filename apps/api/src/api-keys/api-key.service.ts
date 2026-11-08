import { Injectable, Inject } from "@nestjs/common";
import { randomBytes, createHash } from "node:crypto";
import { eq, and, desc } from "drizzle-orm";
import { DB, type Db, workspaceApiKeys, type WorkspaceApiKey, user } from "@userhq/db";
import { INTEGRATION_ACTOR_PREFIX } from "../auth/principal.js";
import type {
  CreateApiKeyInput,
  ApiKeyMetadata,
  CreatedApiKeyResponse,
  ApiKeyScope,
} from "@userhq/types";
import { ApiException } from "../common/api-error.filter.js";
import { resolveProductRestrictions } from "./authorization.js";

export interface ValidatedApiKey {
  id: string;
  workspaceId: string;
  name: string;
  keyPrefix: string;
  scopes: ApiKeyScope[];
  productRestrictions: string[] | null;
  createdByUserId: string | null;
}

@Injectable()
export class ApiKeyService {
  constructor(@Inject(DB) private readonly db: Db) {}

  async integrationActor(key: ValidatedApiKey) {
    const id = `${INTEGRATION_ACTOR_PREFIX}${key.id}`;
    const name = `${key.name} (integration)`;
    const email = `${key.id}@api.userhq.invalid`;
    // Both id and email are unique. Concurrent first use can conflict on either,
    // so allow either insert conflict, then refresh only this exact actor identity.
    await this.db.insert(user).values({
      id,
      name,
      email,
      emailVerified: false,
      commentEmails: false,
    }).onConflictDoNothing();
    const [actor] = await this.db.update(user)
      .set({ name })
      .where(and(eq(user.id, id), eq(user.email, email)))
      .returning({ id: user.id });
    if (!actor) throw new ApiException("internal_error", 500, "Integration identity could not be initialized.");
    return { id, name, image: null };
  }

  static hashToken(token: string): string {
    return createHash("sha256").update(token).digest("hex");
  }

  async createKey(
    workspaceId: string,
    userId: string,
    dto: CreateApiKeyInput
  ): Promise<CreatedApiKeyResponse> {
    const random = randomBytes(24).toString("base64url");
    const token = `uhq_live_${random}`;
    const keyPrefix = `uhq_live_${random.slice(0, 8)}`;
    const keyHash = ApiKeyService.hashToken(token);

    const productRestrictions = await resolveProductRestrictions(this.db, workspaceId, dto.productRestrictions);
    const expiresAt = dto.expiresInDays
      ? new Date(Date.now() + dto.expiresInDays * 86_400_000)
      : null;

    const [row] = await this.db
      .insert(workspaceApiKeys)
      .values({
        workspaceId,
        name: dto.name,
        keyPrefix,
        keyHash,
        scopes: dto.scopes,
        productRestrictions,
        createdByUserId: userId,
        expiresAt,
      })
      .returning();

    return {
      key: this.formatMetadata(row),
      token,
    };
  }

  async listKeys(workspaceId: string): Promise<ApiKeyMetadata[]> {
    const rows = await this.db
      .select()
      .from(workspaceApiKeys)
      .where(eq(workspaceApiKeys.workspaceId, workspaceId))
      .orderBy(desc(workspaceApiKeys.createdAt));

    return rows.map((r) => this.formatMetadata(r));
  }

  async revokeKey(workspaceId: string, keyId: string): Promise<ApiKeyMetadata> {
    const [existing] = await this.db
      .select()
      .from(workspaceApiKeys)
      .where(
        and(
          eq(workspaceApiKeys.id, keyId),
          eq(workspaceApiKeys.workspaceId, workspaceId)
        )
      )
      .limit(1);

    if (!existing) {
      throw new ApiException("not_found", 404, "API key not found.");
    }

    if (existing.revokedAt) {
      return this.formatMetadata(existing);
    }

    const now = new Date();
    const [updated] = await this.db
      .update(workspaceApiKeys)
      .set({
        revokedAt: now,
        updatedAt: now,
      })
      .where(eq(workspaceApiKeys.id, keyId))
      .returning();

    return this.formatMetadata(updated);
  }

  async validateToken(
    token: string
  ): Promise<
    | { valid: true; key: ValidatedApiKey }
    | { valid: false; error: "api_key_invalid" | "api_key_expired" | "api_key_revoked" }
  > {
    const keyHash = ApiKeyService.hashToken(token);

    const [row] = await this.db
      .select()
      .from(workspaceApiKeys)
      .where(eq(workspaceApiKeys.keyHash, keyHash))
      .limit(1);

    if (!row) {
      return { valid: false, error: "api_key_invalid" };
    }

    if (row.revokedAt) {
      return { valid: false, error: "api_key_revoked" };
    }

    if (row.expiresAt && row.expiresAt < new Date()) {
      return { valid: false, error: "api_key_expired" };
    }

    // Touch lastUsedAt asynchronously without blocking request
    this.db
      .update(workspaceApiKeys)
      .set({ lastUsedAt: new Date() })
      .where(eq(workspaceApiKeys.id, row.id))
      .catch(() => {});

    return {
      valid: true,
      key: {
        id: row.id,
        workspaceId: row.workspaceId,
        name: row.name,
        keyPrefix: row.keyPrefix,
        scopes: row.scopes as ApiKeyScope[],
        productRestrictions: row.productRestrictions as string[] | null,
        createdByUserId: row.createdByUserId,
      },
    };
  }

  private formatMetadata(row: any): ApiKeyMetadata {
    return {
      id: row.id,
      workspaceId: row.workspaceId,
      name: row.name,
      keyPrefix: row.keyPrefix,
      scopes: row.scopes as ApiKeyScope[],
      productRestrictions: (row.productRestrictions as string[] | null) ?? null,
      createdByUserId: row.createdByUserId ?? null,
      lastUsedAt: row.lastUsedAt ? new Date(row.lastUsedAt).toISOString() : null,
      expiresAt: row.expiresAt ? new Date(row.expiresAt).toISOString() : null,
      revokedAt: row.revokedAt ? new Date(row.revokedAt).toISOString() : null,
      createdAt: new Date(row.createdAt).toISOString(),
      updatedAt: new Date(row.updatedAt).toISOString(),
    };
  }
}
