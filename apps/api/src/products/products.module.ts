import { Module } from "@nestjs/common";
import { ProductsController } from "./products.controller.js";
import { TenantGuard } from "../tenancy/tenant.guard.js";

@Module({
  controllers: [ProductsController],
  providers: [TenantGuard],
})
export class ProductsModule {}

