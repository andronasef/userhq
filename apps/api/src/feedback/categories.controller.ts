import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  Inject,
  UseGuards,
  UseInterceptors,
  SerializeOptions,
} from "@nestjs/common";
import { StandardSchemaSerializerInterceptor } from "@nestjs/common";
import { and, eq, sql, asc, isNull } from "drizzle-orm";
import { z } from "zod";
import { DB, type Db, categories, posts } from "@userhq/db";
import {
  CategorySchema,
  CategoryInputSchema,
  type Category,
  type CategoryInput,
} from "@userhq/types";
import { TenantGuard, type Tenant } from "../tenancy/tenant.guard.js";
import { CurrentTenant } from "../tenancy/current-tenant.decorator.js";
import { ApiException } from "../common/api-error.filter.js";
import { isUniqueViolation } from "../common/db-errors.js";

const UuidParamSchema = z.string().uuid();

@Controller("workspaces/:ws/products/:product/categories")
@UseGuards(TenantGuard)
@UseInterceptors(StandardSchemaSerializerInterceptor)
export class CategoriesController {
  constructor(@Inject(DB) private readonly db: Db) {}

  @Get()
  @SerializeOptions({ schema: CategorySchema })
  async listCategories(
    @CurrentTenant() tenant: Tenant
  ): Promise<Category[]> {
    const rows = await this.db
      .select({
        id: categories.id,
        name: categories.name,
        postCount: sql<number>`(
          SELECT count(*)::int
          FROM ${posts} p
          WHERE p.category_id = categories.id
            AND p.product_id = ${tenant.productId}
            AND p.deleted_at IS NULL
            AND p.merged_into_id IS NULL
        )`,
      })
      .from(categories)
      .where(eq(categories.productId, tenant.productId!))
      .orderBy(asc(categories.createdAt), asc(categories.id));

    return rows.map((r) =>
      CategorySchema.parse({
        id: r.id,
        name: r.name,
        postCount: Number(r.postCount),
      })
    );
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @SerializeOptions({ schema: CategorySchema })
  async createCategory(
    @CurrentTenant() tenant: Tenant,
    @Body({ schema: CategoryInputSchema }) input: CategoryInput
  ): Promise<Category> {
    try {
      const [inserted] = await this.db
        .insert(categories)
        .values({
          productId: tenant.productId!,
          name: input.name,
        })
        .returning({
          id: categories.id,
          name: categories.name,
        });

      return CategorySchema.parse({
        id: inserted.id,
        name: inserted.name,
        postCount: 0,
      });
    } catch (e) {
      if (isUniqueViolation(e, "categories_product_name_ci")) {
        throw new ApiException(
          "category_name_taken",
          409,
          "This product already has a category with that name."
        );
      }
      throw e;
    }
  }

  @Patch(":categoryId")
  @SerializeOptions({ schema: CategorySchema })
  async updateCategory(
    @CurrentTenant() tenant: Tenant,
    @Param("categoryId") categoryIdRaw: string,
    @Body({ schema: CategoryInputSchema }) input: CategoryInput
  ): Promise<Category> {
    const parsedId = UuidParamSchema.safeParse(categoryIdRaw);
    if (!parsedId.success) {
      throw new ApiException("not_found", 404, "Not found.");
    }
    const categoryId = parsedId.data;

    try {
      const [updated] = await this.db
        .update(categories)
        .set({ name: input.name })
        .where(
          and(
            eq(categories.id, categoryId),
            eq(categories.productId, tenant.productId!)
          )
        )
        .returning({
          id: categories.id,
          name: categories.name,
        });

      if (!updated) {
        throw new ApiException("not_found", 404, "Not found.");
      }

      const [countRow] = await this.db
        .select({
          postCount: sql<number>`count(*)::int`,
        })
        .from(posts)
        .where(
          and(
            eq(posts.categoryId, categoryId),
            eq(posts.productId, tenant.productId!),
            isNull(posts.deletedAt),
            isNull(posts.mergedIntoId)
          )
        );

      return CategorySchema.parse({
        id: updated.id,
        name: updated.name,
        postCount: Number(countRow?.postCount ?? 0),
      });
    } catch (e) {
      if (isUniqueViolation(e, "categories_product_name_ci")) {
        throw new ApiException(
          "category_name_taken",
          409,
          "This product already has a category with that name."
        );
      }
      throw e;
    }
  }

  @Delete(":categoryId")
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteCategory(
    @CurrentTenant() tenant: Tenant,
    @Param("categoryId") categoryIdRaw: string
  ): Promise<void> {
    const parsedId = UuidParamSchema.safeParse(categoryIdRaw);
    if (!parsedId.success) {
      throw new ApiException("not_found", 404, "Not found.");
    }
    const categoryId = parsedId.data;

    await this.db.transaction(async (tx) => {
      const [cat] = await tx
        .select({ id: categories.id })
        .from(categories)
        .where(
          and(
            eq(categories.id, categoryId),
            eq(categories.productId, tenant.productId!)
          )
        )
        .for("update");

      if (!cat) {
        throw new ApiException("not_found", 404, "Not found.");
      }

      await tx
        .update(posts)
        .set({ categoryId: null })
        .where(
          and(
            eq(posts.categoryId, categoryId),
            eq(posts.productId, tenant.productId!)
          )
        );

      await tx
        .delete(categories)
        .where(
          and(
            eq(categories.id, categoryId),
            eq(categories.productId, tenant.productId!)
          )
        );
    });
  }
}
