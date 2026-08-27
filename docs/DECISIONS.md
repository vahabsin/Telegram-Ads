# DECISIONS — Architecture Decision Records

Log of technical decisions not fully pinned down by `docs/ARCHITECTURE.md`, made during implementation.

## ADR-001: pnpm workspaces (not Turborepo) for the monorepo

**Date:** 2026-08-27
**Phase:** 0

`docs/ROADMAP.md` phase 0 allowed either "pnpm workspaces یا turborepo". Chose plain pnpm workspaces for now:

- No build-caching/task-graph needs yet at this project size (a handful of small packages, no heavy build pipeline).
- One less moving part during early phases.
- Turborepo can be layered on top later without restructuring, since it works directly on top of pnpm workspaces (`pnpm-workspace.yaml` stays valid).

## ADR-002: Local git repo scoped to the project folder

**Date:** 2026-08-27
**Phase:** 0

The project folder was originally a subdirectory of a much larger git repository rooted at the user's home directory (tracking unrelated personal files). Ran `git init` directly inside the project folder to create an independent repo scoped only to this project, isolated from the home-directory repo. The GitHub remote (see README.md) points at this independent repo.

## ADR-003: Money fields as Prisma `BigInt`, serialized as strings over the API

**Date:** 2026-08-27
**Phase:** 1

`docs/ARCHITECTURE.md` mandates all coin amounts be stored as integers, "هرگز float" (never float), and lists the storage type as "Decimal/BigInt". Chose `BigInt` (not `Decimal`) for every `*Coins` field in `packages/database/prisma/schema.prisma`:

- Coin amounts are always whole numbers everywhere in the PRD (budgets, CPM, wallet balances) — there is no fractional-coin concept, so `Decimal` brings no benefit over `BigInt`.
- Prisma's 32-bit `Int` caps around 2.1 billion, which real wallet balances/ad budgets could plausibly exceed over the platform's lifetime; `BigInt` avoids silent overflow.

Consequence: JavaScript's `JSON.stringify` cannot serialize `BigInt`. `apps/api` response DTOs convert every coin field to a `string` before returning it over HTTP (never a `number`, to avoid precision loss in JS clients). Internal service/repository code keeps using `bigint`.

## ADR-004: Ad channel targeting stored as free-text handles, not a relation

**Date:** 2026-08-27
**Phase:** 1

`docs/ARCHITECTURE.md` left `AdTargeting.targetChannelIds` as "(relation یا رشته‌ی لینک‌های وارد‌شده)" — an explicit either/or. Implemented `targetChannelHandles` / `excludeChannelHandles` as `String[]` (usernames or t.me links) rather than a relation to the `Channel` model, because per `docs/PRD.md` section 2.3 step 3, an advertiser can type in *any* channel username/link as a target — it does not need to already be registered as a Publisher `Channel` in our system. Category targeting (`AdTargetCategory`/`AdExcludeCategory`) does use a proper relation, since `Category` is a fixed taxonomy we control.

## ADR-005: Launch-default `PlatformSetting` values

**Date:** 2026-08-27
**Phase:** 1

Per the user's 2026-08-27 instruction to decide undocumented values autonomously (using standard practice) rather than stopping, and to flag anything that will need real data later with a `TODO`, seeded `PlatformSetting` with:

- `platformCommissionPercent = 20` — **explicit user instruction**, not a guess (80% publisher / 20% platform, a common marketplace/ad-network split).
- `coinToTomanRate = 1` (1 coin = 1 Toman) — inferred from `docs/PRD.md` section 2.4's own quick-deposit buttons (20,000 / 50,000 / 100,000 / 300,000), which read naturally as Toman amounts. `TODO(real-money)`: confirm with the user before phase 8 (Rial gateway) goes live — this is exactly the "coin-to-Toman rate" CLAUDE.md flags as a real-money decision.
- `minPayoutAmount = 100000` coins (100,000 Toman at the above rate) — a plausible minimum withdrawal for an Iranian consumer platform, in line with typical local app minimums. `TODO(real-money)`: confirm with the user before phase 7/8 go live.
- `minCpm = 1000`, `maxCpm = 1000000` coins — wide operational bounds so early advertisers aren't blocked; tunable later via the admin panel (phase 6) without a migration.
- `restrictedCountries = ["KP", "SY", "CU"]` — a small illustrative sample per `docs/PRD.md` section 2.3 ("پیش‌فرض چند کشور نمونه"), deliberately not including Iran itself since this is an Iran-facing platform. `TODO(compliance)`: needs an actual legal/compliance review before launch, not just an engineering guess.

