import type { Context } from "grammy";
import type { Env } from "@telegram-ads/config";

const mockFindOrCreateUser = jest.fn();
jest.mock("../services/user.service", () => ({
  findOrCreateUser: (...args: unknown[]) => mockFindOrCreateUser(...args),
}));

import { createStartHandler } from "./start";

const env = { MINIAPP_URL: undefined } as unknown as Env;

function buildCtx(from: { id: number; username?: string; first_name?: string } | undefined) {
  return {
    from,
    reply: jest.fn(),
  } as unknown as Context;
}

describe("start handler", () => {
  beforeEach(() => jest.clearAllMocks());

  it("does nothing when ctx.from is missing (e.g. channel post)", async () => {
    const ctx = buildCtx(undefined);
    await createStartHandler(env)(ctx);
    expect(mockFindOrCreateUser).not.toHaveBeenCalled();
    expect((ctx as unknown as { reply: jest.Mock }).reply).not.toHaveBeenCalled();
  });

  it("prompts for a language choice on first-ever /start", async () => {
    mockFindOrCreateUser.mockResolvedValue({
      user: { id: "u1", firstName: "Vahab", languageCode: "fa" },
      isNew: true,
    });
    const ctx = buildCtx({ id: 42, first_name: "Vahab" });

    await createStartHandler(env)(ctx);

    const reply = (ctx as unknown as { reply: jest.Mock }).reply;
    expect(reply).toHaveBeenCalledTimes(1);
    expect(reply.mock.calls[0][0]).toContain("choose your language");
  });

  it("greets a returning user in their saved language and shows the main menu", async () => {
    mockFindOrCreateUser.mockResolvedValue({
      user: { id: "u1", firstName: "وحاب", languageCode: "fa" },
      isNew: false,
    });
    const ctx = buildCtx({ id: 42, first_name: "وحاب" });

    await createStartHandler(env)(ctx);

    const reply = (ctx as unknown as { reply: jest.Mock }).reply;
    expect(reply).toHaveBeenCalledTimes(2);
    expect(reply.mock.calls[0][0]).toContain("سلام");
  });
});
