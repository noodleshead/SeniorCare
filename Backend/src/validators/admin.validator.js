import { z } from "zod";
import { ACCOUNT_STATUS } from "../utils/constants.js";

const objectIdSchema = z
  .string()
  .trim()
  .regex(/^[0-9a-fA-F]{24}$/, "Please select a valid Barangay.");

export const createBarangaySchema = z.object({
  name: z.string().trim().min(1, "Barangay name is required.").max(120),
  municipality: z.string().trim().min(1, "Municipality/City is required.").max(120),
  province: z.string().trim().min(1, "Province is required.").max(120),
  code: z
    .string()
    .trim()
    .min(1, "Barangay code is required.")
    .max(20)
    .regex(/^[A-Za-z0-9-]+$/, "Code may only contain letters, numbers, and hyphens."),
});

// Only ACTIVE/INACTIVE make sense for an admin-provisioned staff account —
// PENDING_VERIFICATION and REJECTED are states that belong to the senior
// registration/verification pipeline, not admin-driven provisioning.
const STAFF_STATUSES = [ACCOUNT_STATUS.ACTIVE, ACCOUNT_STATUS.INACTIVE];

export const createStaffSchema = z.object({
  email: z.string().trim().toLowerCase().email("Please enter a valid email address."),
  username: z.string().trim().min(3).max(40).optional(),
  assignedBarangayId: objectIdSchema,
  // Optional: if omitted, the backend generates a secure random initial
  // password (see admin.service.js#generateTemporaryPassword).
  password: z
    .string()
    .min(8, "Password must be at least 8 characters.")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter.")
    .regex(/\d/, "Password must contain at least one number.")
    .optional(),
  status: z.enum(STAFF_STATUSES).optional().default(ACCOUNT_STATUS.ACTIVE),
});

export const updateStaffAssignmentSchema = z.object({
  assignedBarangayId: objectIdSchema,
});

export const updateStaffStatusSchema = z.object({
  status: z.enum(STAFF_STATUSES),
});
