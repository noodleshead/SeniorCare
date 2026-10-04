import { ValidationError } from "../utils/errors.js";

// Wraps a Zod schema. On failure, converts Zod's issue list into a flat
// { field: message } map so the frontend can highlight specific fields
// without parsing Zod's internal error shape.
export function validateBody(schema) {
  return (req, _res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const fieldErrors = {};
      for (const issue of result.error.issues) {
        const key = issue.path.join(".") || "_root";
        if (!fieldErrors[key]) fieldErrors[key] = issue.message;
      }
      return next(new ValidationError("Please correct the highlighted fields.", fieldErrors));
    }
    req.validatedBody = result.data;
    next();
  };
}
