import mongoose from "mongoose";

const barangaySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    municipality: { type: String, required: true, trim: true },
    province: { type: String, required: true, trim: true },
    code: { type: String, required: true, unique: true, trim: true, uppercase: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

barangaySchema.index({ name: 1, municipality: 1 });

export default mongoose.model("Barangay", barangaySchema);
