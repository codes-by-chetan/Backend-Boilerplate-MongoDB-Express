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
import { isBcryptHash } from "../utils/diff.util.js";

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
    refreshToken: {
        type: String,
        required: false,
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

// Indexes for performance
// userSchema.index({ "sessions.tokenId": 1 }, { unique: true, sparse: true });

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

const parseDurationToSeconds = (duration, defaultSeconds = 900) => {
    if (typeof duration === "number") return duration;
    if (typeof duration !== "string") return defaultSeconds;
    const match = duration.toLowerCase().match(/^(\d+)([smhd])$/);
    if (!match) return defaultSeconds;
    const val = parseInt(match[1], 10);
    const unit = match[2];
    if (unit === "s") return val;
    if (unit === "m") return val * 60;
    if (unit === "h") return val * 3600;
    if (unit === "d") return val * 86400;
    return defaultSeconds;
};

// Generate Access & Refresh token pair and persist session
userSchema.methods.generateAuthTokens = async function (req) {
    const tokenId = uuidv4();

    const accessExpirySeconds = parseDurationToSeconds(config.jwt.expiry, 900); // 15m default
    const refreshExpirySeconds = parseDurationToSeconds(config.jwt.refreshExpiry, 7 * 86400); // 7d default

    const accessTokenExpiresAt = moment().add(accessExpirySeconds, "seconds").toDate();
    const refreshTokenExpiresAt = moment().add(refreshExpirySeconds, "seconds").toDate();

    const accessToken = jwt.sign(
        {
            id: this._id,
            userName: this.userName,
            email: this.email,
            fullName: this.fullName,
            role: this.role,
            jti: tokenId,
            type: "access",
        },
        config.jwt.secret,
        { expiresIn: config.jwt.expiry || "15m" }
    );

    const refreshToken = jwt.sign(
        {
            id: this._id,
            jti: tokenId,
            type: "refresh",
        },
        config.jwt.refreshSecret,
        { expiresIn: config.jwt.refreshExpiry || "7d" }
    );

    let deviceInfo = {};
    if (req?.headers) {
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
    }

    const session = {
        tokenId,
        refreshToken,
        deviceInfo,
        ipAddress: req ? getIpDetails(req).clientIp : null,
        loginAt: new Date(),
        expiresAt: refreshTokenExpiresAt,
        isActive: true,
    };

    this.sessions.push(session);
    await this.save();

    return {
        accessToken,
        refreshToken,
        token: accessToken, // backwards compatibility
        accessTokenExpiryTime: accessTokenExpiresAt.toISOString(),
        refreshTokenExpiryTime: refreshTokenExpiresAt.toISOString(),
    };
};

// Backwards compatibility for generateAccessToken
userSchema.methods.generateAccessToken = async function (req) {
    return this.generateAuthTokens(req);
};

// Verify refresh token and validate against active sessions
userSchema.statics.verifyRefreshToken = async function (refreshToken) {
    let decoded;
    try {
        decoded = jwt.verify(refreshToken, config.jwt.refreshSecret);
    } catch (err) {
        if (err.message === "jwt expired") {
            throw new ApiError(httpStatus.UNAUTHORIZED, "Refresh token expired. Please log in again.");
        }
        throw new ApiError(httpStatus.UNAUTHORIZED, "Invalid refresh token.");
    }

    if (decoded.type && decoded.type !== "refresh") {
        throw new ApiError(httpStatus.UNAUTHORIZED, "Invalid token type for refresh.");
    }

    const user = await this.findById(decoded.id);
    if (!user) {
        throw new ApiError(httpStatus.NOT_FOUND, "User not found.");
    }
    if (user.status === constants.UserStatus.Inactive) {
        throw new ApiError(httpStatus.FORBIDDEN, "User account is inactive.");
    }
    if (user.deleted) {
        throw new ApiError(httpStatus.FORBIDDEN, "User account has been deleted.");
    }

    // Find the matching active session
    const session = user.sessions.find(
        (s) => s.tokenId === decoded.jti && s.isActive && s.expiresAt > new Date()
    );

    if (!session) {
        throw new ApiError(httpStatus.UNAUTHORIZED, "Session expired or revoked. Please log in again.");
    }

    return { user, session, decoded };
};

// Revoke a session
userSchema.statics.revokeSession = async function (userId, tokenIdOrToken) {
    return this.updateOne(
        { _id: userId },
        {
            $pull: {
                sessions: {
                    $or: [{ tokenId: tokenIdOrToken }, { refreshToken: tokenIdOrToken }],
                },
            },
        }
    );
};

// Revoke all sessions for a user
userSchema.statics.revokeAllSessions = async function (userId) {
    return this.updateOne(
        { _id: userId },
        { $set: { sessions: [] } }
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
    if (this._isRollbackOperation || this.$locals?.isRollback || !this.isNew) {
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
    if (this._isRollbackOperation || this.$locals?.isRollback) return;

    if (!this.isModified("password") || !this.password) return;

    // 2. Prevent double-hashing if password is already a valid bcrypt hash ($2a$, $2b$, $2y$)
    if (isBcryptHash(this.password)) {
        return;
    }

    this.password = bcrypt.hashSync(this.password, 10);
});

userSchema.plugin(plugins.versioning, {
    excludeFieldsOnRollback: ["password", "registrationToken"],
});

const User = mongoose.model("User", userSchema);
export default User;
