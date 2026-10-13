import type { Request, Response } from "express";
import { sendError, sendSuccess } from "../lib/response.ts";
import ActivityLog from "../models/activityLogs.ts";

// @desc Get all activity logs including paginations
// @route GET /api/activity-logs
// @access Private/Admin
export const getAllActivities = async (req: Request, res: Response) => {
    try {
        const page = Number(req.query.page) || 1;
        const limit = Number(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        const count = await ActivityLog.countDocuments();

        const logs = await ActivityLog.find().populate("user", "name email role") // populate user details
            .sort({ createdAt: -1 }) //latest first
            .skip(skip).limit(limit);
        return sendSuccess(res, 200, "Activity logs fetched successfully", {
            logs,
            page,
            pages: Math.ceil(count / limit),
            total: count,
            limit,
        });
    } catch (error) {
        console.error("Failed to fetch activity logs:", error)
        return sendError(res, 500, "Failed to fetch activity logs");
    }
}