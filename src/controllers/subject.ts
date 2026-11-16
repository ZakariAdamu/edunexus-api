import type { Response } from "express";
import * as z from "zod";

import { sendError, sendSuccess } from "../lib/response.ts";
import type { AuthRequest } from "../middleware/auth.ts";
import { logActivity } from "../services/activityLog.service.ts";
import { ActivityAction } from "../models/activityLogs.ts";
import Subject from "../models/subject.ts";

// @desc    1. Create a new subject
// @route   POST /api/subjects
// @access  Private/Admin
export const createSubject = async (req: AuthRequest, res: Response) => {
	try {
		const { name, code, teacher, isActive } = req.body;
		if (!req.user) {
			return sendError(res, 401, "Authentication required");
		}

		const existingSubject = await Subject.findOne({ name, code });
		if (existingSubject) {
			return sendError(
				res,
				409,
				"Subject with this name and code already exists",
			);
		}

		const newSubject = await Subject.create({
			name,
			code,
			teacher,
			isActive: isActive ?? true,
		});

		await logActivity({
			userId: req.user._id,
			action: ActivityAction.CREATE_SUBJECT,
			description: `Created subject: ${newSubject.name}`,
		});

		sendSuccess(res, 201, "Subject created successfully", newSubject);
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

// @desc    2. Get all subjects
// @route   GET /api/subjects
// @access  Private
export const getAllSubjects = async (req: AuthRequest, res: Response) => {
	try {
		const page = parseInt(req.query.page as string) || 1;
		const limit = parseInt(req.query.limit as string) || 10;
		const search = (req.query.search as string) || "";

		const query: Record<string, unknown> = {};
		if (search) {
			query.name = { $regex: search, $options: "i" };
		}
		const totalSubjects = await Subject.countDocuments(query);
		const totalPages = Math.ceil(totalSubjects / limit);
		const subjects = await Subject.find(query)
			// .populate("teacher")
			// .populate("students")
			.skip((page - 1) * limit)
			.limit(limit);

		sendSuccess(res, 200, "Subjects retrieved successfully", {
			subjects,
			pagination: {
				totalSubjects,
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

// @desc    3. Get a specific subject by ID
// @route   GET /api/subjects/:id
// @access  Private
export const getSubjectById = async (req: AuthRequest, res: Response) => {
	try {
		const { id } = req.params;
		if (!req.user) {
			return sendError(res, 401, "Authentication required");
		}
		const subject = await Subject.findById(id);
		// .populate("teacher")
		// .populate("students");
		if (!subject) {
			return sendError(res, 404, "Subject not found");
		}
		sendSuccess(res, 200, "Subject retrieved successfully", subject);
	} catch (error) {
		return sendError(
			res,
			500,
			error instanceof Error ? error.message : "Server error",
		);
	}
};

// @desc    4. Update a specific subject by ID
// @route   PUT /api/subjects/:id
// @access  Private/Admin
export const updateSubject = async (req: AuthRequest, res: Response) => {
	try {
		const { id } = req.params;
		const { name, code, teacher, isActive } = req.body;

		if (!req.user) {
			return sendError(res, 401, "Authentication required");
		}

		const subject = await Subject.findById(id);
		if (!subject) {
			return sendError(res, 404, "Subject not found");
		}

		subject.name = name ?? subject.name;
		subject.code = code ?? subject.code;
		subject.teacher = teacher ?? subject.teacher;
		subject.isActive = isActive ?? subject.isActive;

		await subject.save();

		await logActivity({
			userId: req.user._id,
			action: ActivityAction.UPDATE_SUBJECT,
			description: `Updated subject: ${subject.name}`,
		});

		sendSuccess(res, 200, "Subject updated successfully", subject);
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

// @desc    5. Delete a specific subject by ID
// @route   DELETE /api/subjects/:id
// @access  Private/Admin
export const deleteSubject = async (req: AuthRequest, res: Response) => {
	try {
		const { id } = req.params;

		if (!req.user) {
			return sendError(res, 401, "Authentication required");
		}

		const subject = await Subject.findByIdAndDelete(id);

		if (!subject) {
			return sendError(res, 404, "Subject not found");
		}

		await logActivity({
			userId: req.user._id,
			action: ActivityAction.DELETE_SUBJECT,
			description: `Deleted subject: ${subject.name}`,
		});

		sendSuccess(res, 200, "Subject deleted successfully", subject);
	} catch (error) {
		return sendError(
			res,
			500,
			error instanceof Error ? error.message : "Server error",
		);
	}
};
