import mongoose from "mongoose";
import crypto from "node:crypto";
import QRCode from "qrcode";
import PensionSchedule from "../models/PensionSchedule.js";
import PensionClaim from "../models/PensionClaim.js";
import Pension from "../models/Pension.js";
import Senior from "../models/Senior.js";
import { CLAIM_STATUS, SCHEDULE_STATUS, NOTIFICATION_TYPE, AUDIT_ACTIONS, AUDIT_MODULES } from "../utils/constants.js";
import { NotFoundError, ConflictError, ValidationError, AuthorizationError } from "../utils/errors.js";
import { assertCanAccessBarangay } from "../utils/barangayScope.js";
import { sweepMissedClaims, sweepMissedClaim } from "../utils/claimWindow.js";
import { createNotification } from "./notification.service.js";
import { safeCreateAuditLog } from "./auditLog.service.js";

// Human-readable messages for claims that can no longer be claimed —
// shared by the QR resolve/confirm paths so Staff always see a clear,
// specific reason instead of a generic "invalid" error.
function claimStatusMessage(status) {
  switch (status) {
    case CLAIM_STATUS.CLAIMED:
      return "This claiming stub has already been claimed.";
    case CLAIM_STATUS.CANCELLED:
      return "This claiming stub has been cancelled.";
    case CLAIM_STATUS.MISSED:
      return "This claiming stub has been marked as missed.";
    default:
      return "This claiming pass is no longer valid.";
  }
}

const SENIOR_SUMMARY_FIELDS = "firstName lastName seniorCitizenId";

/**
 * Notifies the Senior who owns a claim — resolved via the claim's own
 * seniorId, never trusted from anywhere else. Called only after the
 * relevant write has already committed (outside any transaction/session),
 * matching the session-safety rule documented in benefitApplication.service.js.
 */
async function notifyClaimOwner(claim, { eventType, title, message }) {
  const senior = await Senior.findById(claim.seniorId).select("userId");
  if (!senior) return;
  await createNotification({
    recipientId: senior.userId,
    type: NOTIFICATION_TYPE.PENSION,
    eventType,
    title,
    message,
    relatedEntityType: "PensionClaim",
    relatedEntityId: claim._id,
  });
}

/**
 * Books a claiming slot for the authenticated Senior (`userId` from the
 * verified token — never a client-supplied seniorId).
 *
 * Concurrency safety, without relying on a distributed lock:
 *  1. The slot reservation is a single atomic document update
 *     (`findOneAndUpdate` with `availableCount: { $gt: 0 }` in the query
 *     filter) — MongoDB guarantees this is race-free even under
 *     concurrent requests for the same slot, so two Seniors can never
 *     both win the last seat.
 *  2. Duplicate active bookings are additionally rejected by a
 *     DB-level partial unique index on PensionClaim (see the model) —
 *     not just an application-level "already booked?" check — so it
 *     holds even under a race between two requests from the same Senior.
 *  3. Both writes happen inside a transaction, so a failure creating the
 *     PensionClaim (e.g. the duplicate-index violation) automatically
 *     rolls back the slot reservation instead of leaving an orphaned
 *     decremented seat.
 */
