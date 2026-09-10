import constants from "../constants/index.js";
import services from "../services/index.js";
import ApiError from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import asyncHandler from "../utils/asyncHandler.js";
import httpStatus from "http-status";
import config from "../config/env.config.js";

const setAuthCookies = (res, tokens) => {
    if (tokens.accessToken) {
        res.cookie("accessToken", tokens.accessToken, {
            ...config.jwt.cookieOptions,
            maxAge: 15 * 60 * 1000,
        });
    }
    if (tokens.refreshToken) {
        res.cookie("refreshToken", tokens.refreshToken, {
            ...config.jwt.cookieOptions,
            maxAge: 7 * 24 * 60 * 60 * 1000,
        });
    }
};

const clearAuthCookies = (res) => {
    res.clearCookie("accessToken", config.jwt.cookieOptions);
    res.clearCookie("refreshToken", config.jwt.cookieOptions);
};

const register = asyncHandler(async (req, res) => {
    const userData = await services.authService.registerUser(req.body);
    const authTokens = await userData.generateAuthTokens(req);
    setAuthCookies(res, authTokens);

    const chosenFields = {
        id: userData._id,
        fullName: userData.fullName,
        email: userData.email,
        userName: userData.userName,
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
    const data = await services.authService.loginWithEmailAndPassword(req);
    setAuthCookies(res, data);

    const response = new ApiResponse(
        httpStatus.OK,
        data,
        "Login successful."
    );
    res.status(httpStatus.OK).json(response);
});

const adminLogin = asyncHandler(async (req, res) => {
    const data = await services.authService.loginWithEmailAndPassword(req, {
        allowedRoles: [constants.UserRoles.ADMIN],
    });
    setAuthCookies(res, data);

    const response = new ApiResponse(
        httpStatus.OK,
        data,
        "Admin login successful."
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
    setAuthCookies(res, data);

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

const refreshTokens = asyncHandler(async (req, res) => {
    const refreshToken = req.cookies?.refreshToken || req.body?.refreshToken;
    if (!refreshToken) {
        throw new ApiError(httpStatus.BAD_REQUEST, "Refresh token is required.");
    }

    const data = await services.authService.refreshAuthTokens(refreshToken, req);
    setAuthCookies(res, data);

    const response = new ApiResponse(
        httpStatus.OK,
        data,
        "Tokens refreshed successfully."
    );
    res.status(httpStatus.OK).json(response);
});

const logout = asyncHandler(async (req, res) => {
    const authHeader = req.headers["authorization"];
    const token = (authHeader && authHeader.split(" ")[1]) || req.cookies?.accessToken || req.cookies?.refreshToken;

    if (req.user?._id) {
        await services.authService.logout(req.user._id, token);
    }
    clearAuthCookies(res);

    const response = new ApiResponse(
        httpStatus.OK,
        null,
        "Logged out successfully."
    );
    res.status(httpStatus.OK).json(response);
});

const logoutAll = asyncHandler(async (req, res) => {
    if (req.user?._id) {
        await services.authService.logoutAll(req.user._id);
    }
    clearAuthCookies(res);

    const response = new ApiResponse(
        httpStatus.OK,
        null,
        "Logged out from all devices successfully."
    );
    res.status(httpStatus.OK).json(response);
});

const authController = {
    register,
    login,
    adminLogin,
    verifySocialToken,
    changePassword,
    isAdmin,
    verifyUser,
    getUserDetails,
    refreshTokens,
    logout,
    logoutAll,
};

export default authController;
