import mongoose from "mongoose";
import validator from "validator";
import plugins from "./plugins/index.js";
import ApiError from "../utils/ApiError.js";
import httpStatus from "http-status";
import constants from "../constants/index.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import config from "../config/env.config.js";
import moment from "moment";
import reusableSchemas from "./reusableSchemas/index.js";
import { v4 as uuidv4 } from "uuid";
import { UAParser } from "ua-parser-js";
import getIpDetails from "../utils/getIpDetails.js";

const fullNameSchema = new mongoose.Schema({
    firstName: {
        type: String,
        required: [true, "First name is required"],
        index: true,
        trim: true,
    },
    lastName: {
        type: String,
        required: [true, "Last name is required"],
        index: true,
        trim: true,
    },
});

const sessionSchema = new mongoose.Schema({
    tokenId: {
        type: String,
        required: [true, "Token ID is required"],
    },
    deviceInfo: {
        browser: { type: String, trim: true },
        os: { type: String, trim: true },
        device: { type: String, trim: true },
    },
    ipAddress: {
        type: String,
        trim: true,
        validate: {
            validator: (value) => !value || validator.isIP(value),
            message: "Invalid IP address",
        },
    },
    loginAt: {
        type: Date,
        default: Date.now,
        required: [true, "Login timestamp is required"],
    },
    expiresAt: {
        type: Date,
        required: [true, "Expiration timestamp is required"],
    },
    isActive: {
        type: Boolean,
        default: true,
    },
    _id: false,
});

const userSchema = new mongoose.Schema(
    {
        fullName: {
            type: fullNameSchema,
            required: [true, "fullName is required"],
        },
        email: {
            type: String,
            required: [true, "Email is required field"],
            index: true,
            trim: true,
            lowercase: true,
            validate(value) {
                if (
                    !validator.isEmail(value, { allow_utf8_local_part: false })
                ) {
                    throw new ApiError(httpStatus.BAD_REQUEST, "Invalid Email");
                }
            },
        },
        userName: {
            type: String,
            required: false,
            index: true,
            trim: true,
            lowercase: true,
            match: [
                /^[a-z0-9_-]+$/,
                "Only lowercase alphabets, numbers, -, _ are allowed in user name",
            ],
        },
        contactNumber: {
            type: reusableSchemas.contactNumberSchema,
            required: false,
        },
        password: {
            type: String,
            required: false,
            trim: true,
            minlength: 8,
            private: true,
        },
        oauthProvider: {
            type: String,
            enum: ["google", "facebook", "twitter"],
            required: false,
        },
        oauthId: {
            type: String,
            required: false,
            index: true,
        },
        role: {
            type: String,
            enum: Object.values(constants.UserRoles),
            default: constants.UserRoles.USER,
        },
        status: {
            type: String,
            enum: Object.values(constants.UserStatus),
            default: constants.UserStatus.Active,
        },
        profile: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "UserProfile",
            required: false,
            index: true,
        },
        sessions: { type: [sessionSchema], required: false },

        // Threat mitigation & Brute-force Lockout tracking
        failedLoginAttempts: {
            type: Number,
            default: 0,
            index: true,
        },
        lockUntil: {
            type: Date,
            default: null,
            index: true,
        },
        lastFailedLoginAt: {
            type: Date,
            default: null,
        },
        lastFailedLoginIp: {
            type: String,
            default: null,
        },

        // Self-service account unlock token
        unlockAccountToken: {
            type: String,
            default: null,
            index: true,
        },
        unlockAccountTokenExpiresAt: {
            type: Date,
            default: null,
        },
        lastUnlockEmailSentAt: {
            type: Date,
            default: null,
        },

        // Password reset token
        passwordResetToken: {
            type: String,
            default: null,
            index: true,
        },
        passwordResetTokenExpiresAt: {
            type: Date,
            default: null,
        },
        lastPasswordResetEmailSentAt: {
            type: Date,
            default: null,
        },

        // Two-Factor Authentication (2FA / TOTP)
        twoFactorEnabled: {
            type: Boolean,
            default: false,
        },
        twoFactorSecret: {
            type: String,
            select: false,
            default: null,
        },
        twoFactorRecoveryCodes: [
            {
                code: { type: String, required: true },
                used: { type: Boolean, default: false },
            },
        ],
    },
    {
        timestamps: true,
        toJSON: { virtuals: true },
        toObject: { virtuals: true },
    }
);

// Virtual for full name string
userSchema.virtual("fullNameString").get(function () {
    return `${this.fullName?.firstName} ${this.fullName?.lastName}`;
});

userSchema.plugin(plugins.paginate);
userSchema.plugin(plugins.privatePlugin);

// Helper to parse human-readable durations like '15m', '2d', '7d', or numeric seconds
const parseDurationSeconds = (durationStr, defaultSecs = 900) => {
    if (!durationStr) return defaultSecs;
    if (typeof durationStr === "number") return durationStr;
    const match = durationStr.toString().trim().match(/^(\d+)([smhd])$/i);
    if (!match) return defaultSecs;
    const value = parseInt(match[1], 10);
    const unit = match[2].toLowerCase();
    if (unit === "s") return value;
    if (unit === "m") return value * 60;
    if (unit === "h") return value * 3600;
    if (unit === "d") return value * 86400;
    return defaultSecs;
};

