import multer from "multer";
import path from "node:path";
import crypto from "node:crypto";
import { ValidationError } from "../utils/errors.js";
import { UPLOAD_DIR } from "../utils/storage.js";

const ALLOWED_MIME_TYPES = new Set(["application/pdf", "image/jpeg", "image/png"]);
const ALLOWED_EXTENSIONS = new Set([".pdf", ".jpg", ".jpeg", ".png"]);

const maxFileSizeBytes = Number(process.env.MAX_FILE_SIZE_MB || 10) * 1024 * 1024;

// Development storage writes to local disk. Swap this `storage` engine
// for a multer-s3 / Cloudinary / Supabase adapter in production — the
// rest of the upload pipeline (validation, Document records) is unaffected.
//
// Uses the shared, project-root-anchored UPLOAD_DIR (see utils/storage.js)
// rather than a bare "uploads" resolved against process.cwd(), so writes
// here always land in the exact directory the download endpoint reads
// from, regardless of the directory the server was launched from.
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const safeName = `${crypto.randomUUID()}${ext}`;
    cb(null, safeName);
  },
});

function fileFilter(_req, file, cb) {
  const ext = path.extname(file.originalname).toLowerCase();
  if (!ALLOWED_MIME_TYPES.has(file.mimetype) || !ALLOWED_EXTENSIONS.has(ext)) {
    return cb(new ValidationError("Only PDF, JPG, and PNG files are accepted."));
  }
  cb(null, true);
}

export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: maxFileSizeBytes,
    files: 7, // valid ID, senior ID, proof of residency, guardian ID, auth doc, medical doc, +1 buffer
  },
});
