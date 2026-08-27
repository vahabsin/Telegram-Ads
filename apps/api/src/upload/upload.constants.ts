import { join } from "node:path";

// Local disk volume per docs/ARCHITECTURE.md's phase-1 storage note (S3-compatible storage is
// deferred - docs/DECISIONS.md ADR-011). Resolved relative to the process cwd, which is
// apps/api both under `pnpm --filter @telegram-ads/api start:dev` and `node dist/main.js`.
export const UPLOAD_DIR = join(process.cwd(), "uploads");
export const UPLOAD_ROUTE_PREFIX = "/uploads";
