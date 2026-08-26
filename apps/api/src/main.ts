import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { loadEnv } from "@telegram-ads/config";
import { AppModule } from "./app.module";

async function bootstrap() {
  const env = loadEnv();
  const app = await NestFactory.create(AppModule);
  app.enableCors();
  await app.listen(env.API_PORT);
}

void bootstrap();
