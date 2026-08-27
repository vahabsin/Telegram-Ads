import { Controller, Get } from "@nestjs/common";
import type { ListCategoriesResponse } from "@telegram-ads/shared-types";
import { PrismaService } from "../prisma/prisma.service";

// Public (no JwtAuthGuard) - this is fixed reference taxonomy, not user data.
@Controller("categories")
export class CategoryController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list(): Promise<ListCategoriesResponse> {
    const categories = await this.prisma.category.findMany({ orderBy: { nameEn: "asc" } });
    return {
      categories: categories.map((category) => ({
        id: category.id,
        slug: category.slug,
        nameFa: category.nameFa,
        nameEn: category.nameEn,
        nameAr: category.nameAr,
        parentId: category.parentId,
      })),
    };
  }
}
