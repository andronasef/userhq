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

/** Public source for a joined key row (id and name); null when no key made it. */
export function keySource(id: string | null | undefined, name: string | null | undefined) {
  return id ? { kind: "integration" as const, name: name ?? "" } : null;
}

/** Admin source: the public shape plus the key id. Never use on anonymous responses. */
export function adminKeySource(id: string | null | undefined, name: string | null | undefined) {
  return id ? { ...keySource(id, name)!, apiKeyId: id } : null;
}
