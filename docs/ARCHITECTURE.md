# ARCHITECTURE — معماری فنی

## ۱. استک فنی (تصمیم نهایی)

| لایه | انتخاب | دلیل |
|---|---|---|
| زبان | TypeScript (همه‌جا) | تایپ مشترک بین بک‌اند/ربات/فرانت، یک زبان برای کل مانوریپو |
| Backend API | NestJS (Node.js) | معماری ماژولار، DI، مناسب پروژه‌ی بزرگ با تیم تنها (agent) |
| ربات تلگرام | grammY | مدرن، TypeScript-first، پشتیبانی خوب از WebApp/Stars |
| ORM / دیتابیس | Prisma + PostgreSQL | type-safety، migration ساده، مناسب داده‌ی رابطه‌ای مالی |
| کش/صف | Redis + BullMQ | rate limiting، صف پردازش impression/click، cache targeting |
| Mini App | React + Vite + TypeScript + Tailwind | سبک، سریع، سازگار با Telegram WebApp SDK |
| پنل ادمین | React + Vite + TypeScript + Tailwind + shadcn/ui | جدا از Mini App، بدون محدودیت‌های WebApp |
| احراز هویت Mini App | اعتبارسنجی `initData` تلگرام (HMAC-SHA256) + JWT session | استاندارد رسمی تلگرام |
| احراز هویت ادمین | ایمیل/پسورد + 2FA (TOTP) | پنل ادمین جدا از اکوسیستم تلگرام است |
| صف پرداخت ریالی | IDPay (یا NextPay مشابه، طبق تصمیم کاربر) | API ساده، مناسب MVP ایرانی |
| پرداخت Stars | Telegram Bot API (`sendInvoice` با currency=XTR) | رسمی و بدون نیاز به PSP جدا |
| پرداخت کریپتو | TronWeb/TronGrid + آدرس اختصاصی HD wallet به‌ازای هر کاربر یا watch-only + memo | ساده‌ترین مسیر برای USDT TRC-20 |
| کانتینر | Docker + docker-compose | یکسان‌سازی dev/prod |
| CI/CD | GitHub Actions | build, lint, test, و در صورت تأیید، دیپلوی به VPS از طریق SSH+docker compose |
| Reverse proxy / SSL | Caddy | SSL خودکار، کانفیگ ساده‌تر از Nginx برای شروع سریع |
| هاست پیشنهادی برای شروع | یک VPS ساده (مثلاً Hetzner CX22 یا مشابه) با Docker Compose | کم‌هزینه، سریع بالا میاد، بعداً قابل مهاجرت به K8s در صورت رشد |

> **یادداشت تصمیم:** انتخاب نهایی درگاه ریالی (IDPay/NextPay/زرین‌پال) باید در فاز پرداخت با کاربر با نمونه کلید API واقعی تست بشه؛ کد باید طوری طراحی بشه (اینترفیس `PaymentGateway`) که تعویض درگاه فقط نیازمند یک adapter جدید باشه، نه تغییر منطق اصلی.

## ۲. ساختار مانوریپو

```
apps/api/        -> NestJS: REST API + WebSocket gateway (آمار زنده)
apps/bot/        -> grammY bot: /start, منوها, wizard ساخت تبلیغ (mini app entrypoint), وبهوک پرداخت Stars
apps/miniapp/    -> React WebApp: داشبورد, ساخت تبلیغ, کیف پول, پروفایل
apps/admin/      -> React: پنل مدیریت
packages/database/     -> Prisma schema + migrations + generated client
packages/shared-types/ -> DTOها, enum ها, Zod schema های اعتبارسنجی مشترک
packages/config/       -> بارگذاری و اعتبارسنجی env با zod
```

هر اپ داکرفایل مخصوص خودش رو داره؛ `docker-compose.yml` همه رو + Postgres + Redis + Caddy کنار هم بالا میاره.

## ۳. اسکیمای دیتابیس (خلاصه — جزئیات کامل در Prisma schema)

### `User`
`id, telegramId (unique), username, firstName, languageCode (fa/en/ar), role (USER/ADVERTISER/PUBLISHER/ADMIN — یک کاربر می‌تونه هم advertiser هم publisher باشه، پس role به‌صورت boolean flag بهتره: isAdvertiser, isPublisher, isBanned), createdAt`

