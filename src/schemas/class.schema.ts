import * as z from "zod";

// ====================== CLASS MANAGEMENT SCHEMAS ======================

export const createClassSchema = z.object({
	name: z.string().min(1).max(100),
	academicYear: z.string(),
	classTeacher: z.string().optional(),
	subjects: z.array(z.string()).default([]),
	students: z.array(z.string()).default([]),
	capacity: z.number().min(0).optional(),
});
