import {
  Controller,
  Get,
  Post,
  Patch,
  Put,
  Delete,
  Body,
  Query,
  Param,
  HttpCode,
  HttpStatus,
  Inject,
  UseGuards,
  UseInterceptors,
  SerializeOptions,
} from "@nestjs/common";
import { StandardSchemaSerializerInterceptor } from "@nestjs/common";
import { and, eq, sql, asc, inArray } from "drizzle-orm";
import { z } from "zod";
import { DB, type Db, statuses } from "@userhq/db";
import {
  StatusSchema,
  CreateStatusInputSchema,
  UpdateStatusInputSchema,
  ReorderStatusesInputSchema,
  type Status,
  type CreateStatusInput,
  type UpdateStatusInput,
  type ReorderStatusesInput,
} from "@userhq/types";
import { TenantGuard, type Tenant } from "../tenancy/tenant.guard.js";
import { CurrentTenant } from "../tenancy/current-tenant.decorator.js";
import { ApiException } from "../common/api-error.filter.js";
import { isUniqueViolation } from "../common/db-errors.js";

const UuidParamSchema = z.string().uuid();

@Controller("workspaces/:ws/products/:product/statuses")
@UseGuards(TenantGuard)
@UseInterceptors(StandardSchemaSerializerInterceptor)
export class StatusesController {
  constructor(@Inject(DB) private readonly db: Db) {}

