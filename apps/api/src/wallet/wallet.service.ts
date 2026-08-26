import { BadRequestException, ConflictException, Injectable } from "@nestjs/common";
import {
  createWallet,
  creditWallet,
  debitWallet,
  getBalanceCoins,
  InsufficientBalanceError,
  InvalidAmountError,
  type WalletMutationInput,
} from "@telegram-ads/database";
import { PrismaService } from "../prisma/prisma.service";

export type { WalletMutationInput };

@Injectable()
export class WalletService {
  constructor(private readonly prisma: PrismaService) {}

  async createWallet(userId: string) {
    return createWallet(this.prisma, userId);
  }

  async getBalanceCoins(userId: string): Promise<bigint> {
    return getBalanceCoins(this.prisma, userId);
  }

  /** Credits (adds to) the wallet balance. Idempotent on `idempotencyKey`. */
  async credit(input: WalletMutationInput) {
    return this.runMutation(() => creditWallet(this.prisma, input));
  }

  /** Debits (subtracts from) the wallet balance. Idempotent on `idempotencyKey`. */
  async debit(input: WalletMutationInput) {
    return this.runMutation(() => debitWallet(this.prisma, input));
  }

  async listTransactions(userId: string) {
    const wallet = await this.prisma.wallet.findUniqueOrThrow({ where: { userId } });
    return this.prisma.walletTransaction.findMany({
      where: { walletId: wallet.id },
      orderBy: { createdAt: "desc" },
    });
  }

  private async runMutation<T>(run: () => Promise<T>): Promise<T> {
    try {
      return await run();
    } catch (error) {
      if (error instanceof InvalidAmountError) {
        throw new BadRequestException(error.message);
      }
      if (error instanceof InsufficientBalanceError) {
        throw new ConflictException(error.message);
      }
      throw error;
    }
  }
}
