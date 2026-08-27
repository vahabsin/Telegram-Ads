import { randomUUID } from "node:crypto";
import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { creditWalletInTx, debitWalletInTx, InsufficientBalanceError, type Prisma } from "@telegram-ads/database";
import type { AdDto, AdStatsResponse, CreateAdRequest, UpdateAdRequest } from "@telegram-ads/shared-types";
import { PrismaService } from "../prisma/prisma.service";

// Statuses an advertiser is still allowed to edit or submit from - once an ad has been
// submitted for review (or beyond), the wizard's PATCH /ads/:id is closed per
// docs/ARCHITECTURE.md section 5 ("ویرایش پیش از تأیید" - edit before approval).
const EDITABLE_STATUSES = ["DRAFT", "REJECTED"] as const;

// Statuses from which an advertiser can manually stop an ad and get the unspent remainder
// back (docs/DECISIONS.md ADR-013). Not DRAFT (nothing reserved yet) or terminal states.
const CANCELABLE_STATUSES = ["PENDING_REVIEW", "ACTIVE", "PAUSED"] as const;

type AdWithTargeting = Prisma.AdGetPayload<{
  include: {
    targeting: { include: { targetCategories: true; excludeCategories: true } };
  };
}>;

@Injectable()
export class AdService {
  constructor(private readonly prisma: PrismaService) {}

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

  // Reserves the ad's full budget out of the advertiser's wallet atomically alongside the
  // status change (docs/DECISIONS.md ADR-013) - not just a point-in-time balance check. If the
  // ad's budget is edited later (only possible from DRAFT/REJECTED, i.e. before/after a
  // reservation exists), the *new* budgetTotalCoins is what gets reserved on the next submit.
  async submit(userId: string, adId: string): Promise<AdDto> {
    const existing = await this.findOwnedOrThrow(userId, adId);
    if (!EDITABLE_STATUSES.includes(existing.status as (typeof EDITABLE_STATUSES)[number])) {
      throw new ConflictException(`Ad cannot be submitted while in status ${existing.status}.`);
    }

    try {
      const updated = await this.prisma.$transaction(async (tx) => {
        await debitWalletInTx(tx, {
          userId,
          amountCoins: existing.budgetTotalCoins,
          type: "AD_SPEND",
          paymentMethod: "INTERNAL",
          externalRef: adId,
          idempotencyKey: randomUUID(),
        });
        return tx.ad.update({
          where: { id: adId },
          data: { status: "PENDING_REVIEW", rejectionReason: null },
        });
      });
      return this.toDto(updated);
    } catch (error) {
      if (error instanceof InsufficientBalanceError) {
        throw new ConflictException(
          "Insufficient wallet balance for this ad's budget. Please top up your wallet before submitting.",
        );
      }
      throw error;
    }
  }

  // Advertiser-initiated stop (docs/PRD.md section 2.5 "توقف موقت" / manual stop). Refunds
  // whatever part of the reserved budget hasn't been spent yet (docs/DECISIONS.md ADR-013).
  async cancel(userId: string, adId: string): Promise<AdDto> {
    const existing = await this.findOwnedOrThrow(userId, adId);
    if (!CANCELABLE_STATUSES.includes(existing.status as (typeof CANCELABLE_STATUSES)[number])) {
      throw new ConflictException(`Ad cannot be canceled while in status ${existing.status}.`);
    }

    const updated = await this.refundRemainingAndClose(adId, userId, existing, "COMPLETED");
    return this.toDto(updated);
  }

  // Admin-only in intent (docs/ARCHITECTURE.md section 5's future POST /admin/ads/:id/reject),
  // but no AdminModule/admin auth exists yet (phase 6) - kept as a plain service method for now
  // so the refund behavior (docs/DECISIONS.md ADR-013) exists and is tested ahead of phase 6,
  // rather than blocking on admin auth to get the money-safety part right. Whoever builds the
  // admin controller in phase 6 should call this directly.
  async reject(adId: string, reason: string): Promise<AdDto> {
    const ad = await this.prisma.ad.findUnique({ where: { id: adId } });
    if (!ad) {
      throw new NotFoundException("Ad not found");
    }
    if (ad.status !== "PENDING_REVIEW") {
      throw new ConflictException(`Ad cannot be rejected while in status ${ad.status}.`);
    }

    const updated = await this.refundRemainingAndClose(adId, ad.advertiserId, ad, "REJECTED", reason);
    return this.toDto(updated);
  }

  // Shared refund-and-close step for both cancel() and reject(): credits back whatever part of
  // budgetTotalCoins hasn't been spent yet (0 for an ad that never left PENDING_REVIEW's queue
  // has spent nothing, so the full amount comes back; an ad stopped mid-flight only gets the
  // unspent remainder). Skips the wallet call entirely when remaining is 0 - creditWalletInTx
  // would otherwise reject a 0-coin credit as an invalid amount.
  private async refundRemainingAndClose(
    adId: string,
    advertiserId: string,
    ad: { budgetTotalCoins: bigint; budgetSpentCoins: bigint },
    nextStatus: "COMPLETED" | "REJECTED",
    rejectionReason?: string,
  ) {
    const remaining = ad.budgetTotalCoins - ad.budgetSpentCoins;
    return this.prisma.$transaction(async (tx) => {
      if (remaining > 0n) {
        await creditWalletInTx(tx, {
          userId: advertiserId,
          amountCoins: remaining,
          type: "REFUND",
          paymentMethod: "INTERNAL",
          externalRef: adId,
          idempotencyKey: randomUUID(),
        });
      }
      return tx.ad.update({
        where: { id: adId },
        data: { status: nextStatus, rejectionReason: rejectionReason ?? null },
      });
    });
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
