# TODO — Items skipped or blocked pending user input

Running list of things that could not be completed autonomously (real credentials, production
access, or decisions explicitly reserved for the user per CLAUDE.md), maintained during the
2026-08-27 overnight autonomous run. Each entry says what's blocked and what's needed to unblock it.

## Phase 2 — Telegram bot

- **Live Telegram connectivity could not be verified in this sandbox.** `curl https://api.telegram.org/...` and `bot.start()` (grammY long polling) both hang/time out from this environment — outbound network to `api.telegram.org` appears blocked here. Verified instead via: `pnpm typecheck`/`pnpm lint` passing, and 10 unit tests covering `/start`, language selection, and the user-upsert logic with mocked Telegram context + mocked Prisma. **Action needed:** run `pnpm --filter @telegram-ads/bot start:dev` yourself (outside this sandbox, with `.env` populated) and confirm `/start` actually works against real Telegram.
- **`PLATFORM_CHANNEL_URL` / `PLATFORM_SUPPORT_URL` are unset.** The bot's main menu omits the "کانال" and "پشتیبانی" buttons until these are provided (see `.env.example`) — didn't want to link to a fake/placeholder channel. Provide real URLs whenever they exist and the buttons will appear automatically, no code change needed.
- **Bot runs in long-polling mode**, not webhook — the simplest option without a public HTTPS domain (see `docs/DECISIONS.md`). Revisit for webhook mode once phase 10 has a real domain/VPS.
