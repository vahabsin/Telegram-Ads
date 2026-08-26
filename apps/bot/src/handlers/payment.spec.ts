import type { Context } from "grammy";

const mockCreditWallet = jest.fn();
const mockFindUnique = jest.fn();

jest.mock("@telegram-ads/database", () => ({
  creditWallet: (...args: unknown[]) => mockCreditWallet(...args),
  prisma: { user: { findUnique: (...args: unknown[]) => mockFindUnique(...args) } },
}));

import {
  createPreCheckoutHandler,
  createSuccessfulPaymentHandler,
  parseDepositPayload,
} from "./payment";

describe("parseDepositPayload", () => {
  it("parses a well-formed deposit payload", () => {
    expect(parseDepositPayload("dep:user-123:5000")).toEqual({
      userId: "user-123",
      amountCoins: 5000n,
    });
  });

  it("returns null for malformed payloads", () => {
    expect(parseDepositPayload("not-a-deposit")).toBeNull();
    expect(parseDepositPayload("dep:only-one-part")).toBeNull();
    expect(parseDepositPayload("dep:user-123:not-a-number")).toBeNull();
  });
});

describe("pre-checkout handler", () => {
  beforeEach(() => jest.clearAllMocks());

  function buildCtx(invoicePayload: string | undefined) {
    return {
      preCheckoutQuery:
        invoicePayload !== undefined ? { invoice_payload: invoicePayload } : undefined,
      answerPreCheckoutQuery: jest.fn(),
    } as unknown as Context;
  }

  it("approves a well-formed deposit payload", async () => {
    const ctx = buildCtx("dep:user-1:1000");
    await createPreCheckoutHandler()(ctx);
    expect(
      (ctx as unknown as { answerPreCheckoutQuery: jest.Mock }).answerPreCheckoutQuery,
    ).toHaveBeenCalledWith(true);
  });

  it("rejects a malformed payload", async () => {
    const ctx = buildCtx("garbage");
    await createPreCheckoutHandler()(ctx);
    expect(
      (ctx as unknown as { answerPreCheckoutQuery: jest.Mock }).answerPreCheckoutQuery,
    ).toHaveBeenCalledWith(false, expect.any(String));
  });
});

describe("successful-payment handler", () => {
  beforeEach(() => jest.clearAllMocks());

  function buildCtx(successfulPayment: Record<string, unknown> | undefined) {
    return {
      message: successfulPayment ? { successful_payment: successfulPayment } : undefined,
      reply: jest.fn(),
    } as unknown as Context;
  }

  it("credits the wallet idempotently using the Telegram charge id and replies in the user's language", async () => {
    mockFindUnique.mockResolvedValue({ id: "user-1", languageCode: "fa" });
    const ctx = buildCtx({
      invoice_payload: "dep:user-1:5000",
      telegram_payment_charge_id: "charge-abc",
    });

    await createSuccessfulPaymentHandler()(ctx);

    expect(mockCreditWallet).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        userId: "user-1",
        amountCoins: 5000n,
        type: "DEPOSIT",
        paymentMethod: "STARS",
        idempotencyKey: "stars:charge-abc",
        externalRef: "charge-abc",
      }),
    );
    const reply = (ctx as unknown as { reply: jest.Mock }).reply;
    expect(reply).toHaveBeenCalledTimes(1);
    expect(reply.mock.calls[0][0]).toContain("سکه");
  });

  it("does nothing when there is no successful_payment on the message", async () => {
    const ctx = buildCtx(undefined);
    await createSuccessfulPaymentHandler()(ctx);
    expect(mockCreditWallet).not.toHaveBeenCalled();
  });

  it("ignores a malformed invoice payload without crediting anything", async () => {
    const ctx = buildCtx({ invoice_payload: "garbage", telegram_payment_charge_id: "x" });
    await createSuccessfulPaymentHandler()(ctx);
    expect(mockCreditWallet).not.toHaveBeenCalled();
  });
});
