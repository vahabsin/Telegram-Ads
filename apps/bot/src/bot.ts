import { Bot } from "grammy";
import type { Env } from "@telegram-ads/config";
import { createChangeLanguageHandler, createLanguageCallbackHandler } from "./handlers/language";
import { createPreCheckoutHandler, createSuccessfulPaymentHandler } from "./handlers/payment";
import { createStartHandler } from "./handlers/start";

export function createBot(env: Env): Bot {
  if (!env.TELEGRAM_BOT_TOKEN) {
    throw new Error("TELEGRAM_BOT_TOKEN is required to start apps/bot");
  }

  const bot = new Bot(env.TELEGRAM_BOT_TOKEN);

  bot.command("start", createStartHandler(env));
  bot.callbackQuery(/^lang:(fa|en|ar)$/, createLanguageCallbackHandler(env));
  bot.callbackQuery("menu:change_language", createChangeLanguageHandler());
  bot.on("pre_checkout_query", createPreCheckoutHandler());
  bot.on("message:successful_payment", createSuccessfulPaymentHandler());

  return bot;
}
