import { useEffect, useState } from "react";
import type { AdDto, AdStatsResponse, AdStatus } from "@telegram-ads/shared-types";
import { getAdStats, listAds, submitAd } from "../api";

const STATUS_LABELS: Record<AdStatus, string> = {
  DRAFT: "پیش‌نویس",
  PENDING_REVIEW: "در انتظار تأیید",
  ACTIVE: "فعال",
  PAUSED: "تعلیق‌شده",
  REJECTED: "رد شده",
  COMPLETED: "پایان‌یافته",
  OUT_OF_BUDGET: "پایان بودجه",
};

export function MyAds({ onCreateNew }: { onCreateNew: () => void }) {
  const [ads, setAds] = useState<AdDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedAdId, setExpandedAdId] = useState<string | null>(null);
  const [stats, setStats] = useState<Record<string, AdStatsResponse>>({});
  const [busyAdId, setBusyAdId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    try {
      const result = await listAds();
      setAds(result.ads);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function toggleStats(adId: string) {
    if (expandedAdId === adId) {
      setExpandedAdId(null);
      return;
    }
    setExpandedAdId(adId);
    if (!stats[adId]) {
      const result = await getAdStats(adId);
      setStats((prev) => ({ ...prev, [adId]: result }));
    }
  }

  async function handleSubmit(adId: string) {
    setBusyAdId(adId);
    setErrorMessage(null);
    try {
      await submitAd(adId);
      await refresh();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "خطا در ارسال تبلیغ برای بازبینی");
    } finally {
      setBusyAdId(null);
    }
  }

  if (loading) {
    return <div className="p-6 text-center opacity-70">در حال بارگذاری...</div>;
  }

  return (
    <div className="flex flex-col gap-4 px-4 py-6">
      <div className="flex items-center justify-between">
        <h1 className="font-semibold">تبلیغ‌های من</h1>
        <button
          type="button"
          onClick={onCreateNew}
          className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white"
        >
          + تبلیغ جدید
        </button>
      </div>

      {errorMessage && <p className="text-sm text-red-400">{errorMessage}</p>}

      {ads.length === 0 ? (
        <p className="py-10 text-center text-sm opacity-60">هنوز تبلیغی ثبت نکردید.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {ads.map((ad) => (
            <li key={ad.id} className="rounded-lg border border-white/10 p-3">
              <button
                type="button"
                onClick={() => void toggleStats(ad.id)}
                className="flex w-full items-center justify-between text-start"
              >
                <span className="font-medium">{ad.title}</span>
                <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs">
                  {STATUS_LABELS[ad.status]}
                </span>
              </button>

              {expandedAdId === ad.id && (
                <div className="mt-3 flex flex-col gap-2 border-t border-white/10 pt-3 text-sm">
                  <div className="flex justify-between opacity-80">
                    <span>بودجه کل</span>
                    <span>🪙 {Number(ad.budgetTotalCoins).toLocaleString("fa-IR")}</span>
                  </div>
                  <div className="flex justify-between opacity-80">
                    <span>هزینه‌شده</span>
                    <span>🪙 {Number(ad.budgetSpentCoins).toLocaleString("fa-IR")}</span>
                  </div>
                  <div className="flex justify-between opacity-80">
                    <span>CPM</span>
                    <span>🪙 {Number(ad.cpmCoins).toLocaleString("fa-IR")}</span>
                  </div>
                  {stats[ad.id] && (
                    <>
                      <div className="flex justify-between opacity-80">
                        <span>نمایش‌ها</span>
                        <span>{stats[ad.id]!.impressions.toLocaleString("fa-IR")}</span>
                      </div>
                      <div className="flex justify-between opacity-80">
                        <span>کلیک‌ها</span>
                        <span>{stats[ad.id]!.clicks.toLocaleString("fa-IR")}</span>
                      </div>
                      <div className="flex justify-between opacity-80">
                        <span>CTR</span>
                        <span>{(stats[ad.id]!.ctr * 100).toFixed(1)}٪</span>
                      </div>
                    </>
                  )}
                  {ad.rejectionReason && (
                    <p className="text-xs text-red-400">دلیل رد: {ad.rejectionReason}</p>
                  )}
                  {ad.status === "DRAFT" && (
                    <button
                      type="button"
                      disabled={busyAdId === ad.id}
                      onClick={() => void handleSubmit(ad.id)}
                      className="mt-1 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
                    >
                      {busyAdId === ad.id ? "در حال ارسال..." : "ارسال برای بازبینی"}
                    </button>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
