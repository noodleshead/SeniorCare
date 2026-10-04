import { z } from "zod";
import { ANNOUNCEMENT_CATEGORY, ANNOUNCEMENT_SCOPE, TARGET_AUDIENCE } from "../utils/constants.js";

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid id.");

export const createAnnouncementSchema = z.object({
  title: z.string().trim().min(1, "Title is required.").max(200),
  content: z.string().trim().min(1, "Content is required.").max(5000),
  category: z.enum(Object.values(ANNOUNCEMENT_CATEGORY)).optional().default(ANNOUNCEMENT_CATEGORY.GENERAL),
  targetAudience: z.enum(Object.values(TARGET_AUDIENCE)).optional().default(TARGET_AUDIENCE.ALL),
  scope: z.enum(Object.values(ANNOUNCEMENT_SCOPE)).optional(),
  barangayIds: z.array(objectId).optional().default([]),
  isImportant: z.coerce.boolean().optional().default(false),
});

export const updateAnnouncementSchema = createAnnouncementSchema.partial();
