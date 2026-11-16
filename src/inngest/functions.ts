import mongoose from "mongoose";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createGroq } from "@ai-sdk/groq";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { createCerebras } from "@ai-sdk/cerebras";
import { generateObject } from "ai";
import { z } from "zod";

import { inngest } from "./index.ts";
import Class from "../models/class.ts";
import User, { UserRole } from "../models/user.ts";
import Timetable from "../models/timetable.ts";

interface GenSettings {
	startTime: string;
	endTime: string;
	periods: number;
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

const WEEKDAYS = [
	"Monday",
	"Tuesday",
	"Wednesday",
	"Thursday",
	"Friday",
] as const;

function asId(value: unknown): string {
	if (value && typeof value === "object" && "_id" in value) {
		return String((value as { _id: unknown })._id);
	}

	return String(value);
}

function parseModelList(value?: string): string[] {
	return [
		...new Set(
			(value ?? "")
				.split(",")
				.map((model) => model.trim())
				.filter(Boolean),
		),
	];
}

type FailureScope = "model" | "provider" | "fatal";

interface AIErrorDetails {
	status?: number;
	message: string;
	code?: string;
}

function getAIErrorDetails(error: unknown): AIErrorDetails {
	const err = error as Record<string, unknown>;

	const statusValue = err?.statusCode ?? err?.status;

	const status = typeof statusValue === "number" ? statusValue : undefined;

	const messageParts = [err?.message, err?.responseBody, err?.body, err?.code];

	const message = messageParts
		.filter(Boolean)
		.map((part) => (typeof part === "string" ? part : JSON.stringify(part)))
		.join(" ")
		.toLowerCase();

	return {
		status,
		message,
		code: typeof err?.code === "string" ? err.code : undefined,
	};
}

/**
 * Determines whether a failed request should move to another model,
 * skip the entire provider, or stop because the request itself is invalid.
 */
function classifyAIError(error: unknown): FailureScope {
	const { status, message } = getAIErrorDetails(error);

	// Account/project/provider-level problems.
	if (
		status === 401 ||
		status === 402 ||
		status === 403 ||
		status === 429 ||
		/quota|resource_exhausted|insufficient_quota|billing|payment required|credits exhausted|rate limit exceeded/.test(
			message,
		)
	) {
		return "provider";
	}

	// Model-specific problems.
	if (
		status === 404 ||
		status === 408 ||
		(status !== undefined && status >= 500) ||
		/model not found|unknown model|model unavailable|deprecated model|no object generated|invalid json|json parsing|schema validation|timeout|fetch failed|network error|econnreset|etimedout/.test(
			message,
		)
	) {
		return "model";
	}

	// Invalid request, invalid parameters, or other non-recoverable errors.
	return "fatal";
}

const WEEKDAY_SCHEMA = z.enum(WEEKDAYS);

export const generateTimeTable = inngest.createFunction(
	{
		id: "generate-timetable",
		retries: 0,
		triggers: [{ event: "generate/timetable" }],
	},
	async ({ event, step }) => {
		const { classId, academicYear, settings } =
			event.data as TimetableEventData;

		if (
			!mongoose.isValidObjectId(classId) ||
			!mongoose.isValidObjectId(academicYear) ||
			!settings ||
			!Number.isInteger(settings.periods) ||
			settings.periods < 1
		) {
			throw new Error("Invalid timetable generation event data.");
		}

		// ==========================================
		// STEP 1: FETCH CLASS AND TEACHER CONTEXT
		// ==========================================

		const contextData = await step.run("fetch-class-context", async () => {
			const classData = await Class.findById(classId).populate({
				path: "subjects",
				select: "name code isActive",
			});

			if (!classData) {
				throw new Error(`Class ${classId} not found.`);
			}

			if (asId(classData.academicYear) !== academicYear) {
				throw new Error(
					"Selected academic year does not belong to this class.",
				);
			}

			const subjects = classData.subjects as unknown as Array<{
				_id: unknown;
				name: string;
				code: string;
				isActive?: boolean;
			}>;

			const activeSubjects = subjects.filter(
				(subject) => subject.isActive !== false,
			);

			if (activeSubjects.length === 0) {
				throw new Error("This class has no active subjects assigned.");
			}

			const classSubjectIds = activeSubjects.map((subject) => asId(subject));

			const allTeachers = await User.find({
				role: UserRole.TEACHER,
				isActive: true,
				teacherSubjects: { $in: classSubjectIds },
			}).select("_id name teacherSubjects");

			const qualifiedTeachers: TeacherPayload[] = allTeachers.map(
				(teacher) => ({
					id: teacher._id.toString(),
					name: teacher.name,
					subjects: (teacher.teacherSubjects ?? []).map((subjectId) =>
						asId(subjectId),
					),
				}),
			);

			if (qualifiedTeachers.length === 0) {
				throw new Error(
					"No active teachers are assigned to this class's subjects.",
				);
			}

			const subjectsPayload: SubjectPayload[] = activeSubjects.map(
				(subject) => ({
					id: asId(subject),
					name: subject.name,
					code: subject.code,
				}),
			);

			return {
				className: classData.name,
				subjects: subjectsPayload,
				teachers: qualifiedTeachers,
			};
		});

		// ==========================================
		// STEP 2: PREPARE EXISTING TIMETABLES
		// ==========================================

		const occupied = await step.run("fetch-existing-timetables", async () => {
			const academicYearId = new mongoose.Types.ObjectId(academicYear);

			const otherTimetables = await Timetable.find({
				academicYear: academicYearId,
				class: { $ne: new mongoose.Types.ObjectId(classId) },
			}).select("class schedule");

			return otherTimetables.map((timetable) => ({
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
		});

		// ==========================================
		// STEP 3: DEFINE OUTPUT SCHEMA
		// ==========================================

		const periodSchema = z.object({
			subject: z.string().regex(/^[a-fA-F0-9]{24}$/),
			teacher: z.string().regex(/^[a-fA-F0-9]{24}$/),
			startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
			endTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
		});

		const scheduleSchema = z
			.object({
				schedule: z
					.array(
						z.object({
							day: WEEKDAY_SCHEMA,
							periods: z.array(periodSchema).length(settings.periods),
						}),
					)
					.length(5),
			})
			.superRefine((data, ctx) => {
				const days = data.schedule.map((item) => item.day);

				if (new Set(days).size !== 5) {
					ctx.addIssue({
						code: "custom",
						message: "Each weekday must appear exactly once.",
						path: ["schedule"],
					});
				}

				for (const day of data.schedule) {
					for (const period of day.periods) {
						if (period.startTime >= period.endTime) {
							ctx.addIssue({
								code: "custom",
								message: `Invalid time range on ${day.day}.`,
							});
						}
					}
				}
			});

		const prompt = `
You are an expert school timetable scheduling assistant.

Generate a Monday-to-Friday timetable.

CLASS:
${JSON.stringify({
	className: contextData.className,
	startTime: settings.startTime,
	endTime: settings.endTime,
	teachingPeriodsPerDay: settings.periods,
})}

AVAILABLE SUBJECTS:
${JSON.stringify(contextData.subjects)}

AVAILABLE TEACHERS:
${JSON.stringify(contextData.teachers)}

TEACHERS ALREADY BOOKED IN OTHER CLASSES:
${JSON.stringify(occupied)}

STRICT RULES:
1. Generate exactly five days: Monday, Tuesday, Wednesday, Thursday and Friday.
2. Each day must have exactly ${settings.periods} teaching periods.
3. Assign one teacher to every subject period.
4. A teacher must be qualified to teach the assigned subject.
5. Use only subject and teacher IDs supplied above.
6. A teacher must never teach two classes at the same time.
7. Avoid all teacher bookings listed in existing timetables.
8. Do not assign teaching periods outside the specified school hours.
9. After every two teaching periods, allow a 10-minute break.
10. After four teaching periods, allow a 60-minute lunch break.
11. Do not include breaks or lunch as period objects.
12. Return structured data matching the supplied schema.

Important:
- Do not invent IDs.
- Do not duplicate weekdays.
- Do not omit periods.
- Return no explanations outside the structured output.
`;

		// ==========================================
		// STEP 4: MULTI-PROVIDER AI FALLBACK
		// ==========================================

		const aiSchedule = await step.run(
			"generate-timetable-with-ai",
			async () => {
				const candidates: Array<{
					provider: string;
					model: string;
					run: () => Promise<z.infer<typeof scheduleSchema>>;
				}> = [];

				// Google Gemini
				if (process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
					const google = createGoogleGenerativeAI({
						apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
					});

					const models = parseModelList(
						process.env.GOOGLE_GENERATIVE_AI_MODELS ??
							process.env.GOOGLE_GENERATIVE_AI_MODEL ??
							"gemini-3.8-flash",
					);

					for (const model of models) {
						candidates.push({
							provider: "Google",
							model,
							run: async () =>
								(
									await generateObject({
										model: google(model),
										schema: scheduleSchema,
										prompt,
										maxRetries: 0,
									})
								).object,
						});
					}
				}

				// Groq
				if (process.env.GROQ_API_KEY) {
					const groq = createGroq({
						apiKey: process.env.GROQ_API_KEY,
					});

					for (const model of parseModelList(process.env.GROQ_MODELS)) {
						candidates.push({
							provider: "Groq",
							model,
							run: async () =>
								(
									await generateObject({
										model: groq(model),
										schema: scheduleSchema,
										prompt,
										maxRetries: 0,
									})
								).object,
						});
					}
				}

				// OpenRouter
				if (process.env.OPENROUTER_API_KEY) {
					const openrouter = createOpenRouter({
						apiKey: process.env.OPENROUTER_API_KEY,
					});

					for (const model of parseModelList(process.env.OPENROUTER_MODELS)) {
						candidates.push({
							provider: "OpenRouter",
							model,
							run: async () =>
								(
									await generateObject({
										model: openrouter.chat(model),
										schema: scheduleSchema,
										prompt,
										maxRetries: 0,
									})
								).object,
						});
					}
				}

				// Cerebras
				if (process.env.CEREBRAS_API_KEY) {
					const cerebras = createCerebras({
						apiKey: process.env.CEREBRAS_API_KEY,
					});

					for (const model of parseModelList(process.env.CEREBRAS_MODELS)) {
						candidates.push({
							provider: "Cerebras",
							model,
							run: async () =>
								(
									await generateObject({
										model: cerebras(model),
										schema: scheduleSchema,
										prompt,
										maxRetries: 0,
									})
								).object,
						});
					}
				}

				if (candidates.length === 0) {
					throw new Error(
						"No configured AI providers or models are available.",
					);
				}

				const failedProviders = new Set<string>();
				const failures: string[] = [];

				for (const candidate of candidates) {
					if (failedProviders.has(candidate.provider)) {
						continue;
					}

					try {
						console.log(
							`[Timetable AI] Trying ${candidate.provider}/${candidate.model}`,
						);

						const result = await candidate.run();

						console.log(
							`[Timetable AI] Successful model: ${candidate.provider}/${candidate.model}`,
						);

						return {
							...result,
							aiProvider: candidate.provider,
							aiModel: candidate.model,
						};
					} catch (error) {
						const details = getAIErrorDetails(error);
						const scope = classifyAIError(error);

						console.warn(
							`[Timetable AI] ${candidate.provider}/${candidate.model} failed.`,
							{
								status: details.status,
								code: details.code,
								scope,
								message: details.message.slice(0, 500),
							},
						);

						failures.push(
							`${candidate.provider}/${candidate.model}: ${details.message.slice(0, 200)}`,
						);

						if (scope === "fatal") {
							throw new Error(
								`AI generation stopped because the request failed: ${details.message}`,
								{ cause: error },
							);
						}

						if (scope === "provider") {
							failedProviders.add(candidate.provider);
						}
					}
				}

				throw new Error(
					`All configured AI models failed. Attempts: ${failures.join(" | ")}`,
				);
			},
		);

		// ==========================================
		// STEP 5: SAVE GENERATED TIMETABLE
		// ==========================================

		const saved = await step.run("save-timetable", async () => {
			const academicYearId = new mongoose.Types.ObjectId(academicYear);

			const classObjectId = new mongoose.Types.ObjectId(classId);

			const timetable = await Timetable.findOneAndUpdate(
				{
					class: classObjectId,
					academicYear: academicYearId,
				},
				{
					class: classObjectId,
					academicYear: academicYearId,
					schedule: aiSchedule.schedule, 
				},
				{
					upsert: true,
					new: true,
					setDefaultsOnInsert: true,
					runValidators: true,
				},
			);

			return {
				status: "success",
				timetableId: timetable._id.toString(),
				classId,
				academicYear,
				aiProvider: aiSchedule.aiProvider,
				aiModel: aiSchedule.aiModel,
			};
		});

		return {
			message: "Timetable generated successfully",
			...saved, 
		};
	},
);
