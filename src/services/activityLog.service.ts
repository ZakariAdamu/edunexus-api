import type { Types } from "mongoose";
import type { ActivityAction } from "../models/activityLogs.ts";
import ActivityLog from "../models/activityLogs.ts";

// ====================== LOG ACTIVITY SERVICE ======================
// This service is used to log activities in the database.
// Some applications may have this activityLog.service.ts file in the utils folder.
interface LogActivityParams {
	userId: Types.ObjectId;
	action: ActivityAction;
	description: string;

	resourceType?: string;
	resourceId?: string; 

	metadata?: Record<string, unknown>;
}

export const logActivity = async ({
	userId,
	action,
	description,
	resourceType,
	resourceId,
	metadata,
}: LogActivityParams): Promise<void> => {
	try {
		const activityLog = await ActivityLog.create({
			user: userId,
			action,
			description,
			resourceType,
			resourceId,
			metadata,
		});
		if (process.env.NODE_ENV === "development") {
			console.log("Activity Log Created:", activityLog.toObject());
		}
	} catch (error) {
		console.error("Failed to log activity:", error);
	}
};
