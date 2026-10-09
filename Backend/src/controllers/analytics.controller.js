import * as analyticsService from "../services/analytics.service.js";
import { toCsv, sendCsv } from "../utils/csv.js";
import { safeCreateAuditLog } from "../services/auditLog.service.js";
import { AUDIT_ACTIONS, AUDIT_MODULES } from "../utils/constants.js";

// Every handler resolves scope from req.user (set by `authenticate` from
// the verified JWT) — a `barangayId` query param is only ever a
// *narrowing* filter for ADMIN/LGU_OSCA; analytics.service.js ignores it
// entirely for BARANGAY_STAFF. See resolveScope() there.

export async function getBarangays(req, res, next) {
  try {
    const data = await analyticsService.listAnalyticsBarangays(req.user);
    res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function getSummary(req, res, next) {
  try {
    const data = await analyticsService.getSeniorAnalytics(req.user, {
      barangayId: req.query.barangayId,
      pensionMonth: req.query.pensionMonth,
      pensionYear: req.query.pensionYear,
    });
    res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

// Phase 8 — LGU report export (Step 17/19). Reuses the same CSV builder
// Admin System Reports already uses (utils/csv.js) rather than a new
// export framework. Re-derives the SAME report the caller is currently
// viewing (same filters) server-side, exactly like adminReports.controller.js's
// exports already do, so the file can never diverge from what's on screen.
export async function exportBarangayComparisonCsv(req, res, next) {
  try {
    const data = await analyticsService.getSeniorAnalytics(req.user, { barangayId: req.query.barangayId });
    const rows = data.byBarangay.length
      ? data.byBarangay
      : data.barangay
      ? [
          {
            name: data.barangay.name,
            seniors: data.totals.seniors,
            bedridden: data.totals.bedridden,
            pensionBeneficiaries: data.pension.totalBeneficiaries,
            activeApplications: data.applications.reduce((a, c) => (c.status !== "REJECTED" ? a + c.count : a), 0),
            homeVisitsRequired: data.medical.homeVisitRequired.REQUIRED,
            homeVisitsCompleted: data.medical.homeVisitExecution.COMPLETED,
            pendingBarangayVerification: data.workflow.barangayVerification.PENDING,
            endorsed: data.workflow.endorsement.ENDORSED,
          },
        ]
      : [];
    const csv = toCsv(rows, [
      { key: "name", label: "Barangay" },
      { key: "seniors", label: "Total Seniors" },
      { key: "bedridden", label: "Bedridden" },
      { key: "pensionBeneficiaries", label: "Pension Beneficiaries" },
      { key: "activeApplications", label: "Active Applications" },
      { key: "homeVisitsRequired", label: "Home Visits Required" },
      { key: "homeVisitsCompleted", label: "Home Visits Completed" },
      { key: "pendingBarangayVerification", label: "Pending Barangay Verification" },
      { key: "endorsed", label: "Endorsed" },
    ]);
    await safeCreateAuditLog({
      actor: req.user,
      action: AUDIT_ACTIONS.LGU_REPORT_EXPORTED,
      module: AUDIT_MODULES.REPORTS,
      description: `${req.user.role} exported the LGU barangay comparison report as CSV.`,
      metadata: { reportType: "LGU_BARANGAY_COMPARISON", barangayId: req.query.barangayId || "ALL" },
    });
    sendCsv(res, "lgu-barangay-comparison.csv", csv);
  } catch (err) {
    next(err);
  }
}

export async function exportWorkflowCsv(req, res, next) {
  try {
    const data = await analyticsService.getSeniorAnalytics(req.user, { barangayId: req.query.barangayId });
    const rows = [
      { metric: "Applications — Submitted", value: data.applications.find((a) => a.status === "SUBMITTED")?.count || 0 },
      { metric: "Applications — Under Review", value: data.applications.find((a) => a.status === "UNDER_REVIEW")?.count || 0 },
      { metric: "Applications — Endorsed", value: data.applications.find((a) => a.status === "ENDORSED")?.count || 0 },
      { metric: "Applications — Revision Required", value: data.applications.find((a) => a.status === "REVISION_REQUIRED")?.count || 0 },
      { metric: "Applications — Approved", value: data.applications.find((a) => a.status === "APPROVED")?.count || 0 },
      { metric: "Applications — Released", value: data.applications.find((a) => a.status === "RELEASED")?.count || 0 },
      { metric: "Applications — Claimed", value: data.applications.find((a) => a.status === "CLAIMED")?.count || 0 },
      { metric: "Applications — Rejected", value: data.applications.find((a) => a.status === "REJECTED")?.count || 0 },
      { metric: "Barangay Verification — Pending", value: data.workflow.barangayVerification.PENDING },
      { metric: "Barangay Verification — Verified", value: data.workflow.barangayVerification.VERIFIED },
      { metric: "Barangay Verification — Revision Required", value: data.workflow.barangayVerification.REVISION_REQUIRED },
      { metric: "Barangay Verification — Rejected", value: data.workflow.barangayVerification.REJECTED },
      { metric: "Home Visits Required (Admin)", value: data.medical.homeVisitRequired.REQUIRED },
      { metric: "Home Visits Completed (Barangay)", value: data.medical.homeVisitExecution.COMPLETED },
      { metric: "Barangay Endorsed", value: data.workflow.endorsement.ENDORSED },
      { metric: "Ready for OSCA Review", value: data.workflow.readyForOscaReview },
    ];
    const csv = toCsv(rows, [
      { key: "metric", label: "Metric" },
      { key: "value", label: "Value" },
    ]);
    await safeCreateAuditLog({
      actor: req.user,
      action: AUDIT_ACTIONS.LGU_REPORT_EXPORTED,
      module: AUDIT_MODULES.REPORTS,
      description: `${req.user.role} exported the LGU workflow overview report as CSV.`,
      metadata: { reportType: "LGU_WORKFLOW_OVERVIEW", barangayId: req.query.barangayId || "ALL" },
    });
    sendCsv(res, "lgu-workflow-overview.csv", csv);
  } catch (err) {
    next(err);
  }
}

export async function getMapMarkers(req, res, next) {
  try {
    const data = await analyticsService.getSeniorMapMarkers(req.user, { barangayId: req.query.barangayId });
    res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}
