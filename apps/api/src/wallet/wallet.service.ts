import { BadRequestException, ConflictException, Injectable } from "@nestjs/common";
import { Prisma, type PaymentMethod, type WalletTransactionType } from "@telegram-ads/database";
import { PrismaService } from "../prisma/prisma.service";

type Db = PrismaService | Prisma.TransactionClient;

export interface WalletMutationInput {
  userId: string;
  amountCoins: bigint;
  type: WalletTransactionType;
  paymentMethod: PaymentMethod;
  idempotencyKey: string;
  externalRef?: string;
}

@Injectable()
export class WalletService {
  constructor(private readonly prisma: PrismaService) {}

  async createWallet(userId: string, db: Db = this.prisma) {
    return db.wallet.create({ data: { userId, balanceCoins: 0n } });
  }

  async getWalletByUserId(userId: string, db: Db = this.prisma) {
    return db.wallet.findUniqueOrThrow({ where: { userId } });
  }

  async getBalanceCoins(userId: string): Promise<bigint> {
    const wallet = await this.getWalletByUserId(userId);
    return wallet.balanceCoins;
  }

  /** Credits (adds to) the wallet balance. Idempotent on `idempotencyKey`. */
  async credit(input: WalletMutationInput) {
    return this.mutate({ ...input, direction: 1 });
  }

  /** Debits (subtracts from) the wallet balance. Idempotent on `idempotencyKey`. */
  async debit(input: WalletMutationInput) {
    return this.mutate({ ...input, direction: -1 });
  }

  private async mutate(input: WalletMutationInput & { direction: 1 | -1 }) {
    if (input.amountCoins <= 0n) {
      throw new BadRequestException("amountCoins must be positive");
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        const existing = await tx.walletTransaction.findUnique({
          where: { idempotencyKey: input.idempotencyKey },
        });
        if (existing) {
          return existing;
        }

        const wallet = await tx.wallet.findUniqueOrThrow({ where: { userId: input.userId } });

        if (input.direction === -1) {
          // Atomic conditional decrement: the DB itself checks the balance under the row
          // lock it takes for the UPDATE, so this is race-safe against concurrent debits
          // (no separate read-then-write window where two debits could both "see" enough funds).
          const updated = await tx.wallet.updateMany({
            where: { id: wallet.id, balanceCoins: { gte: input.amountCoins } },
            data: { balanceCoins: { decrement: input.amountCoins } },
          });
          if (updated.count === 0) {
            throw new ConflictException("Insufficient wallet balance");
          }
        } else {
          await tx.wallet.update({
            where: { id: wallet.id },
            data: { balanceCoins: { increment: input.amountCoins } },
          });
        }

        return tx.walletTransaction.create({
          data: {
            walletId: wallet.id,
            type: input.type,
            amountCoins: input.amountCoins,
            status: "COMPLETED",
            paymentMethod: input.paymentMethod,
            externalRef: input.externalRef ?? null,
            idempotencyKey: input.idempotencyKey,
          },
        });
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        // Lost a race against another request with the same idempotencyKey: our whole
        // transaction (including any balance mutation) was rolled back. Return the
        // winner's result instead of erroring, so retries are truly idempotent.
        const existing = await this.prisma.walletTransaction.findUnique({
          where: { idempotencyKey: input.idempotencyKey },
        });
        if (existing) {
          return existing;
        }
      }
      throw error;
    }
  }
}
