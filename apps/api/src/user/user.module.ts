import { Module } from "@nestjs/common";
import { WalletModule } from "../wallet/wallet.module";
import { UserController } from "./user.controller";
import { UserService } from "./user.service";

@Module({
  imports: [WalletModule],
  controllers: [UserController],
  providers: [UserService],
  exports: [UserService],
})
export class UserModule {}
