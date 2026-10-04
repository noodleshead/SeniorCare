import { setupTestDatabase, teardownTestDatabase, clearCollections } from "./setup.js";
import Barangay from "../src/models/Barangay.js";
import User from "../src/models/User.js";
import Guardian from "../src/models/Guardian.js";
import Senior from "../src/models/Senior.js";
import Verification from "../src/models/Verification.js";
import { registerSenior } from "../src/services/registration.service.js";
import { approveVerification } from "../src/services/verification.service.js";
import * as programService from "../src/services/benefitProgram.service.js";
import * as applicationService from "../src/services/benefitApplication.service.js";
import { resolveActingSenior } from "../src/utils/guardianAccess.js";
import { ACCOUNT_STATUS, ROLES, BENEFIT_CATEGORY, APPLICATION_STATUS } from "../src/utils/constants.js";
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
    dateOfBirth: "1945-05-05", // ~80 years old as of 2026
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

async function makeUserWithRole(role, assignedBarangay, emailPrefix = "user") {
  const user = await User.create({
    email: `${emailPrefix}-${Date.now()}-${Math.random()}@example.com`,
    passwordHash: await hashPassword("Password1"),
    role,
    status: ACCOUNT_STATUS.ACTIVE,
    assignedBarangayId: assignedBarangay?._id,
  });
  return { id: user._id.toString(), role: user.role, assignedBarangayId: assignedBarangay?._id.toString() };
}

async function makeActiveSenior(overrides = {}) {
  const result = await registerSenior(baseRegistration(overrides));
  const staff = await makeUserWithRole(
    ROLES.BARANGAY_STAFF,
    overrides.barangayId ? { _id: overrides.barangayId } : barangayA,
    "approver"
  );
  const verification = await Verification.findById(result.verificationId);
  await approveVerification(verification._id, staff, {});
  return result;
}

function programInput(overrides = {}) {
  return {
    name: "Octogenarian Assistance",
    description: "One-time cash assistance for seniors aged 80+.",
    category: BENEFIT_CATEGORY.AGE_BASED,
    minAge: 80,
    amount: 10000,
    status: "ACTIVE",
    ...overrides,
  };
}

test("a senior aged 80+ is eligible for an age-based program and can apply", async () => {
  const admin = await makeUserWithRole(ROLES.ADMIN);
  const program = await programService.createProgram(admin, programInput());

  const senior = await makeActiveSenior();
  const seniorProfile = await Senior.findOne({ userId: senior.userId });

  const { eligible } = programService.computeEligibility(seniorProfile, program);
  expect(eligible).toBe(true);

  const application = await applicationService.applyForBenefit(
    { id: senior.userId.toString(), role: ROLES.SENIOR_CITIZEN },
    { benefitProgramId: program._id.toString() }
  );
  expect(application.status).toBe(APPLICATION_STATUS.SUBMITTED);
  expect(application.barangayId.toString()).toBe(barangayA._id.toString());
});

test("a senior below the minimum age is not eligible and the backend rejects the application", async () => {
  const admin = await makeUserWithRole(ROLES.ADMIN);
  const program = await programService.createProgram(admin, programInput({ minAge: 90 }));

  const senior = await makeActiveSenior(); // ~80 years old
  await expect(
    applicationService.applyForBenefit(
      { id: senior.userId.toString(), role: ROLES.SENIOR_CITIZEN },
      { benefitProgramId: program._id.toString() }
    )
  ).rejects.toMatchObject({ statusCode: 400 });
});

test("a senior cannot have two active applications for the same program", async () => {
  const admin = await makeUserWithRole(ROLES.ADMIN);
  const program = await programService.createProgram(admin, programInput());
  const senior = await makeActiveSenior();
  const requestingUser = { id: senior.userId.toString(), role: ROLES.SENIOR_CITIZEN };

  await applicationService.applyForBenefit(requestingUser, { benefitProgramId: program._id.toString() });

  await expect(
    applicationService.applyForBenefit(requestingUser, { benefitProgramId: program._id.toString() })
  ).rejects.toMatchObject({ statusCode: 409 });
});

