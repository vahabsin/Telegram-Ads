import { Module } from "@nestjs/common";
import { ThrottlerModule } from "@nestjs/throttler";
import { PlatformSettingsModule } from "../platform-settings/platform-settings.module";
import { InternalServiceGuard } from "./internal-service.guard";
import { ServeController } from "./serve.controller";
import { ServeService } from "./serve.service";

@Module({
  // Scoped to this module's controller only (not APP_GUARD) - see serve.controller.ts.
  imports: [ThrottlerModule.forRoot([{ name: "default", ttl: 10_000, limit: 30 }]), PlatformSettingsModule],
  controllers: [ServeController],
  providers: [ServeService, InternalServiceGuard],
})
export class ServeModule {}
