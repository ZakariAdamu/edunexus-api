import { Router, type Request, type Response } from "express";
import { getMongoStatus } from "../db/mongo.ts";
import { sendSuccess } from "../lib/response.ts";
import { env } from "../config/env.ts";

export const healthRouter = Router();

healthRouter.get("/", (_request: Request, response: Response) => {
	const mongo = getMongoStatus();

	return sendSuccess(response, 200, "Service is healthy", {
		service: env.projectName,
		timestamp: new Date().toISOString(),
		port: env.port,
		host: env.host,
		database: {
			provider: "mongodb",
			...mongo,
		},
	});
});
