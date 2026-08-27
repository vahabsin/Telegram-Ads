import { ConflictException, NotFoundException } from "@nestjs/common";
import { AdService } from "./ad.service";

const OWNER_ID = "user-1";
const OTHER_USER_ID = "user-2";
const AD_ID = "ad-1";
const TARGETING_ID = "targeting-1";

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
    $transaction: jest.fn(async (fn: (tx: unknown) => unknown) => fn(prisma)),
  };
  return prisma;
}

function createWalletServiceMock() {
  return { getBalanceCoins: jest.fn() };
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
      const wallet = createWalletServiceMock();
      prisma.ad.create.mockResolvedValue(baseAdRow());
      prisma.ad.findUnique.mockResolvedValue(baseAdRow());
      const service = new AdService(prisma as never, wallet as never);

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
      const wallet = createWalletServiceMock();
      prisma.ad.findUnique.mockResolvedValue(baseAdRow({ status: "ACTIVE" }));
      const service = new AdService(prisma as never, wallet as never);

      await expect(service.update(OWNER_ID, AD_ID, { title: "New" })).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    it("throws NotFound when the ad belongs to a different advertiser", async () => {
      const prisma = createPrismaMock();
      const wallet = createWalletServiceMock();
      prisma.ad.findUnique.mockResolvedValue(baseAdRow());
      const service = new AdService(prisma as never, wallet as never);

      await expect(
        service.update(OTHER_USER_ID, AD_ID, { title: "New" }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it("applies only the provided partial fields and clears rejectionReason for a REJECTED ad", async () => {
      const prisma = createPrismaMock();
      const wallet = createWalletServiceMock();
      prisma.ad.findUnique
        .mockResolvedValueOnce(baseAdRow({ status: "REJECTED", rejectionReason: "bad creative" }))
        .mockResolvedValueOnce(baseAdRow({ status: "REJECTED", title: "New title" }));
      const service = new AdService(prisma as never, wallet as never);

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
      const wallet = createWalletServiceMock();
      prisma.ad.findUnique.mockResolvedValue(baseAdRow());
      const service = new AdService(prisma as never, wallet as never);

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
    it("rejects submitting when the wallet balance is below the ad budget", async () => {
      const prisma = createPrismaMock();
      const wallet = createWalletServiceMock();
      prisma.ad.findUnique.mockResolvedValue(baseAdRow({ budgetTotalCoins: 10_000n }));
      wallet.getBalanceCoins.mockResolvedValue(5_000n);
      const service = new AdService(prisma as never, wallet as never);

      await expect(service.submit(OWNER_ID, AD_ID)).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.ad.update).not.toHaveBeenCalled();
    });

    it("moves the ad to PENDING_REVIEW when the balance covers the budget", async () => {
      const prisma = createPrismaMock();
      const wallet = createWalletServiceMock();
      prisma.ad.findUnique.mockResolvedValue(baseAdRow({ budgetTotalCoins: 10_000n }));
      wallet.getBalanceCoins.mockResolvedValue(10_000n);
      prisma.ad.update.mockResolvedValue(baseAdRow({ status: "PENDING_REVIEW" }));
      const service = new AdService(prisma as never, wallet as never);

      const result = await service.submit(OWNER_ID, AD_ID);

      expect(prisma.ad.update).toHaveBeenCalledWith({
        where: { id: AD_ID },
        data: { status: "PENDING_REVIEW", rejectionReason: null },
      });
      expect(result.status).toBe("PENDING_REVIEW");
    });

    it("rejects submitting an ad that is already under review", async () => {
      const prisma = createPrismaMock();
      const wallet = createWalletServiceMock();
      prisma.ad.findUnique.mockResolvedValue(baseAdRow({ status: "PENDING_REVIEW" }));
      const service = new AdService(prisma as never, wallet as never);

      await expect(service.submit(OWNER_ID, AD_ID)).rejects.toBeInstanceOf(ConflictException);
      expect(wallet.getBalanceCoins).not.toHaveBeenCalled();
    });
  });

  describe("stats", () => {
    it("computes CTR from impressions and clicks", async () => {
      const prisma = createPrismaMock();
      const wallet = createWalletServiceMock();
      prisma.ad.findUnique.mockResolvedValue(baseAdRow({ budgetSpentCoins: 2_500n }));
      prisma.adImpression.count.mockResolvedValue(200);
      prisma.adClick.count.mockResolvedValue(10);
      const service = new AdService(prisma as never, wallet as never);

      const result = await service.stats(OWNER_ID, AD_ID);

      expect(result).toEqual({ impressions: 200, clicks: 10, ctr: 0.05, budgetSpentCoins: "2500" });
    });

    it("returns 0 CTR instead of dividing by zero when there are no impressions yet", async () => {
      const prisma = createPrismaMock();
      const wallet = createWalletServiceMock();
      prisma.ad.findUnique.mockResolvedValue(baseAdRow());
      prisma.adImpression.count.mockResolvedValue(0);
      prisma.adClick.count.mockResolvedValue(0);
      const service = new AdService(prisma as never, wallet as never);

      const result = await service.stats(OWNER_ID, AD_ID);

      expect(result.ctr).toBe(0);
    });
  });

  describe("list", () => {
    it("maps all of the advertiser's ads to DTOs", async () => {
      const prisma = createPrismaMock();
      const wallet = createWalletServiceMock();
      prisma.ad.findMany.mockResolvedValue([baseAdRow(), baseAdRow({ id: "ad-2" })]);
      const service = new AdService(prisma as never, wallet as never);

      const result = await service.list(OWNER_ID);

      expect(prisma.ad.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { advertiserId: OWNER_ID } }),
      );
      expect(result).toHaveLength(2);
    });
  });
});
