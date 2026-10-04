import { jest } from "@jest/globals";
import { setupTestDatabase, teardownTestDatabase, clearCollections } from "./setup.js";
import Barangay from "../src/models/Barangay.js";
import User from "../src/models/User.js";
import Verification from "../src/models/Verification.js";
import { registerSenior } from "../src/services/registration.service.js";
import { approveVerification } from "../src/services/verification.service.js";
import * as pensionService from "../src/services/pension.service.js";
import * as scheduleService from "../src/services/pensionSchedule.service.js";
import * as claimService from "../src/services/pensionClaim.service.js";
import { ACCOUNT_STATUS, ROLES, PENSION_TYPES, PENSION_FREQUENCY } from "../src/utils/constants.js";
import { hashPassword } from "../src/utils/password.js";

jest.setTimeout(30000);

let barangayA;
let barangayB;

beforeAll(async () => {
  await setupTestDatabase();
});

afterAll(async () => {
  await teardownTestDatabase();
});

beforeEach(async () => {
  await clearCollections();
  barangayA = await Barangay.create({ name: "San Antonio", municipality: "M", province: "P", code: "SA01" });
  barangayB = await Barangay.create({ name: "Del Pilar", municipality: "M", province: "P", code: "DP01" });
});

function baseRegistration(overrides = {}) {
  return {
    barangayId: barangayA._id.toString(),
    firstName: "Maria",
    lastName: "Santos",
    dateOfBirth: "1945-05-05",
    sex: "Female",
    civilStatus: "Widowed",
    mobileNumber: "9171234567",
    address: { street: "Purok 2", municipality: "M" },
    bedridden: false,
    accountEmail: "maria@example.com",
    password: "Password1",
    ...overrides,
  };
}

async function makeStaff(assignedBarangay, emailPrefix = "staff") {
  const user = await User.create({
    email: `${emailPrefix}-${assignedBarangay._id}@example.com`,
    passwordHash: await hashPassword("StaffPass1"),
    role: ROLES.BARANGAY_STAFF,
    status: ACCOUNT_STATUS.ACTIVE,
    assignedBarangayId: assignedBarangay._id,
  });
  return { id: user._id.toString(), role: user.role, assignedBarangayId: assignedBarangay._id.toString() };
}

/** Registers + approves a Senior, returning { userId, seniorId, barangayId }. */
async function makeActiveSenior(overrides = {}) {
  const result = await registerSenior(baseRegistration(overrides));
  const staff = await makeStaff(overrides.barangayId ? { _id: overrides.barangayId } : barangayA, "approver");
  const verification = await Verification.findById(result.verificationId);
  await approveVerification(verification._id, staff, {});
  return result;
}

function pensionInput(seniorId, overrides = {}) {
  return {
    seniorId: seniorId.toString(),
    pensionType: PENSION_TYPES.SOCIAL_PENSION,
    pensionProvider: "DSWD",
    pensionAmount: 1000,
    frequency: PENSION_FREQUENCY.MONTHLY,
    effectiveDate: new Date("2026-01-01"),
    ...overrides,
  };
}

test("staff can create a pension record for an active senior in their barangay", async () => {
  const senior = await makeActiveSenior({ accountEmail: "p1@example.com" });
  const staff = await makeStaff(barangayA);

  const pension = await pensionService.createPension(staff, pensionInput(senior.seniorId));
  expect(pension.pensionAmount).toBe(1000);

  const mine = await pensionService.getMyPension(senior.userId);
  expect(mine.pensionAmount).toBe(1000);
});

test("staff cannot create a pension record for a senior outside their barangay", async () => {
  const senior = await makeActiveSenior({ accountEmail: "p2@example.com", barangayId: barangayA._id.toString() });
  const staffB = await makeStaff(barangayB);

  await expect(pensionService.createPension(staffB, pensionInput(senior.seniorId))).rejects.toMatchObject({
    statusCode: 403,
  });
});

