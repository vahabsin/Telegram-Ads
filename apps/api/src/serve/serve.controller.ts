import { Body, Controller, Get, Post, Query, UseGuards } from "@nestjs/common";
import { Throttle, ThrottlerGuard } from "@nestjs/throttler";
import {
  serveAdQuerySchema,
  serveClickRequestSchema,
  type ServeAdResponse,
  type ServeClickResponse,
} from "@telegram-ads/shared-types";
import { parseWithZod } from "../common/zod-validate";
import { InternalServiceGuard } from "./internal-service.guard";
import { ServeService } from "./serve.service";

// Internal-only (docs/DECISIONS.md ADR-015): InternalServiceGuard, not JwtAuthGuard. Rate
// limits here are the "سیستم پایه ضدتقلب" placeholder from docs/ROADMAP.md phase 5 - deliberately
// generous defaults, tune once real traffic patterns exist.
@Controller("serve")
@UseGuards(InternalServiceGuard, ThrottlerGuard)
export class ServeController {
  constructor(private readonly serveService: ServeService) {}

  @Get("ad")
  @Throttle({ default: { limit: 30, ttl: 10_000 } })
  async serveAd(@Query() query: unknown): Promise<ServeAdResponse> {
    const { channelId, viewerTelegramId } = parseWithZod(serveAdQuerySchema, query);
    return this.serveService.serveAd(channelId, viewerTelegramId);
  }

  @Post("click")
  @Throttle({ default: { limit: 10, ttl: 10_000 } })
  async click(@Body() body: unknown): Promise<ServeClickResponse> {
    const { impressionId } = parseWithZod(serveClickRequestSchema, body);
    return this.serveService.recordClick(impressionId);
  }
}
