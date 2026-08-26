import { InlineKeyboard } from "grammy";
import type { Env } from "@telegram-ads/config";
import { t, type LanguageCode } from "@telegram-ads/shared-types";

export function languageKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text("🇮🇷 فارسی", "lang:fa")
    .text("🇬🇧 English", "lang:en")
    .row()
    .text("🇸🇦 العربية", "lang:ar");
}

export function mainMenuKeyboard(language: LanguageCode, env: Env): InlineKeyboard {
  const keyboard = new InlineKeyboard();

  if (env.MINIAPP_URL) {
    if (env.MINIAPP_URL.startsWith("https://")) {
      keyboard.webApp(t(language, "menu_open_app"), env.MINIAPP_URL);
    } else {
      // Telegram rejects web_app buttons on non-HTTPS URLs - fall back to a plain link so
      // /start still works end-to-end in local dev. See docs/DECISIONS.md.
      keyboard.url(t(language, "menu_open_app"), env.MINIAPP_URL);
    }
    keyboard.row();
  }

  // Channel/support links are only shown once configured - see TODO.md (real URLs needed from the user).
  if (env.PLATFORM_CHANNEL_URL) {
    keyboard.url(t(language, "menu_channel"), env.PLATFORM_CHANNEL_URL).row();
  }
  if (env.PLATFORM_SUPPORT_URL) {
    keyboard.url(t(language, "menu_support"), env.PLATFORM_SUPPORT_URL).row();
  }

  keyboard.text(t(language, "menu_change_language"), "menu:change_language");

  return keyboard;
}
