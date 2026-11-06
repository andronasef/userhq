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
import { and, eq, isNull, asc, sql } from "drizzle-orm";
import {
  DB,
  type Db,
  categories,
  products,
  statuses,
  uploads,
  changelogTags,
} from "@userhq/db";
import {
  CreateProductInputSchema,
  ProductCreatedSchema,
  ProductSummarySchema,
  ProductDetailSchema,
  UpdateProductInputSchema,
  DEFAULT_ACCENT,
  SEEDED_STATUSES,
  SEEDED_CHANGELOG_TAGS,
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
import { isUniqueViolation } from "../common/db-errors.js";
import { pickFeatures, productFeatureColumns } from "../portal/product-features.js";

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
    @Body({ schema: CreateProductInputSchema }) input: CreateProductInput,
  ): Promise<ProductCreated> {
    if (input.logoUploadId) {
      const [upload] = await this.db
        .select({ id: uploads.id })
        .from(uploads)
        .where(
          and(
            eq(uploads.id, input.logoUploadId),
            eq(uploads.uploaderId, user.id),
          ),
        )
        .limit(1);

      if (!upload) {
        throw new ApiException(
          "validation_failed",
          400,
          "That logo can't be used.",
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
        })),
      );

      // ponytail: creation order via created_at offset; add a position column if reordering ever ships
      const now = new Date();
      await tx.insert(categories).values([
        {
          productId: inserted.id,
          name: "Feature Request",
          createdAt: now,
        },
        {
          productId: inserted.id,
          name: "Bug",
          createdAt: new Date(now.getTime() + 1),
        },
      ]);

      await tx.insert(changelogTags).values(
        SEEDED_CHANGELOG_TAGS.map((t) => ({
          productId: inserted.id,
          name: t.name,
          color: t.color,
        })),
      );
    });

    return ProductCreatedSchema.parse({ slug: input.slug });
  }

  @Get()
  @SerializeOptions({ schema: ProductSummarySchema })
  async listProducts(
    @CurrentTenant() tenant: Tenant,
  ): Promise<ProductSummary[]> {
    const rows = await this.db
      .select({
        id: products.id,
        slug: products.slug,
        name: products.name,
        logoKey: uploads.storageKey,
        ...productFeatureColumns,
        accentColor: products.accentColor,
        accentTextColor: products.accentTextColor,
      })
      .from(products)
      .leftJoin(uploads, eq(products.logoUploadId, uploads.id))
      .where(
        and(
          eq(products.workspaceId, tenant.workspaceId),
          isNull(products.deletedAt),
        ),
      )
      .orderBy(asc(products.name), asc(products.slug));

    return rows.map((r) => ({
      id: r.id,
      features: pickFeatures(r),
      slug: r.slug,
      name: r.name,
      logoUrl: r.logoKey ? `/uploads/${r.logoKey}` : null,
      accentColor: r.accentColor,
      accentTextColor: r.accentTextColor ?? null,
    }));
  }

  @Get(":product")
  @SerializeOptions({ schema: ProductDetailSchema })
  async getProduct(@CurrentTenant() tenant: Tenant): Promise<ProductDetail> {
    const [row] = await this.db
      .select({
        id: products.id,
        slug: products.slug,
        name: products.name,
        logoUploadId: products.logoUploadId,
        logoKey: uploads.storageKey,
        ...productFeatureColumns,
        accentColor: products.accentColor,
        accentTextColor: products.accentTextColor,
        tagline: products.tagline,
        websiteUrl: products.websiteUrl,
      })
      .from(products)
      .leftJoin(uploads, eq(products.logoUploadId, uploads.id))
      .where(
        and(eq(products.id, tenant.productId!), isNull(products.deletedAt)),
      )
      .limit(1);

    if (!row) {
      throw new ApiException("not_found", 404, "Not found.");
    }

    return ProductDetailSchema.parse({
      features: pickFeatures(row),
      slug: row.slug,
      name: row.name,
      logoUrl: row.logoKey ? `/uploads/${row.logoKey}` : null,
      logoUploadId: row.logoUploadId ?? null,
      accentColor: row.accentColor,
      accentTextColor: row.accentTextColor ?? null,
      tagline: row.tagline ?? null,
      websiteUrl: row.websiteUrl ?? null,
    });
  }

  @Patch(":product")
  @SerializeOptions({ schema: ProductDetailSchema })
  async updateProduct(
    @CurrentTenant() tenant: Tenant,
    @CurrentUser() user: any,
    @Body({ schema: UpdateProductInputSchema }) input: UpdateProductInput,
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
              eq(uploads.uploaderId, user.id),
            ),
          )
          .limit(1);

        if (!upload) {
          throw new ApiException(
            "validation_failed",
            400,
            "That logo can't be used.",
          );
        }
      }
    }

    const updateData: Record<string, any> = {};
    if (input.slug !== undefined) {
      const [existing] = await this.db
        .select({ id: products.id })
        .from(products)
        .where(
          and(
            eq(products.workspaceId, tenant.workspaceId),
            eq(products.slug, input.slug),
          ),
        )
        .limit(1);

      if (existing) {
        if (existing.id !== tenant.productId) {
          throw new ApiException(
            "slug_taken",
            409,
            "That URL is taken. Try another.",
          );
        }
      } else {
        updateData.slug = input.slug;
      }
    }

    if (input.features) {
      if (input.features.board !== undefined)
        updateData.boardEnabled = input.features.board;
      if (input.features.roadmap !== undefined)
        updateData.roadmapEnabled = input.features.roadmap;
      if (input.features.changelog !== undefined)
        updateData.changelogEnabled = input.features.changelog;
      if (input.features.faq !== undefined)
        updateData.faqEnabled = input.features.faq;
    }

    if (input.name !== undefined) updateData.name = input.name;
    if (input.logoUploadId !== undefined)
      updateData.logoUploadId = input.logoUploadId;
    if (input.tagline !== undefined) updateData.tagline = input.tagline;
    if (input.websiteUrl !== undefined)
      updateData.websiteUrl = input.websiteUrl;
    if (input.accentColor !== undefined)
      updateData.accentColor = input.accentColor;
    if (input.accentTextColor !== undefined)
      updateData.accentTextColor = input.accentTextColor;

    if (Object.keys(updateData).length > 0) {
      try {
        await this.db.transaction(async (tx) => {
        await tx
          .update(products)
          .set(updateData)
          .where(
            and(eq(products.id, tenant.productId!), eq(products.workspaceId, tenant.workspaceId), isNull(products.deletedAt)),
          );
        if (input.features?.board === false) {
          // Delete only derived, unsent delivery state. Source content and read history survive.
          await tx.execute(sql`
            DELETE FROM comment_email_items i USING comment_email_batches b, comments c, posts p, products pr
            WHERE i.batch_id = b.id AND i.comment_id = c.id AND c.post_id = p.id
              AND p.product_id = pr.id AND pr.id = ${tenant.productId!}
              AND pr.workspace_id = ${tenant.workspaceId} AND b.workspace_id = pr.workspace_id
              AND b.status IN ('pending', 'retrying', 'sending')
          `);
          await tx.execute(sql`
            DELETE FROM notifications WHERE product_id = ${tenant.productId!}
              AND workspace_id = ${tenant.workspaceId} AND read_at IS NULL
          `);
          // Same intent for push: drop only derived, unsent rows (D-14). Enqueue share-locks this
          // product row, so a racing enqueue cannot leave a surviving row.
          await tx.execute(sql`
            DELETE FROM push_deliveries
            WHERE status IN ('pending', 'sending') AND data->>'productId' = ${tenant.productId!}
          `);
        }
        });
      } catch (e) {
        // The pre-check above can lose a race with a concurrent rename.
        if (isUniqueViolation(e, "products_workspace_slug_unique")) {
          throw new ApiException(
            "slug_taken",
            409,
            "That URL is taken. Try another.",
          );
        }
        throw e;
      }
    }

    return await this.getProduct(tenant);
  }

  @Delete(":product")
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteProduct(@CurrentTenant() tenant: Tenant): Promise<void> {
    const deleted = await this.db
      .update(products)
      .set({ deletedAt: new Date() })
      .where(
        and(eq(products.id, tenant.productId!), isNull(products.deletedAt)),
      )
      .returning({ id: products.id });

    if (deleted.length === 0) {
      throw new ApiException("not_found", 404, "Not found.");
    }
  }
}
