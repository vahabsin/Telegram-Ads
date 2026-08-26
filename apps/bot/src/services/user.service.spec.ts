const mockPrisma = {
  user: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  $transaction: jest.fn(),
};

jest.mock("@telegram-ads/database", () => ({ prisma: mockPrisma }));

// Imported after the mock so the module under test picks up the mocked `prisma`.
import { findOrCreateUser, setUserLanguage } from "./user.service";

describe("findOrCreateUser", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns the existing user without creating a wallet again", async () => {
    const existing = { id: "user-1", telegramId: 42n, languageCode: "fa" };
    mockPrisma.user.findUnique.mockResolvedValue(existing);

    const result = await findOrCreateUser({ id: 42 });

    expect(result).toEqual({ user: existing, isNew: false });
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it("creates a user and wallet together for a brand-new Telegram id", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);
    const createdUser = { id: "user-2", telegramId: 43n, languageCode: "fa" };
    const tx = {
      user: { create: jest.fn().mockResolvedValue(createdUser) },
      wallet: { create: jest.fn().mockResolvedValue({}) },
    };
    mockPrisma.$transaction.mockImplementation((callback: (tx: unknown) => unknown) =>
      callback(tx),
    );

    const result = await findOrCreateUser({ id: 43, username: "vahab", firstName: "Vahab" });

    expect(tx.user.create).toHaveBeenCalledWith({
      data: { telegramId: 43n, username: "vahab", firstName: "Vahab" },
    });
    expect(tx.wallet.create).toHaveBeenCalledWith({
      data: { userId: "user-2", balanceCoins: 0n },
    });
    expect(result).toEqual({ user: createdUser, isNew: true });
  });
});

describe("setUserLanguage", () => {
  it("updates the user's languageCode by telegramId", async () => {
    mockPrisma.user.update.mockResolvedValue({ id: "user-1", languageCode: "ar" });
    await setUserLanguage(42n, "ar");
    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { telegramId: 42n },
      data: { languageCode: "ar" },
    });
  });
});
