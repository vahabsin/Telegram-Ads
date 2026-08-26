import { Body, Controller, Get, Post, Req, UseGuards } from "@nestjs/common";
import {
  createStarsInvoiceRequestSchema,
  type CreateStarsInvoiceResponse,
  type WalletTransactionsResponse,
} from "@telegram-ads/shared-types";
import { AuthenticatedRequest, JwtAuthGuard } from "../auth/jwt-auth.guard";
import { parseWithZod } from "../common/zod-validate";
import { PlatformSettingsService } from "../platform-settings/platform-settings.service";
import { TelegramBotApiClient } from "../telegram/telegram-bot-api.client";
import { computeStarsAmount } from "./stars-pricing";
import { WalletService } from "./wallet.service";

const DEFAULT_COINS_PER_STAR = 100; // fallback if PlatformSetting is missing - see docs/DECISIONS.md ADR-007

@Controller("wallet")
@UseGuards(JwtAuthGuard)
export class WalletController {
  constructor(
    private readonly walletService: WalletService,
    private readonly platformSettings: PlatformSettingsService,
    private readonly telegramBotApi: TelegramBotApiClient,
  ) {}

  @Post("deposit/stars/invoice")
  async createStarsInvoice(
    @Req() request: AuthenticatedRequest,
    @Body() body: unknown,
  ): Promise<CreateStarsInvoiceResponse> {
    const { amountCoins } = parseWithZod(createStarsInvoiceRequestSchema, body);

    const coinsPerStar = await this.platformSettings.getNumber(
      "coinsPerStar",
      DEFAULT_COINS_PER_STAR,
    );
    const starsAmount = computeStarsAmount(amountCoins, coinsPerStar);

    // The server generates this payload and Telegram only ever echoes it back verbatim -
    // the paying user's client cannot alter it - so it's a safe source of truth for how
    // many coins to credit once the payment succeeds (see apps/bot's payment handler).
    const payload = `dep:${request.userId}:${amountCoins}`;

    const invoiceLink = await this.telegramBotApi.createInvoiceLink({
      title: "شارژ کیف پول",
      description: `${amountCoins} coin`,
      payload,
      starsAmount,
    });

    return { invoiceLink, amountCoins: String(amountCoins), starsAmount };
  }

  @Get("transactions")
  async listTransactions(
    @Req() request: AuthenticatedRequest,
  ): Promise<WalletTransactionsResponse> {
    const transactions = await this.walletService.listTransactions(request.userId);
    return {
      transactions: transactions.map((transaction) => ({
        id: transaction.id,
        type: transaction.type,
        amountCoins: transaction.amountCoins.toString(),
        status: transaction.status,
        paymentMethod: transaction.paymentMethod,
        createdAt: transaction.createdAt.toISOString(),
      })),
    };
  }
}
