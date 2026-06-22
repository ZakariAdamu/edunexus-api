import { Types } from "mongoose";
import ActivityLog, { ActivityAction } from "../models/activityLogs.ts";

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
			console.log("Activity Log Created:");
			console.dir(activityLog.toObject(), {
				depth: null,
				colors: true,
			});
		}
	} catch (error) {
		console.error("Activity logging failed:", error);
	}
};
