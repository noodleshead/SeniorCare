import { setupTestDatabase, teardownTestDatabase, clearCollections } from "./setup.js";
import Barangay from "../src/models/Barangay.js";
import User from "../src/models/User.js";
import Verification from "../src/models/Verification.js";
import { registerSenior } from "../src/services/registration.service.js";
import { approveVerification } from "../src/services/verification.service.js";
import { getMySeniorProfile } from "../src/services/senior.service.js";
import { ACCOUNT_STATUS, ROLES } from "../src/utils/constants.js";
import { hashPassword } from "../src/utils/password.js";

jest.setTimeout(30000);

let barangay;

beforeAll(async () => {
  await setupTestDatabase();
});

afterAll(async () => {
  await teardownTestDatabase();
});

beforeEach(async () => {
  await clearCollections();
  barangay = await Barangay.create({ name: "San Antonio", municipality: "M", province: "P", code: "SA01" });
});

function baseRegistration(overrides = {}) {
  return {
    barangayId: barangay._id.toString(),
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

async function makeStaff(assignedBarangay) {
  const user = await User.create({
    email: `staff-${assignedBarangay._id}@example.com`,
    passwordHash: await hashPassword("StaffPass1"),
    role: ROLES.BARANGAY_STAFF,
    status: ACCOUNT_STATUS.ACTIVE,
    assignedBarangayId: assignedBarangay._id,
  });
  return { id: user._id.toString(), role: user.role, assignedBarangayId: assignedBarangay._id.toString() };
}

test("an active senior can fetch their own profile with barangay info resolved", async () => {
  const result = await registerSenior(baseRegistration());
  const staff = await makeStaff(barangay);
  const verification = await Verification.findById(result.verificationId);
  await approveVerification(verification._id, staff, { remarks: "ok" });

  const profile = await getMySeniorProfile(result.userId);

  expect(profile.firstName).toBe("Maria");
  expect(profile.accountStatus).toBe(ACCOUNT_STATUS.ACTIVE);
  expect(profile.barangay).toMatchObject({ name: "San Antonio" });
  // Never leaks another senior's identifiers.
  expect(profile.id).toBe(result.seniorId.toString());
});

test("getMySeniorProfile only ever resolves the given user's own Senior record", async () => {
  const resultA = await registerSenior(baseRegistration({ accountEmail: "senior-a@example.com" }));
  const resultB = await registerSenior(
    baseRegistration({ accountEmail: "senior-b@example.com", firstName: "Juan", lastName: "Cruz" })
  );
  const staff = await makeStaff(barangay);
  await approveVerification(resultA.verificationId, staff, {});
  await approveVerification(resultB.verificationId, staff, {});

  const profileA = await getMySeniorProfile(resultA.userId);
  const profileB = await getMySeniorProfile(resultB.userId);

  expect(profileA.firstName).toBe("Maria");
  expect(profileB.firstName).toBe("Juan");
  expect(profileA.id).not.toBe(profileB.id);
});
