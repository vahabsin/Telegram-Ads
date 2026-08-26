import type { Context } from "grammy";
import type { Env } from "@telegram-ads/config";

const mockSetUserLanguage = jest.fn();
jest.mock("../services/user.service", () => ({
  setUserLanguage: (...args: unknown[]) => mockSetUserLanguage(...args),
}));

import { createLanguageCallbackHandler, createChangeLanguageHandler } from "./language";

const env = { MINIAPP_URL: undefined } as unknown as Env;

function buildCtx(opts: { data?: string; fromId?: number }) {
  return {
    from: opts.fromId !== undefined ? { id: opts.fromId } : undefined,
    callbackQuery: opts.data !== undefined ? { data: opts.data } : undefined,
    answerCallbackQuery: jest.fn(),
    editMessageText: jest.fn(),
    reply: jest.fn(),
  } as unknown as Context;
}

describe("language callback handler", () => {
  beforeEach(() => jest.clearAllMocks());

  it("saves a valid language choice and shows the main menu", async () => {
    const ctx = buildCtx({ data: "lang:ar", fromId: 42 });

    await createLanguageCallbackHandler(env)(ctx);

    expect(mockSetUserLanguage).toHaveBeenCalledWith(42n, "ar");
    const c = ctx as unknown as {
      answerCallbackQuery: jest.Mock;
      editMessageText: jest.Mock;
      reply: jest.Mock;
    };
    expect(c.answerCallbackQuery).toHaveBeenCalled();
    expect(c.editMessageText).toHaveBeenCalled();
    expect(c.reply).toHaveBeenCalled();
  });

  it("acknowledges but ignores an invalid language code", async () => {
    const ctx = buildCtx({ data: "lang:xx", fromId: 42 });

    await createLanguageCallbackHandler(env)(ctx);

    expect(mockSetUserLanguage).not.toHaveBeenCalled();
    const c = ctx as unknown as { answerCallbackQuery: jest.Mock; editMessageText: jest.Mock };
    expect(c.answerCallbackQuery).toHaveBeenCalled();
    expect(c.editMessageText).not.toHaveBeenCalled();
  });

  it("ignores callback data that isn't a lang: prefix", async () => {
    const ctx = buildCtx({ data: "menu:change_language", fromId: 42 });

    await createLanguageCallbackHandler(env)(ctx);

    expect(mockSetUserLanguage).not.toHaveBeenCalled();
  });
});

describe("change-language handler", () => {
  it("re-shows the language picker", async () => {
    const ctx = buildCtx({ fromId: 42 });

    await createChangeLanguageHandler()(ctx);

    const c = ctx as unknown as { answerCallbackQuery: jest.Mock; reply: jest.Mock };
    expect(c.answerCallbackQuery).toHaveBeenCalled();
    expect(c.reply).toHaveBeenCalled();
  });
});
