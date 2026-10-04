import * as adminService from "../services/admin.service.js";
import { safeCreateAuditLog } from "../services/auditLog.service.js";
import { AUDIT_ACTIONS, AUDIT_MODULES, ACCOUNT_STATUS } from "../utils/constants.js";

export async function createBarangay(req, res, next) {
  try {
    const barangay = await adminService.createBarangay(req.validatedBody);
    await safeCreateAuditLog({
      actor: req.user,
      action: AUDIT_ACTIONS.CREATE,
      module: AUDIT_MODULES.USER_MANAGEMENT,
      entityType: "Barangay",
      entityId: barangay._id,
      description: `${req.user.role} created Barangay "${barangay.name}".`,
    });
    res.status(201).json({ success: true, message: "Barangay created successfully.", data: barangay });
  } catch (err) {
    next(err);
  }
}

export async function listBarangays(req, res, next) {
  try {
    const barangays = await adminService.listBarangaysWithStats();
    res.status(200).json({ success: true, data: barangays });
  } catch (err) {
    next(err);
  }
}

export async function createStaff(req, res, next) {
  try {
    const { user, temporaryPassword } = await adminService.createStaffAccount(req.validatedBody);
    await safeCreateAuditLog({
      actor: req.user,
      action: AUDIT_ACTIONS.CREATE,
      module: AUDIT_MODULES.USER_MANAGEMENT,
      entityType: "User",
      entityId: user._id,
      description: `${req.user.role} created a Barangay Staff account (${user.email}).`,
      metadata: { role: "BARANGAY_STAFF", assignedBarangayId: user.assignedBarangayId?._id || user.assignedBarangayId },
      barangayId: user.assignedBarangayId?._id || user.assignedBarangayId,
    });
    res.status(201).json({
      success: true,
      message: "Barangay Staff account created successfully.",
      data: { user, temporaryPassword },
    });
  } catch (err) {
    next(err);
  }
}

export async function listStaff(req, res, next) {
  try {
    const staff = await adminService.listStaff();
    res.status(200).json({ success: true, data: staff });
  } catch (err) {
    next(err);
  }
}

export async function getStaff(req, res, next) {
  try {
    const staff = await adminService.getStaffById(req.params.staffId);
    res.status(200).json({ success: true, data: staff });
  } catch (err) {
    next(err);
  }
}

export async function updateStaffAssignment(req, res, next) {
  try {
    const staff = await adminService.updateStaffAssignment(req.params.staffId, req.validatedBody.assignedBarangayId);
    await safeCreateAuditLog({
      actor: req.user,
      action: AUDIT_ACTIONS.CREATE,
      module: AUDIT_MODULES.USER_MANAGEMENT,
      entityType: "User",
      entityId: staff._id,
      description: `${req.user.role} reassigned Barangay Staff account (${staff.email}) to a different Barangay.`,
      metadata: { assignedBarangayId: req.validatedBody.assignedBarangayId },
      barangayId: req.validatedBody.assignedBarangayId,
    });
    res.status(200).json({ success: true, message: "Staff assignment updated.", data: staff });
  } catch (err) {
    next(err);
  }
}

export async function updateStaffStatus(req, res, next) {
  try {
    const staff = await adminService.updateStaffStatus(req.params.staffId, req.validatedBody.status);
    const isActivating = req.validatedBody.status === ACCOUNT_STATUS.ACTIVE;
    await safeCreateAuditLog({
      actor: req.user,
      action: isActivating ? AUDIT_ACTIONS.ACTIVATE : AUDIT_ACTIONS.DEACTIVATE,
      module: AUDIT_MODULES.USER_MANAGEMENT,
      entityType: "User",
      entityId: staff._id,
      description: `${req.user.role} set Barangay Staff account (${staff.email}) status to ${req.validatedBody.status}.`,
      metadata: { statusTo: req.validatedBody.status },
      barangayId: staff.assignedBarangayId?._id || staff.assignedBarangayId,
    });
    res.status(200).json({ success: true, message: "Staff account status updated.", data: staff });
  } catch (err) {
    next(err);
  }
}
