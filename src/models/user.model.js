import mongoose from "mongoose";
import validator from "validator";
import plugins from "./plugins/index.js";
import ApiError from "../utils/ApiError.js";
import httpStatus from "http-status";
import constants from "../constants/index.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import config from "../config/env.config.js";
import middlewares from "../middlewares/index.js";
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

// Generate access token and add session
userSchema.methods.generateAccessToken = async function (req) {
    const tokenId = uuidv4();

    // Parse config.jwt.expiry (e.g., "2D" or numeric seconds)
    let expirySeconds;
    if (typeof config.jwt.expiry === "string") {
        console.log("expiry data: ", config.jwt.expiry);

        const match = config.jwt.expiry.match(/^(\d+)([dhm])$/); // Matches "2D", "1H", "30M"
        if (!match) {
            throw new Error(
                "Invalid JWT expiry format. Use number or format like '2D', '1H', '30M'"
            );
        }
        const value = parseInt(match[1], 10);
        const unit = match[2];
        if (unit === "d")
            expirySeconds = value * 24 * 60 * 60; // Days to seconds
        else if (unit === "h")
            expirySeconds = value * 60 * 60; // Hours to seconds
        else if (unit === "m") expirySeconds = value * 60; // Minutes to seconds
    } else {
        expirySeconds = config.jwt.expiry; // Assume numeric seconds
    }

    const expiresAt = moment().add(expirySeconds, "seconds").toDate();

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
        expiresAt,
        isActive: true,
    };

    this.sessions.push(session);
    await this.save();

    return { token, expiryTime: expiresAt.toISOString() };
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
