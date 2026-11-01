import type { Document } from "mongoose";
import mongoose, { Schema } from "mongoose";

export interface ISubject extends Document {
	name: string;
	code: string; // "MATH101", "ENG202", etc.
	teacher?: mongoose.Types.ObjectId[]; // Reference to the Teacher model
	isActive: boolean; // Indicates if the subject is currently active
}

const subjectSchema = new Schema<ISubject>(
	{
		name: {
			type: String,
			required: true,
			trim: true,
		},
		code: {
			type: String,
			required: true,
			trim: true,
			unique: true,
		},
		teacher: {
			type: [mongoose.Types.ObjectId],
			ref: "Teacher",
			required: false,
		},
		isActive: {
			type: Boolean,
			required: false,
			default: true,
		},
	},
	{
		timestamps: true,
	},
);

// Create a compound index to ensure that the combination of subject name and code is unique e.g. "Mathematics" with code "MATH101" should be unique across the database. This prevents duplicate subject entries.
subjectSchema.index({ name: 1, code: 1 }, { unique: true });

export default mongoose.model<ISubject>("Subject", subjectSchema);
