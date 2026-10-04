import * as concernService from "../services/concern.service.js";
import { resolveActingSenior } from "../utils/guardianAccess.js";

// ---------------- Senior/Guardian-facing ----------------

export async function create(req, res, next) {
  try {
    const senior = await resolveActingSenior(req.user, req.query.seniorId);
    const concern = await concernService.createConcern(senior, req.user, req.validatedBody);
    res.status(201).json({ success: true, data: concern });
  } catch (err) {
    next(err);
  }
}

export async function listForMe(req, res, next) {
  try {
    const senior = await resolveActingSenior(req.user, req.query.seniorId);
    const { status, category, search } = req.query;
    const concerns = await concernService.listConcernsForSenior(senior, { status, category, search });
    res.status(200).json({ success: true, data: concerns });
  } catch (err) {
    next(err);
  }
}

export async function getForMe(req, res, next) {
  try {
    const senior = await resolveActingSenior(req.user, req.query.seniorId);
    const concern = await concernService.getConcernForSenior(req.params.id, senior);
    res.status(200).json({ success: true, data: concern });
  } catch (err) {
    next(err);
  }
}

// ---------------- Staff/Admin/LGU-OSCA-facing ----------------

export async function listForStaff(req, res, next) {
  try {
    const { status, priority, category, search, barangayId, page, limit } = req.query;
    const result = await concernService.listConcernsForStaff(req.user, {
      status,
      priority,
      category,
      search,
      barangayId,
      page,
      limit,
    });
    if (Array.isArray(result)) {
      res.status(200).json({ success: true, data: result });
    } else {
      res.status(200).json({
        success: true,
        data: result.data,
        pagination: { total: result.total, page: result.page, limit: result.limit, totalPages: result.totalPages },
      });
    }
  } catch (err) {
    next(err);
  }
}

export async function getForStaff(req, res, next) {
  try {
    const concern = await concernService.getConcernForStaff(req.params.id, req.user);
    res.status(200).json({ success: true, data: concern });
  } catch (err) {
    next(err);
  }
}

export async function changeStatus(req, res, next) {
  try {
    const concern = await concernService.changeStatus(req.params.id, req.user, req.validatedBody);
    res.status(200).json({ success: true, data: concern });
  } catch (err) {
    next(err);
  }
}

export async function setPriority(req, res, next) {
  try {
    const concern = await concernService.setPriority(req.params.id, req.user, req.validatedBody);
    res.status(200).json({ success: true, data: concern });
  } catch (err) {
    next(err);
  }
}

export async function respond(req, res, next) {
  try {
    const concern = await concernService.respondToConcern(req.params.id, req.user, req.validatedBody);
    res.status(200).json({ success: true, data: concern });
  } catch (err) {
    next(err);
  }
}
