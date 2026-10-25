import type { Request, Response } from "express";
import mongoose from "mongoose";
import { sendError, sendSuccess } from "../lib/response.ts";
import User from "../models/user.ts";
import type { AuthRequest } from "../middleware/auth.ts";
import {
	clearAuthCookies,
	createAuthTokens,
	setAuthCookies,
} from "../utils/jwt.ts";
import * as z from "zod";
import { logActivity } from "../services/activityLog.service.ts";
import { ActivityAction } from "../models/activityLogs.ts";
import {
	sendVerificationEmail,
	transporter,
} from "../services/email.service.ts";
import { env } from "../config/env.ts";
import {
	loginSchema,
	resendCodeSchema,
	signupSchema,
	updateUserSchema,
	verifyEmailSchema,
} from "../schemas/user.schema.ts";
import { code } from "../utils/verificationCode.ts";
import { mapZodIssues } from "../lib/validation.ts";

// 1. ===================== USER REGISTER / SIGNUP ======================
export const registerUser = async (req: AuthRequest, res: Response) => {
	// Verify transporter is ready before processing signup requests to catch any SMTP issues early
	transporter.verify((err) => {
		if (err) {
			console.error("SMTP verify failed:", err);
		} else {
			console.log("SMTP ready");
		}
	});
	try {
		const validated = signupSchema.parse(req.body);
		console.log("A - Signup request received for email:", validated.email);
		const existingUser = await User.findOne({ email: validated.email });
		console.log(
			"B - Existing user check completed:",
			existingUser ? "User found" : "No user found",
		);

		if (existingUser) {
			return sendError(res, 409, "Email already in use");
		}

		const expiresAt = new Date(Date.now() + 2 * 60 * 1000); // 2 minutes

		// create new user
		const user = await new User({
			name: validated.name,
			email: validated.email,
			password: validated.password,
			role: validated.role,
			studentClass: validated.studentClass,
			verificationCode: code,
			verificationCodeExpires: expiresAt,
			teacherSubjects: validated.teacherSubjects,
			isActive: validated.isActive,
		});

		await user.save();

		console.log("New user created:", user);

		try {
			await sendVerificationEmail(user.email, code);
			console.log("E - Verification email sent successfully");
		} catch (emailError) {
			await User.deleteOne({ _id: user._id });
			console.error("F - Error sending verification email:", emailError);
			throw emailError;
		}

		// create an activity log for user registration/signup
		const creatorId = req.user?._id || user._id;
		const activityLogData = {
			userId: creatorId,
			action: ActivityAction.CREATE_USER,
			description: req.user?._id
				? `Created user ${user.name} with email ${user.email}`
				: `User ${user.name} with email ${user.email} signed up for ${env.projectName}`,
			resourceType: "User",
			resourceId: user._id.toString(),
			metadata: {
				name: user.name,
				email: user.email,
				role: user.role,
				ip: req.ip,
			},
		};

		await logActivity(activityLogData);
		console.log(
			"Activity log created on signup/user creation:",
			JSON.stringify(activityLogData, null, 2),
		);

		return sendSuccess(res, 201, `User signed up. Please verify your email.`, {
			user: {
				id: user._id,
				name: user.name,
				email: user.email,
				role: user.role,
				studentClass: user.studentClass,
				teacherSubjects: user.teacherSubjects,
				isActive: user.isActive,
			},
		});
	} catch (error: unknown) {
		if (error instanceof z.ZodError) {
			return sendError(res, 400, "Validation error", {
				errors: mapZodIssues(error),
			});
		}
		return sendError(
			res,
			500,
			error instanceof Error ? error.message : "Server error",
		);
	}
};