### `Wallet`
`id, userId (FK unique), balanceCoins (Decimal/BigInt — هرگز float), createdAt, updatedAt`

### `WalletTransaction`
`id, walletId, type (DEPOSIT/WITHDRAW/AD_SPEND/PUBLISHER_EARNING/REFUND), amountCoins, status (PENDING/COMPLETED/FAILED), paymentMethod (RIAL/STARS/CRYPTO_TRC20/INTERNAL), externalRef (شناسه تراکنش درگاه/بلاکچین), idempotencyKey (unique), createdAt`

### `Category`
`id, slug, nameFa, nameEn, nameAr, parentId (nullable برای زیردسته)`

### `Channel` (فضای تبلیغاتی ناشر — کانال یا ربات)
`id, ownerId (FK User), telegramChatId, username, type (CHANNEL/BOT), title, subscriberCount, languageCode, minAcceptedCpm, verificationStatus (PENDING/VERIFIED/REJECTED), isActive, createdAt`

### `ChannelCategory` (many-to-many)
`channelId, categoryId`

### `Ad`
`id, advertiserId (FK User), placementType (CHANNELS/BOTS/SEARCH/USERS), title, bodyText (markdown), targetUrl, mediaUrl, mediaType (IMAGE/VIDEO/NONE), showAdvertiserAvatar (bool), status (DRAFT/PENDING_REVIEW/ACTIVE/PAUSED/REJECTED/COMPLETED/OUT_OF_BUDGET), rejectionReason, dailyViewLimitPerUser (int), budgetTotalCoins, budgetSpentCoins, cpmCoins, createdAt, updatedAt`

### `AdTargeting`
`id, adId (FK unique), targetLanguages (string[]), targetCategoryIds (relation), targetChannelIds (relation یا رشته‌ی لینک‌های وارد‌شده), excludeCategoryIds (relation), excludeChannelIds (relation), excludedCountries (string[])`

### `AdImpression`
`id, adId, channelId (nullable اگر placement=SEARCH/USERS), viewerTelegramId, costCoins, createdAt` — ایندکس روی `(adId, viewerTelegramId, createdAt)` برای اعمال `dailyViewLimitPerUser`

### `AdClick`
`id, impressionId (FK), adId, viewerTelegramId, createdAt`

### `PayoutRequest`
`id, publisherId (FK User), amountCoins, method (RIAL/STARS/CRYPTO_TRC20), destination (شماره کارت/آدرس ولت/...), status (PENDING/APPROVED/REJECTED/PAID), adminNote, createdAt`

### `AdminUser`
`id, email, passwordHash, totpSecret, role (SUPERADMIN/MODERATOR/FINANCE), createdAt`

### `AuditLog`
`id, actorType (ADMIN/SYSTEM), actorId, action, targetType, targetId, metadata (jsonb), createdAt`

### `PlatformSetting` (key-value برای تنظیمات قابل‌تغییر بدون دیپلوی)
`key (unique), value (jsonb)` — مثال کلیدها: `coinToTomanRate`, `platformCommissionPercent`, `minCpm`, `maxCpm`, `restrictedCountries`, `minPayoutAmount`

> تمام مبالغ به‌صورت عدد صحیح "سکه" (Integer/BigInt) ذخیره می‌شن، هرگز float. تبدیل به ریال/تومان فقط در لایه نمایش UI با نرخ ذخیره‌شده در `PlatformSetting` انجام می‌شه.

## ۴. موتور نمایش تبلیغ (Ad Serving Engine) — منطق هسته‌ای

### ۴.۱ رزرو و آزادسازی بودجه (Budget Reservation)

**این بخش پیش‌نیاز موتور نمایشه و در فاز ۴ (نه فاز ۵) پیاده و تست شد — چون بدون یک قانون قطعی برای «بودجه‌ی موجود»، موتور نمایش نمی‌تونه با خیال راحت روی budget حساب باز کنه.** (`docs/DECISIONS.md` ADR-013)

قانون: **submit = رزرو واقعی، نه فقط چک موجودی.**

