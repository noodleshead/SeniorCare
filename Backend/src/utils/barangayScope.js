import { ROLES } from "./constants.js";
import { AuthorizationError } from "./errors.js";

/** ADMIN and LGU_OSCA see/manage across barangays; BARANGAY_STAFF is scoped. */
export function hasBroadBarangayAccess(role) {
  return role === ROLES.ADMIN || role === ROLES.LGU_OSCA;
}

/**
 * Throws unless the requesting staff/admin/LGU-OSCA user is allowed to
 * act on the given barangay. Never trusts a barangayId supplied by the
 * client for this check — only `requestingUser.assignedBarangayId`,
 * which comes from the authenticated User record.
 */
export function assertCanAccessBarangay(requestingUser, barangayId) {
  if (hasBroadBarangayAccess(requestingUser.role)) return;
  if (
    !requestingUser.assignedBarangayId ||
    requestingUser.assignedBarangayId.toString() !== barangayId.toString()
  ) {
    throw new AuthorizationError("You are not authorized to access this Barangay's records.");
  }
}
