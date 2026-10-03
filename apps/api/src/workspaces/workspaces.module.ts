import { Module } from "@nestjs/common";
import {
  WorkspacesController,
  WorkspaceController,
} from "./workspaces.controller.js";
import { MembersController } from "./members.controller.js";
import { TeamInvitesController } from "./team-invites.controller.js";
import { TenantGuard } from "../tenancy/tenant.guard.js";

import { InvitesModule } from "../invites/invites.module.js";

@Module({
  imports: [InvitesModule],
  controllers: [
    WorkspacesController,
    WorkspaceController,
    MembersController,
    TeamInvitesController,
  ],
  providers: [TenantGuard],
})
export class WorkspacesModule {}
