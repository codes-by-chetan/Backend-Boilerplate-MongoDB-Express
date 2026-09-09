import models from "../models/index.js";
import ApiError from "../utils/ApiError.js";
import httpStatus from "http-status";

/**
 * Create a new user with an initialized profile.
 *
 * @param {Object} userBody - The user data.
 * @returns {Promise<Object>} The created user populated with profile.
 */
const createUser = async (userBody) => {
    if (await models.User.isEmailTaken(userBody.email)) {
        throw new ApiError(
            httpStatus.BAD_REQUEST,
            `Email ${userBody.email} is already taken.`
        );
    }

    if (
        userBody.userName &&
        (await models.User.isUserNameTaken(userBody.userName))
    ) {
        throw new ApiError(
            httpStatus.BAD_REQUEST,
            `Username ${userBody.userName} is already taken.`
        );
    }

    const createdUser = await models.User.create(userBody);
    if (!createdUser) {
        throw new ApiError(
            httpStatus.INTERNAL_SERVER_ERROR,
            "User creation failed."
        );
    }

    const userProfile = await models.UserProfile.create({
        user: createdUser._id,
        createdBy: createdUser._id,
    });

    if (!userProfile) {
        throw new ApiError(
            httpStatus.INTERNAL_SERVER_ERROR,
            "User profile creation failed."
        );
    }

    createdUser.profile = userProfile._id;
    await createdUser.save();
    await createdUser.populate("profile");

    return createdUser;
};

/**
 * Finds a single user by email or username (not marked as deleted).
 *
 * @param {string} [email]
 * @param {string} [userName]
 * @returns {Promise<Object|null>}
 */
const findOneUser = async (email, userName) => {
    const query = { deleted: { $ne: true } };

    if (email) {
        query.email = email.toLowerCase().trim();
    } else if (userName) {
        query.userName = userName.toLowerCase().trim();
    } else {
        return null;
    }

    return models.User.findOne(query);
};

/**
 * Finds a single user by ID.
 *
 * @param {string} id
 * @returns {Promise<Object|null>}
 */
const findUserById = async (id) => {
    return models.User.findById(id);
};

/**
 * Update user information.
 *
 * @param {string} id
 * @param {Object} userBody
 * @returns {Promise<Object>} The updated user
 */
const updateUserInfo = async (id, userBody) => {
    const user = await models.User.findById(id);
    if (!user) {
        throw new ApiError(httpStatus.NOT_FOUND, "User not found.");
    }

    if (userBody.email && user.email !== userBody.email) {
        if (await models.User.isEmailTaken(userBody.email, id)) {
            throw new ApiError(
                httpStatus.BAD_REQUEST,
                `Email ${userBody.email} is already taken.`
            );
        }
    }

    if (userBody.userName && user.userName !== userBody.userName) {
        if (await models.User.isUserNameTaken(userBody.userName, id)) {
            throw new ApiError(
                httpStatus.BAD_REQUEST,
                `Username ${userBody.userName} is already taken.`
            );
        }
    }

    user.set(userBody);
    await user.save();
    return user;
};

/**
 * Get user profile by user ID.
 *
 * @param {string} id
 * @returns {Promise<Object>}
 */
const getUserProfile = async (id) => {
    const userProfile = await models.UserProfile.findByUserId(id);
    if (!userProfile) {
        throw new ApiError(httpStatus.NOT_FOUND, "User profile not found.");
    }
    return userProfile;
};

/**
 * Get sanitized user details.
 *
 * @param {string} id
 * @returns {Promise<Object>}
 */
const getUserDetails = async (id) => {
    const user = await findUserById(id);
    if (!user) {
        throw new ApiError(httpStatus.NOT_FOUND, "User not found.");
    }
    const userData = await user.populate("profile");

    return {
        _id: userData._id,
        fullName: userData.fullName,
        email: userData.email,
        userName: userData.userName,
        contactNumber: userData.contactNumber,
        role: userData.role,
        status: userData.status,
        fullNameString: userData.fullNameString,
        avatar: userData?.profile?.avatar,
        createdAt: userData.createdAt,
    };
};

/**
 * Get full profile details for the authenticated user.
 *
 * @param {Object} user - Authenticated user document
 * @returns {Promise<Object>}
 */
const getUserProfileDetails = async (user) => {
    await user.populate("profile");
    return {
        id: user._id,
        fullName: user.fullName,
        email: user.email,
        userName: user.userName,
        contactNumber: user.contactNumber,
        fullNameString: user.fullNameString,
        role: user.role,
        status: user.status,
        profile: {
            avatar: user?.profile?.avatar,
            bio: user?.profile?.bio,
            displayName: user?.profile?.displayName,
            socialLinks: user?.profile?.socialLinks,
            preferences: user?.profile?.preferences,
            isPublic: user?.profile?.isPublic,
            isVerified: user?.profile?.isVerified,
        },
        createdAt: user.createdAt,
    };
};

const userService = {
    createUser,
    findOneUser,
    findUserById,
    updateUserInfo,
    getUserProfile,
    getUserDetails,
    getUserProfileDetails,
};

export default userService;
