import { z } from "zod";
import { PENSION_TYPES, PENSION_FREQUENCY, PENSION_STATUS } from "../utils/constants.js";

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid id.");

export const createPensionSchema = z.object({
  seniorId: objectId,
  pensionType: z.enum(Object.values(PENSION_TYPES)),
  pensionProvider: z.string().trim().max(150).optional().default(""),
  pensionAmount: z.coerce.number().min(0, "Pension amount cannot be negative."),
  frequency: z.enum(Object.values(PENSION_FREQUENCY)),
  effectiveDate: z.coerce.date(),
  status: z.enum(Object.values(PENSION_STATUS)).optional().default(PENSION_STATUS.ACTIVE),
});

export const updatePensionSchema = z.object({
  pensionType: z.enum(Object.values(PENSION_TYPES)).optional(),
  pensionProvider: z.string().trim().max(150).optional(),
  pensionAmount: z.coerce.number().min(0, "Pension amount cannot be negative.").optional(),
  frequency: z.enum(Object.values(PENSION_FREQUENCY)).optional(),
  effectiveDate: z.coerce.date().optional(),
  status: z.enum(Object.values(PENSION_STATUS)).optional(),
});

const slotInputSchema = z.object({
  startTime: z.string().trim().min(1),
  endTime: z.string().trim().min(1),
  capacity: z.coerce.number().int().min(1).max(500),
});

export const createScheduleSchema = z.object({
  // Optional here: BARANGAY_STAFF never needs to send this (the service
  // always derives their barangay from the authenticated user, never
  // from the request body — see pensionSchedule.service.js#createSchedule).
  // ADMIN/LGU_OSCA use it to pick which barangay the schedule is for.
  // It MUST be declared here or Zod silently strips it from
  // req.validatedBody even if the frontend sends it.
  barangayId: objectId.optional(),
  date: z.coerce.date(),
  location: z.string().trim().min(1).max(200),
  startTime: z.string().trim().min(1),
  endTime: z.string().trim().min(1),
  slots: z.array(slotInputSchema).min(1, "At least one claiming slot is required."),
});

export const updateScheduleSchema = z.object({
  date: z.coerce.date().optional(),
  location: z.string().trim().min(1).max(200).optional(),
  startTime: z.string().trim().min(1).optional(),
  endTime: z.string().trim().min(1).optional(),
  status: z.enum(["OPEN", "CLOSED"]).optional(),
});

export const bookSlotSchema = z.object({
  scheduleId: objectId,
  slotId: objectId,
});

export const verifyClaimSchema = z.object({
  qrToken: z.string().trim().min(10, "Invalid claiming pass."),
});
