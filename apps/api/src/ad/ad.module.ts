import { Module } from "@nestjs/common";
import { WalletModule } from "../wallet/wallet.module";
import { AdController } from "./ad.controller";
import { AdService } from "./ad.service";

@Module({
  imports: [WalletModule],
  controllers: [AdController],
  providers: [AdService],
  exports: [AdService],
})
export class AdModule {}
