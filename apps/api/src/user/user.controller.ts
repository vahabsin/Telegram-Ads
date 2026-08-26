import { Controller, Get, Req, UseGuards } from "@nestjs/common";
import type { MeResponse } from "@telegram-ads/shared-types";
import { JwtAuthGuard, type AuthenticatedRequest } from "../auth/jwt-auth.guard";
import { UserService } from "./user.service";

@Controller()
export class UserController {
  constructor(private readonly userService: UserService) {}

  @UseGuards(JwtAuthGuard)
  @Get("me")
  async me(@Req() request: AuthenticatedRequest): Promise<MeResponse> {
    const user = await this.userService.getByIdWithWallet(request.userId);
    return {
      id: user.id,
      telegramId: user.telegramId.toString(),
      username: user.username,
      firstName: user.firstName,
      languageCode: user.languageCode as MeResponse["languageCode"],
      isAdvertiser: user.isAdvertiser,
      isPublisher: user.isPublisher,
      wallet: {
        balanceCoins: user.wallet.balanceCoins.toString(),
      },
    };
  }
}
