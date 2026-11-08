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
  async listKeys(@Req() req: any): Promise<{ keys: ApiKeyMetadata[] }> {
    const keys = await this.apiKeyService.listKeys(req.tenant.workspaceId);
    return { keys };
  }

  @Post()
  async createKey(
    @Req() req: any,
    @Body({ schema: createApiKeySchema }) input: CreateApiKeyInput
  ): Promise<CreatedApiKeyResponse> {
    return this.apiKeyService.createKey(
      req.tenant.workspaceId,
      req.user.id,
      input
    );
  }

  @Delete(":id")
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
