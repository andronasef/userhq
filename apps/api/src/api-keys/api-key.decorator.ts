import { SetMetadata } from "@nestjs/common";
import type { ApiKeyScope } from "@userhq/types";

export const REQUIRE_SCOPES = "REQUIRE_SCOPES";

export const RequireScopes = (...scopes: ApiKeyScope[]) =>
  SetMetadata(REQUIRE_SCOPES, scopes);
