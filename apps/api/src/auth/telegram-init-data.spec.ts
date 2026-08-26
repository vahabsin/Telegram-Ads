import { createHmac } from "node:crypto";
import { validateTelegramInitData } from "./telegram-init-data";

const BOT_TOKEN = "123456:TEST-bot-token-not-real";

/**
 * Independently re-implements the Telegram signing algorithm (per the official docs) to build
 * fixtures, so these tests catch real bugs in the implementation rather than agreeing with itself.
 */
function signInitData(fields: Record<string, string>, botToken = BOT_TOKEN): string {
  const entries = Object.entries(fields).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  const dataCheckString = entries.map(([k, v]) => `${k}=${v}`).join("\n");
  const secretKey = createHmac("sha256", "WebAppData").update(botToken).digest();
  const hash = createHmac("sha256", secretKey).update(dataCheckString).digest("hex");
  return new URLSearchParams({ ...fields, hash }).toString();
}

function baseFields(overrides: Record<string, string> = {}) {
  return {
    auth_date: String(Math.floor(Date.now() / 1000)),
    user: JSON.stringify({ id: 42, username: "vahab", first_name: "Vahab", language_code: "fa" }),
    query_id: "AAabc123",
    ...overrides,
  };
}

describe("validateTelegramInitData", () => {
  it("accepts a correctly signed payload", () => {
    const initData = signInitData(baseFields());
    const result = validateTelegramInitData(initData, BOT_TOKEN);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.user?.id).toBe(42);
      expect(result.data.user?.username).toBe("vahab");
    }
  });

  it("rejects when the hash does not match (tampered field)", () => {
    const initData = signInitData(baseFields());
    const tampered = initData.replace("query_id=AAabc123", "query_id=AAtampered");
    const result = validateTelegramInitData(tampered, BOT_TOKEN);
    expect(result).toEqual({ ok: false, reason: "hash mismatch" });
  });

  it("rejects when signed with a different bot token", () => {
    const initData = signInitData(baseFields(), "999999:some-other-token");
    const result = validateTelegramInitData(initData, BOT_TOKEN);
    expect(result).toEqual({ ok: false, reason: "hash mismatch" });
  });

  it("rejects when the hash field is missing", () => {
    const result = validateTelegramInitData("auth_date=123&user=%7B%7D", BOT_TOKEN);
    expect(result).toEqual({ ok: false, reason: "missing hash" });
  });

  it("rejects empty initData", () => {
    const result = validateTelegramInitData("", BOT_TOKEN);
    expect(result.ok).toBe(false);
  });

  it("rejects when the bot token is not configured", () => {
    const initData = signInitData(baseFields());
    const result = validateTelegramInitData(initData, "");
    expect(result).toEqual({ ok: false, reason: "bot token is not configured" });
  });

  it("rejects initData older than the max age (replay protection)", () => {
    const oldAuthDate = String(Math.floor(Date.now() / 1000) - 25 * 60 * 60); // 25h ago
    const initData = signInitData(baseFields({ auth_date: oldAuthDate }));
    const result = validateTelegramInitData(initData, BOT_TOKEN);
    expect(result).toEqual({ ok: false, reason: "initData expired" });
  });

  it("accepts initData within a custom maxAgeSeconds window", () => {
    const authDate = String(Math.floor(Date.now() / 1000) - 30);
    const initData = signInitData(baseFields({ auth_date: authDate }));
    const result = validateTelegramInitData(initData, BOT_TOKEN, { maxAgeSeconds: 60 });
    expect(result.ok).toBe(true);
  });

  it("rejects auth_date more than the allowed clock skew in the future", () => {
    const futureAuthDate = String(Math.floor(Date.now() / 1000) + 3600);
    const initData = signInitData(baseFields({ auth_date: futureAuthDate }));
    const result = validateTelegramInitData(initData, BOT_TOKEN);
    expect(result).toEqual({ ok: false, reason: "auth_date is in the future" });
  });

  it("rejects malformed user JSON", () => {
    const initData = signInitData(baseFields({ user: "{not-json" }));
    const result = validateTelegramInitData(initData, BOT_TOKEN);
    expect(result).toEqual({ ok: false, reason: "invalid user JSON" });
  });

  it("rejects a user payload without a numeric id", () => {
    const initData = signInitData(baseFields({ user: JSON.stringify({ username: "no-id" }) }));
    const result = validateTelegramInitData(initData, BOT_TOKEN);
    expect(result).toEqual({ ok: false, reason: "invalid user payload" });
  });

  it("accepts a payload with no user field (e.g. inline query contexts)", () => {
    const fields = baseFields();
    delete (fields as Record<string, string>).user;
    const initData = signInitData(fields);
    const result = validateTelegramInitData(initData, BOT_TOKEN);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.user).toBeNull();
    }
  });
});
