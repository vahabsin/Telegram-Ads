import { Global, Module } from "@nestjs/common";
import { loadEnv } from "@telegram-ads/config";

export const ENV = Symbol("ENV");

// Loads and validates process.env once at boot (fail-fast) and makes it injectable
// everywhere via `@Inject(ENV) env: Env` without every module re-parsing process.env.
@Global()
@Module({
  providers: [{ provide: ENV, useValue: loadEnv() }],
  exports: [ENV],
})
export class ConfigModule {}
