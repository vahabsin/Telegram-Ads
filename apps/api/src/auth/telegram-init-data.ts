import { createHmac, timingSafeEqual } from "node:crypto";

// Validates Telegram Mini App `initData` per the official algorithm:
// https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
//
// secret_key = HMAC_SHA256(bot_token, key="WebAppData")
// computed_hash = HMAC_SHA256(data_check_string, key=secret_key)
// data_check_string = all fields except `hash`, sorted by key, joined as "key=value" with "\n"

export interface TelegramInitDataUser {
  id: number;
  username?: string;
  first_name?: string;
  language_code?: string;
}

export interface ParsedTelegramInitData {
  authDate: number;
  user: TelegramInitDataUser | null;
}

export type ValidateInitDataResult =
  { ok: true; data: ParsedTelegramInitData } | { ok: false; reason: string };

const DEFAULT_MAX_AGE_SECONDS = 24 * 60 * 60; // reject initData older than 24h (anti-replay)
const MAX_CLOCK_SKEW_SECONDS = 60; // tolerate small clock drift for auth_date "in the future"

export function validateTelegramInitData(
  initData: string,
  botToken: string,
  options: { maxAgeSeconds?: number; now?: () => number } = {},
): ValidateInitDataResult {
  if (!botToken) {
    return { ok: false, reason: "bot token is not configured" };
  }
  if (!initData) {
    return { ok: false, reason: "initData is empty" };
  }

  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) {
    return { ok: false, reason: "missing hash" };
  }
  params.delete("hash");

  const entries = [...params.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  const dataCheckString = entries.map(([key, value]) => `${key}=${value}`).join("\n");

  const secretKey = createHmac("sha256", "WebAppData").update(botToken).digest();
  const computedHash = createHmac("sha256", secretKey).update(dataCheckString).digest("hex");

  const expected = Buffer.from(computedHash, "hex");
  const actual = Buffer.from(hash, "hex");
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    return { ok: false, reason: "hash mismatch" };
  }

  const authDateRaw = params.get("auth_date");
  const authDate = authDateRaw ? Number(authDateRaw) : NaN;
  if (!authDateRaw || Number.isNaN(authDate)) {
    return { ok: false, reason: "missing or invalid auth_date" };
  }

  const now = (options.now ?? Date.now)();
  const maxAgeSeconds = options.maxAgeSeconds ?? DEFAULT_MAX_AGE_SECONDS;
  const ageSeconds = now / 1000 - authDate;
  if (ageSeconds > maxAgeSeconds) {
    return { ok: false, reason: "initData expired" };
  }
  if (ageSeconds < -MAX_CLOCK_SKEW_SECONDS) {
    return { ok: false, reason: "auth_date is in the future" };
  }

  let user: TelegramInitDataUser | null = null;
  const userRaw = params.get("user");
  if (userRaw) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(userRaw);
    } catch {
      return { ok: false, reason: "invalid user JSON" };
    }
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      typeof (parsed as { id?: unknown }).id !== "number"
    ) {
      return { ok: false, reason: "invalid user payload" };
    }
    user = parsed as TelegramInitDataUser;
  }

  return { ok: true, data: { authDate, user } };
}
