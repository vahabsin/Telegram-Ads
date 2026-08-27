import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from "@nestjs/common";
import {
  createAdRequestSchema,
  updateAdRequestSchema,
  type AdDto,
  type AdStatsResponse,
  type ListAdsResponse,
} from "@telegram-ads/shared-types";
import { AuthenticatedRequest, JwtAuthGuard } from "../auth/jwt-auth.guard";
import { parseWithZod } from "../common/zod-validate";
import { AdService } from "./ad.service";

@Controller("ads")
@UseGuards(JwtAuthGuard)
export class AdController {
  constructor(private readonly adService: AdService) {}

  @Post()
  async create(@Req() request: AuthenticatedRequest, @Body() body: unknown): Promise<AdDto> {
    const dto = parseWithZod(createAdRequestSchema, body);
    return this.adService.create(request.userId, dto);
  }

  @Patch(":id")
  async update(
    @Req() request: AuthenticatedRequest,
    @Param("id") id: string,
    @Body() body: unknown,
  ): Promise<AdDto> {
    const dto = parseWithZod(updateAdRequestSchema, body);
    return this.adService.update(request.userId, id, dto);
  }

  @Post(":id/submit")
  async submit(@Req() request: AuthenticatedRequest, @Param("id") id: string): Promise<AdDto> {
    return this.adService.submit(request.userId, id);
  }

  @Post(":id/cancel")
  async cancel(@Req() request: AuthenticatedRequest, @Param("id") id: string): Promise<AdDto> {
    return this.adService.cancel(request.userId, id);
  }

  @Get()
  async list(@Req() request: AuthenticatedRequest): Promise<ListAdsResponse> {
    const ads = await this.adService.list(request.userId);
    return { ads };
  }

  @Get(":id/stats")
  async stats(
    @Req() request: AuthenticatedRequest,
    @Param("id") id: string,
  ): Promise<AdStatsResponse> {
    return this.adService.stats(request.userId, id);
  }
}
