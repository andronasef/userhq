import { CanActivate, ExecutionContext, Injectable, Inject } from "@nestjs/common";
import { ENV, type Env } from "../env.js";
import { isPlatformOwner } from "../auth/platform-owner.js";
import { ApiException } from "../common/api-error.filter.js";

@Injectable()
export class PlatformOwnerGuard implements CanActivate {
  constructor(@Inject(ENV) private readonly env: Env) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const user = req.user;
    if (!isPlatformOwner(user, this.env.PLATFORM_OWNER_EMAIL)) {
      throw new ApiException("not_found", 404, "Not found.");
    }
    return true;
  }
}
