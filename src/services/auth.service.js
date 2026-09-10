import constants from "../constants/index.js";
import ApiError from "../utils/ApiError.js";
import httpStatus from "http-status";
import userService from "./user.service.js";
import jwt from "jsonwebtoken";
import config from "../config/env.config.js";
import models from "../models/index.js";
import { OAuth2Client } from "google-auth-library";
import axios from "axios";

const googleClient = new OAuth2Client(config.google_client_id);

/**
 * Logs in a user using email or username and password, with optional role enforcement.
 *
 * @param {Object} req - The express request object containing credentials in req.body.
 * @param {Object} [options] - Additional login constraints (e.g. allowedRoles).
 * @returns {Promise<Object>} - Resolves to the access token and session metadata.
 */
const loginWithEmailAndPassword = async (req, options = {}) => {
    const credentials = req.body;

    if (!credentials.userName && !credentials.email) {
        throw new ApiError(
            httpStatus.BAD_REQUEST,
            "Username or Email is required for login."
        );
    }

    const user = await userService.findOneUser(
        credentials.email,
        credentials.userName
    );

    if (!user) {
        throw new ApiError(httpStatus.NOT_FOUND, "User not found.");
    }

    if (user.status === constants.UserStatus.Inactive) {
        throw new ApiError(httpStatus.UNAUTHORIZED, "User account is inactive.");
    }

    const isPasswordValid = await user.isPasswordCorrect(credentials.password);
    if (!isPasswordValid) {
        throw new ApiError(httpStatus.UNAUTHORIZED, "Incorrect password.");
    }

    if (options.allowedRoles && options.allowedRoles.length > 0) {
        if (!options.allowedRoles.includes(user.role)) {
            throw new ApiError(
                httpStatus.FORBIDDEN,
                "Access denied. Only users with the Admin role are authorized to log in to this portal."
            );
        }
    }

    const tokens = await user.generateAuthTokens(req);
    return {
        ...tokens,
        user: {
            id: user._id,
            email: user.email,
            userName: user.userName,
            fullName: user.fullName,
            role: user.role,
        },
    };
};

/**
 * Verifies a third-party social login token (Google / Facebook) and returns a JWT for the user.
 *
 * @param {string} provider - The provider ("google" | "facebook").
 * @param {string} token - The provider's access/id token.
 * @param {Object} req - The express request object.
 * @returns {Promise<Object>} - Resolves to user data and access tokens.
 */
const verifySocialToken = async (provider, token, req) => {
    let userData;

    if (provider === "google") {
        try {
            const ticket = await googleClient.verifyIdToken({
                idToken: token,
                audience: config.google_client_id,
            });
            const payload = ticket.getPayload();
            if (!payload) {
                throw new ApiError(
                    httpStatus.UNAUTHORIZED,
                    "Invalid Google ID token."
                );
            }
            userData = {
                oauthId: payload.sub,
                oauthProvider: "google",
                email: payload.email,
                fullName: {
                    firstName: payload.given_name || "User",
                    lastName: payload.family_name || "",
                },
            };
        } catch (error) {
            console.error("Google token verification error:", error);
            throw new ApiError(
                httpStatus.UNAUTHORIZED,
                "Google token verification failed."
            );
        }
    } else if (provider === "facebook") {
        try {
            const response = await axios.get(
                `https://graph.facebook.com/me?fields=id,email,first_name,last_name&access_token=${token}`
            );
            const fbData = response.data;
            if (!fbData.id) {
                throw new ApiError(
                    httpStatus.UNAUTHORIZED,
                    "Invalid Facebook access token."
                );
            }
            userData = {
                oauthId: fbData.id,
                oauthProvider: "facebook",
                email: fbData.email,
                fullName: {
                    firstName: fbData.first_name || "User",
                    lastName: fbData.last_name || "",
                },
            };
        } catch (error) {
            console.error("Facebook token verification error:", error);
            throw new ApiError(
                httpStatus.UNAUTHORIZED,
                "Facebook token verification failed."
            );
        }
    } else {
        throw new ApiError(
            httpStatus.BAD_REQUEST,
            `Unsupported OAuth provider: ${provider}`
        );
    }

    let user = await models.User.findOne({
        oauthId: userData.oauthId,
        oauthProvider: userData.oauthProvider,
        deleted: { $ne: true },
    });

    if (!user) {
        user = await models.User.findOne({
            email: userData.email,
            deleted: { $ne: true },
        });

        if (user) {
            if (user.status === constants.UserStatus.Inactive) {
                throw new ApiError(
                    httpStatus.UNAUTHORIZED,
                    "User account is inactive."
                );
            }
            user.oauthId = userData.oauthId;
            user.oauthProvider = userData.oauthProvider;
            await user.save();
        } else {
            user = await userService.createUser({
                fullName: userData.fullName,
                email: userData.email,
                oauthId: userData.oauthId,
                oauthProvider: userData.oauthProvider,
                role: constants.UserRoles.USER,
                status: constants.UserStatus.Active,
            });
        }
    } else if (user.status === constants.UserStatus.Inactive) {
        throw new ApiError(httpStatus.UNAUTHORIZED, "User account is inactive.");
    }

    const authTokens = await user.generateAuthTokens(req);
    const chosenFields = {
        fullName: user.fullName,
        email: user.email,
        contactNumber: user.contactNumber,
        role: user.role,
        fullNameString: user.fullNameString,
        avatar: user?.profile?.avatar,
    };
    return { user: chosenFields, ...authTokens };
};

