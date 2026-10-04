import * as analyticsService from "../services/analytics.service.js";

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
    const data = await analyticsService.getSeniorAnalytics(req.user, { barangayId: req.query.barangayId });
    res.status(200).json({ success: true, data });
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
