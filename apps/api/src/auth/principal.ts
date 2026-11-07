import type { ApiKeyScope } from "@userhq/types";

export const INTEGRATION_ACTOR_PREFIX = "integration:";

export interface ApiKeyPrincipal {
  kind: "api-key";
  keyId: string;
  keyName: string;
  workspaceId: string;
  scopes: ApiKeyScope[];
}

export interface Actor {
  id: string;
  apiPrincipal?: ApiKeyPrincipal;
}

/** Id of the API key acting, or null for a human. */
export function actorApiKeyId(actor: Actor): string | null {
  return actor.apiPrincipal?.keyId ?? null;
}

/** Public attribution for content made through a key; null for humans. */
export function actorSource(actor: Actor) {
  return actor.apiPrincipal
    ? { kind: "integration" as const, name: actor.apiPrincipal.keyName }
    : null;
}
