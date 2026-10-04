import * as programService from "../services/benefitProgram.service.js";
import { resolveActingSenior } from "../utils/guardianAccess.js";

export async function listPrograms(req, res, next) {
  try {
    const { status, category } = req.query;
    const programs = await programService.listProgramsForStaff({ status, category });
    res.status(200).json({ success: true, data: programs });
  } catch (err) {
    next(err);
  }
}

/** Senior/Guardian view: active programs scoped to their own barangay, with eligibility attached. */
export async function listMyEligiblePrograms(req, res, next) {
  try {
    const senior = await resolveActingSenior(req.user, req.query.seniorId);
    const results = await programService.listEligiblePrograms(senior);
    res.status(200).json({ success: true, data: results });
  } catch (err) {
    next(err);
  }
}

export async function getProgram(req, res, next) {
  try {
    const program = await programService.getProgramById(req.params.id);
    res.status(200).json({ success: true, data: program });
  } catch (err) {
    next(err);
  }
}

export async function createProgram(req, res, next) {
  try {
    const program = await programService.createProgram(req.user, req.validatedBody);
    res.status(201).json({ success: true, data: program });
  } catch (err) {
    next(err);
  }
}

export async function updateProgram(req, res, next) {
  try {
    const program = await programService.updateProgram(req.params.id, req.user, req.validatedBody);
    res.status(200).json({ success: true, data: program });
  } catch (err) {
    next(err);
  }
}
