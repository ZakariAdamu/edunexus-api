import express from "express";
import {
	deleteUser,
	getAllUsers,
	getUser,
	loginUser,
	logoutUser,
	registerUser,
	resendVerificationCode,
	updateUser,
	verifyEmail,
} from "../controllers/user.ts";
import { authorize, protect } from "../middleware/auth.ts";
import { UserRole } from "../models/user.ts";

const userRoutes = express.Router();

// Register users: Admins and Teachers only performs this.
// The controller must enforce which roles each caller may assign.

userRoutes.post(
	"/register",
	protect,
	authorize([UserRole.ADMIN, UserRole.TEACHER]),
	registerUser,
);

// Public email verification endpoints.
// Apply appropriate rate limits in app.ts.
userRoutes.post("/verify-email", verifyEmail);

userRoutes.post("/resend-verification-code", resendVerificationCode);

// Public login endpoint.
userRoutes.post("/login", loginUser);

// Authenticated logout endpoint.
userRoutes.post("/logout", protect, logoutUser);

// update user endpoint. Only Admins and Teachers can update users.
userRoutes.patch(
	"/:id",
	protect,
	authorize([UserRole.ADMIN, UserRole.TEACHER]),
	updateUser,
);

// delete user endpoint. Only Admins and Teachers can delete users.
userRoutes.delete(
	"/:id",
	protect,
	authorize([UserRole.ADMIN, UserRole.TEACHER]),
	deleteUser,
);

export default userRoutes;

// get user endpoint. Only Admins and Teachers can get users.
userRoutes.get(
	"/:id",
	protect,
	authorize([UserRole.ADMIN, UserRole.TEACHER]),
	getUser,
);

// get all users endpoint. Only Admins and Teachers can get all users.
userRoutes.get(
	"/",
	protect,
	authorize([UserRole.ADMIN, UserRole.TEACHER]),
	getAllUsers,
);
