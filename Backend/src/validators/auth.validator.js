import { z } from "zod";

export const loginSchema = z.object({
  emailOrUsername: z.string().trim().min(1, "Please enter your email or username."),
  password: z.string().min(1, "Please enter your password."),
});

export const forgotPasswordSchema = z.object({
  email: z.string().trim().email("Please enter a valid email address."),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, "Reset token is required."),
  newPassword: z
    .string()
    .min(8, "Password must be at least 8 characters.")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter.")
    .regex(/\d/, "Password must contain at least one number."),
});
