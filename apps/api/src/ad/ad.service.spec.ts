import { ConflictException, NotFoundException } from "@nestjs/common";
import { AdService } from "./ad.service";

const OWNER_ID = "user-1";
const OTHER_USER_ID = "user-2";
const AD_ID = "ad-1";
const TARGETING_ID = "targeting-1";
const WALLET_ID = "wallet-1";

function baseAdRow(overrides: Record<string, unknown> = {}) {
  return {
    id: AD_ID,
    advertiserId: OWNER_ID,
    placementType: "CHANNELS",
    title: "My ad",
    bodyText: "Body",
    targetUrl: "https://t.me/example",
    mediaUrl: null,
    mediaType: "NONE",
    showAdvertiserAvatar: false,
    status: "DRAFT",
    rejectionReason: null,
    dailyViewLimitPerUser: 2,
    budgetTotalCoins: 10_000n,
    budgetSpentCoins: 0n,
    cpmCoins: 500n,
    createdAt: new Date("2026-08-27T00:00:00.000Z"),
    updatedAt: new Date("2026-08-27T00:00:00.000Z"),
    targeting: { id: TARGETING_ID, targetCategories: [], excludeCategories: [] },
    ...overrides,
  };
}

// The submit/cancel/reject paths run their wallet mutation through debitWalletInTx/
// creditWalletInTx (packages/database/src/wallet.ts), which touch tx.wallet.* and
// tx.walletTransaction.* directly. Since `$transaction` below just calls the callback with the
// same mock object, these need to be present alongside the Ad-related mocks.
function createPrismaMock() {
  const prisma = {
    ad: {
      create: jest.fn(),
      update: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    adTargeting: { create: jest.fn(), update: jest.fn() },
    adTargetCategory: { deleteMany: jest.fn(), createMany: jest.fn() },
    adExcludeCategory: { deleteMany: jest.fn(), createMany: jest.fn() },
    adImpression: { count: jest.fn() },
    adClick: { count: jest.fn() },
    wallet: {
      findUniqueOrThrow: jest.fn().mockResolvedValue({ id: WALLET_ID, balanceCoins: 0n }),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      update: jest.fn(),
    },
    walletTransaction: {
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockImplementation(({ data }: { data: unknown }) => Promise.resolve(data)),
    },
    $transaction: jest.fn(async (fn: (tx: unknown) => unknown) => fn(prisma)),
  };
  return prisma;
}

const validCreateDto = {
  placementType: "CHANNELS" as const,
  title: "My ad",
  targetLanguages: [],
  targetCategoryIds: ["cat-1"],
  targetChannelHandles: [],
  excludeCategoryIds: [],
  excludeChannelHandles: [],
  bodyText: "Body",
  targetUrl: "https://t.me/example",
  showAdvertiserAvatar: false,
  mediaType: "NONE" as const,
  initialStatus: "ACTIVE" as const,
  dailyViewLimitPerUser: 2,
  budgetTotalCoins: 10_000,
  cpmCoins: 500,
  acceptedTerms: true as const,
};

describe("AdService", () => {
  describe("create", () => {
    it("creates the ad in DRAFT status with nested targeting and returns a DTO", async () => {
      const prisma = createPrismaMock();
      prisma.ad.create.mockResolvedValue(baseAdRow());
      prisma.ad.findUnique.mockResolvedValue(baseAdRow());
      const service = new AdService(prisma as never);

      const result = await service.create(OWNER_ID, validCreateDto);

      expect(prisma.ad.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ advertiserId: OWNER_ID, status: "DRAFT" }),
        }),
      );
      expect(prisma.adTargeting.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ adId: AD_ID }),
        }),
      );
      expect(result.status).toBe("DRAFT");
      expect(result.budgetTotalCoins).toBe("10000");
    });
  });

  describe("update", () => {
    it("rejects editing an ad that is no longer editable", async () => {
      const prisma = createPrismaMock();
      prisma.ad.findUnique.mockResolvedValue(baseAdRow({ status: "ACTIVE" }));
      const service = new AdService(prisma as never);

      await expect(service.update(OWNER_ID, AD_ID, { title: "New" })).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    it("throws NotFound when the ad belongs to a different advertiser", async () => {
      const prisma = createPrismaMock();
      prisma.ad.findUnique.mockResolvedValue(baseAdRow());
      const service = new AdService(prisma as never);

      await expect(
        service.update(OTHER_USER_ID, AD_ID, { title: "New" }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it("applies only the provided partial fields and clears rejectionReason for a REJECTED ad", async () => {
      const prisma = createPrismaMock();
      prisma.ad.findUnique
        .mockResolvedValueOnce(baseAdRow({ status: "REJECTED", rejectionReason: "bad creative" }))
        .mockResolvedValueOnce(baseAdRow({ status: "REJECTED", title: "New title" }));
      const service = new AdService(prisma as never);

      await service.update(OWNER_ID, AD_ID, { title: "New title" });

      expect(prisma.ad.update).toHaveBeenCalledWith({
        where: { id: AD_ID },
        data: { title: "New title", rejectionReason: null },
      });
      expect(prisma.adTargeting.update).not.toHaveBeenCalled();
      expect(prisma.adTargetCategory.deleteMany).not.toHaveBeenCalled();
    });

    it("replaces target categories only when targetCategoryIds is provided", async () => {
      const prisma = createPrismaMock();
      prisma.ad.findUnique.mockResolvedValue(baseAdRow());
      const service = new AdService(prisma as never);

      await service.update(OWNER_ID, AD_ID, { targetCategoryIds: ["cat-2"] });

      expect(prisma.adTargetCategory.deleteMany).toHaveBeenCalledWith({
        where: { adTargetingId: TARGETING_ID },
      });
      expect(prisma.adTargetCategory.createMany).toHaveBeenCalledWith({
        data: [{ adTargetingId: TARGETING_ID, categoryId: "cat-2" }],
      });
    });
  });

  describe("submit", () => {
    it("reserves the full budget out of the wallet and moves the ad to PENDING_REVIEW", async () => {
      const prisma = createPrismaMock();
      prisma.ad.findUnique.mockResolvedValue(baseAdRow({ budgetTotalCoins: 10_000n }));
      prisma.wallet.findUniqueOrThrow.mockResolvedValue({ id: WALLET_ID, balanceCoins: 15_000n });
      prisma.wallet.updateMany.mockResolvedValue({ count: 1 });
      prisma.ad.update.mockResolvedValue(baseAdRow({ status: "PENDING_REVIEW" }));
      const service = new AdService(prisma as never);

      const result = await service.submit(OWNER_ID, AD_ID);

      expect(prisma.wallet.updateMany).toHaveBeenCalledWith({
        where: { id: WALLET_ID, balanceCoins: { gte: 10_000n } },
        data: { balanceCoins: { decrement: 10_000n } },
      });
      expect(prisma.walletTransaction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ type: "AD_SPEND", amountCoins: 10_000n, externalRef: AD_ID }),
        }),
      );
      expect(prisma.ad.update).toHaveBeenCalledWith({
        where: { id: AD_ID },
        data: { status: "PENDING_REVIEW", rejectionReason: null },
      });
      expect(result.status).toBe("PENDING_REVIEW");
    });

    it("rejects submitting when the wallet balance is below the ad budget, without changing ad status", async () => {
      const prisma = createPrismaMock();
      prisma.ad.findUnique.mockResolvedValue(baseAdRow({ budgetTotalCoins: 10_000n }));
      prisma.wallet.findUniqueOrThrow.mockResolvedValue({ id: WALLET_ID, balanceCoins: 5_000n });
      prisma.wallet.updateMany.mockResolvedValue({ count: 0 }); // atomic guard: insufficient funds
      const service = new AdService(prisma as never);

      await expect(service.submit(OWNER_ID, AD_ID)).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.ad.update).not.toHaveBeenCalled();
      expect(prisma.walletTransaction.create).not.toHaveBeenCalled();
    });

    it("rejects submitting an ad that is already under review", async () => {
      const prisma = createPrismaMock();
      prisma.ad.findUnique.mockResolvedValue(baseAdRow({ status: "PENDING_REVIEW" }));
      const service = new AdService(prisma as never);

      await expect(service.submit(OWNER_ID, AD_ID)).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.wallet.updateMany).not.toHaveBeenCalled();
    });
  });

  describe("cancel", () => {
    it("refunds the unspent remainder and closes the ad as COMPLETED", async () => {
      const prisma = createPrismaMock();
      prisma.ad.findUnique.mockResolvedValue(
        baseAdRow({ status: "ACTIVE", budgetTotalCoins: 10_000n, budgetSpentCoins: 4_000n }),
      );
      prisma.ad.update.mockResolvedValue(baseAdRow({ status: "COMPLETED" }));
      const service = new AdService(prisma as never);

      const result = await service.cancel(OWNER_ID, AD_ID);

      expect(prisma.wallet.update).toHaveBeenCalledWith({
        where: { id: WALLET_ID },
        data: { balanceCoins: { increment: 6_000n } },
      });
      expect(prisma.walletTransaction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ type: "REFUND", amountCoins: 6_000n, externalRef: AD_ID }),
        }),
      );
      expect(prisma.ad.update).toHaveBeenCalledWith({
        where: { id: AD_ID },
        data: { status: "COMPLETED", rejectionReason: null },
      });
      expect(result.status).toBe("COMPLETED");
    });

    it("skips the wallet credit entirely when nothing is left to refund", async () => {
      const prisma = createPrismaMock();
      prisma.ad.findUnique.mockResolvedValue(
        baseAdRow({ status: "ACTIVE", budgetTotalCoins: 10_000n, budgetSpentCoins: 10_000n }),
      );
      prisma.ad.update.mockResolvedValue(baseAdRow({ status: "COMPLETED" }));
      const service = new AdService(prisma as never);

      await service.cancel(OWNER_ID, AD_ID);

      expect(prisma.wallet.update).not.toHaveBeenCalled();
      expect(prisma.walletTransaction.create).not.toHaveBeenCalled();
    });

    it("rejects canceling a DRAFT ad (nothing reserved yet) or a different owner's ad", async () => {
      const prisma = createPrismaMock();
      prisma.ad.findUnique.mockResolvedValue(baseAdRow({ status: "DRAFT" }));
      const service = new AdService(prisma as never);

      await expect(service.cancel(OWNER_ID, AD_ID)).rejects.toBeInstanceOf(ConflictException);
      await expect(service.cancel(OTHER_USER_ID, AD_ID)).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe("reject", () => {
    it("refunds the full reserved budget (nothing spent yet) and marks the ad REJECTED with a reason", async () => {
      const prisma = createPrismaMock();
      prisma.ad.findUnique.mockResolvedValue(
        baseAdRow({ status: "PENDING_REVIEW", budgetTotalCoins: 10_000n, budgetSpentCoins: 0n }),
      );
      prisma.ad.update.mockResolvedValue(baseAdRow({ status: "REJECTED", rejectionReason: "spam" }));
      const service = new AdService(prisma as never);

      const result = await service.reject(AD_ID, "spam");

      expect(prisma.wallet.update).toHaveBeenCalledWith({
        where: { id: WALLET_ID },
        data: { balanceCoins: { increment: 10_000n } },
      });
      expect(prisma.ad.update).toHaveBeenCalledWith({
        where: { id: AD_ID },
        data: { status: "REJECTED", rejectionReason: "spam" },
      });
      expect(result.status).toBe("REJECTED");
    });

    it("rejects rejecting an ad that isn't PENDING_REVIEW", async () => {
      const prisma = createPrismaMock();
      prisma.ad.findUnique.mockResolvedValue(baseAdRow({ status: "DRAFT" }));
      const service = new AdService(prisma as never);

      await expect(service.reject(AD_ID, "spam")).rejects.toBeInstanceOf(ConflictException);
    });

    it("throws NotFound for a non-existent ad", async () => {
      const prisma = createPrismaMock();
      prisma.ad.findUnique.mockResolvedValue(null);
      const service = new AdService(prisma as never);

      await expect(service.reject(AD_ID, "spam")).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe("stats", () => {
    it("computes CTR from impressions and clicks", async () => {
      const prisma = createPrismaMock();
      prisma.ad.findUnique.mockResolvedValue(baseAdRow({ budgetSpentCoins: 2_500n }));
      prisma.adImpression.count.mockResolvedValue(200);
      prisma.adClick.count.mockResolvedValue(10);
      const service = new AdService(prisma as never);

      const result = await service.stats(OWNER_ID, AD_ID);

      expect(result).toEqual({ impressions: 200, clicks: 10, ctr: 0.05, budgetSpentCoins: "2500" });
    });

    it("returns 0 CTR instead of dividing by zero when there are no impressions yet", async () => {
      const prisma = createPrismaMock();
      prisma.ad.findUnique.mockResolvedValue(baseAdRow());
      prisma.adImpression.count.mockResolvedValue(0);
      prisma.adClick.count.mockResolvedValue(0);
      const service = new AdService(prisma as never);

      const result = await service.stats(OWNER_ID, AD_ID);

      expect(result.ctr).toBe(0);
    });
  });

  describe("list", () => {
    it("maps all of the advertiser's ads to DTOs", async () => {
      const prisma = createPrismaMock();
      prisma.ad.findMany.mockResolvedValue([baseAdRow(), baseAdRow({ id: "ad-2" })]);
      const service = new AdService(prisma as never);

      const result = await service.list(OWNER_ID);

      expect(prisma.ad.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { advertiserId: OWNER_ID } }),
      );
      expect(result).toHaveLength(2);
    });
  });
});
