import services from "../services/index.js";
import ApiResponse from "../utils/ApiResponse.js";
import ApiError from "../utils/ApiError.js";
import httpStatus from "http-status";
import asyncHandler from "../utils/asyncHandler.js";
import models from "../models/index.js";
import constants from "../constants/index.js";

const getUserProfile = asyncHandler(async (req, res) => {
    const profileData = await services.userService.getUserProfileDetails(req.user);
    const response = new ApiResponse(
        httpStatus.OK,
        profileData,
        "User profile fetched successfully."
    );
    return res.status(httpStatus.OK).json(response);
});

const getUserFullProfile = asyncHandler(async (req, res) => {
    const profileData = await services.userProfileService.getUserProfile(req.user._id);
    const response = new ApiResponse(
        httpStatus.OK,
        profileData,
        "User profile fetched successfully."
    );
    return res.status(httpStatus.OK).json(response);
});

const getUserFullProfileById = asyncHandler(async (req, res) => {
    const profileData = await services.userProfileService.viewOtherUserProfile(req);
    const response = new ApiResponse(
        httpStatus.OK,
        profileData,
        "User profile fetched successfully."
    );
    return res.status(httpStatus.OK).json(response);
});

const updateUserAvatar = asyncHandler(async (req, res) => {
    const avatar = await services.userProfileService.updateAvatar(req);
    const response = new ApiResponse(
        httpStatus.OK,
        avatar,
        "User avatar updated successfully."
    );
    return res.status(httpStatus.OK).json(response);
});

const updateUserProfile = asyncHandler(async (req, res) => {
    const updated = await services.userProfileService.updateUserProfile(req.body, req.user._id);
    const response = new ApiResponse(
        httpStatus.OK,
        updated,
        "User profile updated successfully."
    );
    return res.status(httpStatus.OK).json(response);
});

const updateUserRole = asyncHandler(async (req, res) => {
    const { userId } = req.params;
    const { role } = req.body;

    if (userId.toString() === req.user?._id?.toString() && role !== constants.UserRoles.ADMIN) {
        throw new ApiError(httpStatus.BAD_REQUEST, "Administrators cannot demote their own account.");
    }

    const user = await models.User.findById(userId);
    if (!user) {
        throw new ApiError(httpStatus.NOT_FOUND, "User not found.");
    }

    user.role = role;
    await user.save();

    const response = new ApiResponse(
        httpStatus.OK,
        {
            id: user._id,
            email: user.email,
            userName: user.userName,
            role: user.role,
        },
        `User role updated to '${role}' successfully.`
    );
    return res.status(httpStatus.OK).json(response);
});

const getAllUsersAdmin = asyncHandler(async (req, res) => {
    const filter = {
        role: req.query.role,
        status: req.query.status,
        search: req.query.search,
    };
    const options = {
        page: req.query.page,
        limit: req.query.limit,
        sortBy: req.query.sortBy,
        order: req.query.order,
    };

    const data = await services.userService.queryUsers(filter, options);
    const response = new ApiResponse(
        httpStatus.OK,
        data,
        "Users retrieved successfully for admin portal."
    );
    return res.status(httpStatus.OK).json(response);
});

const updateUserStatus = asyncHandler(async (req, res) => {
    const { userId } = req.params;
    const { status } = req.body;
    const currentAdminId = req.user?._id;

    const data = await services.userService.updateUserStatus(userId, status, currentAdminId);
    const response = new ApiResponse(
        httpStatus.OK,
        data,
        `User status updated to '${status}' successfully.`
    );
    return res.status(httpStatus.OK).json(response);
});

const revokeUserSessions = asyncHandler(async (req, res) => {
    const { userId } = req.params;
    const currentAdminId = req.user?._id;

    const data = await services.userService.revokeUserSessions(userId, currentAdminId);
    const response = new ApiResponse(
        httpStatus.OK,
        data,
        "All active sessions revoked for the user."
    );
    return res.status(httpStatus.OK).json(response);
});

const getUserSessions = asyncHandler(async (req, res) => {
    const { userId } = req.params;
    const currentTokenId = req.session?.tokenId;

    const data = await services.userService.getUserSessions(userId, currentTokenId);
    const response = new ApiResponse(
        httpStatus.OK,
        data,
        "User sessions retrieved successfully."
    );
    return res.status(httpStatus.OK).json(response);
});

const revokeSingleSession = asyncHandler(async (req, res) => {
    const { userId, tokenId } = req.params;
    const currentAdminId = req.user?._id;
    const currentTokenId = req.session?.tokenId;

    const data = await services.userService.revokeSingleSession(
        userId,
        tokenId,
        currentAdminId,
        currentTokenId
    );
    const response = new ApiResponse(
        httpStatus.OK,
        data,
        "User session revoked successfully."
    );
    return res.status(httpStatus.OK).json(response);
});

const userController = {
    getUserProfile,
    getUserFullProfile,
    getUserFullProfileById,
    updateUserAvatar,
    updateUserProfile,
    updateUserRole,
    getAllUsersAdmin,
    updateUserStatus,
    revokeUserSessions,
    getUserSessions,
    revokeSingleSession,
};

export default userController;
