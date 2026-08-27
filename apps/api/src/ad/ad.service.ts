import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import type { Prisma } from "@telegram-ads/database";
import type { AdDto, AdStatsResponse, CreateAdRequest, UpdateAdRequest } from "@telegram-ads/shared-types";
import { PrismaService } from "../prisma/prisma.service";
import { WalletService } from "../wallet/wallet.service";

// Statuses an advertiser is still allowed to edit or submit from - once an ad has been
// submitted for review (or beyond), the wizard's PATCH /ads/:id is closed per
// docs/ARCHITECTURE.md section 5 ("ویرایش پیش از تأیید" - edit before approval).
const EDITABLE_STATUSES = ["DRAFT", "REJECTED"] as const;

type AdWithTargeting = Prisma.AdGetPayload<{
  include: {
    targeting: { include: { targetCategories: true; excludeCategories: true } };
  };
}>;

@Injectable()
export class AdService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly walletService: WalletService,
  ) {}

  async create(userId: string, dto: CreateAdRequest): Promise<AdDto> {
    const ad = await this.prisma.$transaction(async (tx) => {
      const created = await tx.ad.create({
        data: {
          advertiserId: userId,
          placementType: dto.placementType,
          title: dto.title,
          bodyText: dto.bodyText,
          targetUrl: dto.targetUrl,
          mediaUrl: dto.mediaUrl ?? null,
          mediaType: dto.mediaType,
          showAdvertiserAvatar: dto.showAdvertiserAvatar,
          status: "DRAFT",
          initialStatusChoice: dto.initialStatus,
          dailyViewLimitPerUser: dto.dailyViewLimitPerUser,
          budgetTotalCoins: BigInt(dto.budgetTotalCoins),
          cpmCoins: BigInt(dto.cpmCoins),
        },
      });

      await tx.adTargeting.create({
        data: {
          adId: created.id,
          targetLanguages: dto.targetLanguages,
          targetChannelHandles: dto.targetChannelHandles,
          excludeChannelHandles: dto.excludeChannelHandles,
          excludedCountries: [], // TODO(phase 6): populate from admin-configured default list
          targetCategories: {
            create: dto.targetCategoryIds.map((categoryId) => ({ categoryId })),
          },
          excludeCategories: {
            create: dto.excludeCategoryIds.map((categoryId) => ({ categoryId })),
          },
        },
      });

      return created;
    });

    return this.toDto(await this.findOwnedOrThrow(userId, ad.id));
  }

  async update(userId: string, adId: string, dto: UpdateAdRequest): Promise<AdDto> {
    const existing = await this.findOwnedOrThrow(userId, adId);
    if (!EDITABLE_STATUSES.includes(existing.status as (typeof EDITABLE_STATUSES)[number])) {
      throw new ConflictException(
        `Ad cannot be edited while in status ${existing.status}. Only ${EDITABLE_STATUSES.join(", ")} ads are editable.`,
      );
    }

    await this.prisma.$transaction(async (tx) => {
      const adData: Prisma.AdUpdateInput = {};
      if (dto.placementType !== undefined) adData.placementType = dto.placementType;
      if (dto.title !== undefined) adData.title = dto.title;
      if (dto.bodyText !== undefined) adData.bodyText = dto.bodyText;
      if (dto.targetUrl !== undefined) adData.targetUrl = dto.targetUrl;
      if (dto.mediaUrl !== undefined) adData.mediaUrl = dto.mediaUrl;
      if (dto.mediaType !== undefined) adData.mediaType = dto.mediaType;
      if (dto.showAdvertiserAvatar !== undefined) adData.showAdvertiserAvatar = dto.showAdvertiserAvatar;
      if (dto.initialStatus !== undefined) adData.initialStatusChoice = dto.initialStatus;
      if (dto.dailyViewLimitPerUser !== undefined) adData.dailyViewLimitPerUser = dto.dailyViewLimitPerUser;
      if (dto.budgetTotalCoins !== undefined) adData.budgetTotalCoins = BigInt(dto.budgetTotalCoins);
      if (dto.cpmCoins !== undefined) adData.cpmCoins = BigInt(dto.cpmCoins);
      // A previously rejected ad goes back to a clean slate once the advertiser edits it.
      if (existing.status === "REJECTED") adData.rejectionReason = null;

      if (Object.keys(adData).length > 0) {
        await tx.ad.update({ where: { id: adId }, data: adData });
      }

      const targetingData: Prisma.AdTargetingUpdateInput = {};
      if (dto.targetLanguages !== undefined) targetingData.targetLanguages = dto.targetLanguages;
      if (dto.targetChannelHandles !== undefined) targetingData.targetChannelHandles = dto.targetChannelHandles;
      if (dto.excludeChannelHandles !== undefined) targetingData.excludeChannelHandles = dto.excludeChannelHandles;
      if (Object.keys(targetingData).length > 0) {
        await tx.adTargeting.update({ where: { adId }, data: targetingData });
      }

      if (dto.targetCategoryIds !== undefined) {
        await tx.adTargetCategory.deleteMany({ where: { adTargetingId: existing.targeting!.id } });
        await tx.adTargetCategory.createMany({
          data: dto.targetCategoryIds.map((categoryId) => ({
            adTargetingId: existing.targeting!.id,
            categoryId,
          })),
        });
      }
      if (dto.excludeCategoryIds !== undefined) {
        await tx.adExcludeCategory.deleteMany({ where: { adTargetingId: existing.targeting!.id } });
        await tx.adExcludeCategory.createMany({
          data: dto.excludeCategoryIds.map((categoryId) => ({
            adTargetingId: existing.targeting!.id,
            categoryId,
          })),
        });
      }
    });

    return this.toDto(await this.findOwnedOrThrow(userId, adId));
  }

  async submit(userId: string, adId: string): Promise<AdDto> {
    const existing = await this.findOwnedOrThrow(userId, adId);
    if (!EDITABLE_STATUSES.includes(existing.status as (typeof EDITABLE_STATUSES)[number])) {
      throw new ConflictException(`Ad cannot be submitted while in status ${existing.status}.`);
    }

    // Gate only: confirms the advertiser *can currently* afford the budget. Coins are not
    // reserved/debited here - actual spend deduction happens per-impression in the
    // AdServingService (docs/ARCHITECTURE.md section 4), which is phase 5, not built yet.
    const balance = await this.walletService.getBalanceCoins(userId);
    if (balance < existing.budgetTotalCoins) {
      throw new ConflictException(
        "Insufficient wallet balance for this ad's budget. Please top up your wallet before submitting.",
      );
    }

    const updated = await this.prisma.ad.update({
      where: { id: adId },
      data: { status: "PENDING_REVIEW", rejectionReason: null },
    });
    return this.toDto(updated);
  }

  async list(userId: string): Promise<AdDto[]> {
    const ads = await this.prisma.ad.findMany({
      where: { advertiserId: userId },
      orderBy: { createdAt: "desc" },
    });
    return ads.map((ad) => this.toDto(ad));
  }

  async stats(userId: string, adId: string): Promise<AdStatsResponse> {
    const ad = await this.findOwnedOrThrow(userId, adId);
    const [impressions, clicks] = await Promise.all([
      this.prisma.adImpression.count({ where: { adId } }),
      this.prisma.adClick.count({ where: { adId } }),
    ]);

    return {
      impressions,
      clicks,
      ctr: impressions > 0 ? clicks / impressions : 0,
      budgetSpentCoins: ad.budgetSpentCoins.toString(),
    };
  }

  private async findOwnedOrThrow(userId: string, adId: string): Promise<AdWithTargeting> {
    const ad = await this.prisma.ad.findUnique({
      where: { id: adId },
      include: { targeting: { include: { targetCategories: true, excludeCategories: true } } },
    });
    // Not-found and not-owned both return 404, so an advertiser can't probe for other users' ad ids.
    if (!ad || ad.advertiserId !== userId) {
      throw new NotFoundException("Ad not found");
    }
    return ad;
  }

  private toDto(ad: {
    id: string;
    placementType: string;
    title: string;
    bodyText: string;
    targetUrl: string;
    mediaUrl: string | null;
    mediaType: string;
    showAdvertiserAvatar: boolean;
    status: string;
    rejectionReason: string | null;
    dailyViewLimitPerUser: number;
    budgetTotalCoins: bigint;
    budgetSpentCoins: bigint;
    cpmCoins: bigint;
    createdAt: Date;
    updatedAt: Date;
  }): AdDto {
    return {
      id: ad.id,
      placementType: ad.placementType as AdDto["placementType"],
      title: ad.title,
      bodyText: ad.bodyText,
      targetUrl: ad.targetUrl,
      mediaUrl: ad.mediaUrl,
      mediaType: ad.mediaType as AdDto["mediaType"],
      showAdvertiserAvatar: ad.showAdvertiserAvatar,
      status: ad.status as AdDto["status"],
      rejectionReason: ad.rejectionReason,
      dailyViewLimitPerUser: ad.dailyViewLimitPerUser,
      budgetTotalCoins: ad.budgetTotalCoins.toString(),
      budgetSpentCoins: ad.budgetSpentCoins.toString(),
      cpmCoins: ad.cpmCoins.toString(),
      createdAt: ad.createdAt.toISOString(),
      updatedAt: ad.updatedAt.toISOString(),
    };
  }
}
