import type { Response } from "express";

type SuccessPayload<T> = {
	message: string;
	data: T;
};

type ErrorPayload = {
	message: string;
	details?: unknown;
};

export function sendSuccess<T>(
	res: Response,
	statusCode: number,
	message: string,
	data: T,
) {
	return res.status(statusCode).json({
		status: "success",
		message,
		data,
	} satisfies SuccessPayload<T> & { status: "success" });
}

export function sendError(
	res: Response,
	statusCode: number,
	message: string,
	details?: unknown,
) {
	return res.status(statusCode).json({
		status: "error",
		message,
		...(details === undefined ? {} : { details }),
	} satisfies ErrorPayload & { status: "error" });
}