test("a senior can only ever fetch their own pension record", async () => {
  const seniorA = await makeActiveSenior({ accountEmail: "p3a@example.com" });
  const seniorB = await makeActiveSenior({ accountEmail: "p3b@example.com", firstName: "Juan", lastName: "Cruz" });
  const staff = await makeStaff(barangayA);

  await pensionService.createPension(staff, pensionInput(seniorA.seniorId, { pensionAmount: 1000 }));
  await pensionService.createPension(staff, pensionInput(seniorB.seniorId, { pensionAmount: 2500 }));

  const mineA = await pensionService.getMyPension(seniorA.userId);
  const mineB = await pensionService.getMyPension(seniorB.userId);
  expect(mineA.pensionAmount).toBe(1000);
  expect(mineB.pensionAmount).toBe(2500);
});

test("staff creates a schedule for their own barangay even if they don't send barangayId", async () => {
  const staff = await makeStaff(barangayA);
  const schedule = await scheduleService.createSchedule(staff, {
    date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    location: "Barangay Hall",
    startTime: "08:00 AM",
    endTime: "12:00 PM",
    slots: [{ startTime: "09:00 AM", endTime: "09:30 AM", capacity: 5 }],
  });
  expect(schedule.barangayId.toString()).toBe(barangayA._id.toString());
});

test("staff cannot redirect their schedule to another barangay by sending a barangayId", async () => {
  const staff = await makeStaff(barangayA);
  const schedule = await scheduleService.createSchedule(staff, {
    barangayId: barangayB._id.toString(), // attempted tampering
    date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    location: "Barangay Hall",
    startTime: "08:00 AM",
    endTime: "12:00 PM",
    slots: [{ startTime: "09:00 AM", endTime: "09:30 AM", capacity: 5 }],
  });
  // Ignored — always their own assigned barangay, never the request body.
  expect(schedule.barangayId.toString()).toBe(barangayA._id.toString());
});

test("admin must explicitly choose a barangay, and it is honored when provided", async () => {
  const admin = { id: "000000000000000000000001", role: ROLES.ADMIN, assignedBarangayId: null };

  await expect(
    scheduleService.createSchedule(admin, {
      date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      location: "Barangay Hall",
      startTime: "08:00 AM",
      endTime: "12:00 PM",
      slots: [{ startTime: "09:00 AM", endTime: "09:30 AM", capacity: 5 }],
    })
  ).rejects.toMatchObject({ statusCode: 400 });

  const schedule = await scheduleService.createSchedule(admin, {
    barangayId: barangayB._id.toString(),
    date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    location: "Barangay Hall",
    startTime: "08:00 AM",
    endTime: "12:00 PM",
    slots: [{ startTime: "09:00 AM", endTime: "09:30 AM", capacity: 5 }],
  });
  expect(schedule.barangayId.toString()).toBe(barangayB._id.toString());
});

test("listBarangayOptionsForScheduling returns only the staff's own barangay, and all barangays for admin", async () => {
  const staff = await makeStaff(barangayA);
  const admin = { id: "000000000000000000000001", role: ROLES.ADMIN, assignedBarangayId: null };

  const staffOptions = await scheduleService.listBarangayOptionsForScheduling(staff);
  expect(staffOptions).toHaveLength(1);
  expect(staffOptions[0]._id.toString()).toBe(barangayA._id.toString());

  const adminOptions = await scheduleService.listBarangayOptionsForScheduling(admin);
  const ids = adminOptions.map((b) => b._id.toString());
  expect(ids).toEqual(expect.arrayContaining([barangayA._id.toString(), barangayB._id.toString()]));
});

async function makeScheduleWithSlot(staff, capacity = 1) {
  return scheduleService.createSchedule(staff, {
    date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    location: "Barangay Hall",
    startTime: "08:00 AM",
    endTime: "12:00 PM",
    slots: [{ startTime: "09:00 AM", endTime: "09:30 AM", capacity }],
  });
}

