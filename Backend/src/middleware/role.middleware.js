import { AuthorizationError } from "../utils/errors.js";

// Usage: router.get("/x", authenticate, authorizeRoles("ADMIN", "BARANGAY_STAFF"), handler)
// Must run AFTER `authenticate` so req.user is populated from the database,
// never from client-supplied data.
export function authorizeRoles(...allowedRoles) {
  return (req, _res, next) => {
    if (!req.user) {
      return next(new AuthorizationError("Authentication required."));
    }
    if (!allowedRoles.includes(req.user.role)) {
      return next(new AuthorizationError("You are not authorized to perform this action."));
    }
    next();
  };
}
