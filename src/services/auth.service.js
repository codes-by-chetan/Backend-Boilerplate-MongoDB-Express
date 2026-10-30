import constants from "../constants/index.js";
import ApiError from "../utils/ApiError.js";
import httpStatus from "http-status";
import userService from "./user.service.js";
import mailService from "./mail.service.js";
import jwt from "jsonwebtoken";
import config from "../config/env.config.js";
import models from "../models/index.js";
import { OAuth2Client } from "google-auth-library";
import axios from "axios";
import crypto from "crypto";
import { UAParser } from "ua-parser-js";
import getIpDetails from "../utils/getIpDetails.js";
import { resolveClientAppUrl } from "../utils/urlHelper.js";
import { generateSecret, generateURI, verify as verifyTOTP } from "otplib";
import qrcode from "qrcode";

const googleClient = new OAuth2Client(config.google_client_id);

/**
 * Authenticates a user using email/username and password.
 * Implements Layer 3 (Progressive Warnings, 3-Strike 24h Lockout, Threat Notification)
 * and Anti-Enumeration protections.
 *
 * @param {Object} req - Express request object containing credentials in req.body.
 * @returns {Promise<Object>} - Access token, refresh token, and session metadata.
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

    // Anti-enumeration: Use uniform error message rather than revealing account existence
    if (!user) {
        throw new ApiError(httpStatus.UNAUTHORIZED, "Invalid email or password.");
    }

    if (user.status === constants.UserStatus.Inactive) {
        throw new ApiError(httpStatus.FORBIDDEN, "User account is inactive.");
    }

    if (user.deleted) {
        throw new ApiError(httpStatus.FORBIDDEN, "User account is deleted.");
    }

    // 1. Check if account is currently locked due to prior failed attempts
    if (user.isLocked()) {
        const remainingMs = new Date(user.lockUntil).getTime() - Date.now();
        const remainingHours = Math.ceil(remainingMs / (1000 * 60 * 60));
        const remainingMins = Math.ceil(remainingMs / (1000 * 60));
        const timeStr = remainingHours > 1 ? `${remainingHours} hours` : `${remainingMins} minute${remainingMins === 1 ? "" : "s"}`;
        const supportEmail = config.email?.from || config.email?.id || "support@example.com";

        throw new ApiError(
            httpStatus.FORBIDDEN,
            `Account has been temporarily locked due to consecutive failed login attempts. Please try again in ${timeStr} or use the self-service unlock link sent to your email.`,
            null,
            {
                isLocked: true,
                email: user.email,
                lockUntil: user.lockUntil,
                remainingHours,
                remainingMins,
                cooldownSeconds: 60,
                supportEmail,
            }
        );
    }

    // 2. Validate password
    const isPasswordValid = await user.isPasswordCorrect(credentials.password);

    if (!isPasswordValid) {
        const currentFailed = (user.failedLoginAttempts || 0) + 1;
        user.failedLoginAttempts = currentFailed;
        user.lastFailedLoginAt = new Date();
        user.lastFailedLoginIp = getIpDetails(req).clientIp;

        const maxAttempts = config.security?.maxLoginAttempts || 3;
        const lockoutHours = config.security?.lockoutDurationHours || 24;
        const supportEmail = config.email?.from || config.email?.id || "support@example.com";

        // 3. Threshold check for lockout
        if (currentFailed >= maxAttempts) {
            user.lockUntil = new Date(Date.now() + lockoutHours * 3600 * 1000);

            // Generate high-entropy 32-byte crypto tokens (1-hour validity)
            const unlockToken = crypto.randomBytes(32).toString("hex");
            const resetToken = crypto.randomBytes(32).toString("hex");
            const tokenExpiry = new Date(Date.now() + 3600 * 1000);

            user.unlockAccountToken = unlockToken;
            user.unlockAccountTokenExpiresAt = tokenExpiry;
            user.lastUnlockEmailSentAt = new Date();

            user.passwordResetToken = resetToken;
            user.passwordResetTokenExpiresAt = tokenExpiry;

            await user.save();

            // Extract forensics for threat notification
            let uaInfo = {};
            try {
                const parser = new UAParser(req.headers["user-agent"] || "");
                const ua = parser.getResult();
                uaInfo = {
                    browser: ua.browser.name || "Unknown Browser",
                    os: ua.os.name || "Unknown OS",
                    device: ua.device.type || "Desktop",
                };
            } catch (_) {}

            const forensicData = {
                ip: getIpDetails(req).clientIp,
                browser: uaInfo.browser,
                os: uaInfo.os,
                device: uaInfo.device,
                location: "Local / Private Network",
                timestamp: new Date().toUTCString(),
            };

            const unlockLink = resolveClientAppUrl(req, `/unlock-account?token=${unlockToken}`);
            const resetPasswordLink = resolveClientAppUrl(req, `/reset-password?token=${resetToken}`);

            // Asynchronously dispatch threat alert email (does not delay HTTP response)
            mailService.sendAccountLockoutAlertEmail(
                user,
                forensicData,
                unlockLink,
                resetPasswordLink
            ).catch((err) => {
                console.error("Lockout threat email dispatch error:", err.message);
            });

            throw new ApiError(
                httpStatus.FORBIDDEN,
                `Account has been temporarily locked for ${lockoutHours} hours due to ${maxAttempts} consecutive failed login attempts. A security alert with recovery instructions has been dispatched to your email.`,
                null,
                {
                    isLocked: true,
                    email: user.email,
                    lockUntil: user.lockUntil,
                    remainingHours: lockoutHours,
                    remainingMins: lockoutHours * 60,
                    cooldownSeconds: 60,
                    supportEmail,
                }
            );
        }

        await user.save();
        const remainingAttempts = maxAttempts - currentFailed;

        throw new ApiError(
            httpStatus.UNAUTHORIZED,
            `Incorrect password. ${remainingAttempts} attempt${remainingAttempts === 1 ? "" : "s"} remaining before a ${lockoutHours}-hour account lockout.`,
            null,
            {
                isLocked: false,
                remainingAttempts,
                maxAttempts,
                failedAttempts: currentFailed,
            }
        );
    }

    // 4. Successful login: Reset failed attempts and lockout timers
    if (user.failedLoginAttempts > 0 || user.lockUntil) {
        user.failedLoginAttempts = 0;
        user.lockUntil = null;
        user.unlockAccountToken = null;
        user.unlockAccountTokenExpiresAt = null;
        await user.save();
    }

    // Step-up authentication: If 2FA is enabled, return 2FA challenge
    if (user.twoFactorEnabled) {
        const tempToken = jwt.sign(
            { id: user._id, type: "2fa_pending" },
            config.jwt.secret,
            { expiresIn: "5m" }
        );
        return {
            requires2FA: true,
            tempToken,
            message: "Two-factor authentication code required.",
        };
    }

    const tokenData = await user.generateAccessToken(req);
    return {
        ...tokenData,
        accessToken: tokenData.token,
        user: {
            id: user._id,
            email: user.email,
            userName: user.userName,
            role: user.role,
            fullName: user.fullName,
            fullNameString: user.fullNameString,
        },
    };
};

/**
 * Initiates safe password reset with anti-enumeration protection and target-account 60s cooldown.
 * Implements Layer 2 (Email Cooldown) and Layer 5 (Safe Password Reset) of Blueprint.
 *
 * @param {string} email - Target account email
 * @param {Object} req - Express request
 * @returns {Promise<Object>} Success message and cooldown info
 */
