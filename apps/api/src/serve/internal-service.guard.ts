import { timingSafeEqual } from "node:crypto";
import { CanActivate, ExecutionContext, Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import type { Env } from "@telegram-ads/config";
import type { Request } from "express";
import { ENV } from "../config/config.module";

// Protects the internal-only serving endpoints (docs/DECISIONS.md ADR-015) with a single
// shared secret - not per-publisher auth, which is phase 7's job once real channel
// registration/ownership exists. Only apps/bot (and this platform's own trusted callers) should
// ever hold INTERNAL_SERVICE_TOKEN.
@Injectable()
export class InternalServiceGuard implements CanActivate {
  constructor(@Inject(ENV) private readonly env: Env) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const provided = request.headers["x-internal-token"];

    if (typeof provided !== "string" || !this.matchesToken(provided)) {
      throw new UnauthorizedException("Invalid or missing internal service token");
    }
    return true;
  }

  private matchesToken(provided: string): boolean {
    const expected = Buffer.from(this.env.INTERNAL_SERVICE_TOKEN);
    const actual = Buffer.from(provided);
    // Constant-time comparison, same reasoning as telegram-init-data.ts's hash check - this
    // guards a money-moving endpoint, so a timing side-channel is worth closing even though the
    // token is only ever held by trusted internal callers.
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  }
}
