import type { Response } from "express";
import type { FilterQuery } from "mongoose";
import * as z from "zod";

import { sendError, sendSuccess } from "../lib/response.ts";
import type { AuthRequest } from "../middleware/auth.ts";
import { logActivity } from "../services/activityLog.service.ts";
import { ActivityAction } from "../models/activityLogs.ts";
import academicYear, { type IAcademicYear } from "../models/academicYear.ts";
import { createAcademicYearSchema } from "../schemas/academicYear.schema.ts";

// @desc    1. Create a new academic year
// @route   POST /api/academic-years
// @access  Private/Admin
export const createAcademicYear = async (req: AuthRequest, res: Response) => {
	try {
		const { name, fromYear, toYear, isCurrent } =
			createAcademicYearSchema.parse(req.body);
		if (!req.user) {
			return sendError(res, 401, "Authentication required");
		}

		const existingAcademicYear = await academicYear.findOne({
			fromYear,
			toYear,
		});
		if (existingAcademicYear) {
			return sendError(
				res,
				409,
				"Academic year with these dates already exists",
			);
		}

		// if isCurrent is true, set all other academic years' isCurrent to false
		if (isCurrent) {
			await academicYear.updateMany({}, { isCurrent: false });
		}

		if (fromYear >= toYear) {
			return sendError(res, 400, "fromYear must be less than toYear");
		}
		const newAcademicYear = await new academicYear({
			name,
			fromYear,
			toYear,
			isCurrent: isCurrent ?? false,
		});
		await newAcademicYear.save();
		await logActivity({
			userId: req.user._id,
			action: ActivityAction.CREATE_ACADEMIC_YEAR,
			description: `Academic year ${newAcademicYear.name} created`,
			resourceType: "AcademicYear",
			resourceId: newAcademicYear._id.toString(),
			metadata: {
				name: newAcademicYear.name,
				fromYear: newAcademicYear.fromYear,
				toYear: newAcademicYear.toYear,
				isCurrent: newAcademicYear.isCurrent,
			},
		});
		return sendSuccess(res, 201, "Academic year created successfully", {
			academicYear: newAcademicYear,
		});
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

// @desc    2. Get the current / active academic year
// @route   GET /api/academic-years/current
// @access  Private
export const getCurrentAcademicYear = async (
	req: AuthRequest,
	res: Response,
) => {
	try {
		const currentAcademicYear = await academicYear.findOne({ isCurrent: true });
		if (!currentAcademicYear) {
			return sendError(res, 404, "No current academic year found");
		}
		return sendSuccess(
			res,
			200,
			"Current academic year retrieved successfully",
			{
				academicYear: currentAcademicYear,
			},
		);
	} catch (error) {
		return sendError(
			res,
			500,
			error instanceof Error ? error.message : "Server error",
		);
	}
};

// @desc    3. Update an academic year
// @route   PUT /api/academic-years/:id
// @access  Private/Admin
export const updateAcademicYear = async (req: AuthRequest, res: Response) => {
	try {
		const { id } = req.params;
		const { name, fromYear, toYear, isCurrent } = req.body;

		if (!req.user) {
			return sendError(res, 401, "Authentication required");
		}

		const academicYearToUpdate = await academicYear.findById(id);
		if (!academicYearToUpdate) {
			return sendError(res, 404, "Academic year not found");
		}

		// Update fields if provided
		if (name) academicYearToUpdate.name = name;
		if (fromYear) academicYearToUpdate.fromYear = fromYear;
		if (toYear) academicYearToUpdate.toYear = toYear;
		if (isCurrent !== undefined) {
			// If isCurrent is true, set all other academic years' isCurrent to false
			if (isCurrent) {
				await academicYear.updateMany({}, { isCurrent: false });
			}
			academicYearToUpdate.isCurrent = isCurrent;
		}

		// Validate that fromYear is less than toYear
		if (academicYearToUpdate.fromYear >= academicYearToUpdate.toYear) {
			return sendError(res, 400, "fromYear must be less than toYear");
		}

		await academicYearToUpdate.save();

		await logActivity({
			userId: req.user._id,
			action: ActivityAction.UPDATE_ACADEMIC_YEAR,
			description: `Academic year ${academicYearToUpdate.name} updated`,
			resourceType: "AcademicYear",
			resourceId: academicYearToUpdate._id.toString(),
			metadata: {
				name: academicYearToUpdate.name,
				fromYear: academicYearToUpdate.fromYear,
				toYear: academicYearToUpdate.toYear,
				isCurrent: academicYearToUpdate.isCurrent,
			},
		});

		return sendSuccess(res, 200, "Academic year updated successfully", {
			academicYear: academicYearToUpdate,
		});
	} catch (error) {
		return sendError(
			res,
			500,
			error instanceof Error ? error.message : "Server error",
		);
	}
};

// @desc    4. Get all academic years (Paginated & Searchable)
// @route   GET /api/academic-years
// @access  Private
export const getAcademicYears = async (req: AuthRequest, res: Response) => {
	try {
		const page = parseInt(req.query.page as string) || 1;
		const limit = parseInt(req.query.limit as string) || 10;
		const search = (req.query.search as string) || "";

		const query: FilterQuery<IAcademicYear> = {};
		if (search) {
			query.name = { $regex: search, $options: "i" };
		}

		const totalAcademicYears = await academicYear.countDocuments(query);
		const totalPages = Math.ceil(totalAcademicYears / limit);
		const skip = (page - 1) * limit;
		const academicYears = await academicYear
			.find(query)
			.sort({ createdAt: -1 })
			.skip(skip)
			.limit(limit);
		return sendSuccess(res, 200, "Academic years retrieved successfully", {
			academicYears,

			pagination: {
				total: totalAcademicYears, // e.g. 10
				page,
				limit,
				totalPages,
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

// @desc    5. Get an academic year by ID
// @route   GET /api/academic-years/:id
// @access  Private
export const getAcademicYearById = async (req: AuthRequest, res: Response) => {
	try {
		const { id } = req.params;

		if (!req.user) {
			return sendError(res, 401, "Authentication required");
		}

		const academicYearRecord: IAcademicYear | null =
			await academicYear.findById(id);
		if (!academicYearRecord) {
			return sendError(res, 404, "Academic year not found");
		}

		return sendSuccess(res, 200, "Academic year retrieved successfully", {
			academicYear: academicYearRecord,
		});
	} catch (error) {
		return sendError(
			res,
			500,
			error instanceof Error ? error.message : "Server error",
		);
	}
};

// @desc    6. Delete an academic year by ID
// @route   DELETE /api/academic-years/:id
// @access  Private/Admin
export const deleteAcademicYear = async (req: AuthRequest, res: Response) => {
	try {
		const { id } = req.params;

		if (!req.user) {
			return sendError(res, 401, "Authentication required");
		}

		const academicYearToDelete = await academicYear.findById(id);
		if (!academicYearToDelete) {
			return sendError(res, 404, "Academic year not found");
		}
		if (academicYearToDelete.isCurrent) {
			return sendError(res, 400, "Cannot delete the current academic year");
		}

		await academicYearToDelete.deleteOne();

		await logActivity({
			userId: req.user._id,
			action: ActivityAction.DELETE_ACADEMIC_YEAR,
			description: `Academic year ${academicYearToDelete.name} deleted`,
			resourceType: "AcademicYear",
			resourceId: academicYearToDelete._id.toString(),
			metadata: {
				name: academicYearToDelete.name,
				fromYear: academicYearToDelete.fromYear,
				toYear: academicYearToDelete.toYear,
				isCurrent: academicYearToDelete.isCurrent,
			},
		});

		return sendSuccess(res, 200, "Academic year deleted successfully", {
			academicYear: academicYearToDelete,
		});
	} catch (error) {
		return sendError(
			res,
			500,
			error instanceof Error ? error.message : "Server error",
		);
	}
};
