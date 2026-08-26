import { Injectable, NotFoundException } from "@nestjs/common";
import type { LanguageCode } from "@telegram-ads/shared-types";
import { PrismaService } from "../prisma/prisma.service";
import { WalletService } from "../wallet/wallet.service";

export interface FindOrCreateFromTelegramInput {
  telegramId: bigint;
  username: string | null;
  firstName: string | null;
  languageCode: LanguageCode;
}

@Injectable()
export class UserService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly walletService: WalletService,
  ) {}

  /** Finds a user by Telegram id, refreshing their profile, or creates one (with a wallet). */
  async findOrCreateFromTelegram(input: FindOrCreateFromTelegramInput) {
    const existing = await this.prisma.user.findUnique({
      where: { telegramId: input.telegramId },
    });

    if (existing) {
      return this.prisma.user.update({
        where: { id: existing.id },
        data: {
          username: input.username,
          firstName: input.firstName,
          languageCode: input.languageCode,
        },
      });
    }

    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          telegramId: input.telegramId,
          username: input.username,
          firstName: input.firstName,
          languageCode: input.languageCode,
        },
      });
      await this.walletService.createWallet(user.id, tx);
      return user;
    });
  }

  async getByIdWithWallet(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: { wallet: true },
    });
    if (!user || !user.wallet) {
      throw new NotFoundException("User not found");
    }
    return { ...user, wallet: user.wallet };
  }
}
