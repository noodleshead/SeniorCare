import { z } from "zod";
import { CONCERN_CATEGORY, CONCERN_URGENCY, CONCERN_STATUS, CONCERN_PRIORITY } from "../utils/constants.js";

export const createConcernSchema = z.object({
  subject: z.string().trim().min(1, "Subject is required.").max(200),
  description: z.string().trim().min(1, "Description is required.").max(3000),
  category: z.enum(Object.values(CONCERN_CATEGORY)).optional().default(CONCERN_CATEGORY.OTHER),
  reportedUrgency: z.enum(Object.values(CONCERN_URGENCY)).optional().nullable(),
});

export const changeStatusSchema = z.object({
  toStatus: z.enum(Object.values(CONCERN_STATUS), { errorMap: () => ({ message: "Invalid status." }) }),
  note: z.string().trim().max(500).optional(),
});

export const setPrioritySchema = z.object({
  priority: z.enum(Object.values(CONCERN_PRIORITY), { errorMap: () => ({ message: "Invalid priority." }) }),
  reason: z.string().trim().min(1, "A reason is required when classifying priority.").max(1000),
});

export const respondSchema = z.object({
  message: z.string().trim().min(1, "A response message is required.").max(2000),
});
