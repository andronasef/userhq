import { Module } from "@nestjs/common";
import { ProductsController } from "./products.controller.js";
import { StatusesController } from "./statuses.controller.js";
import { TenantGuard } from "../tenancy/tenant.guard.js";

@Module({
  controllers: [ProductsController, StatusesController],
  providers: [TenantGuard],
})
export class ProductsModule {}


