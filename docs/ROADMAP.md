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
- [x] فرم چندمرحله‌ای طبق PRD بخش ۲.۳ (Placement -> عنوان -> Targeting -> Creative -> بودجه/CPM) — بک‌اند (`AdModule`) و UI (`apps/miniapp/src/pages/AdWizard.tsx`، ۵ مرحله + `CategoryModule` برای لیست دسته‌بندی‌ها) هر دو کامل شدن. **نحوه‌ی تست:** بک‌اند با curl واقعی روی سرور واقعی + Postgres واقعی (create → PATCH → رد submit با موجودی ناکم → شارژ → submit موفق → قفل edit/resubmit → ایزوله‌بودن مالکیت) به‌علاوه ۱۱ unit test (`ad.service.spec.ts`)؛ UI با یک Chrome واقعی (headless، از طریق یک اسکریپت puppeteer-core موقت چون افزونه‌ی claude-in-chrome در این سشن وصل نبود — نه ادعای تست با claude-in-chrome) که initData رو با bot token واقعی امضا کرده و از طریق escape-hatch فقط-dev در `?mockInitData=` (`docs/DECISIONS.md` ADR-012) به میلی‌اپ داده: کلیک واقعی روی هر ۵ مرحله، آپلود واقعی فایل + پیش‌نمایش زنده‌ی واقعی، ثبت واقعی تبلیغ که در دیتابیس واقعی با وضعیت `PENDING_REVIEW` ظاهر شد و در «تبلیغ‌های من» با آمار واقعی (۰ نمایش/۰ کلیک) قابل مشاهده بود. **هیچ‌کدوم از این‌ها تعامل واقعی با تلگرام نداشتن** (initData ساختگی/محلی بود، نه از Mini App واقعی داخل تلگرام) — همون محدودیت همیشگی این sandbox.
- [x] آپلود تصویر/ویدیو (`UploadModule` — ذخیره local disk طبق تصمیم فاز اول، `docs/DECISIONS.md` ADR-011) — روی سرور واقعی تست شد: آپلود PNG واقعی، رد نوع فایل غیرمجاز، fetch موفق فایل برگشتی، و استفاده از URL برگشتی به‌عنوان mediaUrl واقعی در `POST /ads`
- [x] کامپوننت پیش‌نمایش زنده‌ی تبلیغ (شبیه‌ساز کارت Ad تلگرام) — `AdPreviewCard.tsx`؛ **توجه:** مارک‌آپ واقعی کارت تبلیغ تلگرام مستند رسمی نداره، این فقط یک شبیه‌سازی نزدیکه نه کپی پیکسل‌به‌پیکسل
- [x] اعتبارسنجی سمت سرور کامل فرم (Zod DTO مشترک با بک‌اند) — همون `createAdRequestSchema`/`updateAdRequestSchema` که در بک‌اند هم استفاده می‌شه، سمت سرور با `parseWithZod` اجرا می‌شه (نه فقط سمت کلاینت)
- [x] بررسی موجودی کافی قبل از ثبت + پیام هدایت به شارژ حساب در صورت کمبود — سمت UI (غیرفعال‌شدن دکمه + پیام هشدار قرمز) و authoritative سمت سرور؛ هر دو با سناریوی واقعی موجودی ناکافی تست شدن
- [x] ارسال تبلیغ با وضعیت `PENDING_REVIEW` — تست شد (بالا)
- [x] صفحه‌ی «تبلیغ‌های من» با نمایش وضعیت هر تبلیغ — `MyAds.tsx`؛ نمایش/کلیک/CTR/هزینه‌شده با کلیک روی هر تبلیغ باز می‌شه؛ **ویرایش تبلیغ‌های DRAFT/REJECTED از UI پیاده نشده** (نیاز به یک endpoint جدید `GET /ads/:id` برای واکشی جزئیات targeting داره که در `docs/ARCHITECTURE.md` بخش ۵ لیست نشده — به‌جای گسترش خودسرانه‌ی API، به‌عنوان gap ثبت شد، نه حل‌شده به‌صورت ناقص)
- [x] **رزرو و بازگشت بودجه (پیش‌نیاز فاز ۵، طبق دستور کاربر قبل از ورود به فاز ۵ انجام شد)** — `AdService.submit()` دیگه فقط چک نمی‌کنه، واقعاً و atomic از کیف‌پول کم می‌کنه (`WalletTransaction` نوع `AD_SPEND`)؛ `AdService.reject(adId, reason)` (فقط از `PENDING_REVIEW`، هنوز به هیچ HTTP endpoint وصل نیست چون ادمین auth فاز ۶ هست) و `AdService.cancel` + `POST /ads/:id/cancel` (از `PENDING_REVIEW`/`ACTIVE`/`PAUSED`) باقیمانده‌ی مصرف‌نشده رو با `WalletTransaction` نوع `REFUND` برمی‌گردونن. جزئیات کامل در `docs/ARCHITECTURE.md` بخش ۴.۱ و `docs/DECISIONS.md` ADR-013. **نحوه‌ی تست:** ۱۷ unit test برای `AdService` + ۵ unit test جدید برای `*WalletInTx` در `packages/database`؛ به‌علاوه روی سرور واقعی + Postgres واقعی: submit واقعی موجودی رو دقیقاً کم کرد (ledger واقعی چک شد)، cancel دقیقاً همون مقدار رو برگردوند و double-cancel درست رد شد، و `reject()` (چون endpoint نداره) مستقیماً import و روی DB واقعی صدا زده شد و باقیمانده رو درست برگردوند — موجودی نهایی دقیقاً برابر موجودی اولیه شد.

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
فازهای ۰ تا ۴ کامل و تست‌شده (جزئیات هر آیتم در بخش خودش بالا)، شامل رزرو/بازگشت بودجه که به‌عنوان پیش‌نیاز صریح فاز ۵ انجام شد. فاز ۵ (موتور نمایش تبلیغ) هنوز شروع نشده.

