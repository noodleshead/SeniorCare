import { Navigate, useLocation } from "react-router-dom";
import { getAccessToken, getStoredUser } from "../services/authService.js";

/**
 * Client-side route guard. This is a UX convenience only — the real
 * enforcement happens on the backend (authenticate + authorizeRoles +
 * barangay scoping in verification.routes.js / verification.service.js).
 * A user who bypasses this component still can't call the protected
 * APIs without a valid token and the right role/barangay.
 */
export default function ProtectedRoute({ allowedRoles, children }) {
  const location = useLocation();
  const token = getAccessToken();
  const user = getStoredUser();

  if (!token || !user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/login" replace />;
  }

  return children;
}
