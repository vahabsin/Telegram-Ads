import { Body, Controller, Post } from "@nestjs/common";
import {
  telegramWebAppAuthRequestSchema,
  type TelegramWebAppAuthResponse,
} from "@telegram-ads/shared-types";
import { parseWithZod } from "../common/zod-validate";
import { AuthService } from "./auth.service";

@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("telegram-webapp")
  async telegramWebApp(@Body() body: unknown): Promise<TelegramWebAppAuthResponse> {
    const { initData } = parseWithZod(telegramWebAppAuthRequestSchema, body);
    return this.authService.authenticateWithTelegramWebApp(initData);
  }
}
