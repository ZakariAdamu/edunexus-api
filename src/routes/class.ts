import express from "express";
import {
	createClass,
	deleteClass,
	getAllClasses,
	getClassById,
	updateClass,
	// deleteClass, getClasses, updateClass
} from "../controllers/class.ts";
import { authorize, protect } from "../middleware/auth.ts";
import { UserRole } from "../models/user.ts";

export const classRoutes = express.Router();

// Create a new class
classRoutes.post("/", protect, authorize([UserRole.ADMIN]), createClass);

// Get all classes
classRoutes.get("/", protect, getAllClasses);

// Get a specific class by ID
classRoutes.get("/:id", protect, getClassById);

// Update a specific class by ID
classRoutes.patch("/:id", protect, authorize([UserRole.ADMIN]), updateClass);

// Delete a specific class by ID
classRoutes.delete("/:id", protect, authorize([UserRole.ADMIN]), deleteClass);
