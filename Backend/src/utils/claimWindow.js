import PensionClaim from "../models/PensionClaim.js";
import { CLAIM_STATUS } from "./constants.js";

// Claiming slot times are stored as display strings like "08:00 AM" / "08:30 AM"
// (see PensionSchedule's claimingSlotSchema). This combines that with the
// claim's `scheduledDate` (a Date, time-of-day 00:00) to get the actual
// moment the claiming window for a booking closes.
function combineDateAndTime(date, timeString) {
  const match = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec((timeString || "").trim());
  if (!match) return new Date(date); // Defensive fallback — never throws on unexpected format.

  let [, hours, minutes, meridiem] = match;
  hours = parseInt(hours, 10);
  minutes = parseInt(minutes, 10);
  if (meridiem.toUpperCase() === "PM" && hours !== 12) hours += 12;
  if (meridiem.toUpperCase() === "AM" && hours === 12) hours = 0;

  const combined = new Date(date);
  combined.setHours(hours, minutes, 0, 0);
  return combined;
}

/** The moment this claim's claiming window closes (end of its slot's end time). */
export function getClaimWindowEnd(claim) {
  return combineDateAndTime(claim.scheduledDate, claim.scheduledEndTime);
}

export function isClaimWindowExpired(claim, now = new Date()) {
  return getClaimWindowEnd(claim) < now;
}

/**
 * Lazily transitions any SCHEDULED claim matching `matchQuery` whose
 * claiming window has already passed into MISSED. This is the "no cron
 * exists yet" implementation: instead of introducing new background-job
 * infrastructure, every read/write path that touches claims sweeps its
 * own claims first, so MISSED is always backend-enforced and reflects
 * reality by the time any response is sent — without a new scheduler.
 *
 * Safe under concurrent calls: the final `updateMany` only matches
 * documents that are still SCHEDULED at the moment it runs, so two
 * concurrent sweeps can't double-transition (or double-fire) the same
 * claim, and a claim that was claimed/cancelled in between is left alone.
 */
export async function sweepMissedClaims(matchQuery = {}) {
  const now = new Date();

  const candidates = await PensionClaim.find({
    ...matchQuery,
    status: CLAIM_STATUS.SCHEDULED,
    scheduledDate: { $lte: now },
  }).select("_id scheduledDate scheduledEndTime");

  const expiredIds = candidates.filter((c) => isClaimWindowExpired(c, now)).map((c) => c._id);
  if (expiredIds.length === 0) return;

  await PensionClaim.updateMany(
    { _id: { $in: expiredIds }, status: CLAIM_STATUS.SCHEDULED },
    { $set: { status: CLAIM_STATUS.MISSED, missedAt: now } }
  );
}

/** Convenience: sweep just one claim (by id) before acting on it. */
export async function sweepMissedClaim(claimId) {
  await sweepMissedClaims({ _id: claimId });
}
