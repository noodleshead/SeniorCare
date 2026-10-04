import { z } from "zod";
import { ACTIVITY_CATEGORY } from "../utils/constants.js";

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid id.");
const timeString = z.string().regex(/^\d{1,2}:\d{2}\s*(AM|PM)$/i, "Time must be like '09:00 AM'.");

function parseTimeToMinutes(value) {
  const match = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(value.trim());
  if (!match) return null;
  let [, hours, minutes, meridiem] = match;
  hours = parseInt(hours, 10);
  minutes = parseInt(minutes, 10);
  if (meridiem.toUpperCase() === "PM" && hours !== 12) hours += 12;
  if (meridiem.toUpperCase() === "AM" && hours === 12) hours = 0;
  return hours * 60 + minutes;
}

const baseShape = {
  title: z.string().trim().min(1, "Title is required.").max(200),
  description: z.string().trim().min(1, "Description is required.").max(5000),
  category: z.enum(Object.values(ACTIVITY_CATEGORY)).optional().default(ACTIVITY_CATEGORY.GENERAL),
  barangayId: objectId.optional(),
  date: z.coerce.date({ errorMap: () => ({ message: "A valid date is required." }) }),
  startTime: timeString,
  endTime: timeString,
  venue: z.string().trim().min(1, "Venue is required.").max(200),
  participantInfo: z.string().trim().max(1000).optional().default(""),
  attendanceConfirmationEnabled: z.coerce.boolean().optional().default(false),
};

function withTimeOrderCheck(schema) {
  return schema.refine(
    (data) => {
      if (!data.startTime || !data.endTime) return true;
      const start = parseTimeToMinutes(data.startTime);
      const end = parseTimeToMinutes(data.endTime);
      if (start == null || end == null) return true;
      return end > start;
    },
    { message: "End time must be after start time.", path: ["endTime"] }
  );
}

export const createActivitySchema = withTimeOrderCheck(z.object(baseShape));

export const updateActivitySchema = withTimeOrderCheck(
  z.object(
    Object.fromEntries(Object.entries(baseShape).map(([key, schema]) => [key, schema.optional()]))
  )
);
