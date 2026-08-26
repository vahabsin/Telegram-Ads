import { z } from "zod";

// Minimum supported languages per docs/PRD.md section 2.1 - i18n-ready for adding more later.
export const languageCodeSchema = z.enum(["fa", "en", "ar"]);
export type LanguageCode = z.infer<typeof languageCodeSchema>;
