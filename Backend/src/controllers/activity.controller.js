import * as activityService from "../services/activity.service.js";
import * as attendanceService from "../services/activityAttendance.service.js";
import { resolveActingSenior } from "../utils/guardianAccess.js";

export async function listForStaff(req, res, next) {
  try {
    const { status, category, search, barangayId } = req.query;
    const activities = await activityService.listActivitiesForStaff(req.user, { status, category, search, barangayId });
    res.status(200).json({ success: true, data: activities });
  } catch (err) {
    next(err);
  }
}

export async function getById(req, res, next) {
  try {
    const activity = await activityService.getActivityById(req.params.id, req.user);
    res.status(200).json({ success: true, data: activity });
  } catch (err) {
    next(err);
  }
}

export async function create(req, res, next) {
  try {
    const activity = await activityService.createActivity(req.user, req.validatedBody);
    res.status(201).json({ success: true, data: activity });
  } catch (err) {
    next(err);
  }
}

export async function update(req, res, next) {
  try {
    const activity = await activityService.updateActivity(req.params.id, req.user, req.validatedBody);
    res.status(200).json({ success: true, data: activity });
  } catch (err) {
    next(err);
  }
}

export async function publish(req, res, next) {
  try {
    const activity = await activityService.publishActivity(req.params.id, req.user);
    res.status(200).json({ success: true, data: activity });
  } catch (err) {
    next(err);
  }
}

export async function cancel(req, res, next) {
  try {
    const activity = await activityService.cancelActivity(req.params.id, req.user, req.body || {});
    res.status(200).json({ success: true, data: activity });
  } catch (err) {
    next(err);
  }
}

export async function remove(req, res, next) {
  try {
    const result = await activityService.deleteActivity(req.params.id, req.user);
    res.status(200).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

/** Staff/Admin/LGU-OSCA: list of Seniors who confirmed attendance — barangay ownership enforced via getActivityById. */
export async function listAttendees(req, res, next) {
  try {
    await activityService.getActivityById(req.params.id, req.user);
    const attendees = await attendanceService.listAttendeesForActivity(req.params.id);
    res.status(200).json({ success: true, data: attendees });
  } catch (err) {
    next(err);
  }
}

// ---------------- Senior/Guardian-facing ----------------

export async function listForMe(req, res, next) {
  try {
    const senior = await resolveActingSenior(req.user, req.query.seniorId);
    const { when, category, search } = req.query;
    const activities = await activityService.listActivitiesForSenior(senior, { when, category, search });
    res.status(200).json({ success: true, data: activities });
  } catch (err) {
    next(err);
  }
}

export async function getForMe(req, res, next) {
  try {
    const senior = await resolveActingSenior(req.user, req.query.seniorId);
    const activity = await activityService.getActivityForSenior(req.params.id, senior);
    res.status(200).json({ success: true, data: activity });
  } catch (err) {
    next(err);
  }
}

export async function confirmMyAttendance(req, res, next) {
  try {
    const senior = await resolveActingSenior(req.user, req.query.seniorId);
    const attendance = await attendanceService.confirmAttendance(req.params.id, senior, req.user);
    res.status(201).json({ success: true, data: attendance });
  } catch (err) {
    next(err);
  }
}

export async function withdrawMyAttendance(req, res, next) {
  try {
    const senior = await resolveActingSenior(req.user, req.query.seniorId);
    const result = await attendanceService.withdrawAttendance(req.params.id, senior);
    res.status(200).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}
