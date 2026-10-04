# SENIORCARE Backend (MERN)

Backend for the SENIORCARE barangay senior citizen service platform.
Implements registration, barangay verification, and role-aware authentication.

## Core business rule

A newly registered senior citizen is **never** immediately active:

```
Register → PENDING_VERIFICATION → Barangay Staff Reviews → Approve/Reject → ACTIVE or REJECTED → Login
```

The frontend cannot set `role` or `status` — both are controlled entirely by the backend.

## Project setup

```bash
npm install
cp .env.example .env   # fill in real values
```

### Environment variables

| Variable | Purpose |
|---|---|
| `PORT` | API port (default 5000) |
| `MONGO_URI` | MongoDB connection string |
| `JWT_ACCESS_SECRET` / `JWT_ACCESS_EXPIRES_IN` | Short-lived access token signing |
| `JWT_REFRESH_SECRET` / `JWT_REFRESH_EXPIRES_IN` | Refresh token signing (stored in an HttpOnly cookie) |
| `COOKIE_SECURE` | Set `true` in production (HTTPS only) |
| `CLIENT_URL` | Exact frontend origin for CORS — no wildcards |
| `UPLOAD_DIR` / `MAX_FILE_SIZE_MB` | Local document upload storage (dev) |

### MongoDB

Any MongoDB 6+ instance works — local `mongod`, Docker, or Atlas. Point `MONGO_URI` at it.

### Running

```bash
npm run dev     # nodemon, development
npm start       # production
npm run seed    # seeds sample barangays + dev-only admin/staff accounts
npm test        # runs the Jest suite (uses an in-memory MongoDB)
```

Seeded development accounts (clearly test-only, not for production):

```
dev-admin@seniorcare.test / DevAdmin123        (ADMIN)
dev-staff@seniorcare.test / DevStaff123         (BARANGAY_STAFF, scoped to the first seeded barangay)
```

## Architecture

```
Route → Controller → Service → Model
```

Business logic lives in `services/`, never in routes. Controllers only translate
HTTP ↔ service calls. This keeps the registration/verification/auth business
rules in one place, independent of how they're triggered.

```
src/
  config/database.js        MongoDB connection
  models/                   User, Senior, Barangay, Guardian, Document, Verification
  validators/                Zod schemas — backend re-validates everything the frontend sends
  middleware/                auth (JWT), role (RBAC), upload (Multer), validation, error handling
  services/                  registration.service, verification.service, auth.service
  controllers/                thin HTTP adapters over the services
  routes/                    auth.routes, registration.routes, verification.routes
  utils/                     password hashing, JWT helpers, constants, seed script
```

### Data model

`User` (auth only) and `Senior` (profile only) are deliberately separate collections,
linked 1:1 via `Senior.userId`. `Verification` is its own auditable record
(`status`, `reviewedBy`, `reviewedAt`, `remarks`/`rejectionReason`) rather than a
field on `Senior`, so the review history stays intact regardless of profile edits.
`Document` references point at wherever files are actually stored (local disk in
development; swap the storage engine in `middleware/upload.middleware.js` for
S3 / Cloudinary / Supabase in production without touching the rest of the pipeline).

Registration deliberately does **not** create pension, benefits, application, or
QR-claiming records — those belong to modules built after an account is verified.

## Authentication flow

- `POST /api/auth/login` — email/username + password. Returns a short-lived
  **access token** in the JSON response body (frontend keeps this in memory) and
  sets a **refresh token** as an HttpOnly, `SameSite=Lax` cookie scoped to `/api/auth`.
- `POST /api/auth/refresh` — reads the refresh cookie, issues a new access token.
- `POST /api/auth/logout` — clears the refresh cookie.
- `GET /api/auth/me` — returns the authenticated user's safe profile (requires a valid access token).

Every protected request re-reads the user's `role`/`status` from MongoDB — the
JWT payload is a hint, not a trust boundary. Deactivating a staff account takes
effect on their very next request, not just after their token expires.

### Account status → login outcome

| `User.status` | Login result |
|---|---|
| `PENDING_VERIFICATION` | `403`, code `ACCOUNT_PENDING_VERIFICATION` |
| `INACTIVE` | `403`, code `ACCOUNT_INACTIVE` |
| `REJECTED` | `403`, code `ACCOUNT_REJECTED` |
| `ACTIVE` | `200`, access token + refresh cookie issued |

Invalid credentials always return the same generic `Invalid email or password.`
message — the API never reveals whether the email exists.

