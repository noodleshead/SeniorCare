// Development-only seed script. Do NOT run against a production database.
// Usage: npm run seed

import "dotenv/config";
import { connectDatabase, disconnectDatabase } from "../config/database.js";
import Barangay from "../models/Barangay.js";
import Illness from "../models/Illness.js";
import User from "../models/User.js";
import { hashPassword } from "./password.js";
import { ROLES, ACCOUNT_STATUS } from "./constants.js";

const SAMPLE_BARANGAYS = [
  { name: "Barangay San Isidro", municipality: "Sample Municipality", province: "Sample Province", code: "BSI01" },
  { name: "Barangay Santa Cruz", municipality: "Sample Municipality", province: "Sample Province", code: "BSC01" },
  { name: "Barangay Poblacion", municipality: "Sample Municipality", province: "Sample Province", code: "BPB01" },
];

// Development placeholder list so the registration "medical condition"
// dropdown isn't empty. Deliberately unclassified — the Admin-managed
// Illness Database (Phase 4) will own the real list and any
// classification. Do not treat this as a medical reference.
const SAMPLE_ILLNESSES = [
  "Hypertension",
  "Diabetes",
  "Heart Disease",
  "Stroke",
  "Chronic Kidney Disease",
  "Chronic Obstructive Pulmonary Disease (COPD)",
  "Asthma",
  "Arthritis",
  "Cancer",
  "Dementia / Alzheimer's Disease",
  "Parkinson's Disease",
];

async function seed() {
  await connectDatabase();
  console.log("[seed] connected. Seeding development data...");

  const barangays = [];
  for (const b of SAMPLE_BARANGAYS) {
    const existing = await Barangay.findOneAndUpdate(
      { code: b.code },
      { $setOnInsert: b },
      { upsert: true, new: true }
    );
    barangays.push(existing);
    console.log(`[seed] barangay ready: ${existing.name}`);
  }

  // Idempotent by design: matches on the normalized name (same
  // collision key the unique index uses — see models/Illness.js) and
  // only ever sets fields on insert ($setOnInsert), so re-running `npm
  // run seed` after an Admin has edited/reclassified/deactivated one of
  // these records never overwrites that Admin's changes. Deliberately
  // does NOT set classification/priorityLevel on insert — this phase has
  // no rule to classify these conditions, so they insert as
  // unclassified (needsConfiguration: true in the Admin UI) rather than
  // guessing. Known limitation: if an Admin renames one of these seed
  // records, its normalizedName changes, so a later seed run will no
  // longer recognize it as "already seeded" and will insert a fresh
  // record under the original name — acceptable for a development seed,
  // but worth knowing before running it against a database with real
  // Admin edits.
  for (const name of SAMPLE_ILLNESSES) {
    const normalizedName = name.trim().toLowerCase();
    // $setOnInsert here bypasses Mongoose's pre("validate") hook (that
    // hook only runs on .save()/.create(), not findOneAndUpdate), so
    // normalizedName is set explicitly rather than relying on it.
    await Illness.findOneAndUpdate(
      { normalizedName },
      { $setOnInsert: { name, normalizedName, isActive: true } },
      { upsert: true, setDefaultsOnInsert: true }
    );
  }
  console.log(`[seed] ${SAMPLE_ILLNESSES.length} sample illnesses ready (placeholder list — Phase 4 will replace).`);

  // Development-only admin account. Clearly labeled test credentials —
  // change or remove before any real deployment.
  const adminEmail = "dev-admin@seniorcare.test";
  const existingAdmin = await User.findOne({ email: adminEmail });
  if (!existingAdmin) {
    await User.create({
      email: adminEmail,
      passwordHash: await hashPassword("DevAdmin123"),
      role: ROLES.ADMIN,
      status: ACCOUNT_STATUS.ACTIVE,
    });
    console.log(`[seed] created development admin: ${adminEmail} / DevAdmin123 (TEST ACCOUNT — do not use in production)`);
  } else {
    console.log("[seed] development admin already exists, skipping.");
  }

  // Development-only barangay staff account, scoped to the first barangay.
  const staffEmail = "dev-staff@seniorcare.test";
  const existingStaff = await User.findOne({ email: staffEmail });
  if (!existingStaff) {
    await User.create({
      email: staffEmail,
      passwordHash: await hashPassword("DevStaff123"),
      role: ROLES.BARANGAY_STAFF,
      status: ACCOUNT_STATUS.ACTIVE,
      assignedBarangayId: barangays[0]._id,
    });
    console.log(`[seed] created development staff: ${staffEmail} / DevStaff123 (TEST ACCOUNT — scoped to ${barangays[0].name})`);
  } else {
    console.log("[seed] development staff already exists, skipping.");
  }

  console.log("[seed] done.");
  await disconnectDatabase();
  process.exit(0);
}

seed().catch((err) => {
  console.error("[seed] failed:", err);
  process.exit(1);
});
