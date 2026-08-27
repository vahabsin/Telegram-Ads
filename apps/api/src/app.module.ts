import { Module } from "@nestjs/common";
import { AdModule } from "./ad/ad.module";
import { AuthModule } from "./auth/auth.module";
import { JwtCoreModule } from "./auth/jwt-core.module";
import { CategoryModule } from "./category/category.module";
import { ConfigModule } from "./config/config.module";
import { HealthModule } from "./health/health.module";
import { PrismaModule } from "./prisma/prisma.module";
import { ServeModule } from "./serve/serve.module";
import { UploadModule } from "./upload/upload.module";
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
    UploadModule,
    CategoryModule,
    ServeModule,
  ],
})
export class AppModule {}