  @Get()
  @SerializeOptions({ schema: StatusSchema })
  async listStatuses(
    @CurrentTenant() tenant: Tenant
  ): Promise<Status[]> {
    const rows = await this.db
      .select({
        id: statuses.id,
        name: statuses.name,
        color: statuses.color,
        type: statuses.type,
        position: statuses.position,
        isDefault: statuses.isDefault,
      })
      .from(statuses)
      .where(eq(statuses.productId, tenant.productId!))
      .orderBy(asc(statuses.position), asc(statuses.id));

    return rows.map((r) => StatusSchema.parse(r));
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @SerializeOptions({ schema: StatusSchema })
  async createStatus(
    @CurrentTenant() tenant: Tenant,
    @Body({ schema: CreateStatusInputSchema }) input: CreateStatusInput
  ): Promise<Status> {
    try {
      const [inserted] = await this.db.transaction(async (tx) => {
        const [posRow] = await tx
          .select({
            nextPos: sql<number>`coalesce(max(${statuses.position}), -1) + 1`,
          })
          .from(statuses)
          .where(eq(statuses.productId, tenant.productId!));

        const position = Number(posRow.nextPos);

        return await tx
          .insert(statuses)
          .values({
            productId: tenant.productId!,
            name: input.name,
            type: input.type,
            color: input.color,
            position,
            isDefault: false,
          })
          .returning({
            id: statuses.id,
            name: statuses.name,
            color: statuses.color,
            type: statuses.type,
            position: statuses.position,
            isDefault: statuses.isDefault,
          });
      });

      return StatusSchema.parse(inserted);
    } catch (e) {
      if (isUniqueViolation(e, "statuses_product_name_ci")) {
        throw new ApiException(
          "status_name_taken",
          409,
          "This product already has a status with that name."
        );
      }
      throw e;
    }
  }

  @Patch(":statusId")
  @SerializeOptions({ schema: StatusSchema })
  async updateStatus(
    @CurrentTenant() tenant: Tenant,
    @Param("statusId") statusIdRaw: string,
    @Body({ schema: UpdateStatusInputSchema }) input: UpdateStatusInput
  ): Promise<Status> {
    const parsedId = UuidParamSchema.safeParse(statusIdRaw);
    if (!parsedId.success) {
      throw new ApiException("not_found", 404, "Not found.");
    }
    const statusId = parsedId.data;

    const updateData: Record<string, any> = {};
    if (input.name !== undefined) updateData.name = input.name;
    if (input.type !== undefined) updateData.type = input.type;
    if (input.color !== undefined) updateData.color = input.color;

    if (Object.keys(updateData).length === 0) {
      const [row] = await this.db
        .select({
          id: statuses.id,
          name: statuses.name,
          color: statuses.color,
          type: statuses.type,
          position: statuses.position,
          isDefault: statuses.isDefault,
        })
        .from(statuses)
        .where(
          and(
            eq(statuses.id, statusId),
            eq(statuses.productId, tenant.productId!)
          )
        )
        .limit(1);

      if (!row) {
        throw new ApiException("not_found", 404, "Not found.");
      }
      return StatusSchema.parse(row);
    }

    try {
      const [updated] = await this.db
        .update(statuses)
        .set(updateData)
        .where(
          and(
            eq(statuses.id, statusId),
            eq(statuses.productId, tenant.productId!)
          )
        )
        .returning({
          id: statuses.id,
          name: statuses.name,
          color: statuses.color,
          type: statuses.type,
          position: statuses.position,
          isDefault: statuses.isDefault,
        });

      if (!updated) {
        throw new ApiException("not_found", 404, "Not found.");
      }

      return StatusSchema.parse(updated);
    } catch (e) {
      if (isUniqueViolation(e, "statuses_product_name_ci")) {
        throw new ApiException(
          "status_name_taken",
          409,
          "This product already has a status with that name."
        );
      }
      throw e;
    }
  }

  @Put(":statusId/default")
  @SerializeOptions({ schema: StatusSchema })
  async setDefaultStatus(
    @CurrentTenant() tenant: Tenant,
    @Param("statusId") statusIdRaw: string
  ): Promise<Status[]> {
    const parsedId = UuidParamSchema.safeParse(statusIdRaw);
    if (!parsedId.success) {
      throw new ApiException("not_found", 404, "Not found.");
    }
    const statusId = parsedId.data;

    await this.db.transaction(async (tx) => {
      await tx
        .update(statuses)
        .set({ isDefault: false })
        .where(
          and(
            eq(statuses.productId, tenant.productId!),
            eq(statuses.isDefault, true)
          )
        );

      const [updated] = await tx
        .update(statuses)
        .set({ isDefault: true })
        .where(
          and(
            eq(statuses.id, statusId),
            eq(statuses.productId, tenant.productId!)
          )
        )
        .returning({ id: statuses.id });

      if (!updated) {
        throw new ApiException("not_found", 404, "Not found.");
      }
    });

    return await this.listStatuses(tenant);
  }

  @Put("order")
  @SerializeOptions({ schema: StatusSchema })
  async reorderStatuses(
    @CurrentTenant() tenant: Tenant,
    @Body({ schema: ReorderStatusesInputSchema }) input: ReorderStatusesInput
  ): Promise<Status[]> {
    const { ids } = input;

    await this.db.transaction(async (tx) => {
      const currentRows = await tx
        .select({ id: statuses.id })
        .from(statuses)
        .where(eq(statuses.productId, tenant.productId!))
        .for("update");

      const currentIds = currentRows.map((r) => r.id);
      const uniqueInputIds = new Set(ids);

      if (
        ids.length !== currentIds.length ||
        uniqueInputIds.size !== ids.length
      ) {
        throw new ApiException(
          "validation_failed",
          400,
          "Invalid status list for reordering."
        );
      }

      for (const id of currentIds) {
        if (!uniqueInputIds.has(id)) {
          throw new ApiException(
            "validation_failed",
            400,
            "Invalid status list for reordering."
          );
        }
      }

      for (let i = 0; i < ids.length; i++) {
        await tx
          .update(statuses)
          .set({ position: i })
          .where(
            and(
              eq(statuses.id, ids[i]),
              eq(statuses.productId, tenant.productId!)
            )
          );
      }
    });

    return await this.listStatuses(tenant);
  }

  @Delete(":statusId")
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteStatus(
    @CurrentTenant() tenant: Tenant,
    @Param("statusId") statusIdRaw: string,
    @Query("moveTo") moveToRaw?: string
  ): Promise<void> {
    const parsedId = UuidParamSchema.safeParse(statusIdRaw);
    if (!parsedId.success) {
      throw new ApiException("not_found", 404, "Not found.");
    }
    const statusId = parsedId.data;

    const parsedMoveTo = UuidParamSchema.safeParse(moveToRaw);
    if (!parsedMoveTo.success || parsedMoveTo.data === statusId) {
      throw new ApiException(
        "validation_failed",
        400,
        "A different replacement status is required."
      );
    }
    const moveTo = parsedMoveTo.data;

    await this.db.transaction(async (tx) => {
      const lockedRows = await tx
        .select({
          id: statuses.id,
          isDefault: statuses.isDefault,
        })
        .from(statuses)
        .where(
          and(
            eq(statuses.productId, tenant.productId!),
            inArray(statuses.id, [statusId, moveTo])
          )
        )
        .for("update");

      if (lockedRows.length < 2) {
        throw new ApiException("not_found", 404, "Not found.");
      }

      const toDelete = lockedRows.find((r) => r.id === statusId);
      if (!toDelete) {
        throw new ApiException("not_found", 404, "Not found.");
      }

      if (toDelete.isDefault) {
        throw new ApiException(
          "delete_default_status",
          400,
          "The default status can't be deleted."
        );
      }

      // Phase 3: UPDATE posts SET status_id = moveTo WHERE status_id = id AND product_id = tenant.productId
      // Phase 4: UPDATE roadmap_items SET status_id = moveTo WHERE status_id = id AND product_id = tenant.productId

      await tx
        .delete(statuses)
        .where(
          and(
            eq(statuses.id, statusId),
            eq(statuses.productId, tenant.productId!)
          )
        );
    });
  }
}
