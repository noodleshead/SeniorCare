import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

// Single source of truth for where uploaded documents live on disk.
//
// Both the upload middleware (writes files) and the document-download
// service (reads files) previously computed `process.env.UPLOAD_DIR ||
// "uploads"` independently and resolved it relative to `process.cwd()`.
// That works fine as long as the server is always launched from the same
// working directory — but `process.cwd()` is whatever directory the
// process happened to be *started* from (e.g. `Backend/` in one terminal,
// the repo root in another, a different cwd from an IDE task runner,
// etc.). On Windows in particular it's easy to end up with two different
// npm/nodemon launch configurations that use different cwds.
//
// Result: multer writes a file to `<cwd A>/uploads/<key>`, and the
// download endpoint later looks for it at `<cwd B>/uploads/<key>` — the
// Document record in MongoDB is completely correct, but the physical
// file "disappears" because the two sides of the app disagree on where
// "uploads" actually is. That mismatch is what produces the 404
// ("The document file could not be found on the server.") even though
// the file was uploaded successfully.
//
// Fix: anchor the uploads directory to the backend project root (derived
// from this file's own location via import.meta.url), not to whatever
// directory the process was launched from. This is portable across
// Windows/macOS/Linux and doesn't depend on how `npm run dev`/`npm start`
// was invoked. An absolute UPLOAD_DIR in .env (e.g. for a production
// deployment) is still honored as-is.
const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const configuredUploadDir = process.env.UPLOAD_DIR || "uploads";

export const UPLOAD_DIR = path.isAbsolute(configuredUploadDir)
  ? configuredUploadDir
  : path.resolve(backendRoot, configuredUploadDir);

// multer's diskStorage does NOT create its destination directory
// automatically — if "uploads" doesn't exist yet (e.g. a fresh clone,
// since it's gitignored), writes fail. Ensure it exists once, at import
// time, so both uploading and reading are guaranteed to use a real,
// existing directory.
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

/**
 * Resolves a Document's `storageKey` to an absolute path on disk, using
 * the same UPLOAD_DIR every part of the app agrees on.
 */
export function resolveStoragePath(storageKey) {
  return path.join(UPLOAD_DIR, storageKey);
}
