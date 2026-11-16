import type { Response } from "express";
import * as z from "zod";

import { sendError, sendSuccess } from "../lib/response.ts";
import type { AuthRequest } from "../middleware/auth.ts";
import { logActivity } from "../services/activityLog.service.ts";
import { ActivityAction } from "../models/activityLogs.ts";
import { inngest } from "../inngest/index.ts";
import Timetable from "../models/timetable.ts";

const objectIdSchema = z
	.string()
	.regex(/^[a-fA-F0-9]{24}$/, "Must be a 24-character MongoDB id");

export const generateTimetableSchema = z.object({
	classId: objectIdSchema,
	academicYear: objectIdSchema,
	settings: z.object({
		startTime: z
			.string()
			.regex(/^\d{2}:\d{2}$/, "Use HH:MM, for example 08:00"),
		endTime: z.string().regex(/^\d{2}:\d{2}$/, "Use HH:MM, for example 15:00"),
		periods: z.number().int().positive("periods must be a positive number"),
	}),
});

function inngestUnreachableMessage(error: unknown): string | null {
	if (!(error instanceof Error) || error.message !== "fetch failed") {
		return null;
	}

	const cause = error.cause instanceof Error ? error.cause.message : "";
	const detail = cause ? ` (${cause})` : "";
	return `Could not reach the Inngest dev server${detail}. Start it with \`pnpm inngest\` in a second terminal, then call this route again.`;
}

// 1. @desc Generate a Timetable using AI
// @route   POST /api/timetables/generate
// @access  Private/Admin

export const generateTimetable = async (req: AuthRequest, res: Response) => {
	try {
		const { classId, academicYear, settings } = generateTimetableSchema.parse(
			req.body,
		);
		if (!req.user) {
			return sendError(res, 401, "Authentication required");
		}

		await inngest.send({
			name: "generate/timetable",
			data: {
				classId,
				academicYear,
				settings,
			},
		});

		const newTimetable = {
			classId,
			academicYear,
			settings,
			generatedAt: new Date(),
		};

		await logActivity({
			userId: req.user._id,
			action: ActivityAction.GENERATE_TIMETABLE,
			description: `Generated timetable for class ${classId}`,
		});

		sendSuccess(
			res,
			200,
			"Timetable generation initiated successfully",
			newTimetable,
		);
	} catch (error) {
		if (error instanceof z.ZodError) {
			return sendError(res, 400, "Validation failed", {
				issues: error.issues.map((issue) => ({
					path: issue.path.join("."),
					message: issue.message,
				})),
			});
		}

		const unreachable = inngestUnreachableMessage(error);
		if (unreachable) {
			console.error(unreachable);
			return sendError(res, 503, unreachable);
		}

		return sendError(
			res,
			500,
			error instanceof Error ? error.message : "Server error",
		);
	}
};

// 2. @desc   Get all generated timetables (for admin purposes)
// @route  GET /api/timetables
// @access Private/Admin

export const getAllTimetables = async (req: AuthRequest, res: Response) => {
	try {
		if (!req.user) {
			return sendError(res, 401, "Authentication required");
		}

		const timetables = await Timetable.find()
			.populate("class", "name")
			.populate("academicYear", "year");

		sendSuccess(
			res,
			200,
			"All School Timetables retrieved successfully",
			timetables,
		);
	} catch (error) {
		return sendError(
			res,
			500,
			error instanceof Error ? error.message : "Server error",
		);
	}
};

// 3. @desc   Get the generated timetable by class and academic year
// @route  GET /api/timetables/:academicYearId/:classId
// @access Private/Admin, Teacher, or Student

export const getTimetableByClassAndAcademicYear = async (
	req: AuthRequest,
	res: Response,
) => {
	try {
		const { academicYearId, classId } = z
			.object({
				academicYearId: objectIdSchema,
				classId: objectIdSchema,
			})
			.parse(req.params);

		if (!req.user) {
			return sendError(res, 401, "Authentication required");
		}

		const timetable = await Timetable.findOne({
			academicYear: academicYearId,
			class: classId,
		})
			.populate("schedule.periods.subject", "name code")
			.populate("schedule.periods.teacher", "name email");

		if (!timetable) {
			return sendError(res, 404, "Timetable not found");
		}

		sendSuccess(
			res,
			200,
			`Timetable for ${timetable.class} and academic year ${timetable.academicYear} retrieved successfully`,
			timetable,
		);
	} catch (error) {
		if (error instanceof z.ZodError) {
			return sendError(res, 400, "Validation failed", {
				issues: error.issues.map((issue) => ({
					path: issue.path.join("."),
					message: issue.message,
				})),
			});
		}

		return sendError(
			res,
			500,
			error instanceof Error ? error.message : "Server error",
		);
	}
};
