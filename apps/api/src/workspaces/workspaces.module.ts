import { Module } from "@nestjs/common";
import {
  WorkspacesController,
  WorkspaceController,
} from "./workspaces.controller.js";
import { TenantGuard } from "../tenancy/tenant.guard.js";

import { InvitesModule } from "../invites/invites.module.js";

@Module({
  imports: [InvitesModule],
  controllers: [WorkspacesController, WorkspaceController],
  providers: [TenantGuard],
})
export class WorkspacesModule {}
