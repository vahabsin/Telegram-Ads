import { prisma } from "@telegram-ads/database";
import type { LanguageCode } from "@telegram-ads/shared-types";

export interface TelegramProfile {
  id: number;
  username: string | undefined;
  firstName: string | undefined;
}

export interface FindOrCreateUserResult {
  user: Awaited<ReturnType<typeof prisma.user.findUniqueOrThrow>>;
  isNew: boolean;
}

export async function findOrCreateUser(profile: TelegramProfile): Promise<FindOrCreateUserResult> {
  const telegramId = BigInt(profile.id);
  const existing = await prisma.user.findUnique({ where: { telegramId } });
  if (existing) {
    return { user: existing, isNew: false };
  }

  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        telegramId,
        username: profile.username ?? null,
        firstName: profile.firstName ?? null,
      },
    });
    await tx.wallet.create({ data: { userId: created.id, balanceCoins: 0n } });
    return created;
  });

  return { user, isNew: true };
}

export async function setUserLanguage(telegramId: bigint, languageCode: LanguageCode) {
  return prisma.user.update({ where: { telegramId }, data: { languageCode } });
}
