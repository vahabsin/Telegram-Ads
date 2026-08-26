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
