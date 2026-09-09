import mongoose from "mongoose";
import validator from "validator";
import plugins from "./plugins/index.js";
import middlewares from "../middlewares/index.js";
import reusableSchemas from "./reusableSchemas/index.js";

const userProfileSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: [true, "User reference is required"],
            unique: true,
        },
        bio: {
            type: String,
            trim: true,
            maxlength: [200, "Bio cannot exceed 200 characters"],
            required: false,
        },
        avatar: {
            type: reusableSchemas.avatarSchema,
            required: false,
        },
        displayName: {
            type: String,
            trim: true,
            maxlength: [50, "Display name cannot exceed 50 characters"],
            match: [
                /^[a-zA-Z0-9_-]+$/,
                "Only alphabets, numbers, -, _ are allowed in display name",
            ],
            required: false,
        },
        socialLinks: {
            twitter: {
                type: String,
                trim: true,
                validate: {
                    validator: (value) => !value || validator.isURL(value),
                    message: "Invalid Twitter URL",
                },
                required: false,
            },
            instagram: {
                type: String,
                trim: true,
                validate: {
                    validator: (value) => !value || validator.isURL(value),
                    message: "Invalid Instagram URL",
                },
                required: false,
            },
            website: {
                type: String,
                trim: true,
                validate: {
                    validator: (value) => !value || validator.isURL(value),
                    message: "Invalid website URL",
                },
                required: false,
            },
        },
        preferences: {
            type: Object,
            default: {},
        },
        isPublic: {
            type: Boolean,
            default: true,
        },
        isVerified: {
            type: Boolean,
            default: false,
        },
        isActive: {
            type: Boolean,
            default: true,
        },
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: [true, "Created by is required"],
        },
        updatedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: false,
        },
    },
    {
        timestamps: true,
        toJSON: { virtuals: true },
        toObject: { virtuals: true },
    }
);

// Virtual to check if profile is complete
userProfileSchema.virtual("isComplete").get(function () {
    return !!this.bio && !!this.avatar && !!this.displayName;
});

// Plugins
userProfileSchema.plugin(plugins.versioning);
userProfileSchema.plugin(plugins.paginate);
userProfileSchema.plugin(plugins.privatePlugin);

// Indexes for performance
userProfileSchema.index({ displayName: 1 }, { sparse: true });

// Utility method to create or update profile
userProfileSchema.statics.upsertProfile = async function (
    userId,
    profileData,
    updatedBy
) {
    const profile = await this.findOneAndUpdate(
        { user: userId },
        {
            ...profileData,
            user: userId,
            createdBy: userId,
            updatedBy: updatedBy || userId,
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    return profile;
};

// Utility method to fetch profile by user ID
userProfileSchema.statics.findByUserId = async function (userId) {
    return this.findOne({ user: userId })
        .populate("user")
        .populate("createdBy")
        .populate("updatedBy");
};

// Utility method to soft delete profile
userProfileSchema.statics.softDelete = async function (userId) {
    return this.updateOne({ user: userId }, { isActive: false });
};

// Utility method to restore profile
userProfileSchema.statics.restore = async function (userId) {
    return this.updateOne({ user: userId }, { isActive: true });
};

// Query only active records by default
userProfileSchema.pre(/^find/, function (next) {
    if (!this.getQuery().hasOwnProperty("isActive")) {
        this.where({ isActive: true });
    }
    if (typeof next === "function") next();
});

const UserProfile = mongoose.model("UserProfile", userProfileSchema);

export default UserProfile;
