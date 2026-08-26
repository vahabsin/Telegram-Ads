import fa from "../i18n/fa.json";
import en from "../i18n/en.json";
import ar from "../i18n/ar.json";
import type { LanguageCode } from "./language";

export const locales = { fa, en, ar } as const satisfies Record<
  LanguageCode,
  Record<string, string>
>;

export type TranslationKey = keyof typeof fa;

/** Simple {{placeholder}} interpolation - enough for bot/miniapp copy, no plural rules needed yet. */
export function t(
  language: LanguageCode,
  key: TranslationKey,
  params: Record<string, string | number> = {},
): string {
  const template = locales[language][key] ?? locales.en[key] ?? key;
  return template.replace(/\{\{(\w+)\}\}/g, (match, paramName: string) =>
    paramName in params ? String(params[paramName]) : match,
  );
}
