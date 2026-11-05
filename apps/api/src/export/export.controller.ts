import {
  Controller,
  Get,
  Query,
  UseGuards,
  UseInterceptors,
  SerializeOptions,
} from "@nestjs/common";
import { StandardSchemaSerializerInterceptor } from "@nestjs/common";
import {
  FeedbackExportQuerySchema,
  FeedbackExportResponseSchema,
  type FeedbackExportQuery,
  type FeedbackExportResponse,
} from "@userhq/types";
import { TenantGuard, type Tenant } from "../tenancy/tenant.guard.js";
import { CurrentTenant } from "../tenancy/current-tenant.decorator.js";
import { RequireScopes } from "../api-keys/api-key.decorator.js";
import { ExportService } from "./export.service.js";

@Controller("workspaces/:ws/export")
@UseGuards(TenantGuard)
@UseInterceptors(StandardSchemaSerializerInterceptor)
export class ExportController {
  constructor(private readonly exportService: ExportService) {}

  @Get("feedback")
  @RequireScopes("export:read")
  @SerializeOptions({ schema: FeedbackExportResponseSchema })
  async exportFeedback(
    @CurrentTenant() tenant: Tenant,
    @Query({ schema: FeedbackExportQuerySchema }) query: FeedbackExportQuery
  ): Promise<FeedbackExportResponse> {
    return this.exportService.exportFeedback(
      { workspaceId: tenant.workspaceId },
      query
    );
  }
}
