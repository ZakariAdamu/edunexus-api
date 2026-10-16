import { type Request, type Response, type NextFunction } from "express";
import type { IUser, UserRole } from "../models/user.ts";
import User from "../models/user.ts";
import { ACCESS_TOKEN_COOKIE, extractCookieToken, LEGACY_TOKEN_COOKIE, verifyToken } from "../utils/jwt.ts";

export interface AuthRequest extends Request {
	user?: IUser;
}


export const protect = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  const authToken = req.cookies
    ? extractCookieToken(req.cookies, ACCESS_TOKEN_COOKIE) ??
      extractCookieToken(req.cookies, LEGACY_TOKEN_COOKIE)
    : null;

  if (!authToken) {
    return res.status(401).json({
      message: "Unauthorized, no token",
    });
  }

  try {
    const decoded = verifyToken(authToken, "access");

    const user = await User.findById(decoded.sub).select("-password");

    if (!user) {
      return res.status(401).json({
        message: "Unauthorized",
      });
    }

    req.user = user;

    return next();
  } catch {
    return res.status(401).json({
      message: "Unauthorized",
    });
  }
};

// Accept a list of allowed roles (e.g. 'admin', 'teacher')

export const authorize = (roles: UserRole[]) => {
	return (req: AuthRequest, res: Response, next: NextFunction) => {
		if (!req.user) {
			return res.status(401).json({ message: "Unauthorized, user not found" });
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
