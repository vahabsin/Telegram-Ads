import { existsSync, mkdirSync } from "node:fs";
import { Module } from "@nestjs/common";
import { ServeStaticModule } from "@nestjs/serve-static";
import { UPLOAD_DIR, UPLOAD_ROUTE_PREFIX } from "./upload.constants";
import { UploadController } from "./upload.controller";

@Module({
  imports: [ServeStaticModule.forRoot({ rootPath: UPLOAD_DIR, serveRoot: UPLOAD_ROUTE_PREFIX })],
  controllers: [UploadController],
})
export class UploadModule {
  constructor() {
    if (!existsSync(UPLOAD_DIR)) {
      mkdirSync(UPLOAD_DIR, { recursive: true });
    }
  }
}
