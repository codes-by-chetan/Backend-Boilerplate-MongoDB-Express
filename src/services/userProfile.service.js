import models from "../models/index.js";
import ApiError from "../utils/ApiError.js";
import httpStatus from "http-status";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import userService from "./user.service.js";

/**
 * Upload and update user avatar via Cloudinary.
 *
 * @param {Object} req - Express request containing multer file
 * @returns {Promise<Object>} The updated avatar object
 */
const updateAvatar = async (req) => {
    const avatarLocalPath = req.files?.avatar?.[0]?.path;

    if (!avatarLocalPath) {
        throw new ApiError(httpStatus.BAD_REQUEST, "Avatar file is required.");
    }

    const avatar = await uploadOnCloudinary(avatarLocalPath, "avatars");

    const userProfile = await models.UserProfile.findOne({
        user: req.user._id,
    });
    if (!userProfile) {
        throw new ApiError(httpStatus.NOT_FOUND, "User profile not found.");
    }

    userProfile.avatar = { url: avatar.url, publicId: avatar.public_id };
    userProfile.updatedBy = req.user._id;
    await userProfile.save();

    return userProfile.avatar;
};

/**
 * Get profile by user ID.
 *
 * @param {string} userId
 * @returns {Promise<Object>}
 */
const getUserProfile = async (userId) => {
    const userProfile = await models.UserProfile.findByUserId(userId);
    if (!userProfile) {
        throw new ApiError(httpStatus.NOT_FOUND, "User profile not found.");
    }
    return userProfile;
};

/**
 * View another user's public profile.
 *
 * @param {Object} req - Express request
 * @returns {Promise<Object>}
 */
const viewOtherUserProfile = async (req) => {
    const viewer = req.user;
    const profileOwnerId = req.params.userId;

    if (viewer?._id?.toString() === profileOwnerId) {
        return userService.getUserProfileDetails(viewer);
    }

    const user = await userService.findUserById(profileOwnerId);
    if (!user) {
        throw new ApiError(httpStatus.NOT_FOUND, "User not found.");
    }

    const userProfile = await models.UserProfile.findByUserId(profileOwnerId);
    if (!userProfile) {
        throw new ApiError(httpStatus.NOT_FOUND, "User profile not found.");
    }

    if (!userProfile.isPublic && viewer?.role !== "admin") {
        return {
            id: user._id,
            fullNameString: user.fullNameString,
            displayName: userProfile.displayName,
            avatar: userProfile.avatar,
            isPublic: false,
        };
    }

    return {
        id: user._id,
        fullName: user.fullName,
        email: userProfile.isPublic ? user.email : undefined,
        userName: user.userName,
        fullNameString: user.fullNameString,
        profile: {
            avatar: userProfile.avatar,
            bio: userProfile.bio,
            displayName: userProfile.displayName,
            socialLinks: userProfile.socialLinks,
            preferences: userProfile.preferences,
            isPublic: userProfile.isPublic,
            isVerified: userProfile.isVerified,
        },
        createdAt: user.createdAt,
    };
};

/**
 * Update or create user profile.
 *
 * @param {Object} profileData
 * @param {string} userId
 * @returns {Promise<Object>}
 */
const updateUserProfile = async (profileData, userId) => {
    if (!userId) {
        throw new ApiError(
            httpStatus.UNAUTHORIZED,
            "User authentication required."
        );
    }

    const updatedProfile = await models.UserProfile.upsertProfile(
        userId,
        profileData,
        userId
    );

    if (!updatedProfile) {
        throw new ApiError(
            httpStatus.INTERNAL_SERVER_ERROR,
            "Failed to update profile."
        );
    }

    return updatedProfile;
};

const userProfileService = {
    updateAvatar,
    getUserProfile,
    updateUserProfile,
    viewOtherUserProfile,
};

export default userProfileService;
