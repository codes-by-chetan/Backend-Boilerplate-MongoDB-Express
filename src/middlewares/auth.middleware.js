import jwt from "jsonwebtoken";
import models from "../models/index.js";
import asyncHandler from "../utils/asyncHandler.js";
import config from "../config/env.config.js";
import ApiError from "../utils/ApiError.js";
import httpStatus from "http-status";
import constants from "../constants/index.js";

/**
 * Middleware to authenticate a user using a JWT access token
 * @param {Request} req - The request object
 * @param {Response} res - The response object
 * @param {Function} next - The next middleware function    
 */
const authMiddleware = asyncHandler(async (req, res, next) => {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];

    if (!token) {
        throw new ApiError(httpStatus.UNAUTHORIZED, "Access token is missing or invalid");
    }

    let decoded;
    try {
        decoded = jwt.verify(token, config.jwt.secret);
    } catch (err) {
        console.log(err.message);
        if (err.message === "jwt expired") {
            throw new ApiError(httpStatus.UNAUTHORIZED, "Session expired");
        }
        throw new ApiError(httpStatus.UNAUTHORIZED, "Invalid token");
    }

    const user = await models.User.findById(decoded?.id);
    if (!user) {
        throw new ApiError(httpStatus.NOT_FOUND, "User not found");
    } else if (user.status === constants.UserStatus.Inactive) {
        throw new ApiError(httpStatus.FORBIDDEN, "User is inactive");
    } else if (user.deleted) {
        throw new ApiError(httpStatus.FORBIDDEN, "User is deleted");
    }

    // Find the current session
    const session = user.sessions.find(
        (s) => s.tokenId === decoded.jti && s.isActive && s.expiresAt > new Date()
    );
    if (!session) {
        throw new ApiError(httpStatus.UNAUTHORIZED, "Session not found or expired");
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

export default authMiddleware;