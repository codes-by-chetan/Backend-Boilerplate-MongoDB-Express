import services from "../services/index.js";
import ApiResponse from "../utils/ApiResponse.js";
import httpStatus from "http-status";
import asyncHandler from "../utils/asyncHandler.js";

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

const adminUnlockUser = asyncHandler(async (req, res) => {
    const identifier = req.body.identifier || req.body.email || req.body.userId || req.params.userId;
    const result = await services.userService.adminUnlockUser(identifier);
    const response = new ApiResponse(
        httpStatus.OK,
        result.user,
        result.message
    );
    return res.status(httpStatus.OK).json(response);
});

const getLockedUsers = asyncHandler(async (req, res) => {
    const lockedUsers = await services.userService.getLockedUsers();
    const response = new ApiResponse(
        httpStatus.OK,
        lockedUsers,
        "Locked user accounts fetched successfully."
    );
    return res.status(httpStatus.OK).json(response);
});

const userController = {
    getUserProfile,
    getUserFullProfile,
    getUserFullProfileById,
    updateUserAvatar,
    updateUserProfile,
    adminUnlockUser,
    getLockedUsers,
};

export default userController;