- **رزرو (`AdService.submit`):** وقتی تبلیغی از `DRAFT`/`REJECTED` به `PENDING_REVIEW` می‌ره، `budgetTotalCoins` آن **فوراً و به‌صورت atomic** (یک Prisma transaction) از `Wallet.balanceCoins` تبلیغ‌دهنده کسر می‌شه و یک `WalletTransaction` نوع `AD_SPEND` با `externalRef = adId` ثبت می‌شه. اگر موجودی کافی نباشه، کل تراکنش rollback می‌شه و خطای ۴۰۹ برگردونده می‌شه — نه فقط یک هشدار قبل از تغییر status. از این لحظه به بعد، این مبلغ دیگه جزو `balanceCoins` قابل‌خرج نیست؛ آدرس واقعی‌اش `Ad.budgetTotalCoins` همون تبلیغه (نیازی به یک ستون جدید مثل `reservedBalance` روی `Wallet` نبود، چون `Ad.budgetTotalCoins`/`Ad.budgetSpentCoins` خودشون دقیقاً همون رزرو رو نشون می‌دن).
- **مصرف رزرو (فاز ۵، `AdServingService`):** هر impression، `budgetSpentCoins` تبلیغ رو زیاد می‌کنه — این کسر از رزروی هست که همون لحظه‌ی submit از کیف‌پول جدا شده، **نه** یک کسر جدید و مستقل از `Wallet.balanceCoins`.
- **آزادسازی/بازگشت (`AdService.reject`, `AdService.cancel`):** هر وقت رزرو یک تبلیغ بسته می‌شه بدون اینکه کامل مصرف شده باشه، مابه‌التفاوت `budgetTotalCoins - budgetSpentCoins` به‌صورت atomic به `Wallet.balanceCoins` برمی‌گرده (یک `WalletTransaction` نوع `REFUND` با همون `externalRef = adId`؛ اگر مابه‌التفاوت صفر باشه، هیچ تراکنشی ثبت نمی‌شه):
  - **رد شدن توسط ادمین (`REJECTED`):** چون رد معمولاً قبل از `ACTIVE` شدن (یعنی قبل از هر impression) اتفاق می‌افته، معمولاً کل `budgetTotalCoins` برمی‌گرده. `AdService.reject(adId, reason)` این منطق رو داره ولی هنوز به هیچ HTTP endpoint وصل نیست چون `AdminModule`/احراز هویت ادمین (فاز ۶) هنوز ساخته نشده — هر کنترلر ادمینی که در فاز ۶ ساخته بشه باید مستقیماً همین متد رو صدا بزنه.
  - **توقف دستی توسط تبلیغ‌دهنده (`AdService.cancel` → وضعیت `COMPLETED`):** از طریق `POST /ads/:id/cancel`، از وضعیت‌های `PENDING_REVIEW`/`ACTIVE`/`PAUSED` قابل‌فراخوانیه؛ باقیمانده‌ی مصرف‌نشده برمی‌گرده به کیف‌پول (قابل‌استفاده برای تبلیغ بعدی).
  - **پایان بودجه (`OUT_OF_BUDGET`, فاز ۵):** طبق تعریف، در این حالت `budgetSpentCoins == budgetTotalCoins`، پس مابه‌التفاوت همیشه صفره و نیازی به تراکنش refund نیست — این حالت به‌طور طبیعی idempotent با همین قانون سازگاره، نیازی به مسیر جدا نداره.

هر بار که یک ناشر (کانال/ربات) درخواست یک تبلیغ برای نمایش می‌کنه:

