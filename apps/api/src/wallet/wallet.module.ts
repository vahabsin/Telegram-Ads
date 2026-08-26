import { Module } from "@nestjs/common";
import { PlatformSettingsModule } from "../platform-settings/platform-settings.module";
import { TelegramBotApiClient } from "../telegram/telegram-bot-api.client";
import { WalletController } from "./wallet.controller";
import { WalletService } from "./wallet.service";

@Module({
  imports: [PlatformSettingsModule],
  controllers: [WalletController],
  providers: [WalletService, TelegramBotApiClient],
  exports: [WalletService],
})
export class WalletModule {}
