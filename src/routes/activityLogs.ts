import express from "express";
import { getAllActivities } from "../controllers/activitiesLog.ts";
import { authorize, protect } from "../middleware/auth.ts";
import { UserRole } from "../models/user.ts";
// import activityLogs from "../models/activityLogs.ts";

// ====================== ACTIVITY LOGS ROUTES ======================
// We will handle all the activity logs routes here.

export const logsRouter = express.Router();

// GET /api/activity-logs
// Access: Private/Admin

logsRouter.get("/", protect, authorize([UserRole.ADMIN]), getAllActivities,);