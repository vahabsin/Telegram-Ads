import { NotFoundException } from "@nestjs/common";
import { ServeService } from "./serve.service";

const CHANNEL_ID = "channel-1";
const OWNER_ID = "owner-1";
const WALLET_ID = "wallet-owner-1";
const VIEWER_ID = 111222333;

function baseChannel(overrides: Record<string, unknown> = {}) {
  return {
    id: CHANNEL_ID,
    ownerId: OWNER_ID,
    username: "mychannel",
    languageCode: "fa",
    minAcceptedCpm: 0n,
    isActive: true,
    verificationStatus: "VERIFIED",
    categories: [],
    ...overrides,
  };
}

function baseAd(overrides: Record<string, unknown> = {}) {
  return {
    id: "ad-1",
    status: "ACTIVE",
    title: "Ad title",
    bodyText: "Ad body",
    targetUrl: "https://t.me/example",
    mediaUrl: null,
    mediaType: "NONE",
    showAdvertiserAvatar: false,
    dailyViewLimitPerUser: 4,
    budgetTotalCoins: 100_000n,
    budgetSpentCoins: 0n,
    cpmCoins: 5_000n,
    targeting: {
      targetLanguages: [],
      targetChannelHandles: [],
      excludeChannelHandles: [],
      targetCategories: [],
      excludeCategories: [],
    },
    ...overrides,
  };
}

function createPrismaMock() {
  const prisma = {
    channel: { findUnique: jest.fn(), findUniqueOrThrow: jest.fn() },
    ad: {
      findMany: jest.fn().mockResolvedValue([]),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      update: jest.fn(),
      findUniqueOrThrow: jest.fn().mockResolvedValue(baseAd()),
    },
    adImpression: {
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn().mockResolvedValue({ id: "impression-default", adId: "ad-1" }),
      findUnique: jest.fn().mockResolvedValue(null),
    },
    adClick: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn() },
    wallet: {
      findUniqueOrThrow: jest.fn().mockResolvedValue({ id: WALLET_ID, balanceCoins: 0n }),
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

function createPlatformSettingsMock(commissionPercent = 20) {
  return { getNumber: jest.fn().mockResolvedValue(commissionPercent) };
}

describe("ServeService", () => {
  describe("serveAd - channel eligibility", () => {
    it("returns nulls when the channel does not exist", async () => {
      const prisma = createPrismaMock();
      prisma.channel.findUnique.mockResolvedValue(null);
      const service = new ServeService(prisma as never, createPlatformSettingsMock() as never);

      const result = await service.serveAd(CHANNEL_ID, VIEWER_ID);

      expect(result).toEqual({ impressionId: null, ad: null });
      expect(prisma.ad.findMany).not.toHaveBeenCalled();
    });

    it("returns nulls when the channel is inactive", async () => {
      const prisma = createPrismaMock();
      prisma.channel.findUnique.mockResolvedValue(baseChannel({ isActive: false }));
      const service = new ServeService(prisma as never, createPlatformSettingsMock() as never);

      expect(await service.serveAd(CHANNEL_ID, VIEWER_ID)).toEqual({ impressionId: null, ad: null });
    });

    it("returns nulls when the channel is not VERIFIED", async () => {
      const prisma = createPrismaMock();
      prisma.channel.findUnique.mockResolvedValue(baseChannel({ verificationStatus: "PENDING" }));
      const service = new ServeService(prisma as never, createPlatformSettingsMock() as never);

      expect(await service.serveAd(CHANNEL_ID, VIEWER_ID)).toEqual({ impressionId: null, ad: null });
    });
  });

  describe("serveAd - targeting and eligibility filters", () => {
    it("excludes an ad whose budget is already fully spent", async () => {
      const prisma = createPrismaMock();
      prisma.channel.findUnique.mockResolvedValue(baseChannel());
      prisma.ad.findMany.mockResolvedValue([
        baseAd({ budgetSpentCoins: 100_000n, budgetTotalCoins: 100_000n }),
      ]);
      const service = new ServeService(prisma as never, createPlatformSettingsMock() as never);

      expect(await service.serveAd(CHANNEL_ID, VIEWER_ID)).toEqual({ impressionId: null, ad: null });
      expect(prisma.ad.updateMany).not.toHaveBeenCalled();
    });

    it("excludes an ad whose target language doesn't match the channel's language", async () => {
      const prisma = createPrismaMock();
      prisma.channel.findUnique.mockResolvedValue(baseChannel({ languageCode: "en" }));
      prisma.ad.findMany.mockResolvedValue([
        baseAd({ targeting: { ...baseAd().targeting, targetLanguages: ["fa"] } }),
      ]);
      const service = new ServeService(prisma as never, createPlatformSettingsMock() as never);

      expect(await service.serveAd(CHANNEL_ID, VIEWER_ID)).toEqual({ impressionId: null, ad: null });
    });

    it("excludes an ad when the channel has no language set but the ad targets specific languages", async () => {
      const prisma = createPrismaMock();
      prisma.channel.findUnique.mockResolvedValue(baseChannel({ languageCode: null }));
      prisma.ad.findMany.mockResolvedValue([
        baseAd({ targeting: { ...baseAd().targeting, targetLanguages: ["fa"] } }),
      ]);
      const service = new ServeService(prisma as never, createPlatformSettingsMock() as never);

      expect(await service.serveAd(CHANNEL_ID, VIEWER_ID)).toEqual({ impressionId: null, ad: null });
    });

    it("matches a target channel handle regardless of '@' prefix or case", async () => {
      const prisma = createPrismaMock();
      prisma.channel.findUnique.mockResolvedValue(baseChannel({ username: "MyChannel" }));
      prisma.ad.findMany.mockResolvedValue([
        baseAd({ targeting: { ...baseAd().targeting, targetChannelHandles: ["@mychannel"] } }),
      ]);
      const service = new ServeService(prisma as never, createPlatformSettingsMock() as never);

      const result = await service.serveAd(CHANNEL_ID, VIEWER_ID);

      expect(result.ad).not.toBeNull();
    });

    it("excludes an ad that explicitly excludes this channel's handle", async () => {
      const prisma = createPrismaMock();
      prisma.channel.findUnique.mockResolvedValue(baseChannel({ username: "mychannel" }));
      prisma.ad.findMany.mockResolvedValue([
        baseAd({ targeting: { ...baseAd().targeting, excludeChannelHandles: ["mychannel"] } }),
      ]);
      const service = new ServeService(prisma as never, createPlatformSettingsMock() as never);

      expect(await service.serveAd(CHANNEL_ID, VIEWER_ID)).toEqual({ impressionId: null, ad: null });
    });

    it("requires at least one matching target category when targetCategories is non-empty", async () => {
      const prisma = createPrismaMock();
      prisma.channel.findUnique.mockResolvedValue(
        baseChannel({ categories: [{ categoryId: "cat-tech" }] }),
      );
      prisma.ad.findMany.mockResolvedValue([
        baseAd({
          targeting: {
            ...baseAd().targeting,
            targetCategories: [{ categoryId: "cat-crypto" }],
          },
        }),
      ]);
      const service = new ServeService(prisma as never, createPlatformSettingsMock() as never);

      expect(await service.serveAd(CHANNEL_ID, VIEWER_ID)).toEqual({ impressionId: null, ad: null });
    });

    it("excludes an ad whose excludeCategories overlaps the channel's categories", async () => {
      const prisma = createPrismaMock();
      prisma.channel.findUnique.mockResolvedValue(
        baseChannel({ categories: [{ categoryId: "cat-crypto" }] }),
      );
      prisma.ad.findMany.mockResolvedValue([
        baseAd({
          targeting: {
            ...baseAd().targeting,
            excludeCategories: [{ categoryId: "cat-crypto" }],
          },
        }),
      ]);
      const service = new ServeService(prisma as never, createPlatformSettingsMock() as never);

      expect(await service.serveAd(CHANNEL_ID, VIEWER_ID)).toEqual({ impressionId: null, ad: null });
    });

    it("excludes an ad once the viewer has already hit dailyViewLimitPerUser today", async () => {
      const prisma = createPrismaMock();
      prisma.channel.findUnique.mockResolvedValue(baseChannel());
      prisma.ad.findMany.mockResolvedValue([baseAd({ dailyViewLimitPerUser: 2 })]);
      prisma.adImpression.count.mockResolvedValue(2);
      const service = new ServeService(prisma as never, createPlatformSettingsMock() as never);

      expect(await service.serveAd(CHANNEL_ID, VIEWER_ID)).toEqual({ impressionId: null, ad: null });
    });

    it("picks the eligible ad with the highest CPM", async () => {
      const prisma = createPrismaMock();
      prisma.channel.findUnique.mockResolvedValue(baseChannel());
      prisma.ad.findMany.mockResolvedValue([
        baseAd({ id: "ad-low", cpmCoins: 1_000n }),
        baseAd({ id: "ad-high", cpmCoins: 9_000n }),
      ]);
      const service = new ServeService(prisma as never, createPlatformSettingsMock() as never);

      const result = await service.serveAd(CHANNEL_ID, VIEWER_ID);

      expect(result.ad?.id).toBe("ad-high");
    });
  });

  describe("serveAd - impression recording and budget deduction", () => {
    it("atomically deducts budgetSpentCoins and credits the publisher's wallet with the post-commission share", async () => {
      const prisma = createPrismaMock();
      prisma.channel.findUnique.mockResolvedValue(baseChannel());
      prisma.ad.findMany.mockResolvedValue([baseAd({ cpmCoins: 5_000n })]); // cost = 5 coins
      prisma.adImpression.create.mockResolvedValue({ id: "impression-1", adId: "ad-1" });
      prisma.ad.findUniqueOrThrow.mockResolvedValue(baseAd({ budgetSpentCoins: 5_000n }));
      const service = new ServeService(prisma as never, createPlatformSettingsMock(20) as never);

      const result = await service.serveAd(CHANNEL_ID, VIEWER_ID);

      expect(prisma.ad.updateMany).toHaveBeenCalledWith({
        where: { id: "ad-1", status: "ACTIVE", budgetSpentCoins: { lte: 100_000n - 5n } },
        data: { budgetSpentCoins: { increment: 5n } },
      });
      expect(prisma.wallet.update).toHaveBeenCalledWith({
        where: { id: WALLET_ID },
        data: { balanceCoins: { increment: 4n } }, // 80% of 5 coins
      });
      expect(prisma.walletTransaction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ type: "PUBLISHER_EARNING", amountCoins: 4n, externalRef: "impression-1" }),
        }),
      );
      expect(result).toEqual({
        impressionId: "impression-1",
        ad: {
          id: "ad-1",
          title: "Ad title",
          bodyText: "Ad body",
          targetUrl: "https://t.me/example",
          mediaUrl: null,
          mediaType: "NONE",
          showAdvertiserAvatar: false,
        },
      });
    });

    it("flips the ad to OUT_OF_BUDGET once this impression exhausts the budget", async () => {
      const prisma = createPrismaMock();
      prisma.channel.findUnique.mockResolvedValue(baseChannel());
      prisma.ad.findMany.mockResolvedValue([
        baseAd({ cpmCoins: 5_000n, budgetTotalCoins: 10_000n, budgetSpentCoins: 5_000n }),
      ]);
      prisma.adImpression.create.mockResolvedValue({ id: "impression-1", adId: "ad-1" });
      prisma.ad.findUniqueOrThrow.mockResolvedValue(
        baseAd({ budgetTotalCoins: 10_000n, budgetSpentCoins: 10_000n }),
      );
      const service = new ServeService(prisma as never, createPlatformSettingsMock() as never);

      await service.serveAd(CHANNEL_ID, VIEWER_ID);

      expect(prisma.ad.update).toHaveBeenCalledWith({
        where: { id: "ad-1" },
        data: { status: "OUT_OF_BUDGET" },
      });
    });

    it("does not flip status when budget remains after the impression", async () => {
      const prisma = createPrismaMock();
      prisma.channel.findUnique.mockResolvedValue(baseChannel());
      prisma.ad.findMany.mockResolvedValue([baseAd({ cpmCoins: 5_000n })]);
      prisma.adImpression.create.mockResolvedValue({ id: "impression-1", adId: "ad-1" });
      prisma.ad.findUniqueOrThrow.mockResolvedValue(baseAd({ budgetSpentCoins: 5_000n }));
      const service = new ServeService(prisma as never, createPlatformSettingsMock() as never);

      await service.serveAd(CHANNEL_ID, VIEWER_ID);

      expect(prisma.ad.update).not.toHaveBeenCalled();
    });

    it("skips crediting the publisher when the commission is 100%", async () => {
      const prisma = createPrismaMock();
      prisma.channel.findUnique.mockResolvedValue(baseChannel());
      prisma.ad.findMany.mockResolvedValue([baseAd({ cpmCoins: 5_000n })]);
      prisma.adImpression.create.mockResolvedValue({ id: "impression-1", adId: "ad-1" });
      prisma.ad.findUniqueOrThrow.mockResolvedValue(baseAd({ budgetSpentCoins: 5_000n }));
      const service = new ServeService(prisma as never, createPlatformSettingsMock(100) as never);

      await service.serveAd(CHANNEL_ID, VIEWER_ID);

      expect(prisma.wallet.update).not.toHaveBeenCalled();
      expect(prisma.walletTransaction.create).not.toHaveBeenCalled();
    });

    it("returns nulls without creating an impression when the atomic budget guard loses the race", async () => {
      const prisma = createPrismaMock();
      prisma.channel.findUnique.mockResolvedValue(baseChannel());
      prisma.ad.findMany.mockResolvedValue([baseAd({ cpmCoins: 5_000n })]);
      prisma.ad.updateMany.mockResolvedValue({ count: 0 }); // another concurrent impression won

      const service = new ServeService(prisma as never, createPlatformSettingsMock() as never);

      const result = await service.serveAd(CHANNEL_ID, VIEWER_ID);

      expect(result).toEqual({ impressionId: null, ad: null });
      expect(prisma.adImpression.create).not.toHaveBeenCalled();
    });
  });

  describe("recordClick", () => {
    it("throws NotFound for a non-existent impression", async () => {
      const prisma = createPrismaMock();
      const service = new ServeService(prisma as never, createPlatformSettingsMock() as never);

      await expect(service.recordClick("missing")).rejects.toBeInstanceOf(NotFoundException);
    });

    it("records a new click for a real impression", async () => {
      const prisma = createPrismaMock();
      prisma.adImpression.findUnique.mockResolvedValue({
        id: "impression-1",
        adId: "ad-1",
        viewerTelegramId: 111n,
      });
      const service = new ServeService(prisma as never, createPlatformSettingsMock() as never);

      const result = await service.recordClick("impression-1");

      expect(prisma.adClick.create).toHaveBeenCalledWith({
        data: { impressionId: "impression-1", adId: "ad-1", viewerTelegramId: 111n },
      });
      expect(result).toEqual({ ok: true, alreadyRecorded: false });
    });

    it("is idempotent: a second click on the same impression doesn't create a duplicate row", async () => {
      const prisma = createPrismaMock();
      prisma.adImpression.findUnique.mockResolvedValue({
        id: "impression-1",
        adId: "ad-1",
        viewerTelegramId: 111n,
      });
      prisma.adClick.findFirst.mockResolvedValue({ id: "click-1" });
      const service = new ServeService(prisma as never, createPlatformSettingsMock() as never);

      const result = await service.recordClick("impression-1");

      expect(prisma.adClick.create).not.toHaveBeenCalled();
      expect(result).toEqual({ ok: true, alreadyRecorded: true });
    });
  });
});
