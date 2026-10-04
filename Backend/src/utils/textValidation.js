/**
 * Reasonable, not-overly-strict sanity checks for free-text name/address
 * fields, per the professor's Phase 1 feedback: reject random numbers,
 * one-letter/one-word nonsense, and placeholder junk ("test", "n/a"),
 * without rejecting legitimate short, hyphenated, apostrophe'd, or
 * numbered Filipino names and addresses. These are deliberately loose —
 * the goal is catching obvious garbage, not enforcing a strict grammar.
 */

// Common placeholder/junk values seen in real-world sloppy test data.
// Checked case-insensitively against the *whole trimmed field*, so a
// legitimate address that merely contains "test" as a substring (e.g. a
// subdivision literally named that) is not affected — only the field
// being *exactly* one of these is rejected.
const JUNK_VALUES = new Set([
  "test",
  "n/a",
  "na",
  "none",
  "asdf",
  "asd",
  "xxx",
  "...",
  "???",
  "!!!",
  "-",
  "--",
]);

function isJunkValue(trimmed) {
  return JUNK_VALUES.has(trimmed.toLowerCase());
}

/**
 * For person names (first/middle/last, Guardian names). Allows Unicode
 * letters (covers ñ and other accented characters), spaces, hyphens,
 * apostrophes, and periods (for suffixes like "Jr."/"Sr."), but:
 *   - rejects a single character ("A")
 *   - rejects anything with fewer than 2 actual letters ("1", "12345", "!!!")
 *   - rejects known junk placeholders ("test", "n/a", ...)
 * Deliberately does NOT enforce a minimum word count — a legitimate name
 * may be one word.
 */
export function isValidPersonName(value) {
  const trimmed = (value || "").trim();
  if (trimmed.length < 2) return false;
  if (isJunkValue(trimmed)) return false;
  if (!/^[\p{L}\p{M}][\p{L}\p{M}\s'.-]*$/u.test(trimmed)) return false;
  const letterCount = (trimmed.match(/\p{L}/gu) || []).length;
  return letterCount >= 2;
}

/**
 * For free-text address lines (house/lot/block, street, municipality,
 * province). Addresses legitimately contain digits, abbreviations, unit
 * numbers, hyphens, and punctuation, so this is intentionally much more
 * permissive than the name check — it only rejects:
 *   - a single character ("A")
 *   - values with no letters AND no digits at all ("!!!", "???")
 *   - known junk placeholders ("test", "n/a", ...)
 */
export function isValidAddressLine(value) {
  const trimmed = (value || "").trim();
  if (trimmed.length < 2) return false;
  if (isJunkValue(trimmed)) return false;
  const alnumCount = (trimmed.match(/[\p{L}\p{N}]/gu) || []).length;
  return alnumCount >= 2;
}
