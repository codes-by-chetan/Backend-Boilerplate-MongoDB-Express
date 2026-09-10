import models from "../models/index.js";
import ApiError from "../utils/ApiError.js";
import httpStatus from "http-status";
import constants from "../constants/index.js";

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

/**
 * Query users with pagination, filters, search, and aggregate statistics for Admin portal.
 *
 * @param {Object} filter - Search and filter parameters.
 * @param {Object} options - Pagination options.
 * @returns {Promise<Object>}
 */
const queryUsers = async (filter = {}, options = {}) => {
    const page = Math.max(1, parseInt(options.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(options.limit, 10) || 20));
    const skip = (page - 1) * limit;

    const mongoFilter = { deleted: { $ne: true } };

    if (filter.role) {
        mongoFilter.role = filter.role;
    }

    if (filter.status) {
        mongoFilter.status = filter.status;
    }

    if (filter.search) {
        const searchRegex = { $regex: filter.search.trim(), $options: "i" };
        mongoFilter.$or = [
            { email: searchRegex },
            { userName: searchRegex },
            { "fullName.firstName": searchRegex },
            { "fullName.lastName": searchRegex },
        ];
    }

    const sortBy = options.sortBy || "createdAt";
    const order = options.order === "asc" ? 1 : -1;
    const sort = { [sortBy]: order };

    const [total, users, statsAgg] = await Promise.all([
        models.User.countDocuments(mongoFilter),
        models.User.find(mongoFilter)
            .select("-password -sessions.refreshToken")
            .populate("profile")
            .sort(sort)
            .skip(skip)
            .limit(limit)
            .lean(),
        models.User.aggregate([
            { $match: { deleted: { $ne: true } } },
            {
                $group: {
                    _id: null,
                    totalUsers: { $sum: 1 },
                    activeUsers: {
                        $sum: { $cond: [{ $eq: ["$status", constants.UserStatus.Active] }, 1, 0] },
                    },
                    inactiveUsers: {
                        $sum: { $cond: [{ $eq: ["$status", constants.UserStatus.Inactive] }, 1, 0] },
                    },
                    adminCount: {
                        $sum: { $cond: [{ $eq: ["$role", constants.UserRoles.ADMIN] }, 1, 0] },
                    },
                    managerCount: {
                        $sum: { $cond: [{ $eq: ["$role", constants.UserRoles.MANAGER] }, 1, 0] },
                    },
                    userCount: {
                        $sum: { $cond: [{ $eq: ["$role", constants.UserRoles.USER] }, 1, 0] },
                    },
                },
            },
        ]),
    ]);

    const stats = statsAgg[0] || {
        totalUsers: total,
        activeUsers: 0,
        inactiveUsers: 0,
        adminCount: 0,
        managerCount: 0,
        userCount: 0,
    };
    delete stats._id;

    // Transform user objects for safe frontend representation
    const sanitizedUsers = users.map((u) => ({
        id: u._id,
        fullName: u.fullName,
        fullNameString: u.fullName ? `${u.fullName.firstName || ""} ${u.fullName.lastName || ""}`.trim() : "Unknown",
        email: u.email,
        userName: u.userName,
        contactNumber: u.contactNumber,
        role: u.role,
        status: u.status,
        activeSessionsCount: Array.isArray(u.sessions) ? u.sessions.filter((s) => s.isActive && new Date(s.expiresAt) > new Date()).length : 0,
        createdAt: u.createdAt,
        updatedAt: u.updatedAt,
    }));

    return {
        users: sanitizedUsers,
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit) || 1,
        },
        stats,
    };
};

/**
 * Toggle or update account status of a user (Active / Inactive).
 * If deactivating, revokes all active sessions.
 *
 * @param {string} userId
 * @param {string} status
 * @param {string} currentAdminId
 * @returns {Promise<Object>}
 */
const updateUserStatus = async (userId, status, currentAdminId) => {
    if (userId.toString() === currentAdminId?.toString() && status === constants.UserStatus.Inactive) {
        throw new ApiError(httpStatus.BAD_REQUEST, "Administrators cannot deactivate their own account.");
    }

    const user = await models.User.findById(userId);
    if (!user) {
        throw new ApiError(httpStatus.NOT_FOUND, "User not found.");
    }

    user.status = status;
    if (status === constants.UserStatus.Inactive) {
        user.sessions = [];
    }

    await user.save();

    return {
        id: user._id,
        email: user.email,
        userName: user.userName,
        role: user.role,
        status: user.status,
    };
};

/**
 * Revoke all active sessions for a user (Remote Force Logout).
 *
 * @param {string} userId
 * @param {string} currentAdminId
 * @returns {Promise<Object>}
 */
const revokeUserSessions = async (userId, currentAdminId) => {
    if (userId.toString() === currentAdminId?.toString()) {
        throw new ApiError(httpStatus.BAD_REQUEST, "Cannot revoke own active session from management view. Use Logout instead.");
    }

    const user = await models.User.findById(userId);
    if (!user) {
        throw new ApiError(httpStatus.NOT_FOUND, "User not found.");
    }

    user.sessions = [];
    await user.save();

    return {
        id: user._id,
        email: user.email,
        message: "All active sessions revoked successfully.",
    };
};

/**
 * Get active sessions for a user (excluding refreshToken for security).
 *
 * @param {string} userId
 * @param {string} currentTokenId
 * @returns {Promise<Object>}
 */
const getUserSessions = async (userId, currentTokenId) => {
    const user = await models.User.findById(userId).select("-password");
    if (!user) {
        throw new ApiError(httpStatus.NOT_FOUND, "User not found.");
    }

    const now = new Date();
    const sessions = (user.sessions || []).map((s) => {
        const isExpired = s.expiresAt ? new Date(s.expiresAt) <= now : false;
        return {
            tokenId: s.tokenId,
            deviceInfo: s.deviceInfo || {},
            ipAddress: s.ipAddress || null,
            loginAt: s.loginAt,
            expiresAt: s.expiresAt,
            isActive: s.isActive && !isExpired,
            isCurrentSession: Boolean(currentTokenId && s.tokenId === currentTokenId),
        };
    });

    sessions.sort((a, b) => {
        if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
        return new Date(b.loginAt).getTime() - new Date(a.loginAt).getTime();
    });

    return {
        userId: user._id,
        email: user.email,
        userName: user.userName,
        fullNameString: user.fullNameString,
        totalSessions: sessions.length,
        activeSessionsCount: sessions.filter((s) => s.isActive).length,
        sessions,
    };
};

/**
 * Revoke a single active session by tokenId.
 *
 * @param {string} userId
 * @param {string} tokenId
 * @param {string} currentAdminId
 * @param {string} currentTokenId
 * @returns {Promise<Object>}
 */
const revokeSingleSession = async (userId, tokenId, currentAdminId, currentTokenId) => {
    if (userId.toString() === currentAdminId?.toString() && tokenId === currentTokenId) {
        throw new ApiError(httpStatus.BAD_REQUEST, "Cannot revoke current active session. Use Logout instead.");
    }

    const user = await models.User.findById(userId);
    if (!user) {
        throw new ApiError(httpStatus.NOT_FOUND, "User not found.");
    }

    await models.User.revokeSession(userId, tokenId);

    return {
        userId,
        tokenId,
        message: "Session revoked successfully.",
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
    queryUsers,
    updateUserStatus,
    revokeUserSessions,
    getUserSessions,
    revokeSingleSession,
};

export default userService;
