import type z from "zod";

// Helper to map Zod validation errors to a field-based error object
export function mapZodIssues(error: z.ZodError) {
  return error.issues.reduce<Record<string, string>>((accumulator, issue) => {
    accumulator[issue.path.join(".") || "form"] = issue.message;
    return accumulator;
  }, {});
}
