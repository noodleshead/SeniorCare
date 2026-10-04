import * as pensionService from "../services/pension.service.js";

export async function getMyPension(req, res, next) {
  try {
    const pension = await pensionService.getMyPension(req.user.id);
    res.status(200).json({ success: true, data: pension });
  } catch (err) {
    next(err);
  }
}

export async function listPensions(req, res, next) {
  try {
    const { search, pensionType, status, barangayId } = req.query;
    const pensions = await pensionService.listPensions(req.user, { search, pensionType, status, barangayId });
    res.status(200).json({ success: true, data: pensions });
  } catch (err) {
    next(err);
  }
}

export async function listEligibleSeniors(req, res, next) {
  try {
    const { search, barangayId } = req.query;
    const seniors = await pensionService.listEligibleSeniors(req.user, { search, barangayId });
    res.status(200).json({ success: true, data: seniors });
  } catch (err) {
    next(err);
  }
}

export async function getPension(req, res, next) {
  try {
    const pension = await pensionService.getPensionById(req.params.id, req.user);
    res.status(200).json({ success: true, data: pension });
  } catch (err) {
    next(err);
  }
}

export async function createPension(req, res, next) {
  try {
    const pension = await pensionService.createPension(req.user, req.validatedBody);
    res.status(201).json({ success: true, data: pension });
  } catch (err) {
    next(err);
  }
}

export async function updatePension(req, res, next) {
  try {
    const pension = await pensionService.updatePension(req.params.id, req.user, req.validatedBody);
    res.status(200).json({ success: true, data: pension });
  } catch (err) {
    next(err);
  }
}
