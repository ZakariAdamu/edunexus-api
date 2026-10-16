import * as z from "zod";
import { UserRole } from "../models/user.ts";

// ====================== USER AUTHENTICATION MANAGEMENT SCHEMAS ======================

// Signup schema
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

// Login schema
export const loginSchema = z.object({
  email: z.string().trim().email("Invalid email"),
  password: z.string().min(1, "Password is required"),
});

// verifyEmailSchema
export const verifyEmailSchema = z.object({
  email: z.string().trim().email("Invalid email"),
  code: z.string().length(4, "Verification code must be 4 digits"),
});

// resendCodeSchema
export const resendCodeSchema = z.object({
  email: z.string().trim().email("Invalid email"),
});

// updateProfileSchema
export const updateProfileSchema = z
  .object({
    name: z.string().trim().min(1).optional(),
    email: z.string().trim().email().optional(),
    password: z.string().min(8).optional(),
  })
  .refine((data) => Boolean(data.name || data.email || data.password), {
    message: "At least one field must be provided",
  });

// changePasswordSchema
export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string().min(8, "New password must be at least 8 characters"),
});


