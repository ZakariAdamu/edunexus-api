import type { Document } from "mongoose";
import mongoose, { Schema } from "mongoose";

export interface IAcademicYear extends Document {
	name: string; // e.g., "2023-2024"
	fromYear: Date; // e.g., "2023-09-01"
    toYear: Date; // e.g., "2024-06-30"
    isCurrent: boolean; // Indicates if this is the current academic year
}

const academicYearSchema = new Schema<IAcademicYear>(
	{
		name: {
			type: String,
			required: true,
			unique: true,
		},
		fromYear: {
			type: Date,
			required: true,
		},
		toYear: {
			type: Date,
			required: true,
		},
		isCurrent: {
			type: Boolean,
			required: true,
			default: false,
		},
	},
	{
		timestamps: true,
	}
);

export default mongoose.model<IAcademicYear>("AcademicYear", academicYearSchema);