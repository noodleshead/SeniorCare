import { z } from "zod";

export const approveVerificationSchema = z.object({
  remarks: z.string().trim().max(1000).optional().default(""),
});

export const rejectVerificationSchema = z.object({
  reason: z.string().trim().min(1, "A rejection reason is required.").max(1000),
});
