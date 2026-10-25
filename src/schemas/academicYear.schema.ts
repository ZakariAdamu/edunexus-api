import * as z from "zod";

// ====================== ACADEMIC YEAR MANAGEMENT SCHEMAS ======================

const academicYearDateSchema = z.coerce.date({
	error: "Invalid date",
});

// Create academic year schema
export const createAcademicYearSchema = z
	.object({
		name: z.string().trim().min(1, "Name is required"),
		fromYear: academicYearDateSchema,
		toYear: academicYearDateSchema,
		isCurrent: z.boolean().optional(),
	})
	.refine((data) => data.fromYear < data.toYear, {
		message: "Start date must be before end date",
		path: ["fromYear", "toYear"],
	});
