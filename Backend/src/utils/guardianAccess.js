import Senior from "../models/Senior.js";
import Guardian from "../models/Guardian.js";
import { ROLES } from "./constants.js";
import { AuthorizationError, NotFoundError } from "./errors.js";

/**
 * SENIORCARE — "who may act on behalf of this Senior" authorization.
 *
 * This is the single, isolated place that decides which Senior a request
 * is allowed to act for. Any module that lets a Senior (or, later, a
 * Guardian) manage their own records — Benefits & Assistance today,
 * potentially Pension or others later — should resolve the acting Senior
 * through `resolveActingSenior()` rather than trusting a client-supplied
 * `seniorId`/`userId` anywhere in the request body, params, or query.
 *
 * ── Current (active) behavior ──────────────────────────────────────
 * For `SENIOR_CITIZEN`, this is exactly the existing pattern already
 * used throughout the app (`Senior.findOne({ userId: req.user.id })`):
 * a Senior can only ever resolve to their own profile.
 *
 * ── Dormant (prepared, not reachable) behavior — UPDATED ───────────
 * For `GUARDIAN`, the rule below is now reachable: Barangay Staff/Admin
 * can create a GUARDIAN-role login for an already-authorization-confirmed
 * Guardian record (see admin.service.js's createGuardianAccount, mirroring
 * createStaffAccount), and the Guardian dashboard (routes/guardian.routes.js)
 * lets that account log in and act for its authorized Senior(s). Every
 * module that already accepted SENIOR_OR_GUARDIAN_ROLES before this change
 * required no further changes — this file is still the single place the
 * rule itself lives.
 *
 * The rule itself, once reachable, is intentionally strict and
 * bidirectional — both sides of the relationship must agree:
 *   1. A `Guardian` document must exist whose `userId` matches the
 *      authenticated user (i.e. this specific login is tied to this
 *      specific Guardian record).
 *   2. That Guardian record must have `authorizationConfirmed: true`
 *      (set only once Barangay Staff approved the guardian
 *      authorization documents during the Senior's verification —
 *      see verification.service.js). An unconfirmed/unverified
 *      Guardian relationship can never act for anyone.
 *   3. The target `Senior` must itself point back at that same
 *      Guardian via `senior.guardianId` — so a Guardian record that
 *      was superseded, reassigned, or never actually linked from the
 *      Senior side cannot be used to gain access.
 *
 * A Guardian can never widen this by supplying a different seniorId —
 * for SENIOR_CITIZEN there is no seniorId parameter at all; the Senior
 * is always derived server-side from the authenticated user's own
 * linked record. For GUARDIAN, an optional `requestedSeniorId` is
 * accepted ONLY to disambiguate which of the Guardian's OWN authorized
 * Seniors a request is for (Part 3/16 of the Guardian module — a
 * Guardian may manage more than one Senior). It is never treated as a
 * bare permission grant: the same three-way check above (Guardian doc
 * exists, is confirmed, and the Senior points back at it) still runs
 * against that specific id, so requesting an id that isn't actually one
 * of this Guardian's own authorized Seniors fails exactly the same way
 * as if no id had narrowed anything down.
 */
export async function resolveActingSenior(requestingUser, requestedSeniorId) {
  if (requestingUser.role === ROLES.SENIOR_CITIZEN) {
    const senior = await Senior.findOne({ userId: requestingUser.id });
    if (!senior) throw new NotFoundError("Senior profile not found.");
    return senior;
  }

  if (requestingUser.role === ROLES.GUARDIAN) {
    // Dormant: unreachable until a GUARDIAN-role account can be created
    // and logged in (see the module doc comment above). Implemented now
    // so activating Guardian access later needs no changes here.
    const guardianQuery = { userId: requestingUser.id, authorizationConfirmed: true };
    if (requestedSeniorId) guardianQuery.seniorId = requestedSeniorId;

    // A real-world Guardian may have more than one Guardian record (one
    // per Senior they're authorized for, each created during that
    // Senior's own registration/verification — see models/Guardian.js).
    // Without a requestedSeniorId, we fall back to the first authorized
    // record for backward compatibility with every call site that
    // predates multi-Senior support; callers that need to let the
    // Guardian choose should pass the id explicitly (see
    // listAuthorizedSeniorsForGuardian below for the selection list).
    const guardian = await Guardian.findOne(guardianQuery);
    if (!guardian) {
      throw new AuthorizationError("You are not authorized to act on behalf of a Senior Citizen.");
    }

    const senior = await Senior.findOne({ _id: guardian.seniorId, guardianId: guardian._id });
    if (!senior) {
      throw new AuthorizationError("You are not authorized to act on behalf of a Senior Citizen.");
    }

    return senior;
  }

  throw new AuthorizationError("Only a Senior Citizen (or their authorized Guardian) may perform this action.");
}

/**
 * Every Senior a Guardian is currently authorized to act for — the
 * backing list for "My Managed Seniors" and for the seniorId selector
 * used elsewhere in this file. Same bidirectional check as
 * resolveActingSenior (Guardian doc confirmed AND Senior points back at
 * it), just applied across all of this Guardian's records instead of one.
 */
export async function listAuthorizedSeniorsForGuardian(requestingUser) {
  if (requestingUser.role !== ROLES.GUARDIAN) return [];

  const guardianRecords = await Guardian.find({
    userId: requestingUser.id,
    authorizationConfirmed: true,
  });
  if (guardianRecords.length === 0) return [];

  const bySeniorId = new Map(guardianRecords.map((g) => [g.seniorId.toString(), g]));
  const seniors = await Senior.find({ _id: { $in: [...bySeniorId.keys()] } }).populate(
    "barangayId",
    "name municipality"
  );

  // Keep only Seniors that actually point back at the same Guardian
  // record — the same bidirectional guard as resolveActingSenior.
  return seniors.filter((s) => {
    const guardian = bySeniorId.get(s._id.toString());
    return guardian && s.guardianId && s.guardianId.toString() === guardian._id.toString();
  });
}

/**
 * Roles allowed to reach `resolveActingSenior` at the route level.
 * Exported as a single list so every Benefits route enables the same
 * (currently Senior-only-in-practice) set, and so activating Guardian
 * access later is a one-place change if it ever needs to be anything
 * other than "just add GUARDIAN to authorizeRoles", which is already
 * done here.
 */
export const SENIOR_OR_GUARDIAN_ROLES = [ROLES.SENIOR_CITIZEN, ROLES.GUARDIAN];
