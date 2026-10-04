/**
 * Run this BEFORE deploying the Phase 1 fixes to any environment with
 * real data: models/Senior.js's seniorCitizenId index was already
 * declared unique+sparse before this phase, so if the collection
 * somehow already contains duplicate non-empty seniorCitizenId values,
 * Mongoose will fail to build that index on startup (a duplicate-key
 * error at index-creation time, not at insert time) — the app would
 * refuse to start against that database.
 *
 * This script only REPORTS duplicates. It does not delete, merge, or
 * modify any record — per Phase 1's explicit instruction not to blindly
 * delete existing duplicate data.
 *
 * Usage:
 *   node src/scripts/checkDuplicateSeniorCitizenIds.js
 * (reads MONGO_URI from the environment, same as the app itself)
 */
import mongoose from "mongoose";
import "dotenv/config";
import Senior from "../models/Senior.js";

async function main() {
  await mongoose.connect(process.env.MONGO_URI);

  const duplicates = await Senior.aggregate([
    { $match: { seniorCitizenId: { $nin: [null, ""] } } },
    { $group: { _id: "$seniorCitizenId", count: { $sum: 1 }, seniorIds: { $push: "$_id" } } },
    { $match: { count: { $gt: 1 } } },
  ]);

  if (duplicates.length === 0) {
    console.log("No duplicate Senior Citizen IDs found. Safe to deploy the unique index.");
  } else {
    console.log(`Found ${duplicates.length} duplicate Senior Citizen ID value(s):`);
    for (const dup of duplicates) {
      console.log(`  "${dup._id}" — used by ${dup.count} Senior records: ${dup.seniorIds.join(", ")}`);
    }
    console.log(
      "\nResolve these manually (confirm which record holds the correct ID, correct or clear the others) before deploying — Mongoose will otherwise fail to build the unique index on startup."
    );
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
