import { z } from "zod";

// TELEGRAM_BOT_TOKEN is optional at the env-loading level so apps/api can still boot
// (e.g. for /health) before a real bot token is provided. AuthService fails loudly
// at request time if it's missing when actually needed - see apps/api/src/auth/auth.service.ts.
export const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  REDIS_URL: z.string().min(1, "REDIS_URL is required"),
  API_PORT: z.coerce.number().int().positive().default(3000),
  JWT_SECRET: z.string().min(1, "JWT_SECRET is required"),
  TELEGRAM_BOT_TOKEN: z.string().optional(),
  MINIAPP_URL: z.string().optional(),
  // Optional external links shown in the bot's main menu (docs/ROADMAP.md phase 2). Left unset
  // by default; apps/bot omits the corresponding menu button rather than linking somewhere fake.
  PLATFORM_CHANNEL_URL: z.string().optional(),
  PLATFORM_SUPPORT_URL: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;