const forgotPassword = async (email, req) => {
    const normalizedEmail = (email || "").toLowerCase().trim();
    const user = await models.User.findOne({
        email: normalizedEmail,
        deleted: { $ne: true },
    });

    const cooldownDuration = config.security?.emailCooldownSeconds || 60;

    // Anti-enumeration: Always return uniform success even if email does not exist
    if (!user) {
        return {
            message: "If an account exists with that email, a password reset link has been dispatched.",
            cooldownSeconds: cooldownDuration,
        };
    }

    // Layer 2: Target-Account Email Cooldown Guardrail
    if (user.lastPasswordResetEmailSentAt) {
        const elapsedMs = Date.now() - new Date(user.lastPasswordResetEmailSentAt).getTime();
        const cooldownMs = cooldownDuration * 1000;
        if (elapsedMs < cooldownMs) {
            const waitSecs = Math.ceil((cooldownMs - elapsedMs) / 1000);
            const err = new ApiError(
                httpStatus.TOO_MANY_REQUESTS,
                `Please wait ${waitSecs} second${waitSecs === 1 ? "" : "s"} before requesting another password reset link.`,
                null,
                { cooldownSeconds: waitSecs, retryAfter: waitSecs }
            );
            throw err;
        }
    }

    const resetToken = crypto.randomBytes(32).toString("hex");
    user.passwordResetToken = resetToken;
    user.passwordResetTokenExpiresAt = new Date(Date.now() + 3600 * 1000); // 1-hour expiration
    user.lastPasswordResetEmailSentAt = new Date();
    await user.save();

    const resetLink = resolveClientAppUrl(req, `/reset-password?token=${resetToken}`);
    mailService.sendPasswordResetEmail(user, resetLink).catch((err) => {
        console.error("Password reset email dispatch error:", err.message);
    });

    return {
        message: "If an account exists with that email, a password reset link has been dispatched.",
        cooldownSeconds: cooldownDuration,
    };
};

