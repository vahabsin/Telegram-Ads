import { Injectable, NotFoundException } from "@nestjs/common";
import { createWallet } from "@telegram-ads/database";
import type { LanguageCode } from "@telegram-ads/shared-types";
import { PrismaService } from "../prisma/prisma.service";

export interface FindOrCreateFromTelegramInput {
  telegramId: bigint;
  username: string | null;
  firstName: string | null;
  languageCode: LanguageCode;
}

@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) {}

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
      await createWallet(tx, user.id);
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
