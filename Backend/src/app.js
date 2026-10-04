import express from "express";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import morgan from "morgan";
import mongoSanitize from "express-mongo-sanitize";

import authRoutes from "./routes/auth.routes.js";
import registrationRoutes from "./routes/registration.routes.js";
import verificationRoutes from "./routes/verification.routes.js";
import adminRoutes from "./routes/admin.routes.js";
import seniorRoutes from "./routes/senior.routes.js";
import pensionRoutes from "./routes/pension.routes.js";
import pensionScheduleRoutes from "./routes/pensionSchedule.routes.js";
import pensionClaimRoutes from "./routes/pensionClaim.routes.js";
import benefitProgramRoutes from "./routes/benefitProgram.routes.js";
import benefitApplicationRoutes from "./routes/benefitApplication.routes.js";
import announcementRoutes from "./routes/announcement.routes.js";
import notificationRoutes from "./routes/notification.routes.js";
import activityRoutes from "./routes/activity.routes.js";
import concernRoutes from "./routes/concern.routes.js";
import guardianRoutes from "./routes/guardian.routes.js";
import analyticsRoutes from "./routes/analytics.routes.js";
import adminReportsRoutes from "./routes/adminReports.routes.js";
import auditLogRoutes from "./routes/auditLog.routes.js";
import systemSettingsRoutes from "./routes/systemSettings.routes.js";
import userManagementRoutes from "./routes/userManagement.routes.js";
import illnessRoutes from "./routes/illness.routes.js";
import medicalVerificationRoutes from "./routes/medicalVerification.routes.js";
import barangayEndorsementRoutes from "./routes/barangayEndorsement.routes.js";
import { notFoundHandler, errorHandler } from "./middleware/error.middleware.js";
import { getBarangays } from "./controllers/registration.controller.js";

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(
    cors({
      origin: process.env.CLIENT_URL || "http://localhost:8000",
      credentials: true,
    })
  );
  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: true, limit: "1mb" }));
  app.use(cookieParser());
  app.use(mongoSanitize());

  if (process.env.NODE_ENV !== "test") {
    app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));
  }

  app.get("/api/health", (_req, res) => {
    res.status(200).json({ success: true, message: "SENIORCARE API is running." });
  });

  app.use("/api/auth", authRoutes);
  app.use("/api/registration", registrationRoutes);
  app.use("/api/verifications", verificationRoutes);
  app.use("/api/admin", adminRoutes);
  app.use("/api/seniors", seniorRoutes);
  app.use("/api/pensions", pensionRoutes);
  app.use("/api/pension-schedules", pensionScheduleRoutes);
  app.use("/api/pension-claims", pensionClaimRoutes);
  app.use("/api/benefits", benefitProgramRoutes);
  app.use("/api/benefit-applications", benefitApplicationRoutes);
  app.use("/api/announcements", announcementRoutes);
  app.use("/api/notifications", notificationRoutes);
  app.use("/api/activities", activityRoutes);
  app.use("/api/concerns", concernRoutes);
  app.use("/api/guardian", guardianRoutes);
  app.use("/api/analytics", analyticsRoutes);
  app.use("/api/admin-reports", adminReportsRoutes);
  app.use("/api/audit-logs", auditLogRoutes);
  app.use("/api/settings", systemSettingsRoutes);
  app.use("/api/admin/users", userManagementRoutes);
  app.use("/api/admin/illnesses", illnessRoutes);
  app.use("/api/admin/medical-verification", medicalVerificationRoutes);
  app.use("/api/barangay/endorsement", barangayEndorsementRoutes);
  // Convenience alias — same handler as GET /api/registration/barangays.
  app.get("/api/barangays", getBarangays);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
