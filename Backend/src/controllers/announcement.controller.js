import * as announcementService from "../services/announcement.service.js";
import { resolveActingSenior } from "../utils/guardianAccess.js";

export async function listForStaff(req, res, next) {
  try {
    const { status, category, search, barangayId } = req.query;
    const announcements = await announcementService.listAnnouncementsForStaff(req.user, {
      status,
      category,
      search,
      barangayId,
    });
    res.status(200).json({ success: true, data: announcements });
  } catch (err) {
    next(err);
  }
}

/** Senior/Guardian: published announcements applicable to them. */
export async function listForMe(req, res, next) {
  try {
    const senior = await resolveActingSenior(req.user, req.query.seniorId);
    const { category, search } = req.query;
    const announcements = await announcementService.listAnnouncementsForSenior(senior, { category, search });
    res.status(200).json({ success: true, data: announcements });
  } catch (err) {
    next(err);
  }
}

export async function getById(req, res, next) {
  try {
    const announcement = await announcementService.getAnnouncementById(req.params.id, req.user);
    res.status(200).json({ success: true, data: announcement });
  } catch (err) {
    next(err);
  }
}

export async function create(req, res, next) {
  try {
    const announcement = await announcementService.createAnnouncement(req.user, req.validatedBody);
    res.status(201).json({ success: true, data: announcement });
  } catch (err) {
    next(err);
  }
}

export async function update(req, res, next) {
  try {
    const announcement = await announcementService.updateAnnouncement(req.params.id, req.user, req.validatedBody);
    res.status(200).json({ success: true, data: announcement });
  } catch (err) {
    next(err);
  }
}

export async function publish(req, res, next) {
  try {
    const announcement = await announcementService.publishAnnouncement(req.params.id, req.user);
    res.status(200).json({ success: true, data: announcement });
  } catch (err) {
    next(err);
  }
}

export async function archive(req, res, next) {
  try {
    const announcement = await announcementService.unpublishAnnouncement(req.params.id, req.user);
    res.status(200).json({ success: true, data: announcement });
  } catch (err) {
    next(err);
  }
}

export async function remove(req, res, next) {
  try {
    const result = await announcementService.deleteAnnouncement(req.params.id, req.user);
    res.status(200).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}
