import { z } from "zod";

// One schema per PUT-able section. `.strict()` on every object rejects
// any key not explicitly listed here — this IS the settings whitelist
// (module requirement §18/§31): an unrecognized key is a validation
// error, not silently ignored or saved. There is deliberately no
// generic "PUT /settings { key, value }" endpoint that could accept
// arbitrary keys — see systemSettings.routes.js.

export const generalSettingsSchema = z
  .object({
    systemName: z.string().trim().min(1, "System name is required.").max(100),
    systemDescription: z.string().trim().max(300).optional().default(""),
    contactEmail: z.string().trim().toLowerCase().email().optional().or(z.literal("")).default(""),
    contactNumber: z.string().trim().max(30).optional().default(""),
  })
  .strict();

export const maintenanceModeSchema = z
  .object({
    maintenanceMode: z.boolean(),
  })
  .strict();

export const notificationSettingsSchema = z
  .object({
    enabled: z.boolean(),
  })
  .strict();

export const applicationSettingsSchema = z
  .object({
    enabled: z.boolean(),
  })
  .strict();

export const registrationSettingsSchema = z
  .object({
    seniorRegistrationEnabled: z.boolean(),
    guardianRegistrationEnabled: z.boolean(),
  })
  .strict();

// Maps the `:section` route param to its schema and the field on
// SystemSetting it corresponds to. Adding a new section means adding
// one entry here — there is no path by which a new, unvalidated section
// key could reach the database.
export const SETTINGS_SECTIONS = {
  general: { schema: generalSettingsSchema, field: "general" },
  maintenance: { schema: maintenanceModeSchema, field: null }, // top-level field, see service
  notifications: { schema: notificationSettingsSchema, field: "notifications" },
  applications: { schema: applicationSettingsSchema, field: "applications" },
  registration: { schema: registrationSettingsSchema, field: "registration" },
};
