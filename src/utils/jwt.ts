import type { CookieOptions } from "express";
import jwt, { type JwtPayload, type SignOptions } from "jsonwebtoken";
import { env } from "../config/env.ts";

export type AuthTokenPayload = JwtPayload & {
	sub: string;
	tokenType: "access" | "refresh" | "verification";
};

// Cookie names for authentication tokens
export const ACCESS_TOKEN_COOKIE = "accessToken";
export const REFRESH_TOKEN_COOKIE = "refreshToken";
export const LEGACY_TOKEN_COOKIE = "token";

// ============= TOKEN CREATION & VERIFICATION =============
const JWT_ALGORITHM = "HS256" as const;

// Helper function to sign a JWT with the appropriate payload and options
function signToken(
	userId: string,
	secret: string,
	expiresIn: string,
	tokenType: AuthTokenPayload["tokenType"],
) {
	return jwt.sign({ sub: userId, tokenType }, secret, {
		expiresIn: expiresIn as SignOptions["expiresIn"],
		algorithm: JWT_ALGORITHM,
	});
}

// Creates an access token for the given user ID
export function createAccessToken(userId: string) {
	return signToken(userId, env.jwtSecret, env.jwtAccessExpiresIn, "access");
}

// Creates a refresh token for the given user ID during the sign-in process
export function createRefreshToken(userId: string) {
	return signToken(
		userId,
		env.jwtRefreshSecret,
		env.jwtRefreshExpiresIn,
		"refresh",
	);
}

// Creates a short-lived verification token (1 hour)
export function createVerificationToken(userId: string) {
	return signToken(userId, env.jwtSecret, "1h", "verification");
}

export function getAuthCookieOptions(maxAgeMs: number) {
	return {
		httpOnly: true,
		secure: env.nodeEnv === "production",
		sameSite: "lax" as const,
		path: "/", // Make sure cookies are available on all routes
		maxAge: maxAgeMs,
		...(env.cookieDomain ? { domain: env.cookieDomain } : {}),
	};
}

export function getAccessTokenCookieOptions() {
	return getAuthCookieOptions(24 *60 * 60 * 1000); // 24 hours
}

export function getRefreshTokenCookieOptions() {
	return getAuthCookieOptions(24 * 60 * 60 * 1000); // 24 hours
}
// Sets the access and refresh tokens as HTTP-only cookies in the response
export function setAuthCookies(
	res: {
		cookie: (name: string, value: string, options: CookieOptions) => unknown;
	},
	accessToken: string,
	refreshToken: string,
) {
	res.cookie(ACCESS_TOKEN_COOKIE, accessToken, getAccessTokenCookieOptions());
	res.cookie(
		REFRESH_TOKEN_COOKIE,
		refreshToken,
		getRefreshTokenCookieOptions(),
	);
	res.cookie(LEGACY_TOKEN_COOKIE, accessToken, getAccessTokenCookieOptions());
}

export function clearAuthCookies(res: {
	clearCookie: (name: string, options?: CookieOptions) => unknown;
}) {
	const options = getRefreshTokenCookieOptions();
	res.clearCookie(ACCESS_TOKEN_COOKIE, options);
	res.clearCookie(REFRESH_TOKEN_COOKIE, options);
	res.clearCookie(LEGACY_TOKEN_COOKIE, options);
}

export function verifyToken(
	token: string,
	type: AuthTokenPayload["tokenType"],
) {
	const secret = type === "refresh" ? env.jwtRefreshSecret : env.jwtSecret;
	const payload = jwt.verify(token, secret, {
		algorithms: [JWT_ALGORITHM] as jwt.Algorithm[],
	}) as jwt.JwtPayload & Partial<AuthTokenPayload>;

	if (payload.tokenType !== type) {
		throw new jwt.JsonWebTokenError("Invalid token type");
	}

	if (typeof payload.sub !== "string" || payload.sub.length === 0) {
		throw new jwt.JsonWebTokenError("Token subject is missing");
	}

	return {
		...payload,
		sub: payload.sub,
		tokenType: type,
	} as AuthTokenPayload;
}

export function extractBearerToken(authorizationHeader?: string | null) {
	if (!authorizationHeader) {
		return null;
	}

	const [scheme, token] = authorizationHeader.split(" ");
	if (scheme?.toLowerCase() !== "bearer" || !token) {
		return null;
	}

	return token;
}

export function extractCookieToken(
	cookies: Record<string, unknown>,
	name: string,
) {
	const value = cookies[name];
	return typeof value === "string" && value.length > 0 ? value : null;
}
