import { useEffect, useState, type ChangeEvent } from "react";
import type { AdPlacementType, CategoryDto } from "@telegram-ads/shared-types";
import { createAd, listCategories, submitAd, uploadFile } from "../api";
import { useAuth } from "../AuthContext";
import { AdPreviewCard } from "../components/AdPreviewCard";

// 5-step wizard per docs/PRD.md section 2.3.
const STEPS = ["placement", "title", "targeting", "creative", "budget"] as const;
type Step = (typeof STEPS)[number];

const STEP_LABELS: Record<Step, string> = {
  placement: "هدف‌گیری",
  title: "عنوان",
  targeting: "تارگتینگ",
  creative: "محتوا",
  budget: "بودجه",
};

const LANGUAGE_OPTIONS: { code: string; label: string }[] = [
  { code: "fa", label: "فارسی" },
  { code: "en", label: "English" },
  { code: "ar", label: "العربية" },
];

const VIEW_LIMIT_OPTIONS = [1, 2, 3, 4];
const BUDGET_PERCENT_OPTIONS = [25, 50, 75, 100];

interface WizardState {
  placementType: AdPlacementType;
  title: string;
  targetLanguages: string[];
  targetCategoryIds: string[];
  targetChannelHandles: string[];
  excludeCategoryIds: string[];
  excludeChannelHandles: string[];
  bodyText: string;
  targetUrl: string;
  showAdvertiserAvatar: boolean;
  mediaUrl: string | undefined;
  mediaType: "IMAGE" | "VIDEO" | "NONE";
  initialStatus: "ACTIVE" | "PAUSED";
  dailyViewLimitPerUser: number;
  budgetTotalCoins: number;
  cpmCoins: number;
  acceptedTerms: boolean;
}

const INITIAL_STATE: WizardState = {
  placementType: "CHANNELS",
  title: "",
  targetLanguages: [],
  targetCategoryIds: [],
  targetChannelHandles: [],
  excludeCategoryIds: [],
  excludeChannelHandles: [],
  bodyText: "",
  targetUrl: "",
  showAdvertiserAvatar: false,
  mediaUrl: undefined,
  mediaType: "NONE",
  initialStatus: "ACTIVE",
  dailyViewLimitPerUser: 2,
  budgetTotalCoins: 0,
  cpmCoins: 0,
  acceptedTerms: false,
};

function toggleInArray(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}

function ChipList({
  values,
  onRemove,
}: {
  values: string[];
  onRemove: (index: number) => void;
}) {
  if (values.length === 0) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {values.map((value, index) => (
        <span
          key={`${value}-${index}`}
          className="flex items-center gap-1 rounded-full bg-white/10 px-2 py-1 text-xs"
        >
          {value}
          <button type="button" onClick={() => onRemove(index)}>
            ×
          </button>
        </span>
      ))}
    </div>
  );
}

