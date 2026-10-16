import express from "express";
import {
  loginUser,
  logoutUser,
  registerUser,
  resendVerificationCode,
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

export default userRoutes;
