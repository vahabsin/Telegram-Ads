import { Prisma } from "../generated/client";
import { creditWallet, debitWallet, InsufficientBalanceError, InvalidAmountError } from "./wallet";

function buildMockTx() {
  return {
    walletTransaction: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    wallet: {
      findUniqueOrThrow: jest.fn(),
      updateMany: jest.fn(),
      update: jest.fn(),
    },
  };
}

function buildMockPrisma(mockTx: ReturnType<typeof buildMockTx>) {
  return {
    $transaction: jest.fn((callback: (tx: unknown) => unknown) => callback(mockTx)),
    walletTransaction: {
      findUnique: jest.fn(),
    },
  };
}

describe("wallet mutation logic", () => {
  const baseInput = {
    userId: "user-1",
    amountCoins: 100n,
    type: "DEPOSIT" as const,
    paymentMethod: "STARS" as const,
    idempotencyKey: "idem-1",
  };

  it("credit increments the wallet balance and records a COMPLETED transaction", async () => {
    const mockTx = buildMockTx();
    mockTx.walletTransaction.findUnique.mockResolvedValue(null);
    mockTx.wallet.findUniqueOrThrow.mockResolvedValue({ id: "wallet-1", balanceCoins: 500n });
    mockTx.walletTransaction.create.mockImplementation(({ data }) => Promise.resolve(data));
    const mockPrisma = buildMockPrisma(mockTx);

    const result = await creditWallet(mockPrisma as never, baseInput);

    expect(mockTx.wallet.update).toHaveBeenCalledWith({
      where: { id: "wallet-1" },
      data: { balanceCoins: { increment: 100n } },
    });
    expect(mockTx.wallet.updateMany).not.toHaveBeenCalled();
    expect(result).toMatchObject({ status: "COMPLETED", amountCoins: 100n });
  });

  it("debit decrements the balance atomically when funds are sufficient", async () => {
    const mockTx = buildMockTx();
    mockTx.walletTransaction.findUnique.mockResolvedValue(null);
    mockTx.wallet.findUniqueOrThrow.mockResolvedValue({ id: "wallet-1", balanceCoins: 500n });
    mockTx.wallet.updateMany.mockResolvedValue({ count: 1 });
    mockTx.walletTransaction.create.mockImplementation(({ data }) => Promise.resolve(data));
    const mockPrisma = buildMockPrisma(mockTx);

    const result = await debitWallet(mockPrisma as never, baseInput);

    expect(mockTx.wallet.updateMany).toHaveBeenCalledWith({
      where: { id: "wallet-1", balanceCoins: { gte: 100n } },
      data: { balanceCoins: { decrement: 100n } },
    });
    expect(result).toMatchObject({ status: "COMPLETED" });
  });

  it("debit throws InsufficientBalanceError when the balance guard matches zero rows", async () => {
    const mockTx = buildMockTx();
    mockTx.walletTransaction.findUnique.mockResolvedValue(null);
    mockTx.wallet.findUniqueOrThrow.mockResolvedValue({ id: "wallet-1", balanceCoins: 50n });
    mockTx.wallet.updateMany.mockResolvedValue({ count: 0 });
    const mockPrisma = buildMockPrisma(mockTx);

    await expect(debitWallet(mockPrisma as never, baseInput)).rejects.toBeInstanceOf(
      InsufficientBalanceError,
    );
    expect(mockTx.walletTransaction.create).not.toHaveBeenCalled();
  });

  it("is idempotent: returns the existing transaction without mutating the balance again", async () => {
    const mockTx = buildMockTx();
    const existing = { id: "tx-1", status: "COMPLETED", amountCoins: 100n };
    mockTx.walletTransaction.findUnique.mockResolvedValue(existing);
    const mockPrisma = buildMockPrisma(mockTx);

    const result = await creditWallet(mockPrisma as never, baseInput);

    expect(result).toBe(existing);
    expect(mockTx.wallet.findUniqueOrThrow).not.toHaveBeenCalled();
    expect(mockTx.wallet.update).not.toHaveBeenCalled();
    expect(mockTx.wallet.updateMany).not.toHaveBeenCalled();
  });

  it("rejects non-positive amounts before touching the database", async () => {
    const mockTx = buildMockTx();
    const mockPrisma = buildMockPrisma(mockTx);

    await expect(
      creditWallet(mockPrisma as never, { ...baseInput, amountCoins: 0n }),
    ).rejects.toBeInstanceOf(InvalidAmountError);
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it("on a concurrent idempotencyKey race (P2002), returns the winner's transaction instead of erroring", async () => {
    const mockTx = buildMockTx();
    mockTx.walletTransaction.findUnique.mockResolvedValue(null);
    mockTx.wallet.findUniqueOrThrow.mockResolvedValue({ id: "wallet-1", balanceCoins: 500n });
    mockTx.walletTransaction.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
        code: "P2002",
        clientVersion: "test",
      }),
    );
    const mockPrisma = buildMockPrisma(mockTx);
    const winnerRecord = { id: "tx-winner", status: "COMPLETED", amountCoins: 100n };
    mockPrisma.walletTransaction.findUnique.mockResolvedValue(winnerRecord);

    const result = await creditWallet(mockPrisma as never, baseInput);

    expect(result).toBe(winnerRecord);
  });
});
