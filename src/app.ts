import cors from "cors";
import cookieParser from "cookie-parser";
import compression from "compression";
import rateLimit from "express-rate-limit";
import express, {
	type NextFunction,
	type Request,
	type Response,
} from "express";
import helmet from "helmet";
import jwt from "jsonwebtoken";
import { ZodError } from "zod";
import { env } from "./config/env.js";
import { isHttpError } from "./lib/http-error.ts";
import { sendError, sendSuccess } from "./lib/response.ts";
// import swaggerUi from "swagger-ui-express";
import fs from "fs";
import path from "path";

// Import your routes
// import { healthRouter } from "./routes/health.ts";
// import { summaryRouter } from "./routes/summary.ts";
// import incomeRouter from "./routes/incomeRoute.ts";
// import expenseRouter from "./routes/expenseRoute.ts";
// import dashboardRouter from "./routes/dashboardRoute.ts";
// import userRouter from "./routes/userRoute.ts";

export function createApp() {
	const app = express();
	app.disable("x-powered-by");
	app.set("trust proxy", 1);
	app.set("port", env.port);
	app.set("host", env.host);

	// ====================== MIDDLEWARE ======================

	// 1. Security headers (Very Important)
	app.use(helmet());

	const corsOrigin =
		env.allowedOrigins.length > 0
			? env.allowedOrigins
			: env.nodeEnv === "production"
				? false
				: true;

	const corsOptions: cors.CorsOptions = {
		origin: corsOrigin,
		credentials: true,
		methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
		allowedHeaders: ["Content-Type", "Authorization", "X-Refresh-Token"],
	};

	app.use(cors(corsOptions));

	// 2. Add the global preflight interceptor (CRITICAL for Render + Next.js)
	app.options("/{*splat}", cors(corsOptions));

	// 3. Compression (speeds up responses)
	app.use(compression());

	// 4. Body parsing
	app.use(express.json({ limit: "10mb" })); // Prevent huge payloads
	app.use(express.urlencoded({ extended: true, limit: "10mb" }));

	// 5. Cookie parser
	app.use(cookieParser());

	const authLimiter = rateLimit({
		windowMs: 45 * 60 * 1000, // 45 minutes
		max: 15, // Limit each IP to 15 requests per windowMs
		standardHeaders: true,
		legacyHeaders: false,
		message: {
			status: "error",
			message: "Too many auth attempts, please try again later.",
		},
	});

	const refreshLimiter = rateLimit({
		windowMs: 45 * 60 * 1000,
		max: 50,
		standardHeaders: true,
		legacyHeaders: false,
		message: {
			status: "error",
			message: "Too many refresh attempts, please try again later.",
		},
	});

	// Apply rate limiters to auth-related routes
	app.use("/api/users/login", authLimiter);
	app.use("/api/users/signup", authLimiter);
	// app.use("/api/users/verify-email", authLimiter);
	// app.use("/api/users/resend-verification-code", authLimiter);
	app.use("/api/users/refresh", refreshLimiter);

	// ====================== BASIC ROUTE ======================
	app.get("/", (_req: Request, res: Response) => {
		sendSuccess(res, 200, "Backend is healthy", {
			service: "finance-pro-backend",
			version: process.env.npm_package_version || "1.0.0",
			status: "running",
			port: app.get("port"),
			host: app.get("host"),
		});
	});

	// ====================== ROUTES ======================
	// app.use("/api/health", healthRouter);
	// app.use("/api/users", userRouter);
	// app.use("/api/summary", summaryRouter);
	// app.use("/api/income", incomeRouter);
	// app.use("/api/expenses", expenseRouter);
	// app.use("/api/dashboard", dashboardRouter);

	// Optional: Keep /dashboard if you serve some HTML/views
	// app.use("/dashboard", dashboardRouter);

	// ====================== API Docs (Swagger UI) ======================
	// try {
	// 	const openapiPath = path.resolve(process.cwd(), "openapi", "openapi.json");
	// 	if (fs.existsSync(openapiPath)) {
	// 		const spec = JSON.parse(fs.readFileSync(openapiPath, "utf-8"));
	// 		app.use(
	// 			"/docs",
	// 			swaggerUi.serve,
	// 			swaggerUi.setup(spec, { explorer: true }),
	// 		);
	// 	}
	// } catch (err) {
	// 	console.warn("Could not mount API docs:", err);
	// }

	// ====================== 404 HANDLER ======================
	app.use((_req: Request, res: Response) => {
		sendError(res, 404, "Route not found");
	});

	// ====================== GLOBAL ERROR HANDLER ======================
	app.use(
		(error: unknown, _req: Request, res: Response, _next: NextFunction) => {
			if (res.headersSent) {
				return;
			}

			if (isHttpError(error)) {
				return sendError(res, error.statusCode, error.message, error.details);
			}

			if (error instanceof ZodError) {
				return sendError(res, 400, "Validation failed", {
					issues: error.flatten(),
				});
			}

			if (error instanceof jwt.TokenExpiredError) {
				return sendError(res, 401, "Token has expired");
			}

			if (error instanceof jwt.JsonWebTokenError) {
				return sendError(res, 401, "Invalid token");
			}

			console.error("Unhandled Error:", error);
			return sendError(res, 500, "Internal server error", {
				...(env.nodeEnv === "development" &&
				error instanceof Error &&
				error.stack
					? { stack: error.stack }
					: {}),
			});
		},
	);

	return app;
}
