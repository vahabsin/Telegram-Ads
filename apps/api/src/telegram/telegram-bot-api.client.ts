import { Inject, Injectable, InternalServerErrorException } from "@nestjs/common";
import type { Env } from "@telegram-ads/config";
import { ENV } from "../config/config.module";

interface CreateInvoiceLinkParams {
  title: string;
  description: string;
  /** Opaque string round-tripped back in pre_checkout_query/successful_payment. 1-128 bytes. */
  payload: string;
  /** Amount of Stars (XTR has no subunits, so this is the literal Star count). */
  starsAmount: number;
}

interface TelegramApiResponse<T> {
  ok: boolean;
  result?: T;
  description?: string;
}

// Thin wrapper around the plain Bot API HTTP endpoint - no grammY dependency needed here,
// createInvoiceLink is a single stateless HTTPS call. See docs/ARCHITECTURE.md #5 (wallet endpoints).
@Injectable()
export class TelegramBotApiClient {
  constructor(@Inject(ENV) private readonly env: Env) {}

  async createInvoiceLink(params: CreateInvoiceLinkParams): Promise<string> {
    if (!this.env.TELEGRAM_BOT_TOKEN) {
      throw new InternalServerErrorException("Telegram bot token is not configured on the server");
    }

    const response = await fetch(
      `https://api.telegram.org/bot${this.env.TELEGRAM_BOT_TOKEN}/createInvoiceLink`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: params.title,
          description: params.description,
          payload: params.payload,
          currency: "XTR",
          prices: [{ label: params.title, amount: params.starsAmount }],
        }),
      },
    );

    const body = (await response.json()) as TelegramApiResponse<string>;
    if (!body.ok || !body.result) {
      throw new InternalServerErrorException(
        `Telegram createInvoiceLink failed: ${body.description ?? "unknown error"}`,
      );
    }
    return body.result;
  }
}
