import * as guardianService from "../services/guardian.service.js";

export async function getDashboard(req, res, next) {
  try {
    const dashboard = await guardianService.getGuardianDashboard(req.user);
    res.status(200).json({ success: true, data: dashboard });
  } catch (err) {
    next(err);
  }
}

export async function listSeniors(req, res, next) {
  try {
    const seniors = await guardianService.listManagedSeniors(req.user);
    res.status(200).json({ success: true, data: seniors });
  } catch (err) {
    next(err);
  }
}

export async function getSenior(req, res, next) {
  try {
    const senior = await guardianService.getManagedSeniorDetail(req.user, req.params.seniorId);
    res.status(200).json({ success: true, data: senior });
  } catch (err) {
    next(err);
  }
}

export async function getMyProfile(req, res, next) {
  try {
    const data = await guardianService.getMyGuardianProfile(req.user);
    res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function updateMyProfile(req, res, next) {
  try {
    const data = await guardianService.updateMyGuardianProfile(req.user, req.validatedBody);
    res.status(200).json({ success: true, message: "Profile updated successfully.", data });
  } catch (err) {
    next(err);
  }
}
