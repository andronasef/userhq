import { Module } from "@nestjs/common";
import {
  WorkspacesController,
  WorkspaceController,
} from "./workspaces.controller.js";
import { TenantGuard } from "../tenancy/tenant.guard.js";

@Module({
  controllers: [WorkspacesController, WorkspaceController],
  providers: [TenantGuard],
})
export class WorkspacesModule {}
