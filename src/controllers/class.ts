import type { Response } from "express";
import * as z from "zod";

import { sendError, sendSuccess } from "../lib/response.ts";
import type { AuthRequest } from "../middleware/auth.ts";
import { logActivity } from "../services/activityLog.service.ts";
import { ActivityAction } from "../models/activityLogs.ts";
import Class from "../models/class.ts";
import { createClassSchema } from "../schemas/class.schema.ts";

// @desc    1. Create a new class
// @route   POST /api/classes
// @access  Private/Admin
export const createClass = async (req: AuthRequest, res: Response) => {
	try {
		const { name, academicYear, classTeacher, subjects, students, capacity } =
			createClassSchema.parse(req.body);
		if (!req.user) {
			return sendError(res, 401, "Authentication required");
		}

		const existingClass = await Class.findOne({ name, academicYear });
		if (existingClass) {
			return sendError(
				res,
				409,
				"Class with this name  already exists for the specified academic year",
			);
		}

		const newClass = await Class.create({
			name,
			academicYear,
			classTeacher,
			subjects,
			students,
			capacity,
		});

		await logActivity({
			userId: req.user._id,
			action: ActivityAction.CREATE_CLASS,
			description: `Created class: ${newClass.name}`,
		});

		sendSuccess(res, 201, "Class created successfully", newClass);
	} catch (error) {
		if (error instanceof z.ZodError) {
			return sendError(res, 400, "Validation failed", {
				issues: error.issues,
			});
		}
		return sendError(
			res,
			500,
			error instanceof Error ? error.message : "Server error",
		);
	}
};

// @desc    2. Get all classes
// @route   GET /api/classes
// @access  Private/Admin
export const getAllClasses = async (req: AuthRequest, res: Response) => {
	try {
		const page = parseInt(req.query.page as string) || 1;
		const limit = parseInt(req.query.limit as string) || 10;
		const search = (req.query.search as string) || "";

		const query: Record<string, unknown> = {};
		if (search) {
			query.name = { $regex: search, $options: "i" };
		}
		const totalClasses = await Class.countDocuments(query);
		const totalPages = Math.ceil(totalClasses / limit);
		const classes = await Class.find(query)
			.populate("academicYear")
			// .populate("classTeacher") // Uncomment when this models have been created.
			// .populate("subjects")
			// .populate("students")
			.skip((page - 1) * limit)
			.limit(limit);

		sendSuccess(res, 200, "Classes retrieved successfully", {
			classes,
			pagination: {
				totalClasses,
				totalPages,
				currentPage: page,
				pageSize: limit,
			},
		});
	} catch (error) {
		return sendError(
			res,
			500,
			error instanceof Error ? error.message : "Server error",
		);
	}
};

// @desc    3. Get a single class by ID
// @route   GET /api/classes/:id
// @access  Private/Admin
export const getClassById = async (req: AuthRequest, res: Response) => {
	try {
		const { id } = req.params;

		if (!req.user) {
			return sendError(res, 401, "Authentication required");
		}

		const classDoc = await Class.findById(id).populate("academicYear");
		// .populate("classTeacher") // Uncomment when this models have been created.
		// .populate("subjects")
		// .populate("students");

		if (!classDoc) {
			return sendError(res, 404, "Class not found");
		}

		sendSuccess(res, 200, "Class retrieved successfully", classDoc);
	} catch (error) {
		return sendError(
			res,
			500,
			error instanceof Error ? error.message : "Server error",
		);
	}
};

// @desc    4. Update a class by ID
// @route   PUT /api/classes/:id
// @access  Private/Admin
export const updateClass = async (req: AuthRequest, res: Response) => {
	try {
		const { id } = req.params;
		const { name, academicYear, classTeacher, subjects, students, capacity } =
			req.body;

		if (!req.user) {
			return sendError(res, 401, "Authentication required");
		}

		const existingClass = await Class.findOne({
			name,
			_id: { $ne: id },
		});
		if (existingClass) {
			return sendError(res, 409, "Another class with this name already exists");
		}
		const updatedClass = await Class.findByIdAndUpdate(
			id,
			{
				name,
				academicYear, 
				classTeacher,
				subjects,
				students,
				capacity,
			},
			{ returnDocument: "after" },
		).populate("academicYear");
		// .populate("classTeacher") // Uncomment when this models have been created.
		// .populate("subjects")
		// .populate("students");

		if (!updatedClass) {
			return sendError(res, 404, "Class not found");
		}

		await logActivity({
			userId: req.user._id,
			action: ActivityAction.UPDATE_CLASS,
			description: `Updated class: ${updatedClass.name}`,
		});

		sendSuccess(res, 200, "Class updated successfully", updatedClass);
	} catch (error) {
		if (error instanceof z.ZodError) {
			return sendError(res, 400, "Validation failed", {
				issues: error.issues,
			});
		}
		return sendError(
			res,
			500,
			error instanceof Error ? error.message : "Server error",
		);
	}
};

// @desc    5. Delete a class by ID
// @route   DELETE /api/classes/:id
// @access  Private/Admin
export const deleteClass = async (req: AuthRequest, res: Response) => {
	try {
		const { id } = req.params;

		if (!req.user) {
			return sendError(res, 401, "Authentication required");
		}

		const classDoc = await Class.findByIdAndDelete(id);

		if (!classDoc) {
			return sendError(res, 404, "Class not found");
		}

		await logActivity({
			userId: req.user._id,
			action: ActivityAction.DELETE_CLASS,
			description: `Deleted class: ${classDoc.name}`,
		});

		sendSuccess(res, 200, "Class deleted successfully", classDoc);
	} catch (error) {
		return sendError(
			res,
			500,
			error instanceof Error ? error.message : "Server error",
		);
	}
};