// 2. ====================== VERIFY EMAIL ======================
export async function verifyEmail(req: Request, res: Response) {
	try {
		const { email, code } = verifyEmailSchema.parse(req.body);

		const user = await User.findOne({ email }).select(
			"+verificationCode +verificationCodeExpires",
		);

		if (!user) {
			return sendError(res, 404, "User not found");
		}

		if (user.isVerified) {
			return sendError(res, 400, "Email is already verified");
		}

		if (!user.verificationCode || user.verificationCode !== code) {
			return sendError(res, 400, "Invalid verification code");
		}

		// check if verification code has expired
		if (
			!user.verificationCodeExpires ||
			new Date(Date.now()) > user.verificationCodeExpires
		) {
			return sendError(res, 400, "Verification code has expired");
		}

		user.isVerified = true;
		user.verificationCode = null;
		user.verificationCodeExpires = undefined;
		await user.save();

		return sendSuccess(
			res,
			200,
			"Email verified successfully. You can now log in.",
			null,
		);
	} catch (error: unknown) {
		if (error instanceof z.ZodError) {
			return sendError(res, 422, "Validation failed", {
				fields: mapZodIssues(error),
			});
		}

		return sendError(
			res,
			400,
			error instanceof Error ? error.message : "Verification failed",
		);
	}
}

// 3. ================ RESEND VERIFICATION CODE ======================
export async function resendVerificationCode(req: Request, res: Response) {
	try {
		const { email } = resendCodeSchema.parse(req.body);
		const user = await User.findOne({ email }).select(
			"+verificationCode +verificationCodeExpires",
		);

		if (!user) {
			return sendError(res, 404, "User not found");
		}

		if (user.isVerified) {
			return sendError(res, 400, "Email is already verified");
		}

		user.verificationCode = code;
		user.verificationCodeExpires = new Date(Date.now() + 2 * 60 * 1000); // 2 minutes
		await user.save();

		await sendVerificationEmail(user.email, code);

		return sendSuccess(res, 200, "Verification code resent", null);
	} catch (error: unknown) {
		if (error instanceof z.ZodError) {
			return sendError(res, 422, "Validation failed", {
				fields: mapZodIssues(error),
			});
		}

		return sendError(
			res,
			500,
			error instanceof Error ? error.message : "Server error",
		);
	}
}

// 4. ====================== LOGIN ======================
export async function loginUser(req: Request, res: Response) {
	try {
		const { email, password } = loginSchema.parse(req.body);
		const user = await User.findOne({ email }).select("+password");

		if (!user || !user.password) {
			return sendError(res, 400, "User not found");
		}
		if (!user.isVerified) {
			return sendError(res, 403, "Please verify your email before logging in");
		}

		const passwordMatches = await user.matchPassword(password);
		if (!passwordMatches) {
			return sendError(res, 401, "Invalid credentials");
		}

		const tokens = createAuthTokens(user._id.toString());
		setAuthCookies(res, tokens.accessToken, tokens.refreshToken);

		await logActivity({
			userId: user._id,
			action: ActivityAction.LOGIN,
			description: `User ${user.name} with email ${user.email} logged in`,
			resourceType: "User",
			resourceId: user._id.toString(),
			metadata: {
				name: user.name,
				email: user.email,
				role: user.role,
				ip: req.ip,
			},
		});

		return sendSuccess(res, 200, "Logged in successfully", {
			user,
			accessToken: tokens.accessToken,
		});
	} catch (error: unknown) {
		return sendError(
			res,
			500,
			error instanceof Error ? error.message : "Server error",
		);
	}
}

// 5. ============== User Logout ===================

export async function logoutUser(req: AuthRequest, res: Response) {
	try {
		const user = req.user;

		if (!user) {
			clearAuthCookies(res);
			return sendError(res, 401, "Authentication required");
		}

		clearAuthCookies(res);

		console.log(`User logged out: ${user.email}`);

		return sendSuccess(res, 200, "Logged out successfully", null);
	} catch (error: unknown) {
		console.error("Logout failed:", error);

		return sendError(res, 500, "An unexpected error occurred");
	}
}

// 6. ================ Update User ========================

// @desc      Update user (Admin)
// @route     PUT /api/users/:id
// @access    Private/Admin

