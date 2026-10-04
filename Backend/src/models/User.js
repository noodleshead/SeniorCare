import mongoose from "mongoose";
import { ROLES, ACCOUNT_STATUS } from "../utils/constants.js";

// The User model handles ONLY authentication + account-level state.
// Profile information (name, address, senior status, etc.) lives in the
// Senior model, referenced 1:1 via `userId`. This separation means
// authentication concerns never leak into profile logic and vice versa.

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    username: {
      type: String,
      unique: true,
      sparse: true, // allows multiple docs without a username
      trim: true,
      index: true,
    },
    passwordHash: {
      type: String,
      required: true,
      select: false, // never returned by default queries
    },
    role: {
      type: String,
      enum: Object.values(ROLES),
      required: true,
      default: ROLES.SENIOR_CITIZEN,
    },
    status: {
      type: String,
      enum: Object.values(ACCOUNT_STATUS),
      required: true,
      default: ACCOUNT_STATUS.PENDING_VERIFICATION,
    },
    // Assigned barangay for BARANGAY_STAFF accounts — used to scope
    // which verification records a staff member may see/act on.
    assignedBarangayId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Barangay",
      default: null,
    },
    // Incremented to invalidate all outstanding refresh tokens
    // (e.g. on password change or forced logout).
    tokenVersion: {
      type: Number,
      default: 0,
    },
    lastLoginAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ username: 1 }, { unique: true, sparse: true });

// Never serialize sensitive fields, even if `select` is bypassed somewhere.
userSchema.set("toJSON", {
  transform: (_doc, ret) => {
    delete ret.passwordHash;
    delete ret.tokenVersion;
    delete ret.__v;
    return ret;
  },
});

export default mongoose.model("User", userSchema);
