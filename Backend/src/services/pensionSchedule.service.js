import Barangay from "../models/Barangay.js";
import PensionSchedule from "../models/PensionSchedule.js";
import { SCHEDULE_STATUS } from "../utils/constants.js";
import { NotFoundError, ValidationError } from "../utils/errors.js";
import { assertCanAccessBarangay, hasBroadBarangayAccess } from "../utils/barangayScope.js";

function toSlotSubdoc(slot) {
  return {
    startTime: slot.startTime,
    endTime: slot.endTime,
    capacity: slot.capacity,
    bookedCount: 0,
    availableCount: slot.capacity,
    status: "AVAILABLE",
  };
}

export async function createSchedule(requestingUser, input) {
  const broadAccess = hasBroadBarangayAccess(requestingUser.role);

  if (!broadAccess) {
    // BARANGAY_STAFF: the barangay is ALWAYS the authenticated user's own
    // assignment — never anything from `input`, even if the client sent
    // one. This is the one and only source of truth for staff scoping.
    if (!requestingUser.assignedBarangayId) {
      throw new ValidationError("Your account has no assigned Barangay. Please contact an administrator.");
    }
    return PensionSchedule.create({
      barangayId: requestingUser.assignedBarangayId,
      date: input.date,
      location: input.location,
      startTime: input.startTime,
      endTime: input.endTime,
      slots: input.slots.map(toSlotSubdoc),
      createdBy: requestingUser.id,
    });
  }

  // ADMIN / LGU_OSCA: must explicitly choose which barangay this
  // schedule is for, since they aren't assigned to just one.
  if (!input.barangayId) {
    throw new ValidationError("Please select a Barangay for this claiming schedule.");
  }
  const barangayExists = await Barangay.exists({ _id: input.barangayId });
  if (!barangayExists) {
    throw new ValidationError("The selected Barangay could not be found.");
  }

  return PensionSchedule.create({
    barangayId: input.barangayId,
    date: input.date,
    location: input.location,
    startTime: input.startTime,
    endTime: input.endTime,
    slots: input.slots.map(toSlotSubdoc),
    createdBy: requestingUser.id,
  });
}

/**
 * Barangay options for the "Create Claiming Schedule" form. BARANGAY_STAFF
 * always gets back exactly their own assigned barangay (for a read-only
 * display, not a choice) — never the full list. ADMIN/LGU_OSCA get every
 * barangay, to choose from, mirroring the same broad-access rule used
 * everywhere else in this module rather than introducing a new one.
 */
export async function listBarangayOptionsForScheduling(requestingUser) {
  if (hasBroadBarangayAccess(requestingUser.role)) {
    return Barangay.find().select("name municipality province").sort({ name: 1 });
  }
  if (!requestingUser.assignedBarangayId) return [];
  const own = await Barangay.findById(requestingUser.assignedBarangayId).select("name municipality province");
  return own ? [own] : [];
}

/**
 * Lists schedules for the requesting staff's barangay (or all, for
 * ADMIN/LGU_OSCA, optionally narrowed via `barangayId`). `upcomingOnly`
 * defaults to true so Seniors browsing available schedules never see
 * past dates.
 */
export async function listSchedules(requestingUser, { barangayId, upcomingOnly = false, status } = {}) {
  const query = {};

  if (hasBroadBarangayAccess(requestingUser.role)) {
    if (barangayId) query.barangayId = barangayId;
  } else {
    if (!requestingUser.assignedBarangayId) return [];
    query.barangayId = requestingUser.assignedBarangayId;
  }

  if (status) query.status = status;
  if (upcomingOnly) {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    query.date = { $gte: startOfToday };
  }

  return PensionSchedule.find(query).sort({ date: 1 });
}

/** Schedules a Senior may currently book: OPEN status, today or later. */
export async function listBookableSchedulesForBarangay(barangayId) {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  return PensionSchedule.find({
    barangayId,
    status: SCHEDULE_STATUS.OPEN,
    date: { $gte: startOfToday },
  }).sort({ date: 1 });
}

export async function getScheduleById(scheduleId, requestingUser) {
  const schedule = await PensionSchedule.findById(scheduleId);
  if (!schedule) throw new NotFoundError("Claiming schedule not found.");
  assertCanAccessBarangay(requestingUser, schedule.barangayId);
  return schedule;
}

export async function updateSchedule(scheduleId, requestingUser, updates) {
  const schedule = await PensionSchedule.findById(scheduleId);
  if (!schedule) throw new NotFoundError("Claiming schedule not found.");
  assertCanAccessBarangay(requestingUser, schedule.barangayId);

  Object.assign(schedule, updates);
  await schedule.save();
  return schedule;
}

export async function closeSchedule(scheduleId, requestingUser) {
  return updateSchedule(scheduleId, requestingUser, { status: SCHEDULE_STATUS.CLOSED });
}
