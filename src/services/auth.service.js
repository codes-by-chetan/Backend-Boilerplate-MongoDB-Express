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
 * Authenticates a user using email/username and password.
 *
 * @param {Object} req - The express request object containing credentials in req.body.
 * @returns {Promise<Object>} - Resolves to the access token and session metadata.
 */
const loginWithEmailAndPassword = async (req) => {
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

    const token = await user.generateAccessToken(req);
    return token;
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

    const authTokens = await user.generateAccessToken(req);
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
 * Logs out a user by revoking the active session associated with the JWT.
 *
 * @param {string} userId - The user ID.
 * @param {string} token - The access token to revoke.
 */
const logout = async (userId, token) => {
    try {
        const decoded = jwt.verify(token, config.jwt.secret);
        const tokenId = decoded.jti;

        const result = await models.User.revokeSession(userId, tokenId);
        if (result.modifiedCount === 0) {
            throw new ApiError(
                httpStatus.BAD_REQUEST,
                "Session not found or already revoked."
            );
        }
    } catch (error) {
        if (error instanceof jwt.JsonWebTokenError) {
            throw new ApiError(httpStatus.UNAUTHORIZED, "Invalid token.");
        }
        throw error;
    }
};

const authService = {
    loginWithEmailAndPassword,
    verifySocialToken,
    registerUser,
    changeUserPassword,
    logout,
};

export default authService;
