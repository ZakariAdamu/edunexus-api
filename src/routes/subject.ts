import express from "express";
import {
	createSubject,
	deleteSubject,
	getAllSubjects,
	getSubjectById,
	updateSubject,
	// deleteSubject,
	// getAllSubjects,
	// getSubjectById,
	// updateSubject,
} from "../controllers/subject.ts";
import { authorize, protect } from "../middleware/auth.ts";
import { UserRole } from "../models/user.ts";

export const subjectRoutes = express.Router();

// Create a new subject
subjectRoutes.post("/", protect, authorize([UserRole.ADMIN]), createSubject);

// Get all subjects
subjectRoutes.get("/", protect, getAllSubjects);

// Get a specific subject by ID
subjectRoutes.get("/:id", protect, getSubjectById);

// Update a specific subject by ID
subjectRoutes.put	("/:id", protect, authorize([UserRole.ADMIN]), updateSubject);

// Delete a specific subject by ID
subjectRoutes.delete("/:id", protect, authorize([UserRole.ADMIN]), deleteSubject);
