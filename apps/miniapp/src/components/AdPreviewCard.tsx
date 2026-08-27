// Simulated Telegram ad card (docs/PRD.md section 2.3 step 4: "پیش‌نمایش زنده... کارت Ad
// با دکمه «مشاهده» / View و گزینه Mute"). Not pixel-identical to a real Telegram ad unit -
// there is no public spec for that markup - just a close approximation for the wizard's
// live-preview step.
export interface AdPreviewData {
  title: string;
  bodyText: string;
  targetUrl: string;
  mediaUrl: string | null;
  mediaType: "IMAGE" | "VIDEO" | "NONE";
  showAdvertiserAvatar: boolean;
}

export function AdPreviewCard({ ad }: { ad: AdPreviewData }) {
  return (
    <div className="overflow-hidden rounded-xl border border-white/15 bg-white/5">
      <div className="flex items-center gap-2 border-b border-white/10 px-3 py-2">
        {ad.showAdvertiserAvatar && (
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-white/15 text-sm">
            📢
          </div>
        )}
        <span className="text-xs font-medium opacity-60">تبلیغ</span>
        <button type="button" className="ms-auto text-xs opacity-50" tabIndex={-1}>
          🔇 بی‌صدا
        </button>
      </div>

      {ad.mediaType === "IMAGE" && ad.mediaUrl && (
        <img src={ad.mediaUrl} alt="" className="max-h-48 w-full object-cover" />
      )}
      {ad.mediaType === "VIDEO" && ad.mediaUrl && (
        <video src={ad.mediaUrl} className="max-h-48 w-full object-cover" muted controls={false} />
      )}

      <div className="flex flex-col gap-1 px-3 py-3">
        <p className="font-semibold">{ad.title || "عنوان تبلیغ"}</p>
        <p className="whitespace-pre-wrap text-sm opacity-80">
          {ad.bodyText || "متن تبلیغ اینجا نمایش داده می‌شه..."}
        </p>
        <button
          type="button"
          tabIndex={-1}
          className="mt-2 self-start rounded-md bg-blue-600 px-4 py-1.5 text-sm font-medium text-white"
        >
          مشاهده
        </button>
      </div>
    </div>
  );
}
