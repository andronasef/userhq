import { createParamDecorator, type ExecutionContext } from "@nestjs/common";
import type { Tenant } from "./tenant.guard.js";

export const CurrentTenant = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): Tenant | null => {
    const req = ctx.switchToHttp().getRequest();
    return req.tenant ?? null;
  }
);