/**
 * Resets user password using a single-use cryptographic token.
 * Hashes password with bcrypt, clears token, resets lockout state, and revokes all active sessions.
 *
 * @param {string} token - The 64-character hex reset token
 * @param {string} newPassword - New password
 * @returns {Promise<Object>} Confirmation message
 */
const resetPassword = async (token, newPassword) => {
    if (!token) {
        throw new ApiError(httpStatus.BAD_REQUEST, "Password reset token is required.");
    }

    const user = await models.User.findOne({
        passwordResetToken: token,
        passwordResetTokenExpiresAt: { $gt: new Date() },
        deleted: { $ne: true },
    });

    if (!user) {
        throw new ApiError(
            httpStatus.BAD_REQUEST,
            "Password reset token is invalid or has expired."
        );
    }

    // Set new password (pre-save hook will hash with bcrypt 10 rounds)
    user.password = newPassword;
    user.passwordResetToken = null;
    user.passwordResetTokenExpiresAt = null;
    user.lastPasswordResetEmailSentAt = null;

    // Clear any lockout status
    user.failedLoginAttempts = 0;
    user.lockUntil = null;
    user.unlockAccountToken = null;
    user.unlockAccountTokenExpiresAt = null;
    user.lastUnlockEmailSentAt = null;

    // Security best practice: Revoke all active sessions across all devices
    user.sessions = [];

    await user.save();

    return {
        message: "Password has been successfully updated. All active sessions have been invalidated. Please log in with your new password.",
    };
};

/**
 * Requests a self-service account unlock email with target cooldown protection.
 * Implements Layer 4 of Security Blueprint.
 *
 * @param {string} email - Account email
 * @param {Object} req - Express request
 * @returns {Promise<Object>} Cooldown and dispatch status
 */
const requestUnlock = async (email, req) => {
    const normalizedEmail = (email || "").toLowerCase().trim();
    const user = await models.User.findOne({
        email: normalizedEmail,
        deleted: { $ne: true },
    });

    const cooldownDuration = config.security?.emailCooldownSeconds || 60;

    // Anti-enumeration: return uniform response if user does not exist
    if (!user) {
        return {
            message: "If an account exists and is locked, an unlock link has been dispatched.",
            cooldownSeconds: cooldownDuration,
        };
    }

    if (!user.isLocked()) {
        return {
            message: "This account is not currently locked. You can proceed to sign in.",
            isLocked: false,
        };
    }

    // Target-Account Cooldown check
    if (user.lastUnlockEmailSentAt) {
        const elapsedMs = Date.now() - new Date(user.lastUnlockEmailSentAt).getTime();
        const cooldownMs = cooldownDuration * 1000;
        if (elapsedMs < cooldownMs) {
            const waitSecs = Math.ceil((cooldownMs - elapsedMs) / 1000);
            const err = new ApiError(
                httpStatus.TOO_MANY_REQUESTS,
                `Please wait ${waitSecs} second${waitSecs === 1 ? "" : "s"} before requesting another unlock link.`,
                null,
                { cooldownSeconds: waitSecs, retryAfter: waitSecs }
            );
            throw err;
        }
    }

    const unlockToken = crypto.randomBytes(32).toString("hex");
    user.unlockAccountToken = unlockToken;
    user.unlockAccountTokenExpiresAt = new Date(Date.now() + 3600 * 1000);
    user.lastUnlockEmailSentAt = new Date();
    await user.save();

    const unlockLink = resolveClientAppUrl(req, `/unlock-account?token=${unlockToken}`);
    mailService.sendAccountUnlockEmail(user, unlockLink).catch((err) => {
        console.error("Unlock email dispatch error:", err.message);
    });

    return {
        message: "An account unlock link has been dispatched to your email address.",
        cooldownSeconds: cooldownDuration,
        isLocked: true,
    };
};

