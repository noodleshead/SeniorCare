import * as systemSettingsService from "../services/systemSettings.service.js";

// ADMIN-only for get/update (enforced in systemSettings.routes.js);
// getPublic has no role restriction at all — see that route file.

export async function getSettings(_req, res, next) {
  try {
    const data = await systemSettingsService.getSettings();
    res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function getPublicSettings(_req, res, next) {
  try {
    const data = await systemSettingsService.getPublicSettings();
    res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function updateSection(req, res, next) {
  try {
    const data = await systemSettingsService.updateSettingsSection(req.params.section, req.body, req.user);
    res.status(200).json({ success: true, message: "System settings updated successfully.", data });
  } catch (err) {
    next(err);
  }
}
