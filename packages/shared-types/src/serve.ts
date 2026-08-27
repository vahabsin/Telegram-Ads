import { z } from "zod";
import { adMediaTypeSchema } from "./ad";

// GET /serve/ad and POST /serve/click - internal endpoints called by apps/bot (and, later,
// third-party publisher SDKs per docs/PRD.md section 2.6) to fetch/report ads for a channel.
// Protected by a shared internal secret, not JwtAuthGuard - see docs/DECISIONS.md ADR-015.

export const serveAdQuerySchema = z.object({
  channelId: z.string().min(1),
  // Telegram user ids fit well within JS's safe integer range (current ids are far below 2^53),
  // so a plain coerced number is fine here despite the DB column being BigInt.
  viewerTelegramId: z.coerce.number().int().positive(),
});
export type ServeAdQuery = z.infer<typeof serveAdQuerySchema>;

const servedAdSchema = z.object({
  id: z.string(),
  title: z.string(),
  bodyText: z.string(),
  targetUrl: z.string(),
  mediaUrl: z.string().nullable(),
  mediaType: adMediaTypeSchema,
  showAdvertiserAvatar: z.boolean(),
});
export type ServedAd = z.infer<typeof servedAdSchema>;

// impressionId and ad are always both null or both present - there was no eligible ad to serve
// (or the channel itself isn't eligible) vs. an ad was actually served and its impression
// recorded/billed.
export const serveAdResponseSchema = z.object({
  impressionId: z.string().nullable(),
  ad: servedAdSchema.nullable(),
});
export type ServeAdResponse = z.infer<typeof serveAdResponseSchema>;

export const serveClickRequestSchema = z.object({
  impressionId: z.string().min(1),
});
export type ServeClickRequest = z.infer<typeof serveClickRequestSchema>;

export const serveClickResponseSchema = z.object({
  ok: z.literal(true),
  alreadyRecorded: z.boolean(),
});
export type ServeClickResponse = z.infer<typeof serveClickResponseSchema>;
