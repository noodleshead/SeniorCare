import { z } from "zod";

export const createGuardianAccountSchema = z.object({
  email: z.string().trim().toLowerCase().email("A valid email is required."),
  password: z.string().min(8, "Password must be at least 8 characters.").optional(),
});

export const resetGuardianPasswordSchema = z.object({
  password: z.string().min(8, "Password must be at least 8 characters.").optional(),
});
