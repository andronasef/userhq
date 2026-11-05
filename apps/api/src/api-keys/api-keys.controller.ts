import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  UseGuards,
  Req,
} from "@nestjs/common";
import { TenantGuard } from "../tenancy/tenant.guard.js";
import { ApiKeyService } from "./api-key.service.js";
import { RequireScopes } from "./api-key.decorator.js";
import {
  createApiKeySchema,
  type CreateApiKeyInput,
  type ApiKeyMetadata,
  type CreatedApiKeyResponse,
} from "@userhq/types";

@Controller("workspaces/:ws/api-keys")
@UseGuards(TenantGuard)
export class ApiKeysController {
  constructor(private readonly apiKeyService: ApiKeyService) {}

  @Get()
  @RequireScopes("admin")
  async listKeys(@Req() req: any): Promise<{ keys: ApiKeyMetadata[] }> {
    const keys = await this.apiKeyService.listKeys(req.tenant.workspaceId);
    return { keys };
  }

  @Post()
  @RequireScopes("admin")
  async createKey(
    @Req() req: any,
    @Body() body: any
  ): Promise<CreatedApiKeyResponse> {
    const parsed = createApiKeySchema.parse(body);
    return this.apiKeyService.createKey(
      req.tenant.workspaceId,
      req.user.id,
      parsed
    );
  }

  @Delete(":id")
  @RequireScopes("admin")
  async revokeKey(
    @Req() req: any,
    @Param("id") id: string
  ): Promise<{ key: ApiKeyMetadata }> {
    const key = await this.apiKeyService.revokeKey(
      req.tenant.workspaceId,
      id
    );
    return { key };
  }
}