test("BARANGAY_STAFF can only see/act on applications from their own barangay", async () => {
  const admin = await makeUserWithRole(ROLES.ADMIN);
  const program = await programService.createProgram(admin, programInput());

  const seniorA = await makeActiveSenior({ accountEmail: "a@example.com" });
  const application = await applicationService.applyForBenefit(
    { id: seniorA.userId.toString(), role: ROLES.SENIOR_CITIZEN },
    { benefitProgramId: program._id.toString() }
  );

  const staffA = await makeUserWithRole(ROLES.BARANGAY_STAFF, barangayA, "staffA");
  const staffB = await makeUserWithRole(ROLES.BARANGAY_STAFF, barangayB, "staffB");

  const listForA = await applicationService.listApplications(staffA);
  expect(listForA.map((a) => a._id.toString())).toContain(application._id.toString());

  const listForB = await applicationService.listApplications(staffB);
  expect(listForB.map((a) => a._id.toString())).not.toContain(application._id.toString());

  await expect(applicationService.startReview(application._id, staffB)).rejects.toMatchObject({ statusCode: 403 });
  await expect(applicationService.startReview(application._id, staffA)).resolves.toMatchObject({
    status: APPLICATION_STATUS.UNDER_REVIEW,
  });
});

test("full happy-path workflow: submit -> endorse -> approve -> release -> claimed", async () => {
  const admin = await makeUserWithRole(ROLES.ADMIN);
  const osca = await makeUserWithRole(ROLES.LGU_OSCA);
  const program = await programService.createProgram(admin, programInput());
  const senior = await makeActiveSenior();
  const staff = await makeUserWithRole(ROLES.BARANGAY_STAFF, barangayA, "staff");

  let application = await applicationService.applyForBenefit(
    { id: senior.userId.toString(), role: ROLES.SENIOR_CITIZEN },
    { benefitProgramId: program._id.toString() }
  );

  application = await applicationService.endorseApplication(application._id, staff, { remarks: "Documents verified." });
  expect(application.status).toBe(APPLICATION_STATUS.ENDORSED);

  application = await applicationService.approveApplication(application._id, osca, { remarks: "Approved by OSCA." });
  expect(application.status).toBe(APPLICATION_STATUS.APPROVED);

  application = await applicationService.releaseApplication(application._id, staff, {});
  expect(application.status).toBe(APPLICATION_STATUS.RELEASED);

  application = await applicationService.completeApplication(application._id, staff, {});
  expect(application.status).toBe(APPLICATION_STATUS.CLAIMED);

  expect(application.statusHistory).toHaveLength(5); // SUBMITTED, ENDORSED, APPROVED, RELEASED, CLAIMED
});

test("only ADMIN/LGU_OSCA can approve or reject at the OSCA (ENDORSED) stage", async () => {
  const admin = await makeUserWithRole(ROLES.ADMIN);
  const program = await programService.createProgram(admin, programInput());
  const senior = await makeActiveSenior();
  const staff = await makeUserWithRole(ROLES.BARANGAY_STAFF, barangayA, "staff");

  let application = await applicationService.applyForBenefit(
    { id: senior.userId.toString(), role: ROLES.SENIOR_CITIZEN },
    { benefitProgramId: program._id.toString() }
  );
  application = await applicationService.endorseApplication(application._id, staff, {});

  await expect(applicationService.approveApplication(application._id, staff, {})).rejects.toMatchObject({
    statusCode: 403,
  });
  await expect(
    applicationService.rejectApplication(application._id, staff, { reason: "Incomplete." })
  ).rejects.toMatchObject({ statusCode: 403 });
});

test("Barangay Staff can reject before endorsement, with a recorded reason", async () => {
  const admin = await makeUserWithRole(ROLES.ADMIN);
  const program = await programService.createProgram(admin, programInput());
  const senior = await makeActiveSenior();
  const staff = await makeUserWithRole(ROLES.BARANGAY_STAFF, barangayA, "staff");

  const application = await applicationService.applyForBenefit(
    { id: senior.userId.toString(), role: ROLES.SENIOR_CITIZEN },
    { benefitProgramId: program._id.toString() }
  );

  const rejected = await applicationService.rejectApplication(application._id, staff, { reason: "Missing valid ID." });
  expect(rejected.status).toBe(APPLICATION_STATUS.REJECTED);
  expect(rejected.rejectionReason).toBe("Missing valid ID.");
});

