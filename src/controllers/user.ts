import type { Request, Response } from "express";
import { sendError, sendSuccess } from "../lib/response.ts";
import User, { UserRole } from "../models/user.ts";
import type { AuthRequest } from "../middleware/auth.ts";
import {
	clearAuthCookies,
	createAccessToken,
	createRefreshToken,
	setAuthCookies,
} from "../utils/jwt.ts";
import * as z from "zod";
import { logActivity } from "../services/activityLog.service.ts";
import { ActivityAction } from "../models/activityLogs.ts";
import { transporter } from "../services/email.service.ts";
import { env } from "../config/env.ts";
import axios from "axios";

// ====================== USER AUTHENTICATION / MANAGEMENT SCHEMAS ======================
export const signupSchema = z
	.object({
		name: z.string().trim().min(1, "Name is required"),
		email: z.string().trim().email("Email is not valid"),
		password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string().min(8, "Confirm your password"),
    role: z.enum(UserRole),
    studentClass: z.string().optional(),
    teacherSubjects: z.array(z.string()).optional(),
    isActive: z.boolean().optional(),

	})
	.refine((data) => data.password === data.confirmPassword, {
		message: "Passwords do not match",
		path: ["confirmPassword"],
	});

export const loginSchema = z.object({
	email: z.string().trim().email("Invalid email"),
	password: z.string().min(1, "Password is required"),
});

export const verifyEmailSchema = z.object({
	email: z.string().trim().email("Invalid email"),
	code: z.string().length(4, "Verification code must be 4 digits"),
});

export const resendCodeSchema = z.object({
	email: z.string().trim().email("Invalid email"),
});

export const updateProfileSchema = z
	.object({
		name: z.string().trim().min(1).optional(),
		email: z.string().trim().email().optional(),
		password: z.string().min(8).optional(),
	})
	.refine((data) => Boolean(data.name || data.email || data.password), {
		message: "At least one field must be provided",
	});

export const changePasswordSchema = z.object({
	currentPassword: z.string().min(1, "Current password is required"),
	newPassword: z.string().min(8, "New password must be at least 8 characters"),
});

// Helper to map Zod validation errors to a field-based error object
function mapZodIssues(error: z.ZodError) {
	return error.issues.reduce<Record<string, string>>((accumulator, issue) => {
		accumulator[issue.path.join(".") || "form"] = issue.message;
		return accumulator;
	}, {});
}

// Helper to generate tokens and set cookies
function authCookieResponse(userId: string) {
	const accessToken = createAccessToken(userId);
	const refreshToken = createRefreshToken(userId);
	return { accessToken, refreshToken };
}

// Helper to generate a 4-digit code
const generateVerificationCode = () => {
  const array = new Uint32Array(1);
  globalThis.crypto.getRandomValues(array);
  return (1000 + (array[0] % 9000)).toString();
};

// Reusable helper to send verification email
async function sendVerificationEmail(email: string, code: string) {
  console.log(
    `Starting sending verification email to ${email} with code ${code}`,
  );
  await axios.post(
    "https://api.brevo.com/v3/smtp/email",
    {
      sender: {
        name: env.projectName,
        email: env.fromEmail,
      },
      to: [{ email }],
      subject: `Welcome to ${env.projectName} - Verify Your Email`,
      htmlContent: `
  <div style="
    background-color: #f4f7f6;
    padding: 40px 20px;
    font-family: Arial, Helvetica, sans-serif;
  ">
    <div style="
      max-width: 600px;
      margin: 0 auto;
      background-color: #ffffff;
      border-radius: 12px;
      overflow: hidden;
      border: 1px solid #e5e7eb;
      box-shadow: 0 4px 20px rgba(0,0,0,0.08);
    ">
      
      <!-- Header -->
      <div style="
        background-color: #287c1fff;
        padding: 24px;
        text-align: center;
      ">
        <h1 style="
          margin: 0;
          color: #ffffff;
          font-size: 24px;
          font-weight: 700;
        ">
         ${env.projectName}
        </h1>
      </div>

      <!-- Body -->
      <div style="
        padding: 40px 30px;
        text-align: center;
      ">
        <h2 style="
          margin: 0 0 16px;
          color: #111827;
          font-size: 22px;
          font-weight: 600;
        ">
          Verify Your Email Address
        </h2>

        <p style="
          margin: 0 0 24px;
          color: #6b7280;
          font-size: 16px;
          line-height: 1.6;
        ">
          Thank you for signing up. Use the verification code below to complete your account setup.
        </p>

        <div style="
          display: inline-block;
          background-color: #f0fdf4;
          border: 2px dashed #287c1fff;
          border-radius: 10px;
          padding: 16px 28px;
          margin-bottom: 24px;
        ">
          <span style="
            font-size: 36px;
            font-weight: 700;
            letter-spacing: 8px;
            color: #287c1fff;
          ">
            ${code}
          </span>
        </div>

        <p style="
          margin: 0 0 12px;
          color: #374151;
          font-size: 15px;
        ">
          This code expires in <strong>2 minutes</strong>.
        </p>

        <p style="
          margin: 0;
          color: #9ca3af;
          font-size: 14px;
          line-height: 1.6;
        ">
          If you did not create an account, you can safely ignore this email.
        </p>
      </div>

      <!-- Footer -->
      <div style="
        border-top: 1px solid #e5e7eb;
        padding: 20px;
        text-align: center;
        background-color: #fafafa;
      ">
        <p style="
          margin: 0;
          color: #9ca3af;
          font-size: 13px;
        ">
          © ${new Date().getFullYear()} ${env.projectName}. All rights reserved.
        </p>
      </div>

    </div>
  </div>
`,
    },
    {
      headers: {
        "api-key": env.edunexusBrevoApiKey,
        "content-type": "application/json",
      },
    },
  );
  console.log(`Verification email sent to ${email}`);
}

// 1. ===================== USER REGISTER / SIGNUP ======================
export const registerUser = async (
	req: AuthRequest,
	res: Response,
) => {
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

		// generate 4-digit code
		const code = generateVerificationCode();

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
		console.log("Activity log created on signup/user creation:", JSON.stringify(activityLogData, null, 2));

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
    if(!user.verificationCodeExpires || new Date(Date.now()) > user.verificationCodeExpires) {
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

    const code = generateVerificationCode();
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

		const tokens = authCookieResponse(user._id.toString());
		setAuthCookies(res, tokens.accessToken, tokens.refreshToken);

		return sendSuccess(res, 200, "Logged in successfully", {
			user: { id: user._id.toString(), name: user.name, email: user.email },
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

// 3. ============== User Logout ===================

export async function logoutUser(req: Request, res: Response) {
	clearAuthCookies(res);
	return sendSuccess(res, 200, "Logged out successfully", null)
}
