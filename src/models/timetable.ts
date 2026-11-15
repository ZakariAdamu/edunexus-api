import type { Document } from "mongoose";
import mongoose, { Schema } from "mongoose";

export interface IPeriod extends Document {
    subject: mongoose.Types.ObjectId;
    teacher: mongoose.Types.ObjectId;
    startTime: string;
    endTime: string;
}

export interface IDaySchedule {
    day: string;
    periods: IPeriod[];
}

export interface ITimetable extends Document {
    class: mongoose.Types.ObjectId;
    academicYear: mongoose.Types.ObjectId;
    schedule: IDaySchedule[];
    createdAt: Date;
    updatedAt: Date;
}

const timetableSchema = new Schema<ITimetable>({
    class: { type: mongoose.Schema.Types.ObjectId, ref: "Class", required: true },
    academicYear: { type: mongoose.Schema.Types.ObjectId, ref: "AcademicYear", required: true },
    schedule: [
        {
            day: { type: String, required: true },
            periods: [
                {
                    subject: { type: mongoose.Schema.Types.ObjectId, ref: "Subject", required: true },
                    teacher: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
                    startTime: { type: String, required: true },
                    endTime: { type: String, required: true },
                }
            ]
        }
    ],
}, { timestamps: true });

timetableSchema.index({ class: 1, academicYear: 1 }, { unique: true });

export default mongoose.model<ITimetable>("Timetable", timetableSchema);