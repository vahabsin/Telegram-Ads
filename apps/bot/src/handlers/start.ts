import type { Context } from "grammy";
import type { Env } from "@telegram-ads/config";
import { t, type LanguageCode } from "@telegram-ads/shared-types";
import { languageKeyboard, mainMenuKeyboard } from "../keyboards";
import { findOrCreateUser } from "../services/user.service";

export function createStartHandler(env: Env) {
  return async function startHandler(ctx: Context): Promise<void> {
    if (!ctx.from) return;

    const { user, isNew } = await findOrCreateUser({
      id: ctx.from.id,
      username: ctx.from.username,
      firstName: ctx.from.first_name,
    });

    if (isNew) {
      // First-ever /start: language hasn't been explicitly chosen yet, ask before showing the menu.
      await ctx.reply(t("en", "choose_language"), { reply_markup: languageKeyboard() });
      return;
    }

    const language = user.languageCode as LanguageCode;
    await ctx.reply(t(language, "welcome", { name: user.firstName ?? "" }));
    await ctx.reply(t(language, "main_menu_title"), {
      reply_markup: mainMenuKeyboard(language, env),
    });
  };
}
