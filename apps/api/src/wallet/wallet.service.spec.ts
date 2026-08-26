import { BadRequestException, ConflictException } from "@nestjs/common";
import { InsufficientBalanceError, InvalidAmountError } from "@telegram-ads/database";

const mockCreditWallet = jest.fn();
const mockDebitWallet = jest.fn();
const mockCreateWallet = jest.fn();
const mockGetBalanceCoins = jest.fn();

jest.mock("@telegram-ads/database", () => {
  const actual = jest.requireActual("@telegram-ads/database");
  return {
    ...actual,
    creditWallet: (...args: unknown[]) => mockCreditWallet(...args),
    debitWallet: (...args: unknown[]) => mockDebitWallet(...args),
    createWallet: (...args: unknown[]) => mockCreateWallet(...args),
    getBalanceCoins: (...args: unknown[]) => mockGetBalanceCoins(...args),
  };
});

import { WalletService } from "./wallet.service";

describe("WalletService (NestJS adapter)", () => {
  const service = new WalletService({} as never);
  const baseInput = {
    userId: "user-1",
    amountCoins: 100n,
    type: "DEPOSIT" as const,
    paymentMethod: "STARS" as const,
    idempotencyKey: "idem-1",
  };

  beforeEach(() => jest.clearAllMocks());

  it("delegates credit to the shared creditWallet function", async () => {
    mockCreditWallet.mockResolvedValue({ id: "tx-1" });
    const result = await service.credit(baseInput);
    expect(mockCreditWallet).toHaveBeenCalledWith(expect.anything(), baseInput);
    expect(result).toEqual({ id: "tx-1" });
  });

  it("translates InvalidAmountError into a BadRequestException", async () => {
    mockCreditWallet.mockRejectedValue(new InvalidAmountError());
    await expect(service.credit(baseInput)).rejects.toBeInstanceOf(BadRequestException);
  });

  it("translates InsufficientBalanceError into a ConflictException", async () => {
    mockDebitWallet.mockRejectedValue(new InsufficientBalanceError());
    await expect(service.debit(baseInput)).rejects.toBeInstanceOf(ConflictException);
  });

  it("rethrows unrelated errors unchanged", async () => {
    const boom = new Error("boom");
    mockCreditWallet.mockRejectedValue(boom);
    await expect(service.credit(baseInput)).rejects.toBe(boom);
  });
});
