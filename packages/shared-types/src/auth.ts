import { z } from "zod";

// Request body for POST /auth/telegram-webapp - the raw initData string from
// window.Telegram.WebApp.initData, validated server-side (see apps/api/src/auth).
export const telegramWebAppAuthRequestSchema = z.object({
  initData: z.string().min(1),
});
export type TelegramWebAppAuthRequest = z.infer<typeof telegramWebAppAuthRequestSchema>;

export const telegramWebAppAuthResponseSchema = z.object({
  accessToken: z.string(),
});
export type TelegramWebAppAuthResponse = z.infer<typeof telegramWebAppAuthResponseSchema>;
