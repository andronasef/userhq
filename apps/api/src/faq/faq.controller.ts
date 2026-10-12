import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
  UseInterceptors,
  SerializeOptions,
} from "@nestjs/common";
import { StandardSchemaSerializerInterceptor } from "@nestjs/common";
import { z } from "zod";
import {
  AdminFaqResponseSchema,
  AdminFaqCategorySchema,
  AdminFaqQuestionSchema,
  FaqCategoryInputSchema,
  FaqQuestionInputSchema,
  UpdateFaqQuestionInputSchema,
  MoveFaqCategoryInputSchema,
  MoveFaqQuestionInputSchema,
  MoveFaqCategoryResponseSchema,
  MoveFaqQuestionResponseSchema,
  type AdminFaqResponse,
  type AdminFaqCategory,
  type AdminFaqQuestion,
  type FaqCategoryInput,
  type FaqQuestionInput,
  type UpdateFaqQuestionInput,
  type MoveFaqCategoryInput,
  type MoveFaqQuestionInput,
  type MoveFaqCategoryResponse,
  type MoveFaqQuestionResponse,
} from "@userhq/types";
import { TenantGuard, type Tenant } from "../tenancy/tenant.guard.js";
import { CurrentTenant } from "../tenancy/current-tenant.decorator.js";
import { ApiException } from "../common/api-error.filter.js";
import { FaqService } from "./faq.service.js";

const UuidParamSchema = z.string().uuid();

@Controller("workspaces/:ws/products/:product/faq")
@UseGuards(TenantGuard)
@UseInterceptors(StandardSchemaSerializerInterceptor)
export class FaqController {
  constructor(private readonly faqService: FaqService) {}

  @Get()
  @SerializeOptions({ schema: AdminFaqResponseSchema })
  async getAdminTree(
    @CurrentTenant() tenant: Tenant
  ): Promise<AdminFaqResponse> {
    return this.faqService.listAdminFaq(tenant.productId!);
  }

  // --- Categories Endpoints ---

  @Get("categories")
  @SerializeOptions({ schema: AdminFaqCategorySchema })
  async listCategories(
    @CurrentTenant() tenant: Tenant
  ): Promise<AdminFaqCategory[]> {
    const res = await this.faqService.listAdminFaq(tenant.productId!);
    return res.categories;
  }

  @Post("categories")
  @HttpCode(HttpStatus.CREATED)
  @SerializeOptions({ schema: AdminFaqCategorySchema })
  async createCategory(
    @CurrentTenant() tenant: Tenant,
    @Body({ schema: FaqCategoryInputSchema }) input: FaqCategoryInput
  ): Promise<AdminFaqCategory> {
    return this.faqService.createCategory(tenant.productId!, input);
  }

  @Patch("categories/:id/reorder")
  @HttpCode(HttpStatus.OK)
  @SerializeOptions({ schema: MoveFaqCategoryResponseSchema })
  async reorderCategory(
    @CurrentTenant() tenant: Tenant,
    @Param("id") rawId: string,
    @Body({ schema: MoveFaqCategoryInputSchema }) input: MoveFaqCategoryInput
  ): Promise<MoveFaqCategoryResponse> {
    const parsed = UuidParamSchema.safeParse(rawId);
    if (!parsed.success) {
      throw new ApiException("not_found", 404, "Category not found.");
    }
    return this.faqService.reorderCategory(tenant.productId!, parsed.data, input);
  }

  @Patch("categories/:id")
  @SerializeOptions({ schema: AdminFaqCategorySchema })
  async updateCategory(
    @CurrentTenant() tenant: Tenant,
    @Param("id") rawId: string,
    @Body({ schema: FaqCategoryInputSchema }) input: FaqCategoryInput
  ): Promise<AdminFaqCategory> {
    const parsed = UuidParamSchema.safeParse(rawId);
    if (!parsed.success) {
      throw new ApiException("not_found", 404, "Category not found.");
    }
    return this.faqService.updateCategory(tenant.productId!, parsed.data, input);
  }

  @Delete("categories/:id")
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteCategory(
    @CurrentTenant() tenant: Tenant,
    @Param("id") rawId: string
  ): Promise<void> {
    const parsed = UuidParamSchema.safeParse(rawId);
    if (!parsed.success) {
      throw new ApiException("not_found", 404, "Category not found.");
    }
    await this.faqService.deleteCategory(tenant.productId!, parsed.data);
  }

  // --- Questions Endpoints ---

  @Post("questions")
  @HttpCode(HttpStatus.CREATED)
  @SerializeOptions({ schema: AdminFaqQuestionSchema })
  async createQuestion(
    @CurrentTenant() tenant: Tenant,
    @Body({ schema: FaqQuestionInputSchema }) input: FaqQuestionInput
  ): Promise<AdminFaqQuestion> {
    return this.faqService.createQuestion(tenant.productId!, input);
  }

  @Patch("questions/:id/reorder")
  @HttpCode(HttpStatus.OK)
  @SerializeOptions({ schema: MoveFaqQuestionResponseSchema })
  async reorderQuestion(
    @CurrentTenant() tenant: Tenant,
    @Param("id") rawId: string,
    @Body({ schema: MoveFaqQuestionInputSchema }) input: MoveFaqQuestionInput
  ): Promise<MoveFaqQuestionResponse> {
    const parsed = UuidParamSchema.safeParse(rawId);
    if (!parsed.success) {
      throw new ApiException("not_found", 404, "Question not found.");
    }
    return this.faqService.reorderQuestion(tenant.productId!, parsed.data, input);
  }

  @Patch("questions/:id")
  @SerializeOptions({ schema: AdminFaqQuestionSchema })
  async updateQuestion(
    @CurrentTenant() tenant: Tenant,
    @Param("id") rawId: string,
    @Body({ schema: UpdateFaqQuestionInputSchema }) input: UpdateFaqQuestionInput
  ): Promise<AdminFaqQuestion> {
    const parsed = UuidParamSchema.safeParse(rawId);
    if (!parsed.success) {
      throw new ApiException("not_found", 404, "Question not found.");
    }
    return this.faqService.updateQuestion(tenant.productId!, parsed.data, input);
  }

  @Delete("questions/:id")
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteQuestion(
    @CurrentTenant() tenant: Tenant,
    @Param("id") rawId: string
  ): Promise<void> {
    const parsed = UuidParamSchema.safeParse(rawId);
    if (!parsed.success) {
      throw new ApiException("not_found", 404, "Question not found.");
    }
    await this.faqService.deleteQuestion(tenant.productId!, parsed.data);
  }
}
