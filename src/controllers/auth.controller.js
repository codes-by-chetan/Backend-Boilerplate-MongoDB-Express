import constants from "../constants/index.js";
import services from "../services/index.js";
import ApiError from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import asyncHandler from "../utils/asyncHandler.js";
import httpStatus from "http-status";
import config from "../config/env.config.js";
import { resolveClientAppUrl } from "../utils/urlHelper.js";

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

const forgotPassword = asyncHandler(async (req, res) => {
    const { email } = req.body;
    const result = await services.authService.forgotPassword(email, req);
    const response = new ApiResponse(
        httpStatus.OK,
        {
            cooldownSeconds: result.cooldownSeconds,
        },
        result.message
    );
    res.status(httpStatus.OK).json(response);
});

const resetPassword = asyncHandler(async (req, res) => {
    const { token, newPassword } = req.body;
    const result = await services.authService.resetPassword(token, newPassword);
    const response = new ApiResponse(
        httpStatus.OK,
        null,
        result.message
    );
    res.status(httpStatus.OK).json(response);
});

const requestUnlock = asyncHandler(async (req, res) => {
    const { email } = req.body;
    const result = await services.authService.requestUnlock(email, req);
    const response = new ApiResponse(
        httpStatus.OK,
        {
            isLocked: result.isLocked,
            cooldownSeconds: result.cooldownSeconds,
        },
        result.message
    );
    res.status(httpStatus.OK).json(response);
});

const unlockAccount = asyncHandler(async (req, res) => {
    const token = req.query.token || req.body.token;
    // Any GET request is treated as a browser navigation from an email or terminal link
    const isBrowserGet = req.method === "GET" || Boolean(req.headers.accept?.includes("text/html"));

    try {
        const result = await services.authService.unlockAccount(token);
        if (isBrowserGet) {
            const redirectUrl = resolveClientAppUrl(req, "?unlocked=true");
            return res.redirect(redirectUrl);
        }
        const response = new ApiResponse(
            httpStatus.OK,
            { email: result.email },
            result.message
        );
        return res.status(httpStatus.OK).json(response);
    } catch (err) {
        if (isBrowserGet) {
            const redirectUrl = resolveClientAppUrl(
                req,
                `?unlocked=false&error=${encodeURIComponent(err.message)}`
            );
            return res.redirect(redirectUrl);
        }
        throw err;
    }
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

const refreshToken = refreshTokens;

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

const generate2FA = asyncHandler(async (req, res) => {
    const data = await services.authService.generate2FA(req.user._id);
    const response = new ApiResponse(
        httpStatus.OK,
        data,
        "2FA setup QR code generated successfully."
    );
    res.status(httpStatus.OK).json(response);
});

const enable2FA = asyncHandler(async (req, res) => {
    const { token } = req.body;
    const data = await services.authService.enable2FA(req.user._id, token);
    const response = new ApiResponse(
        httpStatus.OK,
        data,
        data.message
    );
    res.status(httpStatus.OK).json(response);
});

const disable2FA = asyncHandler(async (req, res) => {
    const { password, token } = req.body;
    const data = await services.authService.disable2FA(req.user._id, password, token);
    const response = new ApiResponse(
        httpStatus.OK,
        null,
        data.message
    );
    res.status(httpStatus.OK).json(response);
});

const verify2FALogin = asyncHandler(async (req, res) => {
    const { tempToken, code } = req.body;
    const data = await services.authService.verify2FALogin(tempToken, code, req);
    setAuthCookies(res, data);

    const response = new ApiResponse(
        httpStatus.OK,
        data,
        "Two-factor authentication verified successfully."
    );
    res.status(httpStatus.OK).json(response);
});

const authController = {
    register,
    login,
    adminLogin,
    forgotPassword,
    resetPassword,
    requestUnlock,
    unlockAccount,
    refreshToken,
    refreshTokens,
    verifySocialToken,
    changePassword,
    isAdmin,
    verifyUser,
    getUserDetails,
    logout,
    logoutAll,
    generate2FA,
    enable2FA,
    disable2FA,
    verify2FALogin,
};

export default authController;
