import * as userManagementService from "../services/userManagement.service.js";
import * as seniorService from "../services/senior.service.js";
import Senior from "../models/Senior.js";
import { NotFoundError } from "../utils/errors.js";

export async function listUsers(req, res, next) {
  try {
    const { role, status, search, page, pageSize } = req.query;
    const data = await userManagementService.listUsers({ role, status, search, page, pageSize });
    res.status(200).json({ success: true, data: data.items, pagination: data.pagination });
  } catch (err) {
    next(err);
  }
}

export async function getUser(req, res, next) {
  try {
    const data = await userManagementService.getUserDetail(req.params.userId);
    res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function updateUserStatus(req, res, next) {
  try {
    const user = await userManagementService.setUserAccountStatus(req.params.userId, req.validatedBody.status, req.user);
    res.status(200).json({ success: true, message: "Account status updated.", data: user });
  } catch (err) {
    next(err);
  }
}

// Admin correction of a Senior's profile. The :userId in the URL is the
// account id shown in the Users list; the Senior record is resolved from
// it server-side, so the client never supplies a seniorId directly.
export async function updateSeniorProfile(req, res, next) {
  try {
    const senior = await Senior.findOne({ userId: req.params.userId }).select("_id");
    if (!senior) throw new NotFoundError("Senior profile not found for this account.");
    const updated = await seniorService.adminUpdateSeniorProfile(senior._id, req.validatedBody, req.user);
    res.status(200).json({ success: true, message: "Senior profile updated.", data: updated });
  } catch (err) {
    next(err);
  }
}
