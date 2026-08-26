import { Global, Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import type { Env } from "@telegram-ads/config";
import { ENV } from "../config/config.module";

// Global so JwtService is available to any module (e.g. UserModule's JwtAuthGuard)
// without creating a circular import with AuthModule (which needs UserModule).
@Global()
@Module({
  imports: [
    JwtModule.registerAsync({
      useFactory: (env: Env) => ({
        secret: env.JWT_SECRET,
        signOptions: { expiresIn: "7d" },
      }),
      inject: [ENV],
    }),
  ],
  exports: [JwtModule],
})
export class JwtCoreModule {}
