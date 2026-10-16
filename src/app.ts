// Force IPv4 DNS resolution for MongoDB connection
import dns from "node:dns";
dns.setDefaultResultOrder("ipv4first");

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
import morgan from "morgan";
import jwt from "jsonwebtoken";
import { ZodError } from "zod";
import { env } from "./config/env.ts";
import { isHttpError } from "./lib/http-error.ts";
import { sendError, sendSuccess } from "./lib/response.ts";

// Import your routes
import { healthRouter } from "./routes/health.ts";
import userRoutes from "./routes/user.ts";
import { logsRouter } from "./routes/activityLogs.ts";
// import { summaryRouter } from "./routes/summary.ts";
// import incomeRouter from "./routes/incomeRoute.ts";
// import expenseRouter from "./routes/expenseRoute.ts";
// import dashboardRouter from "./routes/dashboardRoute.ts";

export function createApp() {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", 1);
  app.set("port", env.port);
  app.set("host", env.host);

  // ====================== MIDDLEWARE ======================

  // 1. Security headers (Very Important)
  app.use(helmet());

  // You configure allowed origins and headers through corsOptions.
  // For production, make sure env.allowedOrigins contains the exact
  // frontend origin or origins that should be permitted.
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
  app.use(express.json({ limit: "1mb" })); // middleware to parse JSON bodies
  app.use(express.urlencoded({ extended: true, limit: "1mb" })); // middleware to parse URL-encoded bodies (e.g., form submissions)

  // 5. Cookie parser
  app.use(cookieParser()); // middleware to parse cookies

  // 6. Morgan for logging http requests (optional, can be replaced with a more advanced logger like Winston or Pino)
  if (env.nodeEnv === "development") {
    app.use(morgan("dev"));
  }

  // rate-limit organization

  const loginLimiter = rateLimit({
    windowMs: 10 * 60 * 1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      success: false,
      message: "Too many login attempts. Please try again later.",
    },
  });

  const registrationLimiter = rateLimit({
    windowMs: 10 * 60 * 1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      success: false,
      message: "Too many registration attempts. Please try again later.",
    },
  });

  const verificationLimiter = rateLimit({
    windowMs: 10 * 60 * 1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      success: false,
      message: "Too many verification attempts. Please try again later.",
    },
  });

  // user routes with usage limit controls
  app.use("/api/users/login", loginLimiter);
  app.use("/api/users/register", registrationLimiter);
  app.use("/api/users/verify-email", verificationLimiter);
  app.use("/api/users/resend-verification-code", verificationLimiter);
  app.use("/api/users/refresh", registrationLimiter);

  // ====================== BASIC ROUTE ======================
  app.get("/", (_req: Request, res: Response) => {
    sendSuccess(res, 200, "Backend is healthy", {
      service: `${env.projectName} API`,
      version: process.env.npm_package_version || "1.0.0",
      status: "running",
      port: app.get("port"),
      host: app.get("host"),
    });
  });

  // ====================== API ROUTES ======================
  // Register additional routers here as they become available.
  app.use("/api/health", healthRouter);
  app.use("/api/users", userRoutes);
  app.use("/api/activity-logs", logsRouter);

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

  // ====================== Catch-all 404 HANDLER ======================
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