/**
 * Registers a new user.
 *
 * @param {Object} userDetails - The registration payload.
 * @returns {Promise<Object>} - Resolves to the registered user populated with profile.
 */
const registerUser = async (userDetails) => {
    const user = await userService.createUser(userDetails);
    return user.populate("profile");
};

/**
 * Changes user password after validating old password.
 *
 * @param {string} oldPassword - The current password.
 * @param {string} newPassword - The new password.
 * @param {string} userId - The user ID.
 */
const changeUserPassword = async (oldPassword, newPassword, userId) => {
    const user = await userService.findUserById(userId);

    if (!user) {
        throw new ApiError(httpStatus.NOT_FOUND, "User not found.");
    }

    const isPasswordCorrect = await user.isPasswordCorrect(oldPassword);

    if (!isPasswordCorrect) {
        throw new ApiError(httpStatus.UNAUTHORIZED, "Current password is incorrect.");
    }

    user.password = newPassword;
    await user.save();
};

/**
 * Refreshes auth tokens using a valid refresh token.
 * Implements token rotation by revoking the old session and generating a new token pair.
 *
 * @param {string} refreshToken - The refresh token provided in cookie or body.
 * @param {Object} req - The express request object.
 * @returns {Promise<Object>} - Resolves to the rotated access and refresh tokens.
 */
const refreshAuthTokens = async (refreshToken, req) => {
    if (!refreshToken) {
        throw new ApiError(httpStatus.UNAUTHORIZED, "Refresh token is required.");
    }

    // 1. Verify token signature and validate active session
    const { user, decoded } = await models.User.verifyRefreshToken(refreshToken);

    // 2. Revoke the old session (atomic rotation)
    await models.User.revokeSession(user._id, decoded.jti);

    // 3. Generate new token pair and record new active session
    const newTokens = await user.generateAuthTokens(req);

    return {
        ...newTokens,
        user: {
            id: user._id,
            email: user.email,
            userName: user.userName,
            fullName: user.fullName,
            role: user.role,
        },
    };
};

/**
 * Logs out a user by revoking the active session associated with the JWT.
 *
 * @param {string} userId - The user ID.
 * @param {string} token - The access token or refresh token to revoke.
 */
const logout = async (userId, token) => {
    if (!token) return;
    try {
        let tokenId = token;
        try {
            const decoded = jwt.decode(token);
            if (decoded?.jti) {
                tokenId = decoded.jti;
            }
        } catch (_) {}

        await models.User.revokeSession(userId, tokenId);
    } catch (error) {
        if (error instanceof jwt.JsonWebTokenError) {
            throw new ApiError(httpStatus.UNAUTHORIZED, "Invalid token.");
        }
        throw error;
    }
};

/**
 * Logs out user from all devices by revoking all active sessions.
 *
 * @param {string} userId - The user ID.
 */
const logoutAll = async (userId) => {
    await models.User.revokeAllSessions(userId);
};

const authService = {
    loginWithEmailAndPassword,
    verifySocialToken,
    registerUser,
    changeUserPassword,
    refreshAuthTokens,
    logout,
    logoutAll,
};

export default authService;