test("a senior with a pension can book an available slot and receives a QR pass", async () => {
  const senior = await makeActiveSenior({ accountEmail: "book1@example.com" });
  const staff = await makeStaff(barangayA);
  await pensionService.createPension(staff, pensionInput(senior.seniorId));
  const schedule = await makeScheduleWithSlot(staff, 5);

  const claim = await claimService.bookSlot(senior.userId, {
    scheduleId: schedule._id.toString(),
    slotId: schedule.slots[0]._id.toString(),
  });
  expect(claim.status).toBe("SCHEDULED");
  expect(claim.qrToken).toBeTruthy();

  const { qrDataUrl } = await claimService.getMyClaimQr(senior.userId, claim._id.toString());
  expect(qrDataUrl.startsWith("data:image/png;base64,")).toBe(true);
});

test("booking is rejected once a slot's capacity is exhausted (no overbooking)", async () => {
  const seniorA = await makeActiveSenior({ accountEmail: "cap-a@example.com" });
  const seniorB = await makeActiveSenior({ accountEmail: "cap-b@example.com", firstName: "Juan", lastName: "Cruz" });
  const staff = await makeStaff(barangayA);
  await pensionService.createPension(staff, pensionInput(seniorA.seniorId));
  await pensionService.createPension(staff, pensionInput(seniorB.seniorId));
  const schedule = await makeScheduleWithSlot(staff, 1); // capacity 1
  const slotId = schedule.slots[0]._id.toString();

  await claimService.bookSlot(seniorA.userId, { scheduleId: schedule._id.toString(), slotId });

  await expect(
    claimService.bookSlot(seniorB.userId, { scheduleId: schedule._id.toString(), slotId })
  ).rejects.toMatchObject({ statusCode: 409 });
});

test("a senior cannot book the same schedule twice", async () => {
  const senior = await makeActiveSenior({ accountEmail: "dup1@example.com" });
  const staff = await makeStaff(barangayA);
  await pensionService.createPension(staff, pensionInput(senior.seniorId));
  const schedule = await scheduleService.createSchedule(staff, {
    date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    location: "Barangay Hall",
    startTime: "08:00 AM",
    endTime: "12:00 PM",
    slots: [
      { startTime: "09:00 AM", endTime: "09:30 AM", capacity: 5 },
      { startTime: "09:30 AM", endTime: "10:00 AM", capacity: 5 },
    ],
  });

  await claimService.bookSlot(senior.userId, {
    scheduleId: schedule._id.toString(),
    slotId: schedule.slots[0]._id.toString(),
  });

  await expect(
    claimService.bookSlot(senior.userId, {
      scheduleId: schedule._id.toString(),
      slotId: schedule.slots[1]._id.toString(),
    })
  ).rejects.toMatchObject({ statusCode: 409 });
});

test("a senior cannot book a schedule belonging to another barangay", async () => {
  const senior = await makeActiveSenior({ accountEmail: "wrongbrgy@example.com", barangayId: barangayA._id.toString() });
  const staffB = await makeStaff(barangayB);
  await pensionService.createPension(await makeStaff(barangayA), pensionInput(senior.seniorId));
  const scheduleB = await makeScheduleWithSlot(staffB, 5);

  await expect(
    claimService.bookSlot(senior.userId, {
      scheduleId: scheduleB._id.toString(),
      slotId: scheduleB.slots[0]._id.toString(),
    })
  ).rejects.toMatchObject({ statusCode: 403 });
});

