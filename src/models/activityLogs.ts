import type { Document, Types } from "mongoose";
import mongoose, { Schema } from "mongoose";

export enum ActivityAction {
	CREATE_USER = "CREATE_USER",
	UPDATE_USER = "UPDATE_USER",
	DELETE_USER = "DELETE_USER",
	LOGIN = "LOGIN",
	LOGOUT = "LOGOUT",
	CREATE_EXAM = "CREATE_EXAM",
	UPDATE_EXAM = "UPDATE_EXAM",
	DELETE_EXAM = "DELETE_EXAM",
}

export interface IActivityLog extends Document {
	user: Types.ObjectId;
	action: ActivityAction;
	description: string;

	resourceType?: string;
	resourceId?: string;

	metadata?: Record<string, unknown>;

	createdAt: Date;
	updatedAt: Date;
}

const ActivityLogSchema = new Schema<IActivityLog>(
	{
		user: {
			type: Schema.Types.ObjectId,
			ref: "User",
			required: true,
			index: true,
		},

		action: {
			type: String,
			enum: Object.values(ActivityAction),
			required: true,
			index: true,
		},

		description: {
			type: String,
			required: true,
			trim: true,
		},

		resourceType: {
			type: String,
		},

		resourceId: {
			type: String,
		},

		metadata: {
			type: Schema.Types.Mixed,
		},
	},
	{
		timestamps: true,
	},
);

export default mongoose.model<IActivityLog>("ActivityLog", ActivityLogSchema);
