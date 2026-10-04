// Client-side mirrors of Backend/src/utils/textValidation.js and the
// Philippine mobile / postal code rules from registration.validator.js.
// Used by the profile-editing dialogs so a correction is held to the same
// standard as registration (Register.jsx keeps its own equivalent local
// copies, untouched). The backend remains the authoritative check.
const JUNK = new Set(["test", "n/a", "na", "none", "asdf", "asd", "xxx", "...", "???", "!!!", "-", "--"]);

export const PH_MOBILE_RE = /^(\+?63|0)?9\d{9}$/;

export function isValidPersonName(value) {
  const t = (value || "").trim();
  if (t.length < 2 || JUNK.has(t.toLowerCase())) return false;
  if (!/^[\p{L}\p{M}][\p{L}\p{M}\s'.-]*$/u.test(t)) return false;
  return (t.match(/\p{L}/gu) || []).length >= 2;
}

export function isValidAddressLine(value) {
  const t = (value || "").trim();
  if (t.length < 2 || JUNK.has(t.toLowerCase())) return false;
  return (t.match(/[\p{L}\p{N}]/gu) || []).length >= 2;
}
