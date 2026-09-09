import constants from "../constants/index.js";
import services from "../services/index.js";
import ApiError from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import asyncHandler from "../utils/asyncHandler.js";
import httpStatus from "http-status";

const register = asyncHandler(async (req, res) => {
    const userData = await services.authService.registerUser(req.body);
    const authTokens = await userData.generateAccessToken(req);
    const chosenFields = {
        fullName: userData.fullName,
        email: userData.email,
        contactNumber: userData.contactNumber,
        role: userData.role,
        fullNameString: userData.fullNameString,
        avatar: userData?.profile?.avatar,
    };
    const response = new ApiResponse(
        httpStatus.CREATED,
        { user: chosenFields, ...authTokens },
        "User registered successfully."
    );
    res.status(httpStatus.CREATED).json(response);
});

const login = asyncHandler(async (req, res) => {
    const token = await services.authService.loginWithEmailAndPassword(req);
    const response = new ApiResponse(
        httpStatus.OK,
        token,
        "Login successful."
    );
    res.status(httpStatus.OK).json(response);
});

const verifySocialToken = asyncHandler(async (req, res) => {
    const { provider, token } = req.body;
    const data = await services.authService.verifySocialToken(
        provider,
        token,
        req
    );
    const response = new ApiResponse(
        httpStatus.OK,
        data,
        "Social login successful."
    );
    res.status(httpStatus.OK).json(response);
});

const changePassword = asyncHandler(async (req, res) => {
    const { oldPassword, newPassword } = req.body;
    await services.authService.changeUserPassword(
        oldPassword,
        newPassword,
        req.user._id
    );

    const response = new ApiResponse(
        httpStatus.OK,
        null,
        "Password changed successfully."
    );
    res.status(httpStatus.OK).json(response);
});

const verifyUser = asyncHandler(async (req, res) => {
    const response = new ApiResponse(httpStatus.OK, { user: req.user }, "User is verified.");
    res.status(httpStatus.OK).json(response);
});

const isAdmin = asyncHandler(async (req, res) => {
    if (req.user.role !== constants.UserRoles.ADMIN) {
        throw new ApiError(httpStatus.FORBIDDEN, "Access denied: admin privilege required.");
    }

    const response = new ApiResponse(httpStatus.OK, null, "User has admin privileges.");
    res.status(httpStatus.OK).json(response);
});

const getUserDetails = asyncHandler(async (req, res) => {
    const user = await services.userService.getUserDetails(req.user._id);
    const response = new ApiResponse(
        httpStatus.OK,
        { user },
        "User details fetched successfully."
    );
    res.status(httpStatus.OK).json(response);
});

const logout = asyncHandler(async (req, res) => {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];

    if (!token) {
        throw new ApiError(httpStatus.BAD_REQUEST, "Authorization token is required.");
    }

    await services.authService.logout(req.user._id, token);

    const response = new ApiResponse(
        httpStatus.OK,
        null,
        "Logged out successfully."
    );
    res.status(httpStatus.OK).json(response);
});

const authController = {
    register,
    login,
    verifySocialToken,
    changePassword,
    isAdmin,
    verifyUser,
    getUserDetails,
    logout,
};

export default authController;