test("staff can verify a valid QR claiming pass exactly once", async () => {
  const senior = await makeActiveSenior({ accountEmail: "verify1@example.com" });
  const staff = await makeStaff(barangayA);
  await pensionService.createPension(staff, pensionInput(senior.seniorId));
  const schedule = await makeScheduleWithSlot(staff, 5);
  const claim = await claimService.bookSlot(senior.userId, {
    scheduleId: schedule._id.toString(),
    slotId: schedule.slots[0]._id.toString(),
  });

  // Step 1: resolving the token must NOT change status by itself.
  const resolved = await claimService.resolveClaimByToken(staff, claim.qrToken);
  expect(resolved.status).toBe("SCHEDULED");
  const stillScheduled = await claimService.getMyUpcomingClaim(senior.userId);
  expect(stillScheduled.status).toBe("SCHEDULED");

  // Step 2: explicit confirmation is what actually claims it.
  const confirmed = await claimService.confirmClaim(staff, claim.qrToken);
  expect(confirmed.status).toBe("CLAIMED");
  expect(confirmed.claimedAt).toBeTruthy();
  expect(confirmed.verifiedBy.toString()).toBe(staff.id);

  await expect(claimService.resolveClaimByToken(staff, claim.qrToken)).rejects.toMatchObject({ statusCode: 409 });
  await expect(claimService.confirmClaim(staff, claim.qrToken)).rejects.toMatchObject({ statusCode: 409 });
});

test("an invalid QR token is rejected safely", async () => {
  const staff = await makeStaff(barangayA);
  await expect(claimService.resolveClaimByToken(staff, "not-a-real-token")).rejects.toMatchObject({
    statusCode: 404,
  });
  await expect(claimService.confirmClaim(staff, "not-a-real-token")).rejects.toMatchObject({
    statusCode: 404,
  });
});

test("staff from another barangay cannot resolve or confirm a claim that isn't theirs", async () => {
  const senior = await makeActiveSenior({ accountEmail: "verify2@example.com", barangayId: barangayA._id.toString() });
  const staffA = await makeStaff(barangayA);
  const staffB = await makeStaff(barangayB);
  await pensionService.createPension(staffA, pensionInput(senior.seniorId));
  const schedule = await makeScheduleWithSlot(staffA, 5);
  const claim = await claimService.bookSlot(senior.userId, {
    scheduleId: schedule._id.toString(),
    slotId: schedule.slots[0]._id.toString(),
  });

  await expect(claimService.resolveClaimByToken(staffB, claim.qrToken)).rejects.toMatchObject({ statusCode: 403 });
  await expect(claimService.confirmClaim(staffB, claim.qrToken)).rejects.toMatchObject({ statusCode: 403 });
});

test("a senior can cancel their own upcoming booking and the slot capacity is released", async () => {
  const senior = await makeActiveSenior({ accountEmail: "cancel1@example.com" });
  const staff = await makeStaff(barangayA);
  await pensionService.createPension(staff, pensionInput(senior.seniorId));
  const schedule = await makeScheduleWithSlot(staff, 1);
  const claim = await claimService.bookSlot(senior.userId, {
    scheduleId: schedule._id.toString(),
    slotId: schedule.slots[0]._id.toString(),
  });

  const cancelled = await claimService.cancelClaim(senior.userId, claim._id.toString());
  expect(cancelled.status).toBe("CANCELLED");
  expect(cancelled.cancelledAt).toBeTruthy();

  const refreshedSchedule = await scheduleService.getScheduleById(schedule._id.toString(), staff);
  const slot = refreshedSchedule.slots.id(schedule.slots[0]._id);
  expect(slot.bookedCount).toBe(0);
  expect(slot.availableCount).toBe(1);
  expect(slot.status).toBe("AVAILABLE");

  // Double-cancel must not double-release capacity or succeed again.
  await expect(claimService.cancelClaim(senior.userId, claim._id.toString())).rejects.toMatchObject({
    statusCode: 409,
  });
  const scheduleAfterRetry = await scheduleService.getScheduleById(schedule._id.toString(), staff);
  expect(scheduleAfterRetry.slots.id(schedule.slots[0]._id).availableCount).toBe(1);
});

