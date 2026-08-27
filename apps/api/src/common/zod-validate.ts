import { BadRequestException } from "@nestjs/common";
import type { ZodType, ZodTypeDef } from "zod";

// `ZodType<Output, Def, Input>` (not the narrower `ZodSchema<T>` alias, which pins Input = T
// too) so schemas with `.default(...)` fields - where Input and Output legitimately differ -
// still infer T as the fully-defaulted Output type, matching what generated DTOs expect.
export function parseWithZod<T>(schema: ZodType<T, ZodTypeDef, unknown>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new BadRequestException(result.error.flatten());
  }
  return result.data;
}