// Check if email is taken
userSchema.statics.isEmailTaken = async function (email, excludeUserId) {
    const user = await this.findOne({
        email,
        _id: { $ne: excludeUserId },
    });
    return !!user;
};

// Check if userName is taken
userSchema.statics.isUserNameTaken = async function (userName, excludeUserId) {
    const user = await this.findOne({
        userName,
        _id: { $ne: excludeUserId },
    });
    return !!user;
};

// Check if password is correct
userSchema.methods.isPasswordCorrect = async function (password) {
    return await bcrypt.compare(password, this.password);
};

// Check if user account is currently locked
userSchema.methods.isLocked = function () {
    return Boolean(this.lockUntil && new Date(this.lockUntil).getTime() > Date.now());
};

// Self-service account unlock helper
userSchema.methods.unlockAccount = async function () {
    this.failedLoginAttempts = 0;
    this.lockUntil = null;
    this.unlockAccountToken = null;
    this.unlockAccountTokenExpiresAt = null;
    this.lastUnlockEmailSentAt = null;
    return this.save();
};

// Generate access & refresh tokens and persist session
userSchema.methods.generateAccessToken = async function (req) {
    const tokenId = uuidv4();

    // Short-lived access token expiration (e.g. 15m)
    const accessExpirySecs = parseDurationSeconds(config.jwt.expiry, 15 * 60);
    const accessExpiresAt = moment().add(accessExpirySecs, "seconds").toDate();

    // Long-lived session / refresh token expiration (e.g. 7d)
    const refreshExpirySecs = parseDurationSeconds(config.jwt.refreshExpiry, 7 * 86400);
    const sessionExpiresAt = moment().add(refreshExpirySecs, "seconds").toDate();

    const token = jwt.sign(
        {
            id: this._id,
            userName: this.userName,
            email: this.email,
            fullName: this.fullName,
            role: this.role,
            jti: tokenId,
        },
        config.jwt.secret,
        { expiresIn: config.jwt.expiry }
    );

    const refreshToken = jwt.sign(
        {
            id: this._id,
            jti: tokenId,
            type: "refresh",
        },
        config.jwt.refreshSecret || config.jwt.secret,
        { expiresIn: config.jwt.refreshExpiry || "7d" }
    );

    let deviceInfo = {};
    try {
        const parser = new UAParser(req.headers["user-agent"] || "");
        const ua = parser.getResult();
        deviceInfo = {
            browser: ua.browser.name,
            os: ua.os.name,
            device: ua.device.type || "desktop",
        };
    } catch (error) {
        console.error("Failed to parse User-Agent:", error);
    }

    const session = {
        tokenId,
        deviceInfo,
        ipAddress: getIpDetails(req).clientIp,
        loginAt: new Date(),
        expiresAt: sessionExpiresAt,
        isActive: true,
    };

    this.sessions.push(session);
    await this.save();

    return {
        token,
        accessToken: token,
        refreshToken,
        expiryTime: accessExpiresAt.toISOString(),
        refreshExpiryTime: sessionExpiresAt.toISOString(),
    };
};

// Revoke a session
userSchema.statics.revokeSession = async function (userId, tokenId) {
    return this.updateOne(
        { _id: userId },
        { $pull: { sessions: { tokenId, isActive: true } } }
    );
};

// List active sessions
userSchema.statics.getActiveSessions = async function (userId) {
    const user = await this.findById(userId).select("sessions");
    if (!user) throw new ApiError(httpStatus.NOT_FOUND, "User not found");
    return user.sessions.filter(
        (session) => session.isActive && session.expiresAt > new Date()
    );
};

// Clean up expired sessions
userSchema.pre(/^find/, async function () {
    if (this.getQuery()._id) {
        await this.model.updateOne(
            { _id: this.getQuery()._id },
            { $pull: { sessions: { expiresAt: { $lt: new Date() } } } }
        );
    }
});

// Pre-save hook for registration token
userSchema.pre("save", function () {
    if (this._isRollbackOperation || !this.isNew) {
        return;
    }
    const token = jwt.sign(
        {
            id: this._id,
            userName: this.userName,
            email: this.email,
            fullName: this.fullName,
        },
        config.jwt.secret
    );
    this.registrationToken = bcrypt.hashSync(token, 10);
});

// Pre-save hook for password hashing
userSchema.pre("save", function () {
    // 1. Bypass completely if this save is an explicit rollback / restore operation
    if (this._isRollbackOperation) return;

    if (!this.isModified("password") || !this.password) return;

    // 2. Prevent double-hashing if password is already a valid bcrypt hash ($2a$, $2b$, $2y$)
    if (/^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/.test(this.password)) {
        return;
    }

    this.password = bcrypt.hashSync(this.password, 10);
});

userSchema.plugin(plugins.versioning);

const User = mongoose.model("User", userSchema);
export default User;
