import mongoose from "mongoose";
import { env, hasMongoDbUri } from "../config/env.js";

type MongoStatus = {
	configured: boolean;
	validUri: boolean;
	connected: boolean;
	message: string;
	// optional error stack for debugging when connection fails
	errorStack?: string | null;
};

let status: MongoStatus = {
	configured: hasMongoDbUri,
	validUri: isValidMongoUri(env.mongoDbUri),
	connected: false,
	message: hasMongoDbUri ? "MongoDB URI configured" : "MONGODBURI is not set",
	errorStack: null,
};

let listenersRegistered = false;

function isValidMongoUri(uri: string) {
	return uri.startsWith("mongodb://") || uri.startsWith("mongodb+srv://");
}

function registerMongoListeners() {
	if (listenersRegistered) {
		return;
	}

	mongoose.connection.on("connected", () => {
		status = {
			...status,
			connected: true,
			message: "MongoDB connected",
			errorStack: null,
		};
	});

	mongoose.connection.on("disconnected", () => {
		status = {
			...status,
			connected: false,
			message: "MongoDB disconnected",
		};
	});

	mongoose.connection.on("error", (error) => {
		status = {
			...status,
			connected: false,
			message:
				error instanceof Error ? error.message : "MongoDB connection error",
			errorStack: error instanceof Error && error.stack ? error.stack : null,
		};
	});

	listenersRegistered = true;
}

export function getMongoStatus() {
	return status;
}

export async function initializeMongoConnection() {
	registerMongoListeners();

	if (!hasMongoDbUri) {
		status = {
			configured: false,
			validUri: false,
			connected: false,
			message: "MONGODBURI is not set",
		};
		return status;
	}

	if (!isValidMongoUri(env.mongoDbUri)) {
		status = {
			configured: true,
			validUri: false,
			connected: false,
			message:
				"MONGODBURI is invalid. Use mongodb:// or mongodb+srv:// URI format.",
		};
		return status;
	}

	try {
		await mongoose.connect(env.mongoDbUri, {
			serverSelectionTimeoutMS: 8000,
			maxPoolSize: 10,
		});

		status = {
			configured: true,
			validUri: true,
			connected: true,
			message: "MongoDB connected",
			errorStack: null,
		};
	} catch (error) {
		const message =
			error instanceof Error
				? error.message
				: "Unknown MongoDB connection error";
		const stack = error instanceof Error && error.stack ? error.stack : null;

		status = {
			configured: true,
			validUri: true,
			connected: false,
			message,
			errorStack: stack,
		};
	}

	return status;
}
