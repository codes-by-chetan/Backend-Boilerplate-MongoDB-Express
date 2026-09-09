import ApiError from "./ApiError.js";
import ApiResponse from "./ApiResponse.js";
import asyncHandler from "./asyncHandler.js";
import { uploadOnCloudinary } from "./cloudinary.js";
import getIpDetails from "./getIpDetails.js";
import getHostIpAddress from "./hostIP.js";
import { sendMail, sendTestMail } from "./mailer.js";
import pick from "./pick.js";

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
};

export default utils;