## Registration flow

`POST /api/registration` (multipart/form-data)

- Fields `validId`, `seniorCitizenId`, `proofResidency`, `guardianId` (optional),
  `guardianAuthDoc` (required only if a guardian was declared) — PDF/JPG/PNG, ≤10MB.
- A `data` field containing the JSON-encoded registration payload (barangay,
  personal, contact, status, guardian, account credentials).

Backend sequence: validate barangay (exists + active) → compute age server-side
from `dateOfBirth` (client-sent age is ignored) → check duplicate email / Senior
Citizen ID → hash password → **single MongoDB transaction** creating
`User` (`PENDING_VERIFICATION`) + `Senior` (+ `Guardian` if applicable) +
`Verification` (`PENDING`) + `Document` records → return a safe summary
(no password, no password hash, no internal IDs beyond what's needed).

`GET /api/registration/barangays` (also aliased at `GET /api/barangays`) — public,
returns only active barangays for the registration form's picker.

## Verification flow (barangay staff)

- `GET /api/verifications/pending` — scoped to the requesting staff member's
  `assignedBarangayId`. `ADMIN` / `LGU_OSCA` see across all barangays. A staff
  account with no assigned barangay sees nothing (fails closed).
- `GET /api/verifications/:id`
- `PATCH /api/verifications/:id/approve` — `{ remarks? }`. Sets
  `Verification.status = APPROVED` and `User.status = ACTIVE` in one transaction.
- `PATCH /api/verifications/:id/reject` — `{ reason }` (required). Sets
  `Verification.status = REJECTED` and `User.status = REJECTED` in one transaction.

All four routes require `authenticate` + `authorizeRoles(BARANGAY_STAFF, ADMIN, LGU_OSCA)`.
Approving/rejecting a verification outside the staff member's assigned barangay
returns `403`, even if the verification ID is valid — this is enforced at the
service layer, not just hidden in the UI.

## Role system

```
SENIOR_CITIZEN | GUARDIAN | BARANGAY_STAFF | ADMIN | LGU_OSCA
```

The login page never asks for a role. The frontend receives `user.role` in the
login response purely for **navigation** (which dashboard to redirect to) — it
is never accepted as an input on registration or any other request. Every
authorization decision re-reads `role` from the authenticated `User` document.

## Security notes

- Passwords hashed with bcrypt (cost factor 12); `passwordHash` has
  `select: false` and is stripped from `toJSON()` as a second layer of defense.
- `helmet`, scoped `cors` (no wildcard origin with credentials), `express-mongo-sanitize`,
  and a rate limiter on `/api/auth/login` (10 attempts / 15 min) are all wired in `app.js`.
- Centralized error handler (`middleware/error.middleware.js`) converts Mongoose/JWT/
  duplicate-key errors into safe, generic client messages and logs details server-side only.
- File uploads validate MIME type + extension and are capped at `MAX_FILE_SIZE_MB`.

## Known scaffolding / production TODOs

- `authService.requestPasswordReset` / `resetPassword` currently use an
  in-memory token store as a placeholder. Replace with a persisted, hashed,
  single-use `PasswordResetToken` collection before shipping, and wire in a
  transactional email provider to actually deliver the reset link.
- Local disk storage (`middleware/upload.middleware.js`) is for development
  only — swap in an S3/Cloudinary/Supabase adapter for production, and serve
  documents through a protected, signed-URL endpoint rather than a public folder.
- `assignedBarangayId` on `User` currently must be set manually (e.g. via the
  seed script or an admin tool) when provisioning `BARANGAY_STAFF` accounts —
  there's no self-service staff registration flow yet, by design.

## Testing

`npm test` runs Jest against an in-memory MongoDB (`mongodb-memory-server`) and covers:

- Registration: valid registration, invalid/inactive barangay, duplicate email,
  duplicate Senior Citizen ID, under-minimum-age rejection, password is hashed (never plain text).
- Login: pending account blocked with the correct code, wrong password and
  unknown user both return the same generic message.
- Verification: approving activates the account and allows login; rejecting
  sets `REJECTED` and blocks login; staff cannot approve/see records outside
  their assigned barangay.

> Note: `mongodb-memory-server` downloads a MongoDB binary on first run, which
> requires outbound network access to its binary host. In network-restricted
> environments, point `MONGO_URI` at a real local/Docker MongoDB instance and
> adapt `tests/setup.js` to connect to it instead.
