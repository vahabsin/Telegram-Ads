import { PrismaClient } from "../generated/client";

export * from "../generated/client";

// Single shared PrismaClient instance for the whole monorepo.
// apps/api wraps this in a NestJS-managed PrismaService (see apps/api/src/prisma).
export const prisma = new PrismaClient();
