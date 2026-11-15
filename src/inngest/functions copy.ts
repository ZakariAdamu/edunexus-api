import mongoose from "mongoose";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateObject } from "ai";
import { z } from "zod";
import { inngest } from "./index.ts";
import Class from "../models/class.ts";
import User, { UserRole } from "../models/user.ts";
import Timetable from "../models/timetable.ts";

interface GenSettings {
	startTime: string; // e.g., "08:00"
	endTime: string; // e.g., "15:00"
	periods: number; // e.g., 8
}

interface TimetableEventData {
	classId: string;
	academicYear: string;
	settings: GenSettings;
}

interface SubjectPayload {
	id: string;
	name: string;
	code: string;
}

interface TeacherPayload {
	id: string;
	name: string;
	subjects: string[];
}

function asId(value: unknown): string {
	if (value && typeof value === "object" && "_id" in value) {
		return String((value as { _id: unknown })._id);
	}
	return String(value);
}

export const generateTimeTable = inngest.createFunction(
	{
		id: "generate-timetable",
		triggers: [{ event: "generate/timetable" }],
	},
	async ({ event, step }) => {
		const { classId, academicYear, settings } =
			event.data as TimetableEventData;

		if (!classId || !academicYear || !settings) {
			throw new Error(
				"generate/timetable requires classId, academicYear, and settings",
			);
		}

		const contextData = await step.run("fetch-class-context", async () => {
			const classData = await Class.findById(classId).populate("subjects");
			if (!classData) {
				throw new Error(`Class with ID ${classId} not found`);
			}

			const classSubjectIds = classData.subjects.map((subject) =>
				asId(subject),
			);
			const allTeachers = await User.find({ role: UserRole.TEACHER });

			const qualifiedTeachers: TeacherPayload[] = allTeachers
				.filter((teacher) =>
					(teacher.teacherSubjects ?? []).some((subjectId) =>
						classSubjectIds.includes(asId(subjectId)),
					),
				)
				.map((teacher) => ({
					id: teacher._id.toString(),
					name: teacher.name,
					subjects: (teacher.teacherSubjects ?? []).map((subjectId) =>
						asId(subjectId),
					),
				}));

			const subjectsPayload: SubjectPayload[] = classData.subjects.map(
				(subject) => {
					const doc = subject as unknown as {
						_id: unknown;
						name?: string;
						code?: string;
					};
					return {
						id: asId(subject),
						name: doc.name ?? "",
						code: doc.code ?? "",
					};
				},
			);

			return {
				className: classData.name,
				subjects: subjectsPayload,
				teachers: qualifiedTeachers,
			};
		});

		const aiSchedule = await step.run("generate-timetable", async () => {
			const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
			if (!apiKey) {
				throw new Error("GOOGLE_GENERATIVE_AI_API_KEY is not set");
			}

			const academicYearId = new mongoose.Types.ObjectId(academicYear);
			const otherTimetables = await Timetable.find({
				academicYear: academicYearId,
				class: { $ne: new mongoose.Types.ObjectId(classId) },
			}).select("class schedule");

			const occupied = otherTimetables.map((timetable) => ({
				classId: timetable.class.toString(),
				schedule: timetable.schedule.map((day) => ({
					day: day.day,
					periods: day.periods.map((period) => ({
						teacher: asId(period.teacher),
						startTime: period.startTime,
						endTime: period.endTime,
					})),
				})),
			}));

			const prompt = `
You are a school scheduler. Generate a weekly timetable (Monday to Friday).

CONTEXT:
- Class: ${contextData.className}
- Hours: ${settings.startTime} to ${settings.endTime} (${settings.periods} teaching periods per day)

RESOURCES:
- Subjects: ${JSON.stringify(contextData.subjects)}
- Teachers: ${JSON.stringify(contextData.teachers)}
- Teachers already booked in other classes: ${JSON.stringify(occupied)}

STRICT RULES:
1. Assign a teacher to every subject period.
2. The teacher MUST list that subject's id in their subjects array.
3. Use only subject and teacher ids from RESOURCES.
4. After every 2 teaching periods, leave a 10 minute gap. After 4 teaching periods, leave a 60 minute lunch gap. Do not emit break or lunch as period objects.
5. A teacher cannot be in two classes at the same time. Avoid the booked slots above.
6. Return only JSON with this schema:
{
  "schedule": [
    {
      "day": "Monday",
      "periods": [
        {
          "subject": "SUBJECT_ID",
          "teacher": "TEACHER_ID",
          "startTime": "HH:MM",
          "endTime": "HH:MM"
        }
      ]
    }
  ]
}
`;

			const google = createGoogleGenerativeAI({ apiKey });
			const modelName =
				process.env.GOOGLE_GENERATIVE_AI_MODEL ?? "gemini-3.8-flash";
			const periodSchema = z.object({
				subject: z.string().regex(/^[a-fA-F0-9]{24}$/),
				teacher: z.string().regex(/^[a-fA-F0-9]{24}$/),
				startTime: z.string().regex(/^\d{2}:\d{2}$/),
				endTime: z.string().regex(/^\d{2}:\d{2}$/),
			});
			const scheduleSchema = z.object({
				schedule: z
					.array(
						z.object({
							day: z.enum([
								"Monday",
								"Tuesday",
								"Wednesday",
								"Thursday",
								"Friday",
							]),
							periods: z.array(periodSchema).length(settings.periods),
						}),
					)
					.length(5),
			});

			const { object } = await generateObject({
				prompt,
				model: google(modelName),
				schema: scheduleSchema,
			});

			return object;
		});

		const saved = await step.run("save-timetable", async () => {
			const academicYearId = new mongoose.Types.ObjectId(academicYear);
			const classObjectId = new mongoose.Types.ObjectId(classId);

			const timetable = await Timetable.findOneAndUpdate(
				{ class: classObjectId, academicYear: academicYearId },
				{
					class: classObjectId,
					academicYear: academicYearId,
					schedule: aiSchedule.schedule,
				},
				{ upsert: true, new: true, setDefaultsOnInsert: true },
			);

			return {
				status: "success",
				timetableId: timetable._id.toString(),
				classId,
				academicYear,
			};
		});

		return {
			message: "Timetable generated successfully",
			...saved,
		};
	},
);
