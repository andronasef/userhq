import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  HttpCode,
  HttpStatus,
  Inject,
  UseGuards,
  UseInterceptors,
  SerializeOptions,
} from "@nestjs/common";
import { StandardSchemaSerializerInterceptor } from "@nestjs/common";
import { and, eq, isNull, asc } from "drizzle-orm";
import {
  DB,
  type Db,
  products,
  statuses,
  uploads,
} from "@userhq/db";
import {
  CreateProductInputSchema,
  ProductCreatedSchema,
  ProductSummarySchema,
  ProductDetailSchema,
  UpdateProductInputSchema,
  DEFAULT_ACCENT,
  SEEDED_STATUSES,
  type CreateProductInput,
  type ProductCreated,
  type ProductSummary,
  type ProductDetail,
  type UpdateProductInput,
} from "@userhq/types";
import { TenantGuard, type Tenant } from "../tenancy/tenant.guard.js";
import { CurrentTenant } from "../tenancy/current-tenant.decorator.js";
import { CurrentUser } from "../auth/decorators.js";
import { ApiException } from "../common/api-error.filter.js";

@Controller("workspaces/:ws/products")
@UseGuards(TenantGuard)
@UseInterceptors(StandardSchemaSerializerInterceptor)
export class ProductsController {
  constructor(@Inject(DB) private readonly db: Db) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @SerializeOptions({ schema: ProductCreatedSchema })
  async createProduct(
    @CurrentTenant() tenant: Tenant,
    @CurrentUser() user: any,
    @Body({ schema: CreateProductInputSchema }) input: CreateProductInput
  ): Promise<ProductCreated> {
    if (input.logoUploadId) {
      const [upload] = await this.db
        .select({ id: uploads.id })
        .from(uploads)
        .where(
          and(
            eq(uploads.id, input.logoUploadId),
            eq(uploads.uploaderId, user.id)
          )
        )
        .limit(1);

      if (!upload) {
        throw new ApiException(
          "validation_failed",
          400,
          "That logo can't be used."
        );
      }
    }

    await this.db.transaction(async (tx) => {
      const [inserted] = await tx
        .insert(products)
        .values({
          workspaceId: tenant.workspaceId,
          name: input.name,
          slug: input.slug,
          logoUploadId: input.logoUploadId ?? null,
          accentColor: DEFAULT_ACCENT,
        })
        .onConflictDoNothing({ target: [products.workspaceId, products.slug] })
        .returning({ id: products.id });

      if (!inserted) {
        throw new ApiException("slug_taken", 409, "That URL is taken.");
      }

      await tx.insert(statuses).values(
        SEEDED_STATUSES.map((s, idx) => ({
          productId: inserted.id,
          name: s.name,
          type: s.type,
          color: s.color,
          position: idx,
          isDefault: s.isDefault,
        }))
      );
    });

    return ProductCreatedSchema.parse({ slug: input.slug });
  }

  @Get()
  @SerializeOptions({ schema: ProductSummarySchema })
  async listProducts(
    @CurrentTenant() tenant: Tenant
  ): Promise<ProductSummary[]> {
    const rows = await this.db
      .select({
        slug: products.slug,
        name: products.name,
        logoKey: uploads.storageKey,
        accentColor: products.accentColor,
      })
      .from(products)
      .leftJoin(uploads, eq(products.logoUploadId, uploads.id))
      .where(
        and(
          eq(products.workspaceId, tenant.workspaceId),
          isNull(products.deletedAt)
        )
      )
      .orderBy(asc(products.name), asc(products.slug));

    return rows.map((r) => ({
      slug: r.slug,
      name: r.name,
      logoUrl: r.logoKey ? `/uploads/${r.logoKey}` : null,
      accentColor: r.accentColor,
    }));
  }

  @Get(":product")
  @SerializeOptions({ schema: ProductDetailSchema })
  async getProduct(
    @CurrentTenant() tenant: Tenant
  ): Promise<ProductDetail> {
    const [row] = await this.db
      .select({
        slug: products.slug,
        name: products.name,
        logoUploadId: products.logoUploadId,
        logoKey: uploads.storageKey,
        accentColor: products.accentColor,
        tagline: products.tagline,
        websiteUrl: products.websiteUrl,
      })
      .from(products)
      .leftJoin(uploads, eq(products.logoUploadId, uploads.id))
      .where(
        and(
          eq(products.id, tenant.productId!),
          isNull(products.deletedAt)
        )
      )
      .limit(1);

    if (!row) {
      throw new ApiException("not_found", 404, "Not found.");
    }

    return ProductDetailSchema.parse({
      slug: row.slug,
      name: row.name,
      logoUrl: row.logoKey ? `/uploads/${row.logoKey}` : null,
      logoUploadId: row.logoUploadId ?? null,
      accentColor: row.accentColor,
      tagline: row.tagline ?? null,
      websiteUrl: row.websiteUrl ?? null,
    });
  }

  @Patch(":product")
  @SerializeOptions({ schema: ProductDetailSchema })
  async updateProduct(
    @CurrentTenant() tenant: Tenant,
    @CurrentUser() user: any,
    @Body({ schema: UpdateProductInputSchema }) input: UpdateProductInput
  ): Promise<ProductDetail> {
    if (input.logoUploadId !== undefined && input.logoUploadId !== null) {
      const [current] = await this.db
        .select({ logoUploadId: products.logoUploadId })
        .from(products)
        .where(eq(products.id, tenant.productId!))
        .limit(1);

      if (input.logoUploadId !== current?.logoUploadId) {
        const [upload] = await this.db
          .select({ id: uploads.id })
          .from(uploads)
          .where(
            and(
              eq(uploads.id, input.logoUploadId),
              eq(uploads.uploaderId, user.id)
            )
          )
          .limit(1);

        if (!upload) {
          throw new ApiException(
            "validation_failed",
            400,
            "That logo can't be used."
          );
        }
      }
    }

    const updateData: Record<string, any> = {};
    if (input.name !== undefined) updateData.name = input.name;
    if (input.logoUploadId !== undefined) updateData.logoUploadId = input.logoUploadId;
    if (input.tagline !== undefined) updateData.tagline = input.tagline;
    if (input.websiteUrl !== undefined) updateData.websiteUrl = input.websiteUrl;
    if (input.accentColor !== undefined) updateData.accentColor = input.accentColor;

    if (Object.keys(updateData).length > 0) {
      await this.db
        .update(products)
        .set(updateData)
        .where(
          and(
            eq(products.id, tenant.productId!),
            isNull(products.deletedAt)
          )
        );
    }

    return await this.getProduct(tenant);
  }

  @Delete(":product")
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteProduct(
    @CurrentTenant() tenant: Tenant
  ): Promise<void> {
    const deleted = await this.db
      .update(products)
      .set({ deletedAt: new Date() })
      .where(
        and(
          eq(products.id, tenant.productId!),
          isNull(products.deletedAt)
        )
      )
      .returning({ id: products.id });

    if (deleted.length === 0) {
      throw new ApiException("not_found", 404, "Not found.");
    }
  }
}