1. فیلتر تبلیغ‌های `status=ACTIVE` و `budgetSpentCoins < budgetTotalCoins`
2. فیلتر بر اساس targeting: زبان کانال، دسته‌بندی کانال (مطابق `include`، عدم تطابق با `exclude`)، اگر `targetChannelIds` خالی نیست باید کانال جزو لیست باشه
3. فیلتر کشور بیننده (در صورت در دسترس بودن، طبق `excludedCountries`)
4. بررسی `dailyViewLimitPerUser`: تعداد impression این تبلیغ برای این `viewerTelegramId` در ۲۴ ساعت گذشته نباید از حد مجاز رد بشه
5. بررسی حداقل CPM قابل‌قبول ناشر (`Channel.minAcceptedCpm <= Ad.cpmCoins`)
6. از بین تبلیغ‌های واجد شرایط، **مرتب‌سازی بر اساس CPM نزولی** (مزایده‌ی ساده — Ad با CPM بالاتر اولویت نمایش داره) — می‌تونه بعداً به یک الگوریتم weighted-random ارتقا پیدا کنه تا تبلیغ‌های CPM پایین‌تر هم شانس نمایش داشته باشن
7. ثبت `AdImpression` و کسر `cpmCoins/1000` از `budgetSpentCoins` تبلیغ (به‌صورت atomic transaction؛ طبق ۴.۱ بالا، این کسر از بودجه‌ی از‌قبل‌رزروشده است، نه یک کسر جدید از `Wallet.balanceCoins`) و افزودن سهم ناشر به `WalletTransaction` نوع `PUBLISHER_EARNING` (بعد از کسر `platformCommissionPercent`)
8. اگر `budgetSpentCoins >= budgetTotalCoins` بعد از این تراکنش، وضعیت تبلیغ به `OUT_OF_BUDGET` تغییر کنه و به تبلیغ‌دهنده پیام اطلاع‌رسانی ارسال بشه (طبق ۴.۱، این حالت مابه‌التفاوت صفر داره، پس refund لازم نیست).

این منطق باید در یک سرویس مجزا (`AdServingService`) با تست واحد سنگین پیاده بشه چون قلب مالی سیستمه.

## ۵. API طراحی (نمونه‌ی سطح بالا — جزئیات کامل هنگام پیاده‌سازی هر فاز مستند می‌شه)

```
POST   /auth/telegram-webapp        # اعتبارسنجی initData، صدور JWT
GET    /me                          # پروفایل + موجودی کیف پول
GET    /categories

# تبلیغ‌ها
POST   /ads                         # ایجاد تبلیغ (DRAFT)
PATCH  /ads/:id                     # ویرایش پیش از تأیید
POST   /ads/:id/submit              # ارسال برای بازبینی -> PENDING_REVIEW (رزرو بودجه، بخش ۴.۱)
POST   /ads/:id/cancel              # توقف دستی توسط تبلیغ‌دهنده -> COMPLETED (بازگشت باقیمانده‌ی بودجه، بخش ۴.۱)
GET    /ads                         # لیست تبلیغ‌های من
GET    /ads/:id/stats

# کیف پول
POST   /wallet/deposit/stars/invoice
POST   /wallet/deposit/rial/init
POST   /wallet/deposit/crypto/address
GET    /wallet/transactions

# ناشر
POST   /channels                    # ثبت کانال/ربات
POST   /channels/:id/verify
GET    /channels/:id/earnings
POST   /payouts

# داخلی برای موتور نمایش (فراخوانی از bot/SDK)
GET    /serve/ad?channelId=...      # دریافت بهترین تبلیغ برای نمایش
POST   /serve/click                 # ثبت کلیک

# ادمین (namespace جدا، auth جدا)
GET    /admin/ads/pending
POST   /admin/ads/:id/approve
POST   /admin/ads/:id/reject       # فقط باید AdService.reject(adId, reason) رو صدا بزنه - منطق و بازگشت بودجه از قبل در فاز ۴ پیاده و تست شده (بخش ۴.۱)
GET    /admin/payouts/pending
POST   /admin/payouts/:id/approve
GET    /admin/settings
PATCH  /admin/settings
```

## ۶. i18n

فایل‌های ترجمه در `packages/shared-types/i18n/{fa,en,ar}.json` نگهداری بشه؛ هم `apps/bot` و هم `apps/miniapp` از همون فایل مشترک استفاده کنن تا رشته‌ها تکراری تعریف نشن.

## ۷. تست و کیفیت

- `apps/api`: Jest برای unit + integration test (با یک Postgres تستی در Docker)
- `apps/bot`: تست منطق handler ها با mock کردن API تلگرام
- E2E حداقلی: یک تست کامل مسیر «ساخت تبلیغ -> تأیید ادمین -> نمایش -> کلیک -> کسر بودجه» قبل از پایان فاز ۵ الزامی است.
