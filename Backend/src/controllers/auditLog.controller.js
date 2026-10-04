import * as auditLogService from "../services/auditLog.service.js";

// ADMIN-only (enforced in auditLog.routes.js). Deliberately read-only —
// no create/update/delete handler exists anywhere in this file, per the
// module's own immutability requirement (§27): audit records are never
// edited or deleted through the normal Admin UI.

export async function listLogs(req, res, next) {
  try {
    const data = await auditLogService.listAuditLogs({
      page: req.query.page,
      pageSize: req.query.pageSize,
      action: req.query.action,
      module: req.query.module,
      actorRole: req.query.actorRole,
      entityType: req.query.entityType,
      barangayId: req.query.barangayId,
      from: req.query.from,
      to: req.query.to,
      search: req.query.search,
    });
    res.status(200).json({ success: true, data: data.items, pagination: data.pagination });
  } catch (err) {
    next(err);
  }
}

export async function getSummary(req, res, next) {
  try {
    const data = await auditLogService.getAuditLogSummary();
    res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function getLog(req, res, next) {
  try {
    const log = await auditLogService.getAuditLogById(req.params.id);
    if (!log) {
      return res.status(404).json({ success: false, message: "Audit log not found." });
    }
    res.status(200).json({ success: true, data: log });
  } catch (err) {
    next(err);
  }
}
