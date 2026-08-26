import {
  Prisma,
  type PaymentMethod,
  type PrismaClient,
  type WalletTransactionType,
} from "../generated/client";

// Framework-agnostic wallet mutation logic, shared by apps/api (wrapped in a NestJS service)
// and apps/bot (called directly when a Telegram Stars payment completes). Deliberately has no
// dependency on @nestjs/common - callers translate these plain errors into their own error types.
// See docs/DECISIONS.md ADR-006.

type Db = PrismaClient | Prisma.TransactionClient;

export interface WalletMutationInput {
  userId: string;
  amountCoins: bigint;
  type: WalletTransactionType;
  paymentMethod: PaymentMethod;
  idempotencyKey: string;
  externalRef?: string;
}

export class InsufficientBalanceError extends Error {
  constructor() {
    super("Insufficient wallet balance");
    this.name = "InsufficientBalanceError";
  }
}

export class InvalidAmountError extends Error {
  constructor() {
    super("amountCoins must be positive");
    this.name = "InvalidAmountError";
  }
}

export async function createWallet(db: Db, userId: string) {
  return db.wallet.create({ data: { userId, balanceCoins: 0n } });
}

export async function getBalanceCoins(db: Db, userId: string): Promise<bigint> {
  const wallet = await db.wallet.findUniqueOrThrow({ where: { userId } });
  return wallet.balanceCoins;
}

/** Credits (adds to) the wallet balance. Idempotent on `idempotencyKey`. */
export async function creditWallet(prisma: PrismaClient, input: WalletMutationInput) {
  return mutateWallet(prisma, { ...input, direction: 1 });
}

/** Debits (subtracts from) the wallet balance. Idempotent on `idempotencyKey`. */
export async function debitWallet(prisma: PrismaClient, input: WalletMutationInput) {
  return mutateWallet(prisma, { ...input, direction: -1 });
}

async function mutateWallet(
  prisma: PrismaClient,
  input: WalletMutationInput & { direction: 1 | -1 },
) {
  if (input.amountCoins <= 0n) {
    throw new InvalidAmountError();
  }

  try {
    return await prisma.$transaction(async (tx) => {
      const existing = await tx.walletTransaction.findUnique({
        where: { idempotencyKey: input.idempotencyKey },
      });
      if (existing) {
        return existing;
      }

      const wallet = await tx.wallet.findUniqueOrThrow({ where: { userId: input.userId } });

      if (input.direction === -1) {
        // Atomic conditional decrement: the DB checks the balance under the row lock it
        // takes for the UPDATE, so this is race-safe against concurrent debits.
        const updated = await tx.wallet.updateMany({
          where: { id: wallet.id, balanceCoins: { gte: input.amountCoins } },
          data: { balanceCoins: { decrement: input.amountCoins } },
        });
        if (updated.count === 0) {
          throw new InsufficientBalanceError();
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
      // Lost a race against another call with the same idempotencyKey: our whole transaction
      // (including any balance mutation) was rolled back. Return the winner's result so
      // retries are truly idempotent instead of erroring.
      const existing = await prisma.walletTransaction.findUnique({
        where: { idempotencyKey: input.idempotencyKey },
      });
      if (existing) {
        return existing;
      }
    }
    throw error;
  }
}
