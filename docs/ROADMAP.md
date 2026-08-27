# ROADMAP — نقشه راه فاز‌به‌فاز (چک‌لیست زنده)

> این فایل باید توسط Claude Code مداوم به‌روزرسانی بشه. `[ ]` = انجام نشده، `[~]` = در حال انجام، `[x]` = تکمیل و تست‌شده.
> ورود به فاز بعد فقط بعد از تکمیل کامل فاز فعلی مجاز است، مگر کاربر صریحاً دستور دیگری بده.

## فاز ۰ — راه‌اندازی پایه پروژه
- [x] ساخت ساختار مانوریپو (`apps/*`, `packages/*`) با pnpm workspaces (تصمیم: `docs/DECISIONS.md` ADR-001)
- [x] پیکربندی TypeScript strict مشترک (`tsconfig.base.json`)
- [x] پیکربندی ESLint + Prettier مشترک
- [x] `docker-compose.yml` برای Postgres + Redis (محیط dev)
- [x] فایل `.env.example` کامل با توضیح هر متغیر
- [x] راه‌اندازی ریپازیتوری GitHub + `.gitignore` مناسب (node_modules, .env, dist, ...) — متصل و push شد به https://github.com/vahabsin/Telegram-Ads
- [x] GitHub Actions اولیه: lint + typecheck روی هر PR
- [x] `README.md` اولیه با توضیح راه‌اندازی محیط dev

## فاز ۱ — دیتابیس و هسته‌ی بک‌اند
- [x] نوشتن Prisma schema کامل طبق `ARCHITECTURE.md` بخش ۳
- [x] اولین migration + seed دسته‌بندی‌ها و `PlatformSetting` (کمیسیون ۲۰٪ طبق دستور کاربر؛ بقیه‌ی مقادیر placeholder با TODO — `docs/DECISIONS.md` ADR-005)
- [x] راه‌اندازی پروژه NestJS در `apps/api` با ماژول `HealthCheck` (تست شد: `GET /health` واقعاً بالا اومد)
- [x] پیاده‌سازی اعتبارسنجی `initData` تلگرام + صدور JWT (`AuthModule`) — منطق HMAC با ۱۱ unit test پوشش کامل داده شده (bot token و initData ساختگی/mock در تست، طبق الگوریتم رسمی تلگرام)؛ **end-to-end با bot token واقعی و initData واقعی از Mini App تست نشده** (نیاز به دسترسی شبکه به `api.telegram.org` که در این sandbox مسدوده — TODO.md)
- [x] `UserModule` + `WalletModule` (فقط CRUD پایه، بدون منطق پرداخت هنوز) — شامل credit/debit idempotent برای استفاده در فازهای بعدی
- [x] تست واحد برای اعتبارسنجی initData (۱۱ تست) و منطق کیف پول پایه (۷ تست) — پوشش این دو فایل core به‌ترتیب ~۹۸٪ و ~۸۸٪

## فاز ۲ — ربات تلگرام (هسته)
- [x] راه‌اندازی `apps/bot` با grammY + اتصال به همون دیتابیس (از طریق `packages/database`)
- [x] دستور `/start` + ذخیره/بروزرسانی کاربر در دیتابیس (+ ساخت Wallet هم‌زمان)
- [x] منوی انتخاب زبان (fa/en/ar) + ذخیره در پروفایل
- [x] منوی اصلی با دکمه‌های: اجرای اپلیکیشن (باز کردن Mini App)، کانال، پشتیبانی، تغییر زبان (کانال/پشتیبانی مشروط به تنظیم URL واقعی — TODO.md)
- [x] پیام‌های چندزبانه از فایل i18n مشترک (`packages/shared-types/i18n/{fa,en,ar}.json`)
- [x] Dockerfile برای bot + افزودن به docker-compose — build شد و موفق بود (تست runtime واقعی ممکن نشد، شبکه به api.telegram.org در این sandbox مسدوده — TODO.md)

