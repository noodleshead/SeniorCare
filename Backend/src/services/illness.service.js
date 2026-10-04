import Illness from "../models/Illness.js";
import { AUDIT_ACTIONS, AUDIT_MODULES } from "../utils/constants.js";
import { safeCreateAuditLog } from "./auditLog.service.js";
import { ConflictError, NotFoundError } from "../utils/errors.js";

/**
 * Admin Illness Database. Extends the same `Illness` model Phase 3's
 * registration dropdown already reads from — see
 * registration.service.js#listActiveIllnesses, which is untouched by
 * this file and still returns name-only, active-only records.
 *
 * Deactivation vs. deletion: this file never exposes a hard-delete
 * endpoint. A Senior's `medicalConditionId` references an Illness by
 * _id (models/Senior.js) — deleting the document would either orphan
 * that reference or (worse) require a cascading write into Senior
 * records this phase has no business touching. Deactivating instead
 * preserves the referenced document and every existing Senior's
 * historical medical information stays exactly as it was; only new
 * registration selection is affected (enforced by the `isActive: true`
 * filter in listActiveIllnesses, not by anything in this file).
 */

function buildFilter({ search, classification, priority, status }) {
  const filter = {};
  if (search && search.trim()) {
    const term = search.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    filter.name = new RegExp(term, "i");
  }
  if (classification) filter.classification = classification;
  if (priority) filter.priorityLevel = priority;
  if (status === "ACTIVE") filter.isActive = true;
  else if (status === "INACTIVE") filter.isActive = false;
  return filter;
}

export async function listIllnesses({ search, classification, priority, status, page = 1, pageSize = 20 } = {}) {
  const filter = buildFilter({ search, classification, priority, status });
  const safePageSize = Math.min(Math.max(Number(pageSize) || 20, 1), 100);
  const safePage = Math.max(Number(page) || 1, 1);

  const [items, total] = await Promise.all([
    Illness.find(filter)
      .sort({ name: 1 })
      .skip((safePage - 1) * safePageSize)
      .limit(safePageSize),
    Illness.countDocuments(filter),
  ]);

  return {
    items,
    pagination: {
      page: safePage,
      pageSize: safePageSize,
      total,
      totalPages: Math.max(Math.ceil(total / safePageSize), 1),
    },
  };
}

export async function getIllness(id) {
  const illness = await Illness.findById(id);
  if (!illness) throw new NotFoundError("Medical condition not found.");
  return illness;
}

/**
 * Converts the unique-index duplicate-key error into the friendly
 * message this module's own instructions require, the same pattern
 * error.middleware.js already uses for seniorCitizenId — done here
 * (not left to the generic handler) so the message is specific to this
 * domain ("medical condition" rather than a raw field name).
 */
async function saveOrFriendlyConflict(doc) {
  try {
    await doc.save();
  } catch (err) {
    if (err?.code === 11000) {
      throw new ConflictError("This medical condition already exists.", {
        name: "A medical condition with this name already exists.",
      });
    }
    throw err;
  }
}

export async function createIllness(data, requestingUser) {
  const illness = new Illness(data);
  await saveOrFriendlyConflict(illness);

  await safeCreateAuditLog({
    actor: requestingUser,
    action: AUDIT_ACTIONS.CREATE,
    module: AUDIT_MODULES.ILLNESS_DATABASE,
    entityType: "Illness",
    entityId: illness._id,
    description: `${requestingUser.role} added "${illness.name}" to the Illness Database.`,
    metadata: { name: illness.name, classification: illness.classification, priorityLevel: illness.priorityLevel, isActive: illness.isActive },
  });

  return illness;
}

export async function updateIllness(id, data, requestingUser) {
  const illness = await Illness.findById(id);
  if (!illness) throw new NotFoundError("Medical condition not found.");

  const changed = [];
  for (const key of ["name", "classification", "priorityLevel", "isActive"]) {
    if (data[key] !== undefined && data[key] !== illness[key]) {
      illness[key] = data[key];
      changed.push(key);
    }
  }
  if (changed.length === 0) return illness;

  await saveOrFriendlyConflict(illness);

  await safeCreateAuditLog({
    actor: requestingUser,
    action: AUDIT_ACTIONS.UPDATE,
    module: AUDIT_MODULES.ILLNESS_DATABASE,
    entityType: "Illness",
    entityId: illness._id,
    description: `${requestingUser.role} updated "${illness.name}" in the Illness Database.`,
    metadata: { changedFields: changed },
  });

  return illness;
}

export async function setIllnessStatus(id, isActive, requestingUser) {
  const illness = await Illness.findById(id);
  if (!illness) throw new NotFoundError("Medical condition not found.");
  if (illness.isActive === isActive) return illness;

  illness.isActive = isActive;
  await illness.save();

  await safeCreateAuditLog({
    actor: requestingUser,
    action: isActive ? AUDIT_ACTIONS.ACTIVATE : AUDIT_ACTIONS.DEACTIVATE,
    module: AUDIT_MODULES.ILLNESS_DATABASE,
    entityType: "Illness",
    entityId: illness._id,
    description: `${requestingUser.role} ${isActive ? "reactivated" : "deactivated"} "${illness.name}" in the Illness Database.`,
    metadata: {
      name: illness.name,
      note: isActive
        ? "Now selectable again in new Senior registrations."
        : "No longer selectable in new Senior registrations; existing Seniors already associated with it are unaffected.",
    },
  });

  return illness;
}
