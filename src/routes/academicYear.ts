import express from "express";
import {
	createAcademicYear,
	deleteAcademicYear,
	getAcademicYearById,
	getAcademicYears,
	getCurrentAcademicYear,
	updateAcademicYear,
} from "../controllers/academicYear.ts";
import { authorize, protect } from "../middleware/auth.ts";
import { UserRole } from "../models/user.ts";

const academicYearRoutes = express.Router();

// Create a new academic year
academicYearRoutes.post(
	"/",
	protect,
	authorize([UserRole.ADMIN, UserRole.TEACHER]),
	createAcademicYear,
);
// Get the current academic year
academicYearRoutes.get("/current", protect, getCurrentAcademicYear);

// Get all academic years
academicYearRoutes.get("/", protect, getAcademicYears);

// Get a specific academic year by ID
academicYearRoutes.get("/:id", protect, getAcademicYearById);

// Update a specific academic year by ID
academicYearRoutes.put(
	"/:id",
	protect,
	authorize([UserRole.ADMIN, UserRole.TEACHER]),
	updateAcademicYear,
);

// Delete a specific academic year by ID
academicYearRoutes.delete(
	"/:id",
	protect,
	authorize([UserRole.ADMIN]),
	deleteAcademicYear,
);

export default academicYearRoutes;
