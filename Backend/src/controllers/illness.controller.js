import * as illnessService from "../services/illness.service.js";

export async function listIllnesses(req, res, next) {
  try {
    const { search, classification, priority, status, page, pageSize } = req.query;
    const data = await illnessService.listIllnesses({ search, classification, priority, status, page, pageSize });
    res.status(200).json({ success: true, data: data.items, pagination: data.pagination });
  } catch (err) {
    next(err);
  }
}

export async function getIllness(req, res, next) {
  try {
    const illness = await illnessService.getIllness(req.params.id);
    res.status(200).json({ success: true, data: illness });
  } catch (err) {
    next(err);
  }
}

export async function createIllness(req, res, next) {
  try {
    const illness = await illnessService.createIllness(req.validatedBody, req.user);
    res.status(201).json({ success: true, message: "Medical condition added.", data: illness });
  } catch (err) {
    next(err);
  }
}

export async function updateIllness(req, res, next) {
  try {
    const illness = await illnessService.updateIllness(req.params.id, req.validatedBody, req.user);
    res.status(200).json({ success: true, message: "Medical condition updated.", data: illness });
  } catch (err) {
    next(err);
  }
}

export async function updateIllnessStatus(req, res, next) {
  try {
    const illness = await illnessService.setIllnessStatus(req.params.id, req.validatedBody.isActive, req.user);
    res.status(200).json({ success: true, message: "Status updated.", data: illness });
  } catch (err) {
    next(err);
  }
}
