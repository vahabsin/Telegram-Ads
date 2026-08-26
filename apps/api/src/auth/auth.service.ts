import { Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import type { Env } from "@telegram-ads/config";
import type { LanguageCode } from "@telegram-ads/shared-types";
import { ENV } from "../config/config.module";
import { UserService } from "../user/user.service";
import { validateTelegramInitData } from "./telegram-init-data";

const SUPPORTED_LANGUAGES: readonly LanguageCode[] = ["fa", "en", "ar"];
const DEFAULT_LANGUAGE: LanguageCode = "en";

function normalizeLanguageCode(code: string | undefined): LanguageCode {
  return (SUPPORTED_LANGUAGES as readonly string[]).includes(code ?? "")
    ? (code as LanguageCode)
    : DEFAULT_LANGUAGE;
}

@Injectable()
export class AuthService {
  constructor(
    @Inject(ENV) private readonly env: Env,
    private readonly userService: UserService,
    private readonly jwtService: JwtService,
  ) {}

  async authenticateWithTelegramWebApp(initData: string): Promise<{ accessToken: string }> {
    if (!this.env.TELEGRAM_BOT_TOKEN) {
      throw new UnauthorizedException("Telegram bot token is not configured on the server");
    }

    const result = validateTelegramInitData(initData, this.env.TELEGRAM_BOT_TOKEN);
    if (!result.ok) {
      throw new UnauthorizedException(`Invalid Telegram initData: ${result.reason}`);
    }
    if (!result.data.user) {
      throw new UnauthorizedException("initData did not include a user");
    }

    const user = await this.userService.findOrCreateFromTelegram({
      telegramId: BigInt(result.data.user.id),
      username: result.data.user.username ?? null,
      firstName: result.data.user.first_name ?? null,
      languageCode: normalizeLanguageCode(result.data.user.language_code),
    });

    const accessToken = await this.jwtService.signAsync({ sub: user.id });
    return { accessToken };
  }
}