All of the above are edited in the admin panel (`PlatformSetting` CRUD, phase 6) without a redeploy, so none of this is a one-way door.

## ADR-006: Wallet mutation logic lives in `packages/database`, not `apps/api`

**Date:** 2026-08-27
**Phase:** 3

Phase 3 needs the Telegram Stars `successful_payment` handler (in `apps/bot`, which has no NestJS DI container) to credit the same wallet using the exact same atomic/idempotent logic `apps/api`'s `WalletService` uses for every other mutation - duplicating that logic would be exactly the kind of divergence CLAUDE.md's financial-safety rules exist to prevent. Moved the actual `creditWallet`/`debitWallet`/`createWallet`/`getBalanceCoins` implementation into `packages/database/src/wallet.ts` as plain functions with no `@nestjs/common` dependency (they throw plain `InvalidAmountError`/`InsufficientBalanceError`). `apps/api/src/wallet/wallet.service.ts` is now a thin adapter that calls these functions and translates those errors into `BadRequestException`/`ConflictException`; `apps/bot` calls them directly with the shared `prisma` singleton. Single source of truth for the one piece of logic that must never diverge.

## ADR-007: Telegram Stars exchange rate (`coinsPerStar`)

**Date:** 2026-08-27
**Phase:** 3

Telegram Stars (XTR) need a coins-per-Star conversion to price a deposit invoice. Unlike an internal "coin," a Star has real-world value set by Telegram/Apple/Google that fluctuates, so this isn't a value to confidently hardcode. Seeded `PlatformSetting.coinsPerStar = 100` (1 Star buys 100 coins) as an explicit, clearly-round placeholder. `TODO(real-money)`: confirm the real target rate with the user before real Stars payments go live - trivial to change since it's read from `PlatformSetting` at invoice-creation time, not compiled in.

## ADR-008: Miniapp uses the official inline Telegram WebApp script, no router library yet

**Date:** 2026-08-27
**Phase:** 3

