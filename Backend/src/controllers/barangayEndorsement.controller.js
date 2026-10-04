import * as barangayEndorsementService from "../services/barangayEndorsement.service.js";

export async function listQueue(req, res, next) {
  try {
    const { status, homeVisit, search, page, pageSize } = req.query;
    const data = await barangayEndorsementService.listBarangayQueue(req.user, { status, homeVisit, search, page, pageSize });
    res.status(200).json({ success: true, data: data.items, pagination: data.pagination });
  } catch (err) {
    next(err);
  }
}

export async function getDetail(req, res, next) {
  try {
    const data = await barangayEndorsementService.getBarangayReviewDetail(req.params.seniorId, req.user);
    res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function recordVerification(req, res, next) {
  try {
    const senior = await barangayEndorsementService.recordVerificationDecision(req.params.seniorId, req.validatedBody, req.user);
    res.status(200).json({ success: true, message: "Barangay verification decision recorded.", data: senior });
  } catch (err) {
    next(err);
  }
}

export async function recordHomeVisit(req, res, next) {
  try {
    const senior = await barangayEndorsementService.recordHomeVisit(req.params.seniorId, req.validatedBody, req.user);
    res.status(200).json({ success: true, message: "Home Visit record saved.", data: senior });
  } catch (err) {
    next(err);
  }
}

export async function recordEndorsement(req, res, next) {
  try {
    const senior = await barangayEndorsementService.recordEndorsement(req.params.seniorId, req.validatedBody, req.user);
    res.status(200).json({ success: true, message: "Barangay endorsement recorded.", data: senior });
  } catch (err) {
    next(err);
  }
}

export async function getSummary(req, res, next) {
  try {
    const data = await barangayEndorsementService.getBarangayEndorsementSummary(req.user);
    res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}
