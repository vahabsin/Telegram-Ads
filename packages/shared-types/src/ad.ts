import { z } from "zod";

// MVP scope per docs/PRD.md section 4: only CHANNELS/BOTS targeting for now (SEARCH/USERS
// are docs/ROADMAP.md phase 9). The Prisma enum still has all four for forward-compat.
export const adPlacementTypeSchema = z.enum(["CHANNELS", "BOTS"]);
export type AdPlacementType = z.infer<typeof adPlacementTypeSchema>;

export const adMediaTypeSchema = z.enum(["IMAGE", "VIDEO", "NONE"]);
export type AdMediaType = z.infer<typeof adMediaTypeSchema>;

export const adStatusSchema = z.enum([
  "DRAFT",
  "PENDING_REVIEW",
  "ACTIVE",
  "PAUSED",
  "REJECTED",
  "COMPLETED",
  "OUT_OF_BUDGET",
]);
export type AdStatus = z.infer<typeof adStatusSchema>;

// POST /ads and PATCH /ads/:id - the whole wizard's worth of fields in one payload; the
// Mini App wizard collects these across its 5 steps but only submits once per PRD 2.3.
export const createAdRequestSchema = z.object({
  placementType: adPlacementTypeSchema,
  title: z.string().min(1).max(120),

  // Step 3: targeting - everything optional except explicitly noted in PRD 2.3.
  targetLanguages: z.array(z.string()).default([]),
  targetCategoryIds: z.array(z.string()).default([]),
  targetChannelHandles: z.array(z.string()).default([]),
  excludeCategoryIds: z.array(z.string()).default([]),
  excludeChannelHandles: z.array(z.string()).default([]),

  // Step 4: creative.
  bodyText: z.string().min(1).max(2000),
  targetUrl: z.string().url(),
  showAdvertiserAvatar: z.boolean().default(false),
  mediaUrl: z.string().url().optional(),
  mediaType: adMediaTypeSchema.default("NONE"),

  // Step 5: budget & rate.
  initialStatus: z.enum(["ACTIVE", "PAUSED"]).default("ACTIVE"),
  dailyViewLimitPerUser: z.coerce.number().int().min(1).max(4),
  budgetTotalCoins: z.coerce.number().int().positive(),
  cpmCoins: z.coerce.number().int().positive(),
  acceptedTerms: z.literal(true),
});
export type CreateAdRequest = z.infer<typeof createAdRequestSchema>;

export const updateAdRequestSchema = createAdRequestSchema.partial();
export type UpdateAdRequest = z.infer<typeof updateAdRequestSchema>;

export const adSchema = z.object({
  id: z.string(),
  placementType: adPlacementTypeSchema,
  title: z.string(),
  bodyText: z.string(),
  targetUrl: z.string(),
  mediaUrl: z.string().nullable(),
  mediaType: adMediaTypeSchema,
  showAdvertiserAvatar: z.boolean(),
  status: adStatusSchema,
  rejectionReason: z.string().nullable(),
  dailyViewLimitPerUser: z.number(),
  budgetTotalCoins: z.string(),
  budgetSpentCoins: z.string(),
  cpmCoins: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type AdDto = z.infer<typeof adSchema>;

export const listAdsResponseSchema = z.object({ ads: z.array(adSchema) });
export type ListAdsResponse = z.infer<typeof listAdsResponseSchema>;

export const adStatsResponseSchema = z.object({
  impressions: z.number(),
  clicks: z.number(),
  ctr: z.number(),
  budgetSpentCoins: z.string(),
});
export type AdStatsResponse = z.infer<typeof adStatsResponseSchema>;
