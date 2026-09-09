import jwt from "jsonwebtoken";
import models from "../models/index.js";
import asyncHandler from "../utils/asyncHandler.js";
import config from "../config/env.config.js";
import ApiError from "../utils/ApiError.js";
import httpStatus from "http-status";
import constants from "../constants/index.js";

/**
 * Middleware to identify a user using a JWT access token (does not block unauthorized users)
 * @param {Request} req - The request object
 * @param {Response} res - The response object
 * @param {Function} next - The next middleware function    
 */
const userMiddleware = asyncHandler(async (req, res, next) => {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];

    if (!token) {
        return next(); // Skip if no token
    }

    let decoded;
    try {
        decoded = jwt.verify(token, config.jwt.secret);
        console.log("decoded user ===>>", decoded);
    } catch (err) {
        console.log(err.message);
        if (err.message === "jwt expired") {
            return next(); // Skip if token expired
        }
        return next(); // Skip if token invalid
    }

    const user = await models.User.findById(decoded?.id);
    if (!user) {
        return next(); // Skip if user not found
    }

    // Find the current session
    const session = user.sessions.find(
        (s) => s.tokenId === decoded.jti && s.isActive && s.expiresAt > new Date()
    );
    if (!session) {
        return next(); // Skip if session not found or expired
    }

    // Set user and session details in req
    req.user = user;
    req.session = {
        tokenId: session.tokenId,
        keyId: session.keyId,
        deviceInfo: session.deviceInfo,
        ipAddress: session.ipAddress,
        loginAt: session.loginAt,
        expiresAt: session.expiresAt,
    };

    next();
});

export default userMiddleware;