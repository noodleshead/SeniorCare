import Activity from "../models/Activity.js";
import ActivityAttendance from "../models/ActivityAttendance.js";
import { ACTIVITY_STATUS } from "../utils/constants.js";
import { NotFoundError, ConflictError } from "../utils/errors.js";

/**
 * Confirms attendance for `senior` (already resolved server-side via
 * resolveActingSenior — this function never receives a client-supplied
 * seniorId). A Senior/Guardian can only ever confirm for the Senior
 * `resolveActingSenior` resolved them to, so there is no path here for
 * submitting attendance on behalf of an arbitrary Senior.
 *
 * Duplicate confirmations are prevented at the database level by
 * ActivityAttendance's unique (activityId, seniorId) index, not just by
 * this application-level check — the check exists purely to return a
 * clear, expected error instead of a raw duplicate-key error.
 */
export async function confirmAttendance(activityId, senior, requestingUser) {
  const activity = await Activity.findOne({ _id: activityId, barangayId: senior.barangayId });
  if (!activity) throw new NotFoundError("Activity not found.");

  if (!activity.attendanceConfirmationEnabled) {
    throw new ConflictError("Attendance confirmation is not available for this activity.");
  }
  if (![ACTIVITY_STATUS.PUBLISHED, ACTIVITY_STATUS.ONGOING].includes(activity.status)) {
    throw new ConflictError("Attendance can only be confirmed for a published or ongoing activity.");
  }

  const existing = await ActivityAttendance.findOne({ activityId: activity._id, seniorId: senior._id });
  if (existing) {
    throw new ConflictError("You have already confirmed attendance for this activity.");
  }

  try {
    return await ActivityAttendance.create({
      activityId: activity._id,
      seniorId: senior._id,
      confirmedBy: requestingUser.id,
    });
  } catch (err) {
    // Race: two near-simultaneous confirm requests for the same Senior.
    // The unique index is the real guard; this just gives a clean error.
    if (err?.code === 11000) {
      throw new ConflictError("You have already confirmed attendance for this activity.");
    }
    throw err;
  }
}

/** Withdraws the Senior's own confirmation — ownership enforced by the query itself. */
export async function withdrawAttendance(activityId, senior) {
  const result = await ActivityAttendance.findOneAndDelete({ activityId, seniorId: senior._id });
  if (!result) throw new NotFoundError("No attendance confirmation found for this activity.");
  return { deleted: true };
}

/** Staff/Admin/LGU-OSCA view of who has confirmed — barangay ownership already checked by the caller via getActivityById. */
export async function listAttendeesForActivity(activityId) {
  return ActivityAttendance.find({ activityId })
    .populate({ path: "seniorId", select: "firstName lastName seniorCitizenId" })
    .sort({ createdAt: -1 });
}
