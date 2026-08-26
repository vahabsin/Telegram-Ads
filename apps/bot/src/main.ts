import { loadEnv } from "@telegram-ads/config";
import { createBot } from "./bot";

async function main() {
  const env = loadEnv();
  const bot = createBot(env);

  // Long polling: simplest mode without a public HTTPS domain. Webhook mode needs a real
  // domain/VPS - see TODO.md - revisit in phase 10.
  await bot.start({
    onStart: () => console.log("Telegram bot started (long polling)"),
  });
}

process.on("SIGINT", () => process.exit(0));
process.on("SIGTERM", () => process.exit(0));

void main();
