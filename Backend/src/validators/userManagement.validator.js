import { z } from "zod";
import { ACCOUNT_STATUS } from "../utils/constants.js";

// Deliberately excludes PENDING_VERIFICATION and REJECTED — those
// remain owned exclusively by the Verification workflow (see
// userManagement.service.js#setUserAccountStatus for the enforcement).
export const updateUserStatusSchema = z
  .object({
    status: z.enum([ACCOUNT_STATUS.ACTIVE, ACCOUNT_STATUS.INACTIVE], {
      errorMap: () => ({ message: "Status must be ACTIVE or INACTIVE." }),
    }),
  })
  .strict();