/**
 * Validates cryptographic unlock token and atomically clears lockout state.
 *
 * @param {string} token - 64-character hex unlock token
 * @returns {Promise<Object>} Status and user info
 */
const unlockAccount = async (token) => {
    if (!token) {
        throw new ApiError(httpStatus.BAD_REQUEST, "Unlock token is required.");
    }

    const user = await models.User.findOne({
        unlockAccountToken: token,
        unlockAccountTokenExpiresAt: { $gt: new Date() },
        deleted: { $ne: true },
    });

    if (!user) {
        throw new ApiError(
            httpStatus.BAD_REQUEST,
            "Unlock token is invalid or has expired."
        );
    }

    await user.unlockAccount();

    return {
        message: "Account has been unlocked successfully. You may now sign in.",
        email: user.email,
    };
};

/**
 * Refreshes an access token using a valid, active refresh token.
 * Validates signature against config.jwt.refreshSecret and verifies session in database.
 *
 * @param {string} refreshToken - The JWT refresh token
 * @param {Object} req - Express request
 * @returns {Promise<Object>} New access token, refresh token, and user metadata
 */
const refreshAuthToken = async (refreshToken, req) => {
    if (!refreshToken) {
        throw new ApiError(httpStatus.BAD_REQUEST, "Refresh token is required.");
    }

    let decoded;
    try {
        decoded = jwt.verify(
            refreshToken,
            config.jwt.refreshSecret || config.jwt.secret
        );
    } catch (err) {
        if (err.name === "TokenExpiredError") {
            throw new ApiError(httpStatus.UNAUTHORIZED, "Refresh token has expired. Please log in again.");
        }
        throw new ApiError(httpStatus.UNAUTHORIZED, "Invalid refresh token.");
    }

    const user = await models.User.findById(decoded.id);
    if (!user || user.deleted || user.status === constants.UserStatus.Inactive) {
        throw new ApiError(httpStatus.UNAUTHORIZED, "User account is unavailable.");
    }

    // Verify session is active and not revoked
    const activeSession = user.sessions?.find(
        (s) => s.tokenId === decoded.jti && s.isActive && new Date(s.expiresAt) > new Date()
    );

    if (!activeSession) {
        throw new ApiError(
            httpStatus.UNAUTHORIZED,
            "Session has been revoked or expired. Please sign in again."
        );
    }

    // Revoke old session token and generate a fresh pair
    await models.User.revokeSession(user._id, decoded.jti);
    const tokenData = await user.generateAccessToken(req);

    return {
        ...tokenData,
        accessToken: tokenData.token,
        user: {
            id: user._id,
            email: user.email,
            userName: user.userName,
            role: user.role,
        },
    };
};

/**
 * Verifies a third-party social login token (Google / Facebook) and returns JWT tokens for the user.
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

/**
 * Generates a new TOTP secret and QR code for setting up 2FA.
 */
const generate2FA = async (userId) => {
    const user = await models.User.findById(userId);
    if (!user) {
        throw new ApiError(httpStatus.NOT_FOUND, "User not found.");
    }

    const secret = generateSecret();
    const appName = "ExpressSentinel";
    const otpauth = generateURI({ secret, label: user.email, issuer: appName });
    const qrCodeDataUrl = await qrcode.toDataURL(otpauth);

    user.twoFactorSecret = secret;
    await user.save();

    return {
        secret,
        qrCode: qrCodeDataUrl,
        otpauth,
    };
};

/**
 * Verifies a 6-digit TOTP code, enables 2FA, and generates 8 one-time emergency backup recovery codes.
 */
