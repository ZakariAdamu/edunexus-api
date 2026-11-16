import express from "express";
import { authorize, protect } from "../middleware/auth.ts";
import { UserRole } from "../models/user.ts";

import {
	generateTimetable,
	getAllTimetables,
	getTimetableByClassAndAcademicYear,
} from "../controllers/timetable.ts";
export const timetableRoutes = express.Router();

// Generate a Timetable using AI: Admin only (costs money/resources)
timetableRoutes.post(
	"/generate",
	protect,
	authorize([UserRole.ADMIN]),
	generateTimetable,
);

// Get all timetables (Admin only)
timetableRoutes.get(
	"/",
	protect,
	authorize([UserRole.ADMIN]),
	getAllTimetables,
);

// Get timetable for a specific class and academic year
timetableRoutes.get(
	"/:academicYearId/:classId",
	protect,
	authorize([UserRole.ADMIN, UserRole.TEACHER, UserRole.STUDENT]),
	getTimetableByClassAndAcademicYear,
);
