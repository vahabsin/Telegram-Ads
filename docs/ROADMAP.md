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
- [x] پیاده‌سازی `AdServingService` طبق منطق `ARCHITECTURE.md` بخش ۴ — فیلتر ACTIVE+بودجه، زبان/دسته‌بندی/کانال include-exclude (نرمال‌سازی @ و حروف بزرگ‌کوچک)، حداقل CPM ناشر، `dailyViewLimitPerUser`، مزایده‌ی CPM نزولی. **توجه:** فیلتر `excludedCountries` پیاده نشده چون کشور بیننده در هیچ‌جای مسیر فعلی در دسترس نیست (`apps/bot` هم نداره) — TODO.md
- [x] endpoint داخلی `GET /serve/ad` و `POST /serve/click` — با `InternalServiceGuard` (توکن مشترک `INTERNAL_SERVICE_TOKEN`، مقایسه‌ی constant-time) طبق `docs/DECISIONS.md` ADR-015؛ **توجه:** `apps/bot` هنوز واقعاً این endpoint ها رو صدا نمی‌زنه (فراخوانی از کانال واقعی نیاز به فاز ۷ داره) — TODO.md
- [x] اعمال atomic transaction برای کسر بودجه (جلوگیری از race condition با دو impression هم‌زمان) — همون الگوی `updateMany` شرطی که در ADR-013 برای کیف‌پول استفاده شد، اینجا هم برای `budgetSpentCoins` به کار رفت؛ با unit test مخصوص «باخت در race» و توضیح در ADR-015
- [x] پیاده‌سازی `dailyViewLimitPerUser` با شمارش `AdImpression` در ۲۴ ساعت گذشته (از ایندکس موجود `[adId, viewerTelegramId, createdAt]` در schema استفاده می‌کنه)؛ **توجه:** این چک خودش atomic نیست (race نادر و بی‌ضرر مالی) — TODO.md
- [x] سیستم پایه ضدتقلب: rate limit روی endpoint های `/serve/*` با `@nestjs/throttler` (فقط همین ماژول، نه global) — با burst test واقعی (۱۵ درخواست پشت‌سرهم) تأیید شد که از درخواست ۱۱ به بعد ۴۲۹ برمی‌گرده
- [x] تغییر خودکار وضعیت تبلیغ به `OUT_OF_BUDGET` — تست شد؛ **اطلاع‌رسانی به تبلیغ‌دهنده از طریق ربات پیاده نشده** چون `apps/api` هیچ مسیری برای push کردن پیام به `apps/bot` نداره (gap یکپارچه‌سازی بین دو اپ، نه یک جزئیات کوچیک) — TODO.md
- [x] تست‌های سنگین برای این ماژول — ۲۰ unit test، پوشش ۹۷.۶٪ statements / ۸۳.۷٪ branch روی `serve.service.ts`
- [x] **به‌جای «یک کانال تلگرام تستی متصل کن»** (که چون فاز ۷/ثبت کانال هنوز نیومده امکان‌پذیر نبود)، مسیر کامل روی سرور واقعی + Postgres واقعی با یک ردیف `Channel` واقعی (ساخته‌شده مستقیم توسط اسکریپت، نه از طریق تلگرام) end-to-end تست شد: create→submit (فاز ۴) → approve دستی از DB (چون فاز ۶ نیومده) → ۳ بار `GET /serve/ad` واقعی که دقیقاً بودجه رو کم کرد و کیف‌پول ناشر رو شارژ کرد → `OUT_OF_BUDGET` خودکار → `POST /serve/click` واقعی → همون داده از `GET /ads/:id/stats` فاز ۴ هم درست خونده شد. **هیچ تعامل واقعی با تلگرام نبود** (نه کانال واقعی، نه ربات واقعی) — همون محدودیت شبکه‌ی همیشگی این sandbox.

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
فازهای ۰ تا ۵ کامل و تست‌شده (جزئیات هر آیتم در بخش خودش بالا). دو تصمیم مهم فاز ۵ (حداقل CPM=۱۰۰۰ برای جلوگیری از رند شدن هزینه‌ی هر نمایش به صفر — ADR-014؛ و توکن داخلی مشترک برای `/serve/*` تا فاز ۷ کلید API واقعی هر ناشر رو بسازه — ADR-015) با تأیید صریح کاربر گرفته شد، نه حدسی. فاز ۶ (پنل ادمین) هنوز شروع نشده.

**نقطه‌ی دقیق شروع فاز ۶:**
۱. `apps/admin` با احراز هویت ایمیل/پسورد + TOTP (طبق ROADMAP) راه‌اندازی کن — این یک تصمیم امنیتی/معماری تازه‌ست (کتابخانه‌ی TOTP، مدل نشست ادمین) که در ARCHITECTURE.md فقط در حد اسم اومده؛ قبل از انتخاب کتابخانه/الگو با کاربر هماهنگ کن (طبق CLAUDE.md بند ۳).
۲. صف تأیید تبلیغ‌ها: `POST /admin/ads/:id/approve` باید `Ad.status` رو به `initialStatusChoice` (ACTIVE یا PAUSED) تغییر بده؛ `POST /admin/ads/:id/reject` باید مستقیماً `AdService.reject(adId, reason)` رو صدا بزنه — این متد و منطق بازگشت بودجه‌اش از فاز ۴ کامل و تست‌شده آماده‌ست (ADR-013)، فقط نیاز به wiring داره.
۳. بعد از پنل ادمین، `apps/bot` رو به `GET /serve/ad`/`POST /serve/click` وصل کن (با هدر `X-Internal-Token`) تا مسیر end-to-end واقعی («ساخت→تأیید ادمین واقعی→نمایش در کانال واقعی→کلیک→کسر بودجه» طبق ARCHITECTURE.md بخش ۷) بالاخره با تلگرام واقعی قابل تست بشه — تا این لحظه این مسیر فقط با داده‌ی دستی در دیتابیس شبیه‌سازی شده (TODO.md فاز ۵).
۴. طبق قانون‌های خودکار (`docs/DECISIONS.md`)، هر تصمیم مهم رو ثبت کن؛ فقط برای credential واقعی/production/تغییر بنیادین معماری متوقف شو.
