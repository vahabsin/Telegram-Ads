import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class PlatformSettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async getNumber(key: string, fallback: number): Promise<number> {
    const setting = await this.prisma.platformSetting.findUnique({ where: { key } });
    if (!setting || typeof setting.value !== "number") {
      return fallback;
    }
    return setting.value;
  }
}
