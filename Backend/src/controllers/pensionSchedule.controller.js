import * as scheduleService from "../services/pensionSchedule.service.js";
import Senior from "../models/Senior.js";
import { NotFoundError } from "../utils/errors.js";

/** Barangay options for the Create Schedule form's barangay field. */
export async function listBarangayOptions(req, res, next) {
  try {
    const barangays = await scheduleService.listBarangayOptionsForScheduling(req.user);
    res.status(200).json({ success: true, data: barangays });
  } catch (err) {
    next(err);
  }
}

export async function createSchedule(req, res, next) {
  try {
    const schedule = await scheduleService.createSchedule(req.user, req.validatedBody);
    res.status(201).json({ success: true, data: schedule });
  } catch (err) {
    next(err);
  }
}

export async function listSchedules(req, res, next) {
  try {
    const { barangayId, upcomingOnly, status } = req.query;
    const schedules = await scheduleService.listSchedules(req.user, {
      barangayId,
      upcomingOnly: upcomingOnly === "true",
      status,
    });
    res.status(200).json({ success: true, data: schedules });
  } catch (err) {
    next(err);
  }
}

/** Senior-facing: the currently bookable schedules for their own Barangay. */
export async function listMyBarangaySchedules(req, res, next) {
  try {
    const senior = await Senior.findOne({ userId: req.user.id });
    if (!senior) throw new NotFoundError("Senior profile not found.");
    const schedules = await scheduleService.listBookableSchedulesForBarangay(senior.barangayId);
    res.status(200).json({ success: true, data: schedules });
  } catch (err) {
    next(err);
  }
}

export async function getSchedule(req, res, next) {
  try {
    const schedule = await scheduleService.getScheduleById(req.params.id, req.user);
    res.status(200).json({ success: true, data: schedule });
  } catch (err) {
    next(err);
  }
}

export async function updateSchedule(req, res, next) {
  try {
    const schedule = await scheduleService.updateSchedule(req.params.id, req.user, req.validatedBody);
    res.status(200).json({ success: true, data: schedule });
  } catch (err) {
    next(err);
  }
}

export async function closeSchedule(req, res, next) {
  try {
    const schedule = await scheduleService.closeSchedule(req.params.id, req.user);
    res.status(200).json({ success: true, data: schedule });
  } catch (err) {
    next(err);
  }
}