export async function bookSlot(userId, { scheduleId, slotId }) {
  const senior = await Senior.findOne({ userId });
  if (!senior) throw new NotFoundError("Senior profile not found.");

  const pension = await Pension.findOne({ seniorId: senior._id });
  if (!pension) {
    throw new ValidationError("You don't have a pension record on file yet. Please contact your Barangay office.");
  }

  const schedule = await PensionSchedule.findById(scheduleId);
  if (!schedule) throw new NotFoundError("Claiming schedule not found.");
  if (schedule.barangayId.toString() !== senior.barangayId.toString()) {
    throw new AuthorizationError("This claiming schedule is not available to your Barangay.");
  }
  if (schedule.status !== SCHEDULE_STATUS.OPEN) {
    throw new ConflictError("This claiming schedule is no longer open for booking.");
  }

  const slot = schedule.slots.id(slotId);
  if (!slot) throw new NotFoundError("Claiming slot not found.");

  const session = await mongoose.startSession();
  try {
    let claim;
    await session.withTransaction(async () => {
      const reserved = await PensionSchedule.findOneAndUpdate(
        { _id: scheduleId, "slots._id": slotId, "slots.availableCount": { $gt: 0 } },
        { $inc: { "slots.$.availableCount": -1, "slots.$.bookedCount": 1 } },
        { new: true, session }
      );

      if (!reserved) {
        throw new ConflictError("This claiming slot is no longer available. Please select another slot.");
      }

      const reservedSlot = reserved.slots.id(slotId);
      if (reservedSlot.availableCount === 0) {
        reservedSlot.status = "FULL";
        await reserved.save({ session });
      }

      try {
        const created = await PensionClaim.create(
          [
            {
              seniorId: senior._id,
              pensionId: pension._id,
              barangayId: senior.barangayId,
              scheduleId: schedule._id,
              slotId: slot._id,
              scheduledDate: schedule.date,
              scheduledStartTime: slot.startTime,
              scheduledEndTime: slot.endTime,
              location: schedule.location,
              amount: pension.pensionAmount,
              status: CLAIM_STATUS.SCHEDULED,
              qrToken: crypto.randomBytes(24).toString("hex"),
            },
          ],
          { session }
        );
        claim = created[0];
      } catch (err) {
        // Duplicate-key error from the partial unique index means this
        // Senior already has an active booking on this schedule.
        if (err?.code === 11000) {
          throw new ConflictError("You already have a booking for this claiming schedule.");
        }
        throw err;
      }
    });
    return claim;
  } finally {
    await session.endSession();
  }
}

/** The Senior's own next upcoming (SCHEDULED) claim, soonest first. */
export async function getMyUpcomingClaim(userId) {
  const senior = await Senior.findOne({ userId });
  if (!senior) throw new NotFoundError("Senior profile not found.");

  await sweepMissedClaims({ seniorId: senior._id });

  return PensionClaim.findOne({ seniorId: senior._id, status: CLAIM_STATUS.SCHEDULED }).sort({ scheduledDate: 1 });
}

/** The Senior's own claiming history (everything not currently scheduled), most recent first. */
export async function getMyClaimHistory(userId) {
  const senior = await Senior.findOne({ userId });
  if (!senior) throw new NotFoundError("Senior profile not found.");

  await sweepMissedClaims({ seniorId: senior._id });

  return PensionClaim.find({ seniorId: senior._id, status: { $ne: CLAIM_STATUS.SCHEDULED } }).sort({
    scheduledDate: -1,
  });
}

/** Renders the Senior's own claim as a scannable QR pass (PNG data URL). */
export async function getMyClaimQr(userId, claimId) {
  const senior = await Senior.findOne({ userId });
  if (!senior) throw new NotFoundError("Senior profile not found.");

  const claim = await PensionClaim.findById(claimId);
  if (!claim || claim.seniorId.toString() !== senior._id.toString()) {
    throw new NotFoundError("Claiming pass not found.");
  }

  // Only the opaque token goes into the QR — never the amount, senior
  // name, or any other personal data.
  const qrDataUrl = await QRCode.toDataURL(claim.qrToken, { margin: 1, width: 320 });
  return { claim, qrDataUrl };
}

/**
 * Barangay Staff/Admin: today's claims for their barangay (or a
 * specific schedule), for the "verify claims" view.
 */
export async function listClaimsForBarangay(requestingUser, { barangayId, scheduleId, date } = {}) {
  const query = {};
  if (barangayId) {
    assertCanAccessBarangay(requestingUser, barangayId);
    query.barangayId = barangayId;
  } else if (requestingUser.assignedBarangayId) {
    query.barangayId = requestingUser.assignedBarangayId;
  }
  if (scheduleId) query.scheduleId = scheduleId;
  if (date) {
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    query.scheduledDate = { $gte: start, $lt: end };
  }

  await sweepMissedClaims(query);

  return PensionClaim.find(query)
    .populate({ path: "seniorId", select: SENIOR_SUMMARY_FIELDS })
    .sort({ scheduledDate: 1, scheduledStartTime: 1 });
}

/**
 * Staff scans/enters a QR token. This ONLY resolves the token to claim
 * information for review — it never changes the claim's status. That
 * separation is what makes "scan alone doesn't claim" possible: the
 * camera scanner (and the manual-entry form) both call this first, then
 * `confirmClaim` is a distinct, explicit action.
 *
 * The backend is the sole source of truth here — the frontend never
 * sends claimId, status, or barangayId directly, only the opaque token
 * it read from the QR image.
 */
export async function resolveClaimByToken(requestingUser, qrToken) {
  const claim = await PensionClaim.findOne({ qrToken }).populate({ path: "seniorId", select: SENIOR_SUMMARY_FIELDS });
  if (!claim) throw new NotFoundError("Invalid claiming pass.");

  assertCanAccessBarangay(requestingUser, claim.barangayId);

  // A stale-but-not-yet-swept SCHEDULED claim whose window has passed
  // should read (and be rejected) as MISSED, not as still-claimable.
  await sweepMissedClaim(claim._id);
  if (claim.status === CLAIM_STATUS.SCHEDULED) {
    const refreshed = await PensionClaim.findById(claim._id);
    claim.status = refreshed.status;
    claim.missedAt = refreshed.missedAt;
  }

  if (claim.status !== CLAIM_STATUS.SCHEDULED) {
    throw new ConflictError(claimStatusMessage(claim.status), { status: claim.status });
  }

  return claim;
}

/**
 * Staff/Admin explicitly confirms a claim after reviewing the
 * information `resolveClaimByToken` returned. This is the only place
 * that actually transitions a claim to CLAIMED.
 *
 * The token is re-validated here (not just the claim id) so a client
 * can't confirm a different claim than the one it just displayed for
 * review, and every check from resolution (barangay scope, status,
 * expiry) is re-run atomically against the current database state —
 * never trusting whatever the frontend displayed a moment earlier.
 */
export async function confirmClaim(requestingUser, qrToken) {
  const claim = await PensionClaim.findOne({ qrToken }).populate({ path: "seniorId", select: SENIOR_SUMMARY_FIELDS });
  if (!claim) throw new NotFoundError("Invalid claiming pass.");

  assertCanAccessBarangay(requestingUser, claim.barangayId);

  await sweepMissedClaim(claim._id);

  // Atomic guard: only ever transitions a claim that is still SCHEDULED
  // at the moment of the write, so two staff confirming the same QR
  // (or a double-tap) can never both succeed — the second call simply
  // finds no matching document and reports the claim as already used.
  const updated = await PensionClaim.findOneAndUpdate(
    { _id: claim._id, status: CLAIM_STATUS.SCHEDULED },
    { $set: { status: CLAIM_STATUS.CLAIMED, claimedAt: new Date(), verifiedBy: requestingUser.id } },
    { new: true }
  ).populate({ path: "seniorId", select: SENIOR_SUMMARY_FIELDS });

  if (!updated) {
    const current = await PensionClaim.findById(claim._id);
    throw new ConflictError(claimStatusMessage(current.status), { status: current.status });
  }

  await notifyClaimOwner(updated, {
    eventType: "PENSION_CLAIM_CLAIMED",
    title: "Pension Claimed",
    message: "Your pension claim has been successfully completed.",
  });

  // Who confirmed the claim is specifically called out as important by
  // this module's own requirements — pension claiming is a sensitive
  // operational action, and `verifiedBy` above already records this in
  // the claim itself, but the Audit Logs page is where an Administrator
  // actually reviews it without opening each claim individually.
  await safeCreateAuditLog({
    actor: requestingUser,
    action: AUDIT_ACTIONS.CLAIM,
    module: AUDIT_MODULES.PENSION,
    entityType: "PensionClaim",
    entityId: updated._id,
    description: `${requestingUser.role} confirmed a pension claim for ${updated.seniorId?.firstName || "a Senior"} ${updated.seniorId?.lastName || ""}.`.trim(),
    metadata: { seniorId: updated.seniorId?._id, statusFrom: CLAIM_STATUS.SCHEDULED, statusTo: CLAIM_STATUS.CLAIMED },
    barangayId: updated.barangayId,
  });

  return updated;
}