export function AdWizard({ onDone }: { onDone: () => void }) {
  const { user } = useAuth();
  const balance = Number(user?.wallet.balanceCoins ?? "0");
  const [stepIndex, setStepIndex] = useState(0);
  const [form, setForm] = useState<WizardState>(INITIAL_STATE);
  const [categories, setCategories] = useState<CategoryDto[]>([]);
  const [channelHandleInput, setChannelHandleInput] = useState("");
  const [excludeChannelHandleInput, setExcludeChannelHandleInput] = useState("");
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    listCategories()
      .then((result) => setCategories(result.categories))
      .catch(() => setCategories([]));
  }, []);

  const step: Step = STEPS[stepIndex] ?? "placement";

  function update<K extends keyof WizardState>(key: K, value: WizardState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function canGoNext(): boolean {
    switch (step) {
      case "placement":
        return true;
      case "title":
        return form.title.trim().length > 0;
      case "targeting":
        return true;
      case "creative":
        return form.bodyText.trim().length > 0 && form.targetUrl.trim().length > 0;
      case "budget":
        return false;
    }
  }

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setErrorMessage(null);
    try {
      const result = await uploadFile(file);
      update("mediaUrl", result.url);
      update("mediaType", result.mediaType);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "خطا در آپلود فایل");
    } finally {
      setUploading(false);
    }
  }

  async function handleFinalSubmit() {
    setSubmitting(true);
    setErrorMessage(null);
    try {
      const ad = await createAd({
        placementType: form.placementType,
        title: form.title,
        targetLanguages: form.targetLanguages,
        targetCategoryIds: form.targetCategoryIds,
        targetChannelHandles: form.targetChannelHandles,
        excludeCategoryIds: form.excludeCategoryIds,
        excludeChannelHandles: form.excludeChannelHandles,
        bodyText: form.bodyText,
        targetUrl: form.targetUrl,
        showAdvertiserAvatar: form.showAdvertiserAvatar,
        mediaUrl: form.mediaUrl,
        mediaType: form.mediaType,
        initialStatus: form.initialStatus,
        dailyViewLimitPerUser: form.dailyViewLimitPerUser,
        budgetTotalCoins: form.budgetTotalCoins,
        cpmCoins: form.cpmCoins,
        acceptedTerms: true,
      });
      await submitAd(ad.id);
      onDone();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "خطا در ثبت تبلیغ. تبلیغ به‌صورت پیش‌نویس ذخیره شد؛ می‌تونید بعداً از «تبلیغ‌های من» دوباره ارسالش کنید.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  const insufficientBalance = form.budgetTotalCoins > 0 && form.budgetTotalCoins > balance;

  return (
    <div className="flex flex-col gap-4 px-4 py-6">
      <div className="flex items-center justify-between text-xs opacity-60">
        {STEPS.map((s, index) => (
          <span
            key={s}
            className={index === stepIndex ? "font-semibold opacity-100" : undefined}
          >
            {STEP_LABELS[s]}
          </span>
        ))}
      </div>

      {step === "placement" && (
        <section className="flex flex-col gap-3">
          <h2 className="font-semibold">محل نمایش تبلیغ رو انتخاب کنید</h2>
          <div className="grid grid-cols-2 gap-2">
            {(["CHANNELS", "BOTS"] as const).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => update("placementType", type)}
                className={`rounded-lg border px-4 py-3 text-sm font-medium ${
                  form.placementType === type ? "border-blue-500 bg-blue-600/20" : "border-white/15"
                }`}
              >
                {type === "CHANNELS" ? "کانال‌ها" : "ربات‌ها"}
              </button>
            ))}
          </div>
        </section>
      )}

      {step === "title" && (
        <section className="flex flex-col gap-3">
          <h2 className="font-semibold">عنوان تبلیغ</h2>
          <input
            type="text"
            value={form.title}
            onChange={(event) => update("title", event.target.value)}
            placeholder="مثلاً: فروش ویژه پاییزی"
            maxLength={120}
            className="rounded-lg border border-white/20 bg-transparent px-3 py-2"
          />
        </section>
      )}

      {step === "targeting" && (
        <section className="flex flex-col gap-4">
          <h2 className="font-semibold">هدف‌گیری (اختیاری)</h2>

          <div>
            <p className="mb-2 text-sm opacity-70">زبان کانال‌های هدف</p>
            <div className="flex flex-wrap gap-2">
              {LANGUAGE_OPTIONS.map((lang) => (
                <button
                  key={lang.code}
                  type="button"
                  onClick={() => update("targetLanguages", toggleInArray(form.targetLanguages, lang.code))}
                  className={`rounded-full border px-3 py-1 text-xs ${
                    form.targetLanguages.includes(lang.code)
                      ? "border-blue-500 bg-blue-600/20"
                      : "border-white/15"
                  }`}
                >
                  {lang.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2 text-sm opacity-70">دسته‌بندی‌های هدف</p>
            <div className="flex flex-wrap gap-2">
              {categories.map((category) => (
                <button
                  key={category.id}
                  type="button"
                  onClick={() =>
                    update("targetCategoryIds", toggleInArray(form.targetCategoryIds, category.id))
                  }
                  className={`rounded-full border px-3 py-1 text-xs ${
                    form.targetCategoryIds.includes(category.id)
                      ? "border-blue-500 bg-blue-600/20"
                      : "border-white/15"
                  }`}
                >
                  {category.nameFa}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2 text-sm opacity-70">کانال‌های هدف خاص (یوزرنیم)</p>
            <div className="flex gap-2">
              <input
                type="text"
                value={channelHandleInput}
                onChange={(event) => setChannelHandleInput(event.target.value)}
                placeholder="@channel"
                className="flex-1 rounded-lg border border-white/20 bg-transparent px-3 py-2 text-sm"
              />
              <button
                type="button"
                onClick={() => {
                  const value = channelHandleInput.trim();
                  if (value) {
                    update("targetChannelHandles", [...form.targetChannelHandles, value]);
                    setChannelHandleInput("");
                  }
                }}
                className="rounded-lg border border-white/20 px-3 text-sm"
              >
                افزودن
              </button>
            </div>
            <ChipList
              values={form.targetChannelHandles}
              onRemove={(index) =>
                update(
                  "targetChannelHandles",
                  form.targetChannelHandles.filter((_, i) => i !== index),
                )
              }
            />
          </div>

          <div>
            <p className="mb-2 text-sm opacity-70">دسته‌بندی‌های مستثنا</p>
            <div className="flex flex-wrap gap-2">
              {categories.map((category) => (
                <button
                  key={category.id}
                  type="button"
                  onClick={() =>
                    update("excludeCategoryIds", toggleInArray(form.excludeCategoryIds, category.id))
                  }
                  className={`rounded-full border px-3 py-1 text-xs ${
                    form.excludeCategoryIds.includes(category.id)
                      ? "border-red-500 bg-red-600/20"
                      : "border-white/15"
                  }`}
                >
                  {category.nameFa}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2 text-sm opacity-70">کانال‌های مستثنا (یوزرنیم)</p>
            <div className="flex gap-2">
              <input
                type="text"
                value={excludeChannelHandleInput}
                onChange={(event) => setExcludeChannelHandleInput(event.target.value)}
                placeholder="@channel"
                className="flex-1 rounded-lg border border-white/20 bg-transparent px-3 py-2 text-sm"
              />
              <button
                type="button"
                onClick={() => {
                  const value = excludeChannelHandleInput.trim();
                  if (value) {
                    update("excludeChannelHandles", [...form.excludeChannelHandles, value]);
                    setExcludeChannelHandleInput("");
                  }
                }}
                className="rounded-lg border border-white/20 px-3 text-sm"
              >
                افزودن
              </button>
            </div>
            <ChipList
              values={form.excludeChannelHandles}
              onRemove={(index) =>
                update(
                  "excludeChannelHandles",
                  form.excludeChannelHandles.filter((_, i) => i !== index),
                )
              }
            />
          </div>
        </section>
      )}

      {step === "creative" && (
        <section className="flex flex-col gap-4">
          <h2 className="font-semibold">محتوای تبلیغ</h2>
          <textarea
            value={form.bodyText}
            onChange={(event) => update("bodyText", event.target.value)}
            placeholder="متن تبلیغ..."
            rows={4}
            maxLength={2000}
            className="rounded-lg border border-white/20 bg-transparent px-3 py-2 text-sm"
          />
          <input
            type="url"
            value={form.targetUrl}
            onChange={(event) => update("targetUrl", event.target.value)}
            placeholder="https://t.me/..."
            className="rounded-lg border border-white/20 bg-transparent px-3 py-2 text-sm"
          />
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.showAdvertiserAvatar}
              onChange={(event) => update("showAdvertiserAvatar", event.target.checked)}
            />
            نمایش عکس پروفایل در آگهی
          </label>
          <div>
            <input
              type="file"
              accept="image/*,video/*"
              onChange={(event) => void handleFileChange(event)}
              disabled={uploading}
            />
            {uploading && <p className="mt-1 text-xs opacity-60">در حال آپلود...</p>}
          </div>
          <div>
            <p className="mb-2 text-sm opacity-70">پیش‌نمایش زنده</p>
            <AdPreviewCard
              ad={{
                title: form.title,
                bodyText: form.bodyText,
                targetUrl: form.targetUrl,
                mediaUrl: form.mediaUrl ?? null,
                mediaType: form.mediaType,
                showAdvertiserAvatar: form.showAdvertiserAvatar,
              }}
            />
          </div>
        </section>
      )}

      {step === "budget" && (
        <section className="flex flex-col gap-4">
          <h2 className="font-semibold">بودجه و نرخ</h2>

          <div>
            <p className="mb-2 text-sm opacity-70">وضعیت اولیه پس از تأیید</p>
            <div className="grid grid-cols-2 gap-2">
              {(["ACTIVE", "PAUSED"] as const).map((choice) => (
                <button
                  key={choice}
                  type="button"
                  onClick={() => update("initialStatus", choice)}
                  className={`rounded-lg border px-3 py-2 text-sm ${
                    form.initialStatus === choice ? "border-blue-500 bg-blue-600/20" : "border-white/15"
                  }`}
                >
                  {choice === "ACTIVE" ? "فعال" : "تعلیق"}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2 text-sm opacity-70">محدودیت بازدید روزانه هر کاربر</p>
            <div className="grid grid-cols-4 gap-2">
              {VIEW_LIMIT_OPTIONS.map((limit) => (
                <button
                  key={limit}
                  type="button"
                  onClick={() => update("dailyViewLimitPerUser", limit)}
                  className={`rounded-lg border px-2 py-2 text-sm ${
                    form.dailyViewLimitPerUser === limit ? "border-blue-500 bg-blue-600/20" : "border-white/15"
                  }`}
                >
                  {limit}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between text-sm opacity-70">
              <span>بودجه کل (سکه)</span>
              <span>موجودی: 🪙 {balance.toLocaleString("fa-IR")}</span>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {BUDGET_PERCENT_OPTIONS.map((percent) => (
                <button
                  key={percent}
                  type="button"
                  onClick={() => update("budgetTotalCoins", Math.floor((balance * percent) / 100))}
                  className="rounded-lg border border-white/15 px-2 py-2 text-xs"
                >
                  {percent}٪
                </button>
              ))}
            </div>
            <input
              type="number"
              min={1}
              value={form.budgetTotalCoins || ""}
              onChange={(event) => update("budgetTotalCoins", Number(event.target.value))}
              className="mt-2 w-full rounded-lg border border-white/20 bg-transparent px-3 py-2"
            />
            {insufficientBalance && (
              <p className="mt-1 text-xs text-red-400">
                موجودی کافی نیست. لطفاً ابتدا کیف پول خودتون رو شارژ کنید.
              </p>
            )}
          </div>

          <div>
            <p className="mb-2 text-sm opacity-70">CPM (هزینه هزار نمایش)</p>
            <input
              type="number"
              min={1}
              value={form.cpmCoins || ""}
              onChange={(event) => update("cpmCoins", Number(event.target.value))}
              className="w-full rounded-lg border border-white/20 bg-transparent px-3 py-2"
            />
            <p className="mt-1 text-xs opacity-50">CPM بالاتر یعنی اولویت نمایش بیشتر.</p>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.acceptedTerms}
              onChange={(event) => update("acceptedTerms", event.target.checked)}
            />
            قوانین استفاده از پلتفرم رو می‌پذیرم
          </label>

          {errorMessage && <p className="text-sm text-red-400">{errorMessage}</p>}

          <button
            type="button"
            disabled={
              submitting ||
              !form.acceptedTerms ||
              form.budgetTotalCoins <= 0 ||
              form.cpmCoins <= 0 ||
              insufficientBalance
            }
            onClick={() => void handleFinalSubmit()}
            className="w-full rounded-lg bg-blue-600 px-4 py-3 font-medium text-white disabled:opacity-40"
          >
            {submitting ? "در حال ارسال..." : "ایجاد تبلیغ"}
          </button>
        </section>
      )}

      <div className="mt-2 flex justify-between">
        <button
          type="button"
          onClick={() => (stepIndex === 0 ? onDone() : setStepIndex((i) => i - 1))}
          className="rounded-lg border border-white/20 px-4 py-2 text-sm"
        >
          {stepIndex === 0 ? "انصراف" : "قبلی"}
        </button>
        {step !== "budget" && (
          <button
            type="button"
            disabled={!canGoNext()}
            onClick={() => setStepIndex((i) => i + 1)}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
          >
            بعدی
          </button>
        )}
      </div>
    </div>
  );
}