test("a rejected application does not block reapplying for the same program", async () => {
  const admin = await makeUserWithRole(ROLES.ADMIN);
  const program = await programService.createProgram(admin, programInput());
  const senior = await makeActiveSenior();
  const staff = await makeUserWithRole(ROLES.BARANGAY_STAFF, barangayA, "staff");
  const requestingUser = { id: senior.userId.toString(), role: ROLES.SENIOR_CITIZEN };

  const first = await applicationService.applyForBenefit(requestingUser, { benefitProgramId: program._id.toString() });
  await applicationService.rejectApplication(first._id, staff, { reason: "Missing documents." });

  await expect(
    applicationService.applyForBenefit(requestingUser, { benefitProgramId: program._id.toString() })
  ).resolves.toMatchObject({ status: APPLICATION_STATUS.SUBMITTED });
});

// ---- Dormant Guardian authorization layer ----

test("resolveActingSenior: a Senior always resolves to their own profile only", async () => {
  const seniorA = await makeActiveSenior({ accountEmail: "sa@example.com" });
  const resolved = await resolveActingSenior({ id: seniorA.userId.toString(), role: ROLES.SENIOR_CITIZEN });
  expect(resolved._id.toString()).toBe(seniorA.seniorId.toString());
});

test("resolveActingSenior: an unauthorized Guardian record cannot resolve to a Senior", async () => {
  const senior = await makeActiveSenior();
  const seniorProfile = await Senior.findOne({ userId: senior.userId });

  // A Guardian user exists but is not linked/confirmed for this senior.
  const guardianUser = await User.create({
    email: "guardian1@example.com",
    passwordHash: await hashPassword("Password1"),
    role: ROLES.GUARDIAN,
    status: ACCOUNT_STATUS.ACTIVE,
  });

  await expect(
    resolveActingSenior({ id: guardianUser._id.toString(), role: ROLES.GUARDIAN })
  ).rejects.toMatchObject({ statusCode: 403 });

  // Even an unconfirmed Guardian record linked to the right senior must not resolve.
  await Guardian.create({
    seniorId: seniorProfile._id,
    userId: guardianUser._id,
    firstName: "Juan",
    lastName: "Dela Cruz",
    relationship: "Child",
    mobileNumber: "9170000000",
    authorizationConfirmed: false,
  });
  await expect(
    resolveActingSenior({ id: guardianUser._id.toString(), role: ROLES.GUARDIAN })
  ).rejects.toMatchObject({ statusCode: 403 });
});

test("resolveActingSenior: a confirmed, correctly-linked Guardian resolves only to their own senior — never another one by supplying a different id", async () => {
  const seniorA = await makeActiveSenior({ accountEmail: "sa2@example.com" });
  const seniorB = await makeActiveSenior({ accountEmail: "sb2@example.com" });
  const seniorProfileA = await Senior.findOne({ userId: seniorA.userId });
  const seniorProfileB = await Senior.findOne({ userId: seniorB.userId });

  const guardianUser = await User.create({
    email: "guardian2@example.com",
    passwordHash: await hashPassword("Password1"),
    role: ROLES.GUARDIAN,
    status: ACCOUNT_STATUS.ACTIVE,
  });
  const guardian = await Guardian.create({
    seniorId: seniorProfileA._id,
    userId: guardianUser._id,
    firstName: "Juan",
    lastName: "Dela Cruz",
    relationship: "Child",
    mobileNumber: "9170000000",
    authorizationConfirmed: true,
  });
  seniorProfileA.guardianId = guardian._id;
  await seniorProfileA.save();

  const resolved = await resolveActingSenior({ id: guardianUser._id.toString(), role: ROLES.GUARDIAN });
  expect(resolved._id.toString()).toBe(seniorProfileA._id.toString());

  // There is no seniorId parameter anywhere in resolveActingSenior for a
  // Guardian to supply — it is always derived from their own linked
  // Guardian record. Confirm it can never resolve to a different senior.
  expect(resolved._id.toString()).not.toBe(seniorProfileB._id.toString());
});

test("no registration or admin flow can currently create a GUARDIAN-role account (Guardian access remains dormant)", async () => {
  // registerSenior always creates SENIOR_CITIZEN accounts; the optional
  // guardian block only creates a Guardian *profile* record, never a
  // loginable User. This test guards against that changing silently.
  const result = await registerSenior(
    baseRegistration({
      accountEmail: "withguardian@example.com",
      guardian: {
        hasGuardian: true,
        firstName: "Ana",
        lastName: "Reyes",
        relationship: "Child",
        mobileNumber: "9171111111",
      },
    })
  );
  const user = await User.findById(result.userId);
  expect(user.role).toBe(ROLES.SENIOR_CITIZEN);

  const guardianUserCount = await User.countDocuments({ role: ROLES.GUARDIAN });
  expect(guardianUserCount).toBe(0);
});