/**
 * Senior cancels their own eligible upcoming booking.
 *
 * Concurrency/safety, mirroring `bookSlot`'s approach:
 *  1. The claim's SCHEDULED → CANCELLED transition is itself the guard:
 *     `findOneAndUpdate` only matches a claim that is still SCHEDULED,
 *     so a duplicate cancel request (or a race with Staff confirming a
 *     scan at the same moment) can only ever succeed once.
 *  2. Capacity is only released if step 1 actually flipped the status —
 *     never unconditionally — which is what prevents double-release if
 *     the same cancellation request is submitted twice.
 *  3. Both writes happen in a transaction so a failure releasing
 *     capacity rolls back the cancellation instead of leaving the claim
 *     CANCELLED with a slot that was never freed up.
 */
export async function cancelClaim(userId, claimId) {
  const senior = await Senior.findOne({ userId });
  if (!senior) throw new NotFoundError("Senior profile not found.");

  const claim = await PensionClaim.findById(claimId);
  if (!claim || claim.seniorId.toString() !== senior._id.toString()) {
    throw new NotFoundError("Claiming booking not found.");
  }

  // If the claiming window already passed, this is really a MISSED
  // booking, not a cancellable one — sweep first so the rejection below
  // reports the accurate reason.
  await sweepMissedClaim(claim._id);

  const session = await mongoose.startSession();
  try {
    let updated;
    await session.withTransaction(async () => {
      updated = await PensionClaim.findOneAndUpdate(
        { _id: claim._id, status: CLAIM_STATUS.SCHEDULED },
        { $set: { status: CLAIM_STATUS.CANCELLED, cancelledAt: new Date(), cancelledBy: userId } },
        { new: true, session }
      );

      if (!updated) {
        const current = await PensionClaim.findById(claim._id).session(session);
        throw new ConflictError(
          current.status === CLAIM_STATUS.CLAIMED
            ? "This booking has already been claimed and can no longer be cancelled."
            : current.status === CLAIM_STATUS.MISSED
            ? "This booking's claiming window has already passed and it can no longer be cancelled."
            : "This booking has already been cancelled."
        );
      }

      // Release the slot capacity this booking consumed. Uses an
      // aggregation-pipeline update so bookedCount/availableCount/status
      // update together atomically from their current values, the same
      // guarantee `bookSlot`'s $inc relies on for reservation.
      await PensionSchedule.updateOne(
        { _id: updated.scheduleId, "slots._id": updated.slotId },
        [
          {
            $set: {
              slots: {
                $map: {
                  input: "$slots",
                  as: "s",
                  in: {
                    $cond: [
                      { $eq: ["$$s._id", updated.slotId] },
                      {
                        $mergeObjects: [
                          "$$s",
                          {
                            bookedCount: { $max: [0, { $subtract: ["$$s.bookedCount", 1] }] },
                            availableCount: { $min: ["$$s.capacity", { $add: ["$$s.availableCount", 1] }] },
                            status: {
                              $cond: [{ $eq: ["$$s.status", "CLOSED"] }, "$$s.status", "AVAILABLE"],
                            },
                          },
                        ],
                      },
                      "$$s",
                    ],
                  },
                },
              },
            },
          },
        ],
        { session }
      );
    });
    return updated;
  } finally {
    await session.endSession();
  }
}

/**
 * Kept as a thin backward-compatible alias for callers/tests that treat
 * "verify" as a single resolve-and-claim step. Internally this is now
 * exactly `resolveClaimByToken` followed by `confirmClaim`, so it still
 * enforces every rule those two do — but real Staff/Admin flows (the
 * scanner and the manual-entry form) should call `resolveClaimByToken`
 * then `confirmClaim` as two separate, staff-confirmed steps.
 */
export async function verifyClaimByToken(requestingUser, qrToken) {
  await resolveClaimByToken(requestingUser, qrToken);
  return confirmClaim(requestingUser, qrToken);
}
