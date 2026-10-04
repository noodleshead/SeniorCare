import mongoose from "mongoose";
import { DOCUMENT_TYPES } from "../utils/constants.js";

// Files themselves are not stored inline in MongoDB. `storageKey`/`fileUrl`
// point at wherever the upload service actually persisted the file (local
// disk in development, S3/Cloudinary/Supabase Storage in production).
// Swapping storage backends should never require changing this schema.

const documentSchema = new mongoose.Schema(
  {
    seniorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Senior",
      required: true,
      index: true,
    },
    verificationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Verification",
      default: null,
      index: true,
    },

    documentType: {
      type: String,
      enum: Object.values(DOCUMENT_TYPES),
      required: true,
    },

    fileName: { type: String, required: true },
    storageKey: { type: String, required: true }, // path/key in the storage backend
    fileUrl: { type: String, default: null }, // only populated for protected, signed access
    mimeType: { type: String, required: true },
    fileSize: { type: Number, required: true }, // bytes

    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: { createdAt: "uploadedAt", updatedAt: true } }
);

documentSchema.index({ seniorId: 1, documentType: 1 });

export default mongoose.model("Document", documentSchema);
