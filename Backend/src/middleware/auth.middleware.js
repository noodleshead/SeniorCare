import { verifyAccessToken } from "../utils/token.js";
import { AuthenticationError, AccountStatusError, MaintenanceModeError } from "../utils/errors.js";
import User from "../models/User.js";
import { ACCOUNT_STATUS, ROLES } from "../utils/constants.js";
import { isMaintenanceModeOn } from "../services/systemSettings.service.js";

// Extracts and verifies the access token, then re-loads the user's current
// role/status from the database on every request. The role/status inside
// the JWT is treated only as a hint — the database record is the source
// of truth so that a staff demotion or deactivation takes effect
// immediately, not just after the token expires.
export async function authenticate(req, _res, next) {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;

    if (!token) {
      throw new AuthenticationError("Authentication required.");
    }

    let payload;
    try {
      payload = verifyAccessToken(token);
    } catch {
      throw new AuthenticationError("Your session has expired. Please log in again.");
    }

    const user = await User.findById(payload.sub);
    if (!user) {
      throw new AuthenticationError("Account not found.");
    }

    if (user.status !== ACCOUNT_STATUS.ACTIVE) {
      throw new AccountStatusError(
        "Your account is no longer active.",
        "ACCOUNT_NOT_ACTIVE"
      );
    }

    req.user = {
      id: user._id.toString(),
      role: user.role,
      status: user.status,
      assignedBarangayId: user.assignedBarangayId ? user.assignedBarangayId.toString() : null,
    };

    // System Settings' maintenanceMode toggle (see systemSettings.service.js)
    // is enforced here rather than as a separate global middleware: this
    // is the one place nearly every protected route in the app already
    // passes through, so gating here reaches the whole authenticated
    // surface (Senior/Guardian/Staff/LGU-OSCA dashboards, pension,
    // benefits, applications, everything) without restructuring
    // app.js's routing. Administrator is exempt by construction — the
    // check below runs strictly after req.user.role is known, and never
    // applies to it. Unauthenticated routes (login, public registration
    // itself) are NOT covered by this — see the module's final report
    // for that explicit scope boundary.
    if (user.role !== ROLES.ADMIN && (await isMaintenanceModeOn())) {
      throw new MaintenanceModeError();
    }

    next();
  } catch (err) {
    next(err);
  }
}