## فاز ۳ — پوسته Mini App + کیف پول (شروع با Stars)
- [x] راه‌اندازی `apps/miniapp` (React+Vite+Tailwind) + اتصال Telegram WebApp SDK (اسکریپت رسمی، بدون پکیج ثالث — ADR-008)
- [x] صفحه ورود/احراز هویت خودکار با initData
- [x] صفحه Dashboard خالی (طبق PRD بخش ۲.۲) با حالت "هنوز تبلیغی ندارید"
- [x] صفحه کیف پول: نمایش موجودی + دکمه شارژ + تاریخچه‌ی تراکنش‌ها
- [x] پیاده‌سازی کامل پرداخت با **Telegram Stars** (`createInvoiceLink` سمت API + `pre_checkout_query` + `successful_payment` سمت bot) — کد کامل و end-to-end از نظر منطقی نوشته و unit-test شده
- [x] تست: منطق قیمت‌گذاری Stars، تجزیه‌ی payload، و اعتبارسنجی کیف‌پول یونیت‌تست شدن؛ مسیر کامل زنده (پرداخت واقعی داخل تلگرام) در این sandbox قابل اجرا نبود (شبکه مسدود + عدم دسترسی به کلاینت واقعی تلگرام) — TODO.md

## فاز ۴ — ساخت تبلیغ (Wizard کامل)
- [~] فرم چندمرحله‌ای طبق PRD بخش ۲.۳ (Placement -> عنوان -> Targeting -> Creative -> بودجه/CPM) — فقط DTO های Zod مشترک (`packages/shared-types/src/ad.ts`) و فیلد schema `Ad.initialStatusChoice` (بدون migration) آماده‌ست؛ فرم UI، AdModule بک‌اند، و migration هنوز مونده
- [ ] آپلود تصویر/ویدیو (ذخیره در S3-compatible storage یا local volume در فاز اول)
- [ ] کامپوننت پیش‌نمایش زنده‌ی تبلیغ (شبیه‌ساز کارت Ad تلگرام)
- [ ] اعتبارسنجی سمت سرور کامل فرم (Zod DTO مشترک با بک‌اند)
- [ ] بررسی موجودی کافی قبل از ثبت + پیام هدایت به شارژ حساب در صورت کمبود
- [ ] ارسال تبلیغ با وضعیت `PENDING_REVIEW`
- [ ] صفحه‌ی «تبلیغ‌های من» با نمایش وضعیت هر تبلیغ

## فاز ۵ — موتور نمایش تبلیغ (Ad Serving) — هسته‌ی مالی
- [ ] پیاده‌سازی `AdServingService` طبق منطق `ARCHITECTURE.md` بخش ۴
- [ ] endpoint داخلی `GET /serve/ad` و `POST /serve/click`
- [ ] اعمال atomic transaction برای کسر بودجه (جلوگیری از race condition با دو impression هم‌زمان)
- [ ] پیاده‌سازی `dailyViewLimitPerUser` با کوئری بهینه (ایندکس مناسب)
- [ ] سیستم پایه ضدتقلب: rate limit روی کلیک از یک IP/کاربر
- [ ] تغییر خودکار وضعیت تبلیغ به `OUT_OF_BUDGET` + اطلاع‌رسانی به تبلیغ‌دهنده از طریق ربات
- [ ] تست‌های سنگین (unit + integration) برای این ماژول — پوشش حداقل ۸۰٪
- [ ] یک کانال تلگرام تستی متصل کن و کل مسیر رو end-to-end روی محیط dev تست کن

## فاز ۶ — پنل ادمین (نسخه اول)
- [ ] راه‌اندازی `apps/admin` با احراز هویت ایمیل/پسورد + TOTP
- [ ] صف تأیید تبلیغ‌ها (approve/reject با دلیل)
- [ ] مدیریت دسته‌بندی‌ها
- [ ] مدیریت `PlatformSetting` (نرخ تبدیل، کمیسیون، حداقل/حداکثر CPM)
- [ ] audit log قابل مشاهده