`docs/ARCHITECTURE.md` says `apps/miniapp` should be "سازگار با Telegram WebApp SDK" without naming a specific npm package. Used the official `<script src="https://telegram.org/js/telegram-web-app.js">` (per Telegram's own docs) plus a small hand-written ambient type + wrapper (`src/telegram.ts`), instead of a third-party wrapper package like `@twa-dev/sdk` - avoids picking an unlisted dependency for something the official script already covers.

Phase 3 only needs two screens (Dashboard, Wallet), so view switching is a local `useState` in `App.tsx` rather than pulling in `react-router` (not mentioned in `docs/ARCHITECTURE.md`). Revisit once phase 4's ad wizard needs real multi-step routing/deep-linking.

## ADR-009: `Ad.initialStatusChoice` field (additive schema change)

**Date:** 2026-08-27
**Phase:** 4 (WIP - schema edited, migration not yet applied)

`docs/PRD.md` section 2.3 step 5 requires the advertiser to choose, at ad-creation time, whether an approved ad goes straight to `ACTIVE` or starts `PAUSED` waiting for manual activation. `docs/ARCHITECTURE.md`'s (explicitly summarized) `Ad` schema has no field for this - `status` itself becomes `PENDING_REVIEW` on submit regardless, and nothing preserved the advertiser's original choice for the admin-approval step (phase 6) to read back. Added a new nullable-by-default enum `AdInitialStatusChoice { ACTIVE PAUSED }` and `Ad.initialStatusChoice` (`@default(ACTIVE)`) to `schema.prisma` - purely additive, no existing column changed or removed, so it doesn't conflict with anything ARCHITECTURE.md specifies.

**Status:** schema.prisma edited and committed; `prisma migrate dev` has **not** run yet (interrupted before execution) - nothing in the codebase references this field/enum yet, so leaving it unmigrated for now doesn't break anything. Next session should run the migration before writing `AdService` (see `docs/ROADMAP.md` phase 4 resume point).

**Update 2026-08-27:** migration `20260827075316_add_ad_initial_status_choice` applied against the dev Postgres. `AdModule` (`AdService`/`AdController`) built on top of it - see ADR-010 for the editability rule.

## ADR-010: `Ad` is only editable/submittable while `DRAFT` or `REJECTED`

**Date:** 2026-08-27
**Phase:** 4

`docs/ARCHITECTURE.md` section 5 labels `PATCH /ads/:id` as "ویرایش پیش از تأیید" (edit before approval) but doesn't enumerate exactly which `AdStatus` values that covers. Chose `DRAFT` and `REJECTED` (not `PENDING_REVIEW`, `ACTIVE`, `PAUSED`, `COMPLETED`, or `OUT_OF_BUDGET`):

- `DRAFT` is the obvious case - the ad hasn't been submitted yet.
- `REJECTED` is included so an advertiser can fix whatever the admin flagged and resubmit, without needing a separate "clone ad" flow; editing a `REJECTED` ad also clears `rejectionReason` back to `null`.
- `PENDING_REVIEW` is excluded so an admin moderator (phase 6) is never reviewing a payload that changes out from under them mid-queue.
- Everything past approval (`ACTIVE`/`PAUSED`/`COMPLETED`/`OUT_OF_BUDGET`) is excluded because phase 5's `AdServingService` may already be actively spending that ad's budget; editing budget/CPM/targeting live would need its own concurrency-safe design, not a plain field update. Pausing/resuming an active ad is a distinct, simpler action (`docs/PRD.md` section 2.5 "توقف موقت") not yet built - tracked as a phase-4/5 gap, not solved by this ADR.

`AdService.submit()` uses the same `DRAFT`/`REJECTED` gate, plus a wallet-balance check (`WalletService.getBalanceCoins(userId) >= budgetTotalCoins`) before allowing the `PENDING_REVIEW` transition, per `docs/PRD.md` section 2.3's "اعتبارسنجی موجودی" requirement. **Important scope note:** this balance check is a gate only - it does not reserve or debit the coins. Actual budget deduction happens per-impression in phase 5's `AdServingService` (`docs/ARCHITECTURE.md` section 4), which isn't built yet. Until phase 5 lands, nothing stops an advertiser from submitting several ads whose budgets together exceed their current balance (each `submit()` call only checks the balance at that moment, independently). Flagged here rather than solved now because a proper fix (reserving/locking budget at submit time) changes the wallet's accounting model and deserves its own design pass alongside phase 5, not a bolt-on in phase 4.

## ADR-011: Ad media upload uses local disk storage, served via `@nestjs/serve-static`

**Date:** 2026-08-27
**Phase:** 4

`docs/ARCHITECTURE.md`'s phase-4 note allows "S3-compatible storage یا local volume در فاز اول." Chose local disk for phase 4 (S3-compatible storage is a real infra/credentials decision - object storage endpoint, access keys - reserved for a later phase per CLAUDE.md rule 3, not guessed here):

- New `UploadModule` (`apps/api/src/upload/`): `POST /uploads` (multipart, field `file`, `JwtAuthGuard`-protected) writes to `apps/api/uploads/<uuid>.<ext>` via `multer`'s `diskStorage`, and `@nestjs/serve-static` serves that directory at `/uploads/*`. Response is `{ url, mediaType }` where `mediaType` is derived from the file's MIME type (matches `AdMediaType`), ready to hand straight to `POST /ads`' `mediaUrl`/`mediaType` fields.
- Installed `@nestjs/serve-static@^4.x` (not the latest `^5.x`, which requires NestJS 11 - this repo is pinned to NestJS 10 - see ADR-002 if a NestJS-version ADR exists, otherwise just: avoid an unmet-peer-dependency install).
- Added `API_PUBLIC_URL` to `packages/config`'s env schema (defaults to `http://localhost:3000`) so the upload response's `url` is an absolute URL (required by `mediaUrl: z.string().url()` in `packages/shared-types/src/ad.ts`) instead of a relative path. **Must be set to the real public HTTPS URL before production** - same category as `MINIAPP_URL`.
- File type allow-list (JPEG/PNG/WebP/GIF images, MP4/WebM/QuickTime video) and a 20MB size cap are both placeholders picked for a reasonable phase-4 default, not from any spec - revisit if real ad creatives need something outside these.
- `apps/api/uploads/` is gitignored; the directory is created at boot if missing (`UploadModule`'s constructor).
- Verified against the real dev server + real disk: uploading a valid PNG returns a fetchable absolute URL (confirmed via a real `GET` back on that URL returning the file with the right content-type), a disallowed MIME type (`text/plain`) is rejected with 400, and the returned URL was successfully used as `mediaUrl` in a real `POST /ads` call.

## ADR-012: `?mockInitData=` dev-only escape hatch in `apps/miniapp`

**Date:** 2026-08-27
**Phase:** 4

`apps/miniapp/src/telegram.ts`'s `getInitData()` cannot be exercised in a plain browser - it only ever returns a value inside real Telegram's WebApp webview (docs/TODO.md phase 3 already flagged this as a testing gap). To actually click through the new ad wizard in a real browser with a real running backend (rather than trusting typecheck/lint alone for a UI change - per this project's testing standard), added a fallback: if `window.Telegram.WebApp.initData` is empty AND `import.meta.env.DEV` is true, read a `?mockInitData=` query param instead.

- Gated on `import.meta.env.DEV`, which Vite statically replaces with `false` in a production build (`vite build`) - the branch is dead-code-eliminated and cannot exist in what actually ships. Confirmed by grepping the phase-3 production build output for `mockInitData` (absent).
- The value still has to be a validly HMAC-signed `initData` string (`AuthService`/`validateTelegramInitData` doesn't know or care where it came from) - this only removes the "must be inside Telegram's webview to have `window.Telegram.WebApp.initData` populated" barrier for local testing, it does not weaken server-side validation at all.
- Used this to manually verify the full ad wizard (5 steps, category loading, file upload with live preview, budget validation, create+submit) end-to-end in a real Chrome tab against the real dev API + dev Postgres - see `docs/ROADMAP.md` phase 4 for what was actually exercised this way.

## ADR-013: `AdService.submit()` reserves budget atomically; `reject()`/`cancel()` refund it

**Date:** 2026-08-27
**Phase:** 4 (explicitly done before phase 5, per user instruction - phase 5's `AdServingService` needs a settled answer for "how much budget is actually available" before it can be built safely)

ADR-010 flagged that `submit()` only checked the wallet balance as a point-in-time gate, without reserving anything - an advertiser could submit several ads whose combined budgets exceed their real balance. The user asked for this to be fixed properly before phase 5, with three concrete requirements: (1) submit reserves the budget atomically, not just checks it; (2) admin rejection fully refunds the reservation; (3) a manual/out-of-budget stop refunds whatever's unspent. Full design and implementation, documented in `docs/ARCHITECTURE.md` section 4.1 (see there for the mechanism); summary of the implementation choices:

- **No new `reservedBalance` column.** `Ad.budgetTotalCoins`/`Ad.budgetSpentCoins` already fully describe a reservation and its consumption once the money leaves `Wallet.balanceCoins` at submit time - a separate ledger field would just be a second source of truth to keep in sync. Reused the existing `WalletTransactionType.AD_SPEND` (reserve) and `WalletTransactionType.REFUND` (return) enum values - both already existed in `schema.prisma`, so no migration was needed.
- **`packages/database/src/wallet.ts` refactor:** `creditWallet`/`debitWallet` always opened their own `prisma.$transaction`, which made them impossible to compose with `AdService`'s own transaction (reserving budget and flipping `Ad.status` have to succeed or fail together - a partial success would either take money without reserving it for real, or reserve it without actually debiting). Extracted the mutation body into `mutateWalletCore(tx, input)` (works on any `Prisma.TransactionClient`), and added `creditWalletInTx`/`debitWalletInTx` that call it directly against a caller-supplied `tx` with no transaction-wrapping or P2002-retry of their own (a same-idempotencyKey race inside the caller's transaction now just aborts that whole transaction, which is correct here - unlike the standalone `creditWallet`/`debitWallet`, still used as-is by the Stars payment webhook, which do need to tolerate at-least-once delivery). `creditWallet`/`debitWallet`'s public behavior and existing tests are unchanged.
- **`AdService.submit()`:** one `$transaction` that calls `debitWalletInTx` (amount = `budgetTotalCoins`, `type: AD_SPEND`, `externalRef: adId`) then updates `Ad.status` to `PENDING_REVIEW`. `InsufficientBalanceError` from the debit is caught and turned into the same `ConflictException` message as before - so the user-visible failure mode is unchanged, only the mechanism (real atomic reserve vs. a separate check) is fixed.
- **`AdService.reject(adId, reason)`:** new method, `PENDING_REVIEW` only, refunds `budgetTotalCoins - budgetSpentCoins` (skips the wallet call entirely when that's 0) and sets `status: REJECTED` + the reason. **Not wired to any HTTP endpoint** - there is no `AdminModule`/admin auth yet (phase 6). Whoever builds `POST /admin/ads/:id/reject` in phase 6 should call this method directly; building it now would mean guessing at admin-auth design ahead of that phase, which CLAUDE.md's phase discipline says not to do. Tested via unit tests plus a real-DB call (bypassing HTTP, importing `AdService` directly with a real `PrismaClient` in a throwaway script - see `docs/ROADMAP.md` phase 4).
- **`AdService.cancel(userId, adId)` + `POST /ads/:id/cancel`:** advertiser-facing, callable from `PENDING_REVIEW`/`ACTIVE`/`PAUSED`, refunds the same way and sets `status: COMPLETED`. This *is* wired to a real endpoint now (no auth-design gap blocking it, unlike `reject`), giving a genuinely testable, real advertiser-facing way to exercise the refund path end-to-end today rather than only through phase 6's future admin action.
- Idempotency keys for both the reservation and refund `WalletTransaction` rows are fresh `randomUUID()`s, not a deterministic per-ad key - a deterministic key like `ad-reserve:${adId}` would incorrectly collide if the same ad is submitted again after a reject-and-resubmit cycle. Unlike the Stars deposit webhook (which legitimately needs to dedupe retried deliveries of the *same* event), these are synchronous server-side calls triggered by one explicit user action each, so there's no retry-dedup requirement, and the DB's `idempotencyKey` uniqueness is satisfied either way.
- **Verified against the real dev API + dev Postgres**, not just unit tests: submit reserved the exact budget out of a real wallet (balance and a real `AD_SPEND` row both checked directly in Postgres), cancel refunded it back to the exact original balance with a real `REFUND` row, a second cancel on the same (now `COMPLETED`) ad correctly got a 409, and `reject()` (called directly, not via HTTP, per the point above) refunded a second ad's full untouched budget and set `rejectionReason`. 12 new/updated unit tests in `ad.service.spec.ts`, 5 new unit tests for `*WalletInTx` in `packages/database/src/wallet.spec.ts`.
