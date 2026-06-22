import { Router, type Request, type Response } from "express";
import { getMongoStatus } from "../db/mongo.ts";
import { sendSuccess } from "../lib/response.js";

export const healthRouter = Router();

healthRouter.get("/", (_request: Request, response: Response) => {
	const mongo = getMongoStatus();

	return sendSuccess(response, 200, "Service is healthy", {
		service: "medplus-api",
		timestamp: new Date().toISOString(),
		database: {
			provider: "mongodb",
			...mongo,
		},
	});
});
