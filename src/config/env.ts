import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
	NODE_ENV: z
		.enum(["development", "test", "production"])
		.default("development"),
	PORT: z.coerce.number().int().positive().default(5000),
	HOST: z.string().optional(),
	MONGODBURI: z.string().min(1, "MONGODBURI is required"),
	MOGODBURI: z.string().optional(),
	PROJECT_NAME: z.string(),
	JWT_SECRET: z.string().min(1, "JWT_SECRET is required"),
	JWT_REFRESH_SECRET: z.string().min(1).optional(),
	JWT_ACCESS_EXPIRES_IN: z.string().default("60m"),
	JWT_REFRESH_EXPIRES_IN: z.string().default("7d"),
	FROM_EMAIL: z.string().email("Invalid sender email"),
	MONGO_RETRIES: z.coerce.number().int().min(0).default(3),
	MONGO_RETRY_DELAY_MS: z.coerce.number().int().min(0).default(2000),
	FRONTEND_DEV_URL: z.string().url().optional(),
	FRONTEND_PROD_URL: z.string().url().optional(),
	CORS_ORIGINS: z.string().optional(),
	COOKIE_DOMAIN: z.string().optional(),
	EDUNEXUS_BREVO_API_KEY: z.string(),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
	const issues = parsedEnv.error.issues
		.map((issue) => `${issue.path.join(".") || "env"}: ${issue.message}`)
		.join("\n");
	throw new Error(`Environment validation failed:\n${issues}`);
}

function parseOrigins(value: string | undefined) {
	return value
		?.split(",")
		.map((origin) => origin.trim())
		.filter(Boolean);
}

function uniqueOrigins(origins: Array<string | undefined>) {
	return [
		...new Set(origins.filter((origin): origin is string => Boolean(origin))),
	];
}

const envValues = parsedEnv.data;

export const env = {
	nodeEnv: envValues.NODE_ENV,
	port: envValues.PORT,
	host:
		envValues.HOST ??
		(envValues.NODE_ENV === "production" ? "0.0.0.0" : "localhost"),
	edunexusBrevoApiKey: envValues.EDUNEXUS_BREVO_API_KEY,
	fromEmail: envValues.FROM_EMAIL,
	projectName: envValues.PROJECT_NAME,
	mongoDbUri: envValues.MONGODBURI ?? envValues.MOGODBURI ?? "",
	jwtSecret: envValues.JWT_SECRET,
	jwtRefreshSecret: envValues.JWT_REFRESH_SECRET ?? envValues.JWT_SECRET,
	jwtAccessExpiresIn: envValues.JWT_ACCESS_EXPIRES_IN,
	jwtRefreshExpiresIn: envValues.JWT_REFRESH_EXPIRES_IN,
	mongoRetries: envValues.MONGO_RETRIES,
	mongoRetryDelayMs: envValues.MONGO_RETRY_DELAY_MS,
	frontendDevUrl: envValues.FRONTEND_DEV_URL,
	frontendProdUrl: envValues.FRONTEND_PROD_URL,
	allowedOrigins: uniqueOrigins([
		...(parseOrigins(envValues.CORS_ORIGINS) ?? []),
		envValues.FRONTEND_DEV_URL,
		envValues.FRONTEND_PROD_URL,
	]),
	cookieDomain: envValues.COOKIE_DOMAIN,
};

export const hasMongoDbUri = env.mongoDbUri.length > 0;
