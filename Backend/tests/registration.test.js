import { jest } from "@jest/globals";
import { setupTestDatabase, teardownTestDatabase, clearCollections } from "./setup.js";
import Barangay from "../src/models/Barangay.js";
import User from "../src/models/User.js";
import Senior from "../src/models/Senior.js";
import Verification from "../src/models/Verification.js";
import { registerSenior } from "../src/services/registration.service.js";
import { ACCOUNT_STATUS, VERIFICATION_STATUS } from "../src/utils/constants.js";

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
  barangay = await Barangay.create({
    name: "Barangay Test",
    municipality: "Test Municipality",
    province: "Test Province",
    code: "BT01",
    isActive: true,
  });
});

function baseRegistration(overrides = {}) {
  return {
    barangayId: barangay._id.toString(),
    firstName: "Juan",
    middleName: "",
    lastName: "Dela Cruz",
    suffix: "",
    dateOfBirth: "1940-01-20",
    sex: "Male",
    civilStatus: "Widowed",
    seniorCitizenId: "",
    mobileNumber: "9171234567",
    email: "",
    address: {
      street: "Purok 1",
      municipality: "Test Municipality",
    },
    bedridden: false,
    accountEmail: "juan@example.com",
    password: "Password1",
    ...overrides,
  };
}

test("valid registration creates User (PENDING_VERIFICATION) and Verification (PENDING)", async () => {
  const result = await registerSenior(baseRegistration());

  const user = await User.findById(result.userId);
  expect(user.status).toBe(ACCOUNT_STATUS.PENDING_VERIFICATION);

  const verification = await Verification.findById(result.verificationId);
  expect(verification.status).toBe(VERIFICATION_STATUS.PENDING);

  const senior = await Senior.findById(result.seniorId);
  expect(senior.firstName).toBe("Juan");
});

test("rejects registration against an inactive barangay", async () => {
  const inactive = await Barangay.create({
    name: "Inactive Barangay",
    municipality: "Test Municipality",
    province: "Test Province",
    code: "INAC1",
    isActive: false,
  });

  await expect(
    registerSenior(baseRegistration({ barangayId: inactive._id.toString(), accountEmail: "x@example.com" }))
  ).rejects.toThrow(/invalid or currently inactive/i);
});

test("rejects registration against a nonexistent barangay", async () => {
  const fakeId = "64b64b64b64b64b64b64b64b";
  await expect(
    registerSenior(baseRegistration({ barangayId: fakeId, accountEmail: "y@example.com" }))
  ).rejects.toThrow(/invalid or currently inactive/i);
});

test("rejects duplicate email", async () => {
  await registerSenior(baseRegistration());
  await expect(
    registerSenior(baseRegistration({ seniorCitizenId: "" }))
  ).rejects.toThrow(/email already exists/i);
});

test("rejects duplicate Senior Citizen ID", async () => {
  await registerSenior(baseRegistration({ seniorCitizenId: "SC-0001", accountEmail: "first@example.com" }));
  await expect(
    registerSenior(baseRegistration({ seniorCitizenId: "SC-0001", accountEmail: "second@example.com" }))
  ).rejects.toThrow(/already registered/i);
});

test("rejects registrants below the minimum senior age", async () => {
  const young = new Date();
  young.setFullYear(young.getFullYear() - 30);

  await expect(
    registerSenior(
      baseRegistration({
        dateOfBirth: young.toISOString().slice(0, 10),
        accountEmail: "young@example.com",
      })
    )
  ).rejects.toThrow(/age requirement/i);
});

test("never stores a plain-text password", async () => {
  const result = await registerSenior(baseRegistration({ accountEmail: "hash-check@example.com" }));
  const user = await User.findById(result.userId).select("+passwordHash");
  expect(user.passwordHash).not.toBe("Password1");
  expect(user.passwordHash.startsWith("$2")).toBe(true); // bcrypt hash prefix
});
