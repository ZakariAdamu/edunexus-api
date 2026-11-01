import type { Document } from "mongoose";
import mongoose, { Schema } from "mongoose";

export interface IClass extends Document {
	name: string;
	academicYear: mongoose.Types.ObjectId; // Reference to the AcademicYear model "2025-2026"
	classTeacher: mongoose.Types.ObjectId; // Reference to the Teacher model
	subjects: mongoose.Types.ObjectId[]; // Reference to the Subject model
	students: mongoose.Types.ObjectId[]; // Reference to the Student model
	capacity: number; // Maximum number of students allowed in the class
}

const classSchema = new Schema<IClass>(
	{
		name: {
			type: String,
			required: true,
			trim: true,
		},
		academicYear: {
			type: mongoose.Types.ObjectId,
			ref: "AcademicYear",
			required: true,
		},
		classTeacher: {
			type: mongoose.Types.ObjectId,
			ref: "Teacher",
			required: false,
			default: null,
		},
		// Array of references to Subject and Student models
		subjects: {
			type: [mongoose.Types.ObjectId],
			ref: "Subject",
			required: true,
		},
		// Array of references to Student model
		students: {
			type: [mongoose.Types.ObjectId],
			ref: "Student",
			required: true,
		},
		capacity: {
			type: Number,
			required: true,
			default: 30, // Default capacity if not specified
		},
	},
	{
		timestamps: true,
	},
);

// Create a compound index to ensure that the combination of class name and academic year is unique e.g. "Class 10 A" in "2025-2026" should be unique across the database. This prevents duplicate class entries for the same academic year.
classSchema.index({ name: 1, academicYear: 1 }, { unique: true });

export default mongoose.model<IClass>("Class", classSchema);
