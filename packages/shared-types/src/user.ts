import { z } from "zod";
import { languageCodeSchema } from "./language";

// Response body for GET /me. Coin amounts are always strings over the wire (see docs/DECISIONS.md ADR-003).
export const meResponseSchema = z.object({
  id: z.string(),
  telegramId: z.string(),
  username: z.string().nullable(),
  firstName: z.string().nullable(),
  languageCode: languageCodeSchema,
  isAdvertiser: z.boolean(),
  isPublisher: z.boolean(),
  wallet: z.object({
    balanceCoins: z.string(),
  }),
});
export type MeResponse = z.infer<typeof meResponseSchema>;
