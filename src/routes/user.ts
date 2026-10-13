import express from "express";
import { loginUser, logoutUser, registerUser, resendVerificationCode, verifyEmail } from "../controllers/user.ts";
import { authorize, protect } from "../middleware/auth.ts";
import { UserRole } from "../models/user.ts";

const userRoutes = express.Router();

// make sure to protect to get access to the user token and then authorize the user to register
userRoutes.post("/register", protect, authorize([UserRole.ADMIN, UserRole.TEACHER]), registerUser);
userRoutes.post("/verify-email", verifyEmail);
userRoutes.post("/resend-verification-code", resendVerificationCode);
userRoutes.post("/login", loginUser);
userRoutes.post("/logout", protect, logoutUser);


export default userRoutes;
