import * as claimService from "../services/pensionClaim.service.js";
import { resolveActingSenior } from "../utils/guardianAccess.js";
import { safeCreateAuditLog } from "../services/auditLog.service.js";
import { AUDIT_ACTIONS, AUDIT_MODULES, CLAIM_STATUS } from "../utils/constants.js";

// These 5 functions resolve the acting Senior via resolveActingSenior()
// so an authorized Guardian can act for their managed Senior, then pass
// that Senior's OWN userId into pensionClaim.service.js exactly as
// before — the service layer is intentionally untouched: for an
// existing SENIOR_CITIZEN, senior.userId === req.user.id always, so
// behavior is byte-for-byte identical to before this change.

export async function bookSlot(req, res, next) {
  try {
    const senior = await resolveActingSenior(req.user, req.query.seniorId);
    const claim = await claimService.bookSlot(senior.userId, req.validatedBody);
    res.status(201).json({ success: true, data: claim });
  } catch (err) {
    next(err);
  }
}

export async function getMyUpcomingClaim(req, res, next) {
  try {
    const senior = await resolveActingSenior(req.user, req.query.seniorId);
    const claim = await claimService.getMyUpcomingClaim(senior.userId);
    res.status(200).json({ success: true, data: claim });
  } catch (err) {
    next(err);
  }
}

export async function getMyClaimHistory(req, res, next) {
  try {
    const senior = await resolveActingSenior(req.user, req.query.seniorId);
    const history = await claimService.getMyClaimHistory(senior.userId);
    res.status(200).json({ success: true, data: history });
  } catch (err) {
    next(err);
  }
}

export async function getMyClaimQr(req, res, next) {
  try {
    const senior = await resolveActingSenior(req.user, req.query.seniorId);
    const { claim, qrDataUrl } = await claimService.getMyClaimQr(senior.userId, req.params.id);
    res.status(200).json({ success: true, data: { claim, qrDataUrl } });
  } catch (err) {
    next(err);
  }
}

export async function listClaims(req, res, next) {
  try {
    const { barangayId, scheduleId, date } = req.query;
    const claims = await claimService.listClaimsForBarangay(req.user, { barangayId, scheduleId, date });
    res.status(200).json({ success: true, data: claims });
  } catch (err) {
    next(err);
  }
}

// Step 1: resolve a scanned/entered QR token to claim info for Staff to
// review. Never changes the claim's status — see pensionClaim.service.js.
export async function resolveClaim(req, res, next) {
  try {
    const claim = await claimService.resolveClaimByToken(req.user, req.validatedBody.qrToken);
    res.status(200).json({ success: true, data: claim });
  } catch (err) {
    next(err);
  }
}

// Step 2: Staff explicitly confirms the claim that was just resolved,
// which is the only place a claim actually becomes CLAIMED.
export async function confirmClaim(req, res, next) {
  try {
    const claim = await claimService.confirmClaim(req.user, req.validatedBody.qrToken);
    res.status(200).json({ success: true, data: claim });
  } catch (err) {
    next(err);
  }
}

export async function cancelClaim(req, res, next) {
  try {
    const senior = await resolveActingSenior(req.user, req.query.seniorId);
    const claim = await claimService.cancelClaim(senior.userId, req.params.id);
    // req.user is the actual actor (may be a Guardian acting for
    // `senior`, per resolveActingSenior above) — always the authenticated
    // caller, never the Senior's own id when a Guardian is acting.
    await safeCreateAuditLog({
      actor: req.user,
      action: AUDIT_ACTIONS.CANCEL,
      module: AUDIT_MODULES.PENSION,
      entityType: "PensionClaim",
      entityId: claim._id,
      description: `${req.user.role} cancelled a pension claim booking.`,
      metadata: { seniorId: senior._id, statusFrom: CLAIM_STATUS.SCHEDULED, statusTo: CLAIM_STATUS.CANCELLED },
    });
    res.status(200).json({ success: true, data: claim });
  } catch (err) {
    next(err);
  }
}
