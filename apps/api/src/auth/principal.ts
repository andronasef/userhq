import type { ApiKeyScope } from "@userhq/types";

export const INTEGRATION_ACTOR_PREFIX = "integration:";

export interface ApiKeyPrincipal {
  kind: "api-key";
  keyId: string;
  workspaceId: string;
  scopes: ApiKeyScope[];
}

export interface Actor {
  id: string;
  apiPrincipal?: ApiKeyPrincipal;
}
