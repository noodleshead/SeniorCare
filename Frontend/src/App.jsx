import { BrowserRouter, Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import Login from "./pages/Login";
import ForgotPassword from "./pages/ForgotPassword.jsx";
import ResetPassword from "./pages/ResetPassword.jsx";
import Register from "./pages/Register";
import VerificationDashboard from "./pages/dashboard/VerificationDashboard.jsx";
import SeniorReviewPage from "./pages/dashboard/SeniorReviewPage.jsx";
import BarangayManagementPage from "./pages/dashboard/BarangayManagementPage.jsx";
import StaffManagementPage from "./pages/dashboard/StaffManagementPage.jsx";
import PensionManagementPage from "./pages/dashboard/PensionManagementPage.jsx";
import BenefitsManagementPage from "./pages/dashboard/BenefitsManagementPage.jsx";
import AnnouncementsManagementPage from "./pages/dashboard/AnnouncementsManagementPage.jsx";
import ActivitiesManagementPage from "./pages/dashboard/ActivitiesManagementPage.jsx";
import ConcernsManagementPage from "./pages/dashboard/ConcernsManagementPage.jsx";
import SeniorAnalyticsPage from "./pages/dashboard/SeniorAnalyticsPage.jsx";
import AdminReportsPage from "./pages/dashboard/AdminReportsPage.jsx";
import AuditLogsPage from "./pages/dashboard/AuditLogsPage.jsx";
import SystemSettingsPage from "./pages/dashboard/SystemSettingsPage.jsx";
import UserManagementPage from "./pages/dashboard/UserManagementPage.jsx";
import IllnessDatabasePage from "./pages/dashboard/IllnessDatabasePage.jsx";
import MedicalVerificationPage from "./pages/dashboard/MedicalVerificationPage.jsx";
import BarangayEndorsementPage from "./pages/dashboard/BarangayEndorsementPage.jsx";
import SeniorDashboard from "./pages/senior/SeniorDashboard.jsx";
import GuardianDashboard from "./pages/guardian/GuardianDashboard.jsx";
import GuardianSeniorsPage from "./pages/guardian/GuardianSeniorsPage.jsx";
import GuardianPensionPage from "./pages/guardian/GuardianPensionPage.jsx";
import GuardianDocumentsPage from "./pages/guardian/GuardianDocumentsPage.jsx";
import GuardianConcernsPage from "./pages/guardian/GuardianConcernsPage.jsx";
import GuardianNotificationsPage from "./pages/guardian/GuardianNotificationsPage.jsx";
import ProtectedRoute from "./routes/ProtectedRoute.jsx";
// import Dashboard from "./pages/Dashboard";
// import Profile from "./pages/Profile";
// import NotFound from "./pages/NotFound";

// Roles authorized to use the Barangay/Admin verification workflow —
// mirrors `staffOrAbove` in Backend/src/routes/verification.routes.js.
const VERIFICATION_ROLES = ["BARANGAY_STAFF", "ADMIN", "LGU_OSCA"];

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        {/* Phase 1 fix: these were previously dead links (Login.jsx has
            always pointed to /forgot-password, but neither route existed). */}
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/register" element={<Register />} />

        {/* Senior Citizen's own service dashboard. */}
        <Route
          path="/senior/dashboard"
          element={
            <ProtectedRoute allowedRoles={["SENIOR_CITIZEN"]}>
              <SeniorDashboard />
            </ProtectedRoute>
          }
        />

        {/* Guardian / Authorized Representative dashboard — acts on behalf
            of Senior(s) it is explicitly authorized for. Every page
            re-verifies that authorization server-side; the selected-Senior
            context kept client-side (guardianService.js) is UX only. */}
        <Route
          path="/guardian/dashboard"
          element={
            <ProtectedRoute allowedRoles={["GUARDIAN"]}>
              <GuardianDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/guardian/seniors"
          element={
            <ProtectedRoute allowedRoles={["GUARDIAN"]}>
              <GuardianSeniorsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/guardian/pension"
          element={
            <ProtectedRoute allowedRoles={["GUARDIAN"]}>
              <GuardianPensionPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/guardian/documents"
          element={
            <ProtectedRoute allowedRoles={["GUARDIAN"]}>
              <GuardianDocumentsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/guardian/concerns"
          element={
            <ProtectedRoute allowedRoles={["GUARDIAN"]}>
              <GuardianConcernsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/guardian/notifications"
          element={
            <ProtectedRoute allowedRoles={["GUARDIAN"]}>
              <GuardianNotificationsPage />
            </ProtectedRoute>
          }
        />

        {/* Barangay/Admin/LGU-OSCA verification workflow. Each role lands
            on the same dashboard component — access is enforced by the
            backend regardless of which URL is used. */}
        <Route
          path="/barangay/dashboard"
          element={
            <ProtectedRoute allowedRoles={VERIFICATION_ROLES}>
              <VerificationDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/dashboard"
          element={
            <ProtectedRoute allowedRoles={VERIFICATION_ROLES}>
              <VerificationDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/lgu/dashboard"
          element={
            <ProtectedRoute allowedRoles={VERIFICATION_ROLES}>
              <VerificationDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/verification/:id"
          element={
            <ProtectedRoute allowedRoles={VERIFICATION_ROLES}>
              <SeniorReviewPage />
            </ProtectedRoute>
          }
        />

        {/* Barangay/Admin/LGU-OSCA pension management — same role set as verification. */}
        <Route
          path="/pension-management"
          element={
            <ProtectedRoute allowedRoles={VERIFICATION_ROLES}>
              <PensionManagementPage />
            </ProtectedRoute>
          }
        />

        {/* Barangay/Admin/LGU-OSCA Benefits & Assistance management — same role set as verification. */}
        <Route
          path="/benefits-management"
          element={
            <ProtectedRoute allowedRoles={VERIFICATION_ROLES}>
              <BenefitsManagementPage />
            </ProtectedRoute>
          }
        />

        {/* Barangay/Admin/LGU-OSCA Announcements management — same role set as verification. */}
        <Route
          path="/announcements-management"
          element={
            <ProtectedRoute allowedRoles={VERIFICATION_ROLES}>
              <AnnouncementsManagementPage />
            </ProtectedRoute>
          }
        />

        {/* Barangay/Admin/LGU-OSCA Social Activities management — same role set as verification. */}
        <Route
          path="/activities-management"
          element={
            <ProtectedRoute allowedRoles={VERIFICATION_ROLES}>
              <ActivitiesManagementPage />
            </ProtectedRoute>
          }
        />

        {/* Barangay/Admin/LGU-OSCA Reports/Concerns management — same role set as verification. */}
        <Route
          path="/concerns-management"
          element={
            <ProtectedRoute allowedRoles={VERIFICATION_ROLES}>
              <ConcernsManagementPage />
            </ProtectedRoute>
          }
        />

        {/* Barangay/Admin/LGU-OSCA Senior Mapping & Analytics — same role set
            as verification. Backend enforces barangay scoping server-side. */}
        <Route
          path="/senior-analytics"
          element={
            <ProtectedRoute allowedRoles={VERIFICATION_ROLES}>
              <SeniorAnalyticsPage />
            </ProtectedRoute>
          }
        />

        {/* Admin-only organizational management + system-wide reporting.
            ADMIN only — intentionally narrower than VERIFICATION_ROLES
            (BARANGAY_STAFF/LGU_OSCA excluded), per the module's own
            "keep Admin Reports separate from Barangay Analytics"
            requirement. Backend (adminReports.routes.js's adminOnly)
            enforces this independently of this frontend guard. */}
        <Route
          path="/admin/reports"
          element={
            <ProtectedRoute allowedRoles={["ADMIN"]}>
              <AdminReportsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/audit-logs"
          element={
            <ProtectedRoute allowedRoles={["ADMIN"]}>
              <AuditLogsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/users"
          element={
            <ProtectedRoute allowedRoles={["ADMIN"]}>
              <UserManagementPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/illnesses"
          element={
            <ProtectedRoute allowedRoles={["ADMIN"]}>
              <IllnessDatabasePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/barangay-endorsement"
          element={
            <ProtectedRoute allowedRoles={VERIFICATION_ROLES}>
              <BarangayEndorsementPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/medical-verification"
          element={
            <ProtectedRoute allowedRoles={["ADMIN"]}>
              <MedicalVerificationPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/settings"
          element={
            <ProtectedRoute allowedRoles={["ADMIN"]}>
              <SystemSettingsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/barangays"
          element={
            <ProtectedRoute allowedRoles={["ADMIN"]}>
              <BarangayManagementPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/staff"
          element={
            <ProtectedRoute allowedRoles={["ADMIN"]}>
              <StaffManagementPage />
            </ProtectedRoute>
          }
        />

        {/* <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="*" element={<NotFound />} /> */}
      </Routes>
    </BrowserRouter>
  );
}

export default App;
