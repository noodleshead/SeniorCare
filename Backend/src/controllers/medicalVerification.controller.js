import * as medicalVerificationService from "../services/medicalVerification.service.js";

export async function listMedicalVerifications(req, res, next) {
  try {
    const { status, classification, priority, homeVisit, search, page, pageSize } = req.query;
    const data = await medicalVerificationService.listMedicalVerifications({
      status,
      classification,
      priority,
      homeVisit,
      search,
      page,
      pageSize,
    });
    res.status(200).json({ success: true, data: data.items, pagination: data.pagination });
  } catch (err) {
    next(err);
  }
}

export async function getMedicalVerification(req, res, next) {
  try {
    const data = await medicalVerificationService.getMedicalVerificationDetail(req.params.seniorId, req.user);
    res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function recordDecision(req, res, next) {
  try {
    const senior = await medicalVerificationService.recordMedicalVerificationDecision(req.params.seniorId, req.validatedBody, req.user);
    res.status(200).json({ success: true, message: "Medical verification decision recorded.", data: senior });
  } catch (err) {
    next(err);
  }
}