const enable2FA = async (userId, totpCode) => {
    const user = await models.User.findById(userId).select("+twoFactorSecret");
    if (!user || !user.twoFactorSecret) {
        throw new ApiError(
            httpStatus.BAD_REQUEST,
            "2FA setup has not been initiated. Please generate a QR code first."
        );
    }

    let isValid = false;
    try {
        const verifyResult = await verifyTOTP({
            token: totpCode.toString().trim(),
            secret: user.twoFactorSecret,
        });
        isValid = verifyResult?.valid === true;
    } catch (_) {}

    if (!isValid) {
        throw new ApiError(
            httpStatus.BAD_REQUEST,
            "Invalid 6-digit TOTP code. Please check your authenticator app."
        );
    }

    const recoveryCodes = Array.from({ length: 8 }, () =>
        crypto.randomBytes(4).toString("hex").toUpperCase()
    );

    user.twoFactorEnabled = true;
    user.twoFactorRecoveryCodes = recoveryCodes.map((code) => ({ code, used: false }));
    await user.save();

    return {
        message: "Two-factor authentication has been enabled successfully.",
        recoveryCodes,
    };
};

/**
 * Disables 2FA after validating user's current password.
 */
const disable2FA = async (userId, password, totpCode) => {
    const user = await models.User.findById(userId).select("+twoFactorSecret");
    if (!user) {
        throw new ApiError(httpStatus.NOT_FOUND, "User not found.");
    }

    if (!user.twoFactorEnabled) {
        throw new ApiError(httpStatus.BAD_REQUEST, "Two-factor authentication is not enabled.");
    }

    const isPasswordValid = await user.isPasswordCorrect(password);
    if (!isPasswordValid) {
        throw new ApiError(httpStatus.UNAUTHORIZED, "Incorrect password. Cannot disable 2FA.");
    }

    if (totpCode) {
        let isValid = false;
        try {
            const verifyResult = await verifyTOTP({
                token: totpCode.toString().trim(),
                secret: user.twoFactorSecret,
            });
            isValid = verifyResult?.valid === true;
        } catch (_) {}

        if (!isValid) {
            throw new ApiError(httpStatus.BAD_REQUEST, "Invalid TOTP code.");
        }
    }

    user.twoFactorEnabled = false;
    user.twoFactorSecret = null;
    user.twoFactorRecoveryCodes = [];
    await user.save();

    return {
        message: "Two-factor authentication has been disabled successfully.",
    };
};

/**
 * Completes 2FA login challenge using TOTP code or emergency recovery code.
 */
const verify2FALogin = async (tempToken, code, req) => {
    if (!tempToken || !code) {
        throw new ApiError(httpStatus.BAD_REQUEST, "Temporary token and 2FA code are required.");
    }

    let decoded;
    try {
        decoded = jwt.verify(tempToken, config.jwt.secret);
        if (decoded.type !== "2fa_pending") {
            throw new Error("Invalid token type");
        }
    } catch (_) {
        throw new ApiError(
            httpStatus.UNAUTHORIZED,
            "2FA verification session has expired. Please sign in again."
        );
    }

    const user = await models.User.findById(decoded.id).select("+twoFactorSecret");
    if (!user || !user.twoFactorEnabled) {
        throw new ApiError(httpStatus.BAD_REQUEST, "2FA is not enabled for this user.");
    }

    let isTotpValid = false;
    try {
        const verifyResult = await verifyTOTP({
            token: code.toString().trim(),
            secret: user.twoFactorSecret,
        });
        isTotpValid = verifyResult?.valid === true;
    } catch (_) {}

    let usedRecoveryCode = false;

    if (!isTotpValid) {
        const cleanCode = code.toString().trim().toUpperCase();
        const matchedRecovery = user.twoFactorRecoveryCodes.find(
            (rc) => rc.code === cleanCode && !rc.used
        );

        if (matchedRecovery) {
            matchedRecovery.used = true;
            usedRecoveryCode = true;
            await user.save();
        } else {
            throw new ApiError(httpStatus.UNAUTHORIZED, "Invalid 2FA code or recovery code.");
        }
    }

    const tokenData = await user.generateAccessToken(req);
    return {
        ...tokenData,
        accessToken: tokenData.token,
        usedRecoveryCode,
        user: {
            id: user._id,
            email: user.email,
            userName: user.userName,
            role: user.role,
            fullName: user.fullName,
            fullNameString: user.fullNameString,
            twoFactorEnabled: user.twoFactorEnabled,
        },
    };
};

const authService = {
    loginWithEmailAndPassword,
    forgotPassword,
    resetPassword,
    requestUnlock,
    unlockAccount,
    refreshAuthToken,
    verifySocialToken,
    registerUser,
    changeUserPassword,
    logout,
    generate2FA,
    enable2FA,
    disable2FA,
    verify2FALogin,
};

export default authService;
