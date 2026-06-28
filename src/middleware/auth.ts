import { type Request, type Response, type NextFunction } from "express";
import jwt from "jsonwebtoken";
import type { IUser, UserRole } from "../models/user.ts";
import User from "../models/user.ts";

export interface AuthRequest extends Request {
	user?: IUser;
}

export const protect = async (
	req: AuthRequest,
	res: Response,
	next: NextFunction,
) => {
	let authToken;

	// Check for authToken in cookies
	if (req.cookies && (req.cookies.accessToken || req.cookies.token)) {
		authToken = req.cookies.accessToken || req.cookies.token;
	}

	if (authToken) {
		try {
			const decoded = jwt.verify(
				authToken,
				process.env.JWT_SECRET as string,
			) as { sub: string };

			const user = await User.findById(decoded.sub).select("-password");
			if (!user) {
				return res.status(401).json({ message: "Unauthorized" });
			}

			req.user = user;
			// Call next() to proceed to the next middleware or route handler
			next();
		} catch (error) {
			console.error("JWT verification failed:", error);
			return res.status(401).json({ message: "Unauthorized" });
		}
	} else {
		return res.status(401).json({ message: "Unauthorized, no token" });
	}
};

// Accept a list of allowed roles (e.g. 'admin', 'teacher')

export const authorize = (roles: UserRole[]) => {
	return (req: AuthRequest, res: Response, next: NextFunction) => {
		if (!req.user) {
			return res.status(401).json({ message: "Unauthorized" });
		}

		// Check if the user's role is in the allowed roles / listed in the roles array
		if (!roles.includes(req.user.role)) {
			return res.status(403).json({
				message: `User role ${req.user.role} is not authorized to access this resource`,
			});
		}
		// else, the user is authorized, so we call next() to proceed to the route handler
		next();
	};
};
// Example usage in a route