**نقطه‌ی دقیق شروع فاز ۵:**
۱. طبق `docs/ARCHITECTURE.md` بخش ۴، `AdServingService` رو در `apps/api` بساز: فیلتر تبلیغ‌های ACTIVE با بودجه باقی‌مونده → فیلتر targeting (زبان/دسته‌بندی/کانال include-exclude) → فیلتر `dailyViewLimitPerUser` → مرتب‌سازی بر اساس CPM نزولی → ثبت `AdImpression` + کسر اتمیک `budgetSpentCoins` (این کسر از بودجه‌ی از‌قبل‌رزروشده‌ست، طبق بخش ۴.۱ — **نباید** دوباره از `Wallet.balanceCoins` کم بشه).
۲. اگر بعد از این کسر `budgetSpentCoins >= budgetTotalCoins` شد، وضعیت `OUT_OF_BUDGET` بشه — طبق بخش ۴.۱ مابه‌التفاوت همیشه صفره پس refund لازم نیست، نیازی به منطق جدید برای این حالت نیست.
۳. `POST /serve/click` و انتقال سهم ناشر (`WalletTransaction` نوع `PUBLISHER_EARNING`) بعد از کسر `platformCommissionPercent` (مقدار کمیسیون از قبل در `PlatformSetting` طبق ADR-005 ست شده، ۲۰٪).
۴. تست‌های سنگین این ماژول (>۸۰٪ پوشش) چون طبق CLAUDE.md قلب مالی سیستمه؛ حداقل یک e2e «ساخت→تأیید ادمین (فاز ۶، هنوز نساخته - شاید نیاز به یک راه موقت برای approve دستی از طریق دیتابیس/اسکریپت تا فاز ۶ ساخته بشه)→نمایش→کلیک→کسر بودجه» طبق ARCHITECTURE.md بخش ۷.
۵. طبق قانون‌های خودکار (`docs/DECISIONS.md`)، هر تصمیم مهم رو ثبت کن؛ فقط برای credential واقعی/production/تغییر بنیادین معماری متوقف شو.
