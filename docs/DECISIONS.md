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
