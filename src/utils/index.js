import ApiError from "./ApiError.js";
import ApiResponse from "./ApiResponse.js";
import asyncHandler from "./asyncHandler.js";
import { uploadOnCloudinary } from "./cloudinary.js";
import getIpDetails from "./getIpDetails.js";
import getHostIpAddress from "./hostIP.js";
import { sendMail, sendTestMail } from "./mailer.js";
import pick from "./pick.js";
import cryptoUtil from "./crypto.util.js";

const utils = {
    ApiError,
    ApiResponse,
    asyncHandler,
    uploadOnCloudinary,
    getIpDetails,
    getHostIpAddress,
    sendMail,
    sendTestMail,
    pick,
    cryptoUtil,
};

export {
    ApiError,
    ApiResponse,
    asyncHandler,
    uploadOnCloudinary,
    getIpDetails,
    getHostIpAddress,
    sendMail,
    sendTestMail,
    pick,
    cryptoUtil,
};

export default utils;
