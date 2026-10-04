import path from "node:path";
import * as verificationService from "../services/verification.service.js";
import * as adminService from "../services/admin.service.js";

export async function createGuardianAccount(req, res, next) {
  try {
    const result = await adminService.createGuardianAccount(req.user, req.params.guardianRecordId, req.validatedBody);
    res.status(201).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

export async function resetGuardianPassword(req, res, next) {
  try {
    const result = await adminService.resetGuardianPassword(req.user, req.params.guardianRecordId, req.validatedBody);
    res.status(200).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

export async function listPending(req, res, next) {
  try {
    const { search, page, limit, barangayId, status } = req.query;
    const result = await verificationService.listPendingVerifications(req.user, {
      search,
      page,
      limit,
      barangayId,
      status,
    });
    // result.data / result.total etc. — see listPendingVerifications pagination shape.
    res.status(200).json({ success: true, data: result.data, meta: { total: result.total, page: result.page, limit: result.limit, totalPages: result.totalPages } });
  } catch (err) {
    next(err);
  }
}

export async function getStats(req, res, next) {
  try {
    const stats = await verificationService.getVerificationStats(req.user);
    res.status(200).json({ success: true, data: stats });
  } catch (err) {
    next(err);
  }
}

export async function getDocument(req, res, next) {
  try {
    const { filePath, fileName, mimeType } = await verificationService.getDocumentForDownload(
      req.params.documentId,
      req.user
    );
    res.setHeader("Content-Type", mimeType);
    res.setHeader("Content-Disposition", `inline; filename="${encodeURIComponent(fileName)}"`);
    res.sendFile(path.resolve(filePath));
  } catch (err) {
    next(err);
  }
}

export async function getOne(req, res, next) {
  try {
    const result = await verificationService.getVerificationById(req.params.id, req.user);
    res.status(200).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

export async function approve(req, res, next) {
  try {
    const result = await verificationService.approveVerification(req.params.id, req.user, req.validatedBody);
    res.status(200).json({ success: true, message: "Registration approved. The account is now active.", data: result });
  } catch (err) {
    next(err);
  }
}

export async function reject(req, res, next) {
  try {
    const result = await verificationService.rejectVerification(req.params.id, req.user, req.validatedBody);
    res.status(200).json({ success: true, message: "Registration rejected.", data: result });
  } catch (err) {
    next(err);
  }
}
