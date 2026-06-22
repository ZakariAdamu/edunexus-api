import express from "express";
import { loginUser, logoutUser, registerUser, resendVerificationCode, verifyEmail } from "../controllers/user.ts";
import { protect } from "../middleware/auth.ts";

const userRoutes = express.Router();

userRoutes.post("/register", registerUser);
userRoutes.post("/verify-email", verifyEmail);
userRoutes.post("/resend-verification-code", resendVerificationCode);
userRoutes.post("/login", loginUser);
userRoutes.post("/logout", logoutUser);


export default userRoutes;