export const updateUser = async (req: AuthRequest, res: Response) => {
	try {
		const updates = updateUserSchema.parse(req.body);

		if (!mongoose.isValidObjectId(req.params.id)) {
			return sendError(res, 400, "Invalid user ID");
		}

		const user = await User.findById(req.params.id);

		if (!user) {
			return sendError(res, 404, "User not found");
		}

		Object.assign(user, updates);
		const updatedUser = await user.save();

		await logActivity({
			userId: req.user?._id ?? updatedUser._id,
			action: ActivityAction.UPDATE_USER,
			description: `User ${updatedUser.name} with email ${updatedUser.email} got updated`,
			resourceType: "User",
			resourceId: updatedUser._id.toString(),
			metadata: {
				name: updatedUser.name,
				email: updatedUser.email,
				role: updatedUser.role,
				ip: req.ip,
			},
		});

		return sendSuccess(res, 200, "User updated successfully", {
			_id: updatedUser._id,
			name: updatedUser.name,
			email: updatedUser.email,
			role: updatedUser.role,
			isActive: updatedUser.isActive,
			studentClass: updatedUser.studentClass,
			teacherSubjects: updatedUser.teacherSubjects,
		});
	} catch (error: unknown) {
		if (error instanceof z.ZodError) {
			return sendError(res, 422, "Validation failed", {
				fields: mapZodIssues(error),
			});
		}

		if (error instanceof Error && "code" in error && error.code === 11000) {
			return sendError(res, 409, "Email already in use");
		}

		console.error("User update Failed:", error);

		return sendError(res, 500, "An unexpected error occurred");
	}
};

// 7. ================ Delete User ========================

export const deleteUser = async (req: AuthRequest, res: Response) => {
	try {
		if (!mongoose.isValidObjectId(req.params.id)) {
			return sendError(res, 400, "Invalid user ID");
		}

		const user = await User.findById(req.params.id);

		if (!user) {
			return sendError(res, 404, "User not found");
		}

		await user.deleteOne();

		await logActivity({
			userId: req.user?._id ?? user._id,
			action: ActivityAction.DELETE_USER,
			description: `User ${user.name} with email ${user.email} got deleted`,
			resourceType: "User",
			resourceId: user._id.toString(),
			metadata: {
				name: user.name,
				email: user.email,
				role: user.role,
				ip: req.ip,
			},
		});

		return sendSuccess(
			res,
			200,
			`User ${user.name} with email ${user.email} deleted successfully`,
			null,
		);
	} catch (error: unknown) {
		console.error("User delete Failed:", error);

		return sendError(res, 500, "An unexpected error occurred");
	}
};

// 8. ================ Get User ========================

export const getUser = async (req: AuthRequest, res: Response) => {
	try {
		if (!mongoose.isValidObjectId(req.params.id)) {
			return sendError(res, 400, "Invalid user ID");
		}

		const user = await User.findById(req.params.id);

		if (!user) {
			return sendError(res, 404, "User not found");
		}

		return sendSuccess(res, 200, "User retrieved successfully", {
			_id: user._id,
			name: user.name,
			email: user.email,
			role: user.role,
			isActive: user.isActive,
			studentClass: user.studentClass,
			teacherSubjects: user.teacherSubjects,
		});
	} catch (error: unknown) {
		console.error("Failed to get user:", error);

		return sendError(res, 500, "An unexpected error occurred");
	}
};

// 9. ================ Get All Users ========================

export const getAllUsers = async (req: AuthRequest, res: Response) => {
	try {
		const page = parseInt(req.query.page as string) || 1;
		const limit = parseInt(req.query.limit as string) || 10;
		const skip = (page - 1) * limit;
		const role = req.query.role as string | undefined;
		const search = req.query.search as string | undefined;
		const filter: Record<string, unknown> = {};

		if (role) {
			filter.role = role;
		}

		if (search) {
			filter.$or = [
				{ name: { $regex: search, $options: "i" } },
				{ email: { $regex: search, $options: "i" } },
			];
		}

		const totalUsers = await User.countDocuments(filter);
		const totalPages = Math.ceil(totalUsers / limit);

		const users = await User.find(filter)
			.skip(skip)
			.limit(limit)
			.sort({ createdAt: -1 });

		return sendSuccess(res, 200, "Users retrieved successfully", {
			users,
			pagination: {
				totalUsers,
				totalPages,
				currentPage: page,
				pageSize: limit,
			},
		});
	} catch (error: unknown) {
		console.error("Failed to get all users:", error);

		return sendError(res, 500, "An unexpected error occurred");
	}
};
