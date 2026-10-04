import path from "node:path";
import * as applicationService from "../services/benefitApplication.service.js";
import { getDocumentForDownload } from "../services/verification.service.js";

export async function applyForBenefit(req, res, next) {
  try {
    const files = req.files || [];
    const application = await applicationService.applyForBenefit(
      req.user,
      req.validatedBody,
      files,
      req.validatedBody.documentTypes,
      req.query.seniorId
    );
    res.status(201).json({ success: true, data: application });
  } catch (err) {
    next(err);
  }
}

export async function listMyApplications(req, res, next) {
  try {
    const applications = await applicationService.listMyApplications(req.user, req.query.seniorId);
    res.status(200).json({ success: true, data: applications });
  } catch (err) {
    next(err);
  }
}

export async function getMyApplication(req, res, next) {
  try {
    const application = await applicationService.getMyApplicationById(req.params.id, req.user, req.query.seniorId);
    res.status(200).json({ success: true, data: application });
  } catch (err) {
    next(err);
  }
}

export async function listApplications(req, res, next) {
  try {
    const { status, benefitProgramId, barangayId, search, from, to } = req.query;
    const applications = await applicationService.listApplications(req.user, {
      status,
      benefitProgramId,
      barangayId,
      search,
      from,
      to,
    });
    res.status(200).json({ success: true, data: applications });
  } catch (err) {
    next(err);
  }
}

export async function getApplication(req, res, next) {
  try {
    const application = await applicationService.getApplicationById(req.params.id, req.user);
    res.status(200).json({ success: true, data: application });
  } catch (err) {
    next(err);
  }
}

export async function downloadApplicationDocument(req, res, next) {
  try {
    const { filePath, fileName, mimeType } = await getDocumentForDownload(req.params.documentId, req.user);
    res.setHeader("Content-Type", mimeType);
    res.setHeader("Content-Disposition", `inline; filename="${encodeURIComponent(fileName)}"`);
    res.sendFile(path.resolve(filePath));
  } catch (err) {
    next(err);
  }
}

export async function startReview(req, res, next) {
  try {
    const application = await applicationService.startReview(req.params.id, req.user);
    res.status(200).json({ success: true, data: application });
  } catch (err) {
    next(err);
  }
}

export async function endorseApplication(req, res, next) {
  try {
    const application = await applicationService.endorseApplication(req.params.id, req.user, req.validatedBody);
    res.status(200).json({ success: true, data: application });
  } catch (err) {
    next(err);
  }
}

export async function rejectApplication(req, res, next) {
  try {
    const application = await applicationService.rejectApplication(req.params.id, req.user, req.validatedBody);
    res.status(200).json({ success: true, data: application });
  } catch (err) {
    next(err);
  }
}

export async function approveApplication(req, res, next) {
  try {
    const application = await applicationService.approveApplication(req.params.id, req.user, req.validatedBody);
    res.status(200).json({ success: true, data: application });
  } catch (err) {
    next(err);
  }
}

export async function releaseApplication(req, res, next) {
  try {
    const application = await applicationService.releaseApplication(req.params.id, req.user, req.validatedBody);
    res.status(200).json({ success: true, data: application });
  } catch (err) {
    next(err);
  }
}

export async function completeApplication(req, res, next) {
  try {
    const application = await applicationService.completeApplication(req.params.id, req.user, req.validatedBody);
    res.status(200).json({ success: true, data: application });
  } catch (err) {
    next(err);
  }
}

export async function getOscaDetail(req, res, next) {
  try {
    const data = await applicationService.getOscaApplicationDetail(req.params.id, req.user);
    res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function requestRevision(req, res, next) {
  try {
    const application = await applicationService.requestApplicationRevision(req.params.id, req.user, req.validatedBody);
    res.status(200).json({ success: true, message: "Application returned for revision.", data: application });
  } catch (err) {
    next(err);
  }
}
