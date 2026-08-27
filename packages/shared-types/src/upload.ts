import { z } from "zod";
import { adMediaTypeSchema } from "./ad";

// POST /uploads (multipart/form-data, field name "file") - used by the ad wizard's Creative
// step (docs/PRD.md section 2.3 step 4) to get a mediaUrl before submitting the ad payload.
export const uploadResponseSchema = z.object({
  url: z.string().url(),
  mediaType: adMediaTypeSchema,
});
export type UploadResponse = z.infer<typeof uploadResponseSchema>;