## فاز ۷ — سمت ناشر (Publisher)
- [ ] ثبت کانال/ربات + فرآیند تأیید مالکیت
- [ ] انتخاب دسته‌بندی کانال/ربات
- [ ] صفحه‌ی درآمد ناشر + درخواست برداشت (`PayoutRequest`)
- [ ] تأیید/رد برداشت در پنل ادمین
- [ ] راهنمای فنی/SDK ساده برای صاحبان ربات‌های دیگر جهت fetch کردن تبلیغ از `GET /serve/ad`

## فاز ۸ — روش‌های پرداخت تکمیلی
- [ ] پرداخت ریالی (IDPay/NextPay طبق تصمیم نهایی کاربر) — نیاز به merchant credentials واقعی از کاربر
- [ ] پرداخت کریپتو TRC-20 USDT (تولید آدرس/تشخیص واریز از طریق TronGrid webhook یا polling)
- [ ] تست کامل idempotency هر سه روش پرداخت (شبیه‌سازی تراکنش تکراری/webhook تکراری)

## فاز ۹ — Targeting پیشرفته (جستجو و کاربران)
- [ ] پیاده‌سازی placement نوع `SEARCH` و `USERS` طبق محدودیت‌های واقعی Telegram Bot API (نیاز به بررسی فنی جدا — احتمالاً از طریق Inline Mode یا Ads API رسمی تلگرام در صورت وجود)

## فاز ۱۰ — سخت‌سازی، مقیاس، انتشار
- [ ] بازبینی امنیتی کامل (پرداخت، auth، rate limiting)
- [ ] تنظیم لاگ ساختاریافته + متریک Prometheus پایه
- [ ] `docker-compose.prod.yml` + Caddy برای SSL خودکار
- [ ] GitHub Actions: پایپلاین دیپلوی به VPS (build image -> push -> ssh deploy)
- [ ] مستندسازی نهایی README برای راه‌اندازی production
- [ ] تست بار (load test) پایه روی `GET /serve/ad`

---

### وضعیت کلی فعلی
فازهای ۰ تا ۳ کامل و push شده. فاز ۴ شروع شده ولی نصفه‌کاره (نقطه‌ی دقیق ادامه در پایین همین بخش، بعد از تأیید کاربر برای ادامه از سشن قبل).

**نقطه‌ی دقیق شروع مجدد فاز ۴:**
۱. `cd packages/database` و `DATABASE_URL=postgresql://tgads:tgads_dev_password@localhost:5434/tgads npx prisma migrate dev --name add_ad_initial_status_choice` را اجرا کن (این migration قبلاً یک‌بار توسط کاربر رد شد چون سشن داشت می‌بست؛ الان که ادامه می‌دی طبیعیه که اجراش کنی، مگر کاربر چیز دیگه‌ای بگه).
۲. بعد `apps/api/src/ad/` بساز: `AdModule` + `AdService` (create/update/submit/list/stats) + `AdController` طبق endpoint های `docs/ARCHITECTURE.md` بخش ۵ (`POST /ads`, `PATCH /ads/:id`, `POST /ads/:id/submit`, `GET /ads`, `GET /ads/:id/stats`).
۳. در `submit()`: چک موجودی کیف‌پول با `WalletService.getBalanceCoins` قبل از `budgetTotalCoins`؛ اگه ناکافی بود پیام واضح + راهنمایی به شارژ حساب.
۴. آپلود عکس/ویدیو: local disk volume (نه S3) طبق یادداشت ARCHITECTURE برای فاز اول — احتمالاً یک ماژول Upload جدا با multer.
۵. سمت `apps/miniapp`: کامپوننت ویزارد ۵ مرحله‌ای + پیش‌نمایش زنده‌ی کارت تبلیغ + صفحه‌ی «تبلیغ‌های من».
۶. طبق قانون‌های خودکار (`docs/DECISIONS.md`)، هر تصمیم مهم رو ثبت کن؛ فقط برای credential واقعی/production/تغییر بنیادین معماری متوقف شو.
