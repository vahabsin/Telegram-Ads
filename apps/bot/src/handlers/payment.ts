import type { Context } from "grammy";
import { creditWallet, prisma } from "@telegram-ads/database";
import { t, type LanguageCode } from "@telegram-ads/shared-types";

interface DepositPayload {
  userId: string;
  amountCoins: bigint;
}

/**
 * Payload is generated server-side by apps/api when it creates the invoice link
 * (POST /wallet/deposit/stars/invoice) and only ever echoed back by Telegram, so it's a
 * trustworthy source for how many coins to credit - see docs/DECISIONS.md ADR-006/007.
 */
export function parseDepositPayload(payload: string): DepositPayload | null {
  const match = /^dep:([^:]+):(\d+)$/.exec(payload);
  if (!match) {
    return null;
  }
  const [, userId, amountStr] = match;
  return { userId: userId as string, amountCoins: BigInt(amountStr as string) };
}

export function createPreCheckoutHandler() {
  return async function preCheckoutHandler(ctx: Context): Promise<void> {
    const query = ctx.preCheckoutQuery;
    if (!query) {
      return;
    }

    const parsed = parseDepositPayload(query.invoice_payload);
    if (!parsed) {
      await ctx.answerPreCheckoutQuery(false, "Invalid payment payload");
      return;
    }
    await ctx.answerPreCheckoutQuery(true);
  };
}

export function createSuccessfulPaymentHandler() {
  return async function successfulPaymentHandler(ctx: Context): Promise<void> {
    const payment = ctx.message?.successful_payment;
    if (!payment) {
      return;
    }

    const parsed = parseDepositPayload(payment.invoice_payload);
    if (!parsed) {
      return;
    }

    await creditWallet(prisma, {
      userId: parsed.userId,
      amountCoins: parsed.amountCoins,
      type: "DEPOSIT",
      paymentMethod: "STARS",
      // Telegram guarantees this id is unique per successful payment, so it's a safe
      // idempotency key against duplicate-delivered successful_payment updates.
      idempotencyKey: `stars:${payment.telegram_payment_charge_id}`,
      externalRef: payment.telegram_payment_charge_id,
    });

    const user = await prisma.user.findUnique({ where: { id: parsed.userId } });
    const language = (user?.languageCode as LanguageCode | undefined) ?? "en";
    await ctx.reply(
      t(language, "stars_deposit_success", { amount: parsed.amountCoins.toString() }),
    );
  };
}
