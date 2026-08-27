import { z } from "zod";

// GET /categories - the fixed taxonomy advertisers pick from in the ad wizard's targeting
// step (docs/PRD.md section 2.3 step 3) and publishers pick from for their channel/bot.
export const categorySchema = z.object({
  id: z.string(),
  slug: z.string(),
  nameFa: z.string(),
  nameEn: z.string(),
  nameAr: z.string(),
  parentId: z.string().nullable(),
});
export type CategoryDto = z.infer<typeof categorySchema>;

export const listCategoriesResponseSchema = z.object({ categories: z.array(categorySchema) });
export type ListCategoriesResponse = z.infer<typeof listCategoriesResponseSchema>;
