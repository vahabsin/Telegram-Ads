import type { Context } from "grammy";
import type { Env } from "@telegram-ads/config";
import { languageCodeSchema, t } from "@telegram-ads/shared-types";
import { languageKeyboard, mainMenuKeyboard } from "../keyboards";
import { setUserLanguage } from "../services/user.service";

export function createLanguageCallbackHandler(env: Env) {
  return async function languageCallbackHandler(ctx: Context): Promise<void> {
    const data = ctx.callbackQuery?.data;
    if (!data?.startsWith("lang:") || !ctx.from) {
      return;
    }

    const parsed = languageCodeSchema.safeParse(data.slice("lang:".length));
    await ctx.answerCallbackQuery();
    if (!parsed.success) {
      return;
    }
    const language = parsed.data;

    await setUserLanguage(BigInt(ctx.from.id), language);
    await ctx.editMessageText(t(language, "language_saved"));
    await ctx.reply(t(language, "main_menu_title"), {
      reply_markup: mainMenuKeyboard(language, env),
    });
  };
}

export function createChangeLanguageHandler() {
  return async function changeLanguageHandler(ctx: Context): Promise<void> {
    await ctx.answerCallbackQuery();
    await ctx.reply(t("en", "choose_language"), { reply_markup: languageKeyboard() });
  };
}
