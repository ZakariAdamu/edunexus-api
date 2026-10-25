import type { Document, Types } from "mongoose";
import mongoose, { Schema } from "mongoose";

export enum ActivityAction {
	CREATE_USER = "CREATE_USER",
	UPDATE_USER = "UPDATE_USER",
	DELETE_USER = "DELETE_USER",
	LOGIN = "LOGIN",
	LOGOUT = "LOGOUT",
	CREATE_ACADEMIC_YEAR = "CREATE_ACADEMIC_YEAR",
	UPDATE_ACADEMIC_YEAR = "UPDATE_ACADEMIC_YEAR",
	DELETE_ACADEMIC_YEAR = "DELETE_ACADEMIC_YEAR",
	CREATE_SUBJECT = "CREATE_SUBJECT",
	UPDATE_SUBJECT = "UPDATE_SUBJECT",
	DELETE_SUBJECT = "DELETE_SUBJECT",
	CREATE_CLASS = "CREATE_CLASS",
	UPDATE_CLASS = "UPDATE_CLASS",
	DELETE_CLASS = "DELETE_CLASS",
	CREATE_STUDENT = "CREATE_STUDENT",
	UPDATE_STUDENT = "UPDATE_STUDENT",
	DELETE_STUDENT = "DELETE_STUDENT",
	CREATE_TEACHER = "CREATE_TEACHER",
	UPDATE_TEACHER = "UPDATE_TEACHER",
	DELETE_TEACHER = "DELETE_TEACHER",
	CREATE_PARENT = "CREATE_PARENT",
	UPDATE_PARENT = "UPDATE_PARENT",
	DELETE_PARENT = "DELETE_PARENT",
	CREATE_EXAM = "CREATE_EXAM",
	UPDATE_EXAM = "UPDATE_EXAM",
	DELETE_EXAM = "DELETE_EXAM",
}

export interface IActivityLog extends Document {
	/**
	 * The user who triggered the activity
	 */
	user: Types.ObjectId;
	action: ActivityAction;
	description: string;

	/**
	 * The type of the resource that triggered the activity
	 */
	resourceType?: string;
	/**
	 * The ID of the resource that triggered the activity
	 */
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
