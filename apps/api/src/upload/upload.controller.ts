import { randomUUID } from "node:crypto";
import { extname } from "node:path";
import {
  BadRequestException,
  Controller,
  Inject,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import type { Env } from "@telegram-ads/config";
import type { AdMediaType, UploadResponse } from "@telegram-ads/shared-types";
import { diskStorage } from "multer";
import { ENV } from "../config/config.module";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { UPLOAD_DIR, UPLOAD_ROUTE_PREFIX } from "./upload.constants";

// Placeholder limit - revisit if real ad creatives need larger video files.
const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024;

const MIME_TO_MEDIA_TYPE: Record<string, AdMediaType> = {
  "image/jpeg": "IMAGE",
  "image/png": "IMAGE",
  "image/webp": "IMAGE",
  "image/gif": "IMAGE",
  "video/mp4": "VIDEO",
  "video/webm": "VIDEO",
  "video/quicktime": "VIDEO",
};

@Controller("uploads")
@UseGuards(JwtAuthGuard)
export class UploadController {
  constructor(@Inject(ENV) private readonly env: Env) {}

  @Post()
  @UseInterceptors(
    FileInterceptor("file", {
      storage: diskStorage({
        destination: UPLOAD_DIR,
        filename: (_req, file, callback) => {
          callback(null, `${randomUUID()}${extname(file.originalname)}`);
        },
      }),
      limits: { fileSize: MAX_FILE_SIZE_BYTES },
      fileFilter: (_req, file, callback) => {
        if (!(file.mimetype in MIME_TO_MEDIA_TYPE)) {
          callback(new BadRequestException(`Unsupported file type: ${file.mimetype}`), false);
          return;
        }
        callback(null, true);
      },
    }),
  )
  upload(@UploadedFile() file: Express.Multer.File): UploadResponse {
    if (!file) {
      throw new BadRequestException("No file uploaded (expected multipart field \"file\")");
    }
    // fileFilter above already rejects anything not in this map, but re-check defensively
    // here so the type is narrowed without a non-null assertion.
    const mediaType = MIME_TO_MEDIA_TYPE[file.mimetype];
    if (!mediaType) {
      throw new BadRequestException(`Unsupported file type: ${file.mimetype}`);
    }
    return {
      url: new URL(`${UPLOAD_ROUTE_PREFIX}/${file.filename}`, this.env.API_PUBLIC_URL).toString(),
      mediaType,
    };
  }
}