test("a claimed booking cannot be cancelled", async () => {
  const senior = await makeActiveSenior({ accountEmail: "cancel2@example.com" });
  const staff = await makeStaff(barangayA);
  await pensionService.createPension(staff, pensionInput(senior.seniorId));
  const schedule = await makeScheduleWithSlot(staff, 5);
  const claim = await claimService.bookSlot(senior.userId, {
    scheduleId: schedule._id.toString(),
    slotId: schedule.slots[0]._id.toString(),
  });
  await claimService.confirmClaim(staff, claim.qrToken);

  await expect(claimService.cancelClaim(senior.userId, claim._id.toString())).rejects.toMatchObject({
    statusCode: 409,
  });
});

test("a senior cannot cancel another senior's booking", async () => {
  const seniorA = await makeActiveSenior({ accountEmail: "cancel3a@example.com" });
  const seniorB = await makeActiveSenior({ accountEmail: "cancel3b@example.com" });
  const staff = await makeStaff(barangayA);
  await pensionService.createPension(staff, pensionInput(seniorA.seniorId));
  const schedule = await makeScheduleWithSlot(staff, 5);
  const claim = await claimService.bookSlot(seniorA.userId, {
    scheduleId: schedule._id.toString(),
    slotId: schedule.slots[0]._id.toString(),
  });

  await expect(claimService.cancelClaim(seniorB.userId, claim._id.toString())).rejects.toMatchObject({
    statusCode: 404,
  });
});

test("a SCHEDULED claim whose claiming window has passed is swept to MISSED and can no longer be claimed or cancelled", async () => {
  const senior = await makeActiveSenior({ accountEmail: "missed1@example.com" });
  const staff = await makeStaff(barangayA);
  await pensionService.createPension(staff, pensionInput(senior.seniorId));
  const schedule = await makeScheduleWithSlot(staff, 5);
  const claim = await claimService.bookSlot(senior.userId, {
    scheduleId: schedule._id.toString(),
    slotId: schedule.slots[0]._id.toString(),
  });

  // Simulate the claiming window having already passed.
  const PensionClaimModel = (await import("../src/models/PensionClaim.js")).default;
  await PensionClaimModel.updateOne(
    { _id: claim._id },
    { $set: { scheduledDate: new Date(Date.now() - 24 * 60 * 60 * 1000) } }
  );

  const history = await claimService.getMyClaimHistory(senior.userId);
  expect(history).toHaveLength(1);
  expect(history[0].status).toBe("MISSED");
  expect(await claimService.getMyUpcomingClaim(senior.userId)).toBeNull();

  await expect(claimService.resolveClaimByToken(staff, claim.qrToken)).rejects.toMatchObject({ statusCode: 409 });
  await expect(claimService.cancelClaim(senior.userId, claim._id.toString())).rejects.toMatchObject({
    statusCode: 409,
  });
});

test("claiming history reflects a claimed slot and stays empty before any claim", async () => {
  const senior = await makeActiveSenior({ accountEmail: "history1@example.com" });
  const staff = await makeStaff(barangayA);

  expect(await claimService.getMyClaimHistory(senior.userId)).toHaveLength(0);

  await pensionService.createPension(staff, pensionInput(senior.seniorId));
  const schedule = await makeScheduleWithSlot(staff, 5);
  const claim = await claimService.bookSlot(senior.userId, {
    scheduleId: schedule._id.toString(),
    slotId: schedule.slots[0]._id.toString(),
  });

  // Still scheduled, not history yet.
  expect(await claimService.getMyClaimHistory(senior.userId)).toHaveLength(0);
  expect((await claimService.getMyUpcomingClaim(senior.userId))._id.toString()).toBe(claim._id.toString());

  await claimService.verifyClaimByToken(staff, claim.qrToken);

  const history = await claimService.getMyClaimHistory(senior.userId);
  expect(history).toHaveLength(1);
  expect(history[0].status).toBe("CLAIMED");
  expect(await claimService.getMyUpcomingClaim(senior.userId)).toBeNull();
});
