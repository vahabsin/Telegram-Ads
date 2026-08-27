import { Module } from "@nestjs/common";
import { AdModule } from "./ad/ad.module";
import { AuthModule } from "./auth/auth.module";
import { JwtCoreModule } from "./auth/jwt-core.module";
import { ConfigModule } from "./config/config.module";
import { HealthModule } from "./health/health.module";
import { PrismaModule } from "./prisma/prisma.module";
import { UserModule } from "./user/user.module";
import { WalletModule } from "./wallet/wallet.module";

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    JwtCoreModule,
    HealthModule,
    WalletModule,
    UserModule,
    AuthModule,
    AdModule,
  ],
})
export class AppModule {}
