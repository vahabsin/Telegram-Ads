import { randomUUID } from "node:crypto";
import { Injectable, NotFoundException } from "@nestjs/common";
import { creditWalletInTx, type Prisma } from "@telegram-ads/database";
import type { ServeAdResponse, ServeClickResponse } from "@telegram-ads/shared-types";
import { PlatformSettingsService } from "../platform-settings/platform-settings.service";
import { PrismaService } from "../prisma/prisma.service";

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_PLATFORM_COMMISSION_PERCENT = 20; // docs/DECISIONS.md ADR-005

type AdCandidate = Prisma.AdGetPayload<{
  include: {
    targeting: { include: { targetCategories: true; excludeCategories: true } };
  };
}>;

type ChannelWithCategories = Prisma.ChannelGetPayload<{ include: { categories: true } }>;

const EMPTY_RESPONSE: ServeAdResponse = { impressionId: null, ad: null };

function normalizeHandle(handle: string): string {
  return handle.replace(/^@/, "").trim().toLowerCase();
}

@Injectable()
export class ServeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly platformSettings: PlatformSettingsService,
  ) {}

  // Selects and "shows" the best-matching ad for a channel, per docs/ARCHITECTURE.md section 4:
  // eligibility filters -> highest-CPM-wins -> atomic budget deduction + AdImpression +
  // publisher earning -> flip to OUT_OF_BUDGET if that was the last of the budget. Returns
  // { impressionId: null, ad: null } when the channel or nothing qualifies - never an error,
  // since "no ad to show right now" is an expected, routine outcome for a caller.
  async serveAd(channelId: string, viewerTelegramId: number): Promise<ServeAdResponse> {
    const channel = await this.prisma.channel.findUnique({
      where: { id: channelId },
      include: { categories: true },
    });
    if (!channel || !channel.isActive || channel.verificationStatus !== "VERIFIED") {
      return EMPTY_RESPONSE;
    }

    const candidates = await this.prisma.ad.findMany({
      where: { status: "ACTIVE", cpmCoins: { gte: channel.minAcceptedCpm } },
      include: { targeting: { include: { targetCategories: true, excludeCategories: true } } },
    });

    const viewerId = BigInt(viewerTelegramId);
    const since = new Date(Date.now() - DAY_MS);
    const eligible: AdCandidate[] = [];
    for (const ad of candidates) {
      if (ad.budgetSpentCoins >= ad.budgetTotalCoins) continue;
      if (!this.matchesTargeting(ad, channel)) continue;

      const impressionsToday = await this.prisma.adImpression.count({
        where: { adId: ad.id, viewerTelegramId: viewerId, createdAt: { gte: since } },
      });
      if (impressionsToday >= ad.dailyViewLimitPerUser) continue;

      eligible.push(ad);
    }

    if (eligible.length === 0) {
      return EMPTY_RESPONSE;
    }

    // Simple highest-CPM-wins auction (docs/ARCHITECTURE.md section 4 step 6) - a
    // weighted-random upgrade is explicitly deferred there, not this phase's job.
    eligible.sort((a, b) => (b.cpmCoins > a.cpmCoins ? 1 : b.cpmCoins < a.cpmCoins ? -1 : 0));
    const winner = eligible[0]!;
    const costCoins = winner.cpmCoins / 1000n; // safe: cpmCoins >= 1000 is enforced at ad creation (ADR-014)

    return this.recordImpression(winner, channel, costCoins, viewerId);
  }

  async recordClick(impressionId: string): Promise<ServeClickResponse> {
    const impression = await this.prisma.adImpression.findUnique({ where: { id: impressionId } });
    if (!impression) {
      throw new NotFoundException("Impression not found");
    }

    // Best-effort de-dup, not a hard uniqueness constraint (docs/DECISIONS.md ADR-015): clicks
    // carry no payment (only impressions do, per docs/ARCHITECTURE.md section 4), so a rare
    // double-count here only skews CTR slightly rather than causing any money-safety issue.
    const existing = await this.prisma.adClick.findFirst({ where: { impressionId } });
    if (existing) {
      return { ok: true, alreadyRecorded: true };
    }

    await this.prisma.adClick.create({
      data: { impressionId, adId: impression.adId, viewerTelegramId: impression.viewerTelegramId },
    });
    return { ok: true, alreadyRecorded: false };
  }

  private matchesTargeting(ad: AdCandidate, channel: ChannelWithCategories): boolean {
    const targeting = ad.targeting;
    if (!targeting) return true; // create() always makes one; defensive default is "no restriction"

    const channelHandle = channel.username ? normalizeHandle(channel.username) : null;

    if (targeting.targetLanguages.length > 0) {
      if (!channel.languageCode || !targeting.targetLanguages.includes(channel.languageCode)) {
        return false;
      }
    }

    if (targeting.targetChannelHandles.length > 0) {
      const targets = targeting.targetChannelHandles.map(normalizeHandle);
      if (!channelHandle || !targets.includes(channelHandle)) {
        return false;
      }
    }
    if (channelHandle && targeting.excludeChannelHandles.map(normalizeHandle).includes(channelHandle)) {
      return false;
    }

    const channelCategoryIds = channel.categories.map((c) => c.categoryId);
    const targetCategoryIds = targeting.targetCategories.map((c) => c.categoryId);
    if (targetCategoryIds.length > 0 && !targetCategoryIds.some((id) => channelCategoryIds.includes(id))) {
      return false;
    }
    const excludeCategoryIds = targeting.excludeCategories.map((c) => c.categoryId);
    if (excludeCategoryIds.some((id) => channelCategoryIds.includes(id))) {
      return false;
    }

    // excludedCountries (docs/ARCHITECTURE.md section 4 step 3) needs the viewer's country,
    // which isn't available from Telegram context passed into this call yet - out of scope for
    // this phase, not silently dropped: see docs/DECISIONS.md ADR-015 and TODO.md.

    return true;
  }

  private async recordImpression(
    winner: AdCandidate,
    channel: { id: string; ownerId: string },
    costCoins: bigint,
    viewerId: bigint,
  ): Promise<ServeAdResponse> {
    const commissionPercent = await this.platformSettings.getNumber(
      "platformCommissionPercent",
      DEFAULT_PLATFORM_COMMISSION_PERCENT,
    );

    return this.prisma.$transaction(async (tx) => {
      // Atomic conditional increment, same pattern as the wallet debit guard (packages/database/
      // src/wallet.ts): the WHERE is evaluated against the live row under the lock the UPDATE
      // takes, so two concurrent requests can't both push budgetSpentCoins past budgetTotalCoins
      // (docs/ARCHITECTURE.md section 4's explicit race-condition requirement).
      const reserved = await tx.ad.updateMany({
        where: {
          id: winner.id,
          status: "ACTIVE",
          budgetSpentCoins: { lte: winner.budgetTotalCoins - costCoins },
        },
        data: { budgetSpentCoins: { increment: costCoins } },
      });
      if (reserved.count === 0) {
        // Lost the race: another concurrent impression already used up the remaining budget.
        return EMPTY_RESPONSE;
      }

      const impression = await tx.adImpression.create({
        data: { adId: winner.id, channelId: channel.id, viewerTelegramId: viewerId, costCoins },
      });

      const publisherShare = (costCoins * BigInt(100 - commissionPercent)) / 100n;
      if (publisherShare > 0n) {
        await creditWalletInTx(tx, {
          userId: channel.ownerId,
          amountCoins: publisherShare,
          type: "PUBLISHER_EARNING",
          paymentMethod: "INTERNAL",
          externalRef: impression.id,
          idempotencyKey: randomUUID(),
        });
      }

      const refreshed = await tx.ad.findUniqueOrThrow({ where: { id: winner.id } });
      if (refreshed.budgetSpentCoins >= refreshed.budgetTotalCoins) {
        await tx.ad.update({ where: { id: winner.id }, data: { status: "OUT_OF_BUDGET" } });
        // TODO(phase 2/5 integration gap): notify the advertiser via the bot - apps/api has no
        // push channel into apps/bot yet, only apps/bot polls Telegram. See TODO.md.
      }

      return {
        impressionId: impression.id,
        ad: {
          id: winner.id,
          title: winner.title,
          bodyText: winner.bodyText,
          targetUrl: winner.targetUrl,
          mediaUrl: winner.mediaUrl,
          mediaType: winner.mediaType,
          showAdvertiserAvatar: winner.showAdvertiserAvatar,
        },
      };
    });
  }
}
