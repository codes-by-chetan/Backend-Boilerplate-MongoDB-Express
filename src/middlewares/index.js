import authMiddleware, { authorize } from "./auth.middleware.js";
import dbLogger from "./dbLogger.middleware.js";
import errorHandler from "./errorHandler.middleware.js";
import { upload } from "./multer.middleware.js";
import requestLoggerMiddleware from "./requestLogger.middleware.js";
import userMiddleware from "./user.middleware.js";
import validate from "./validate.js";
import authRateLimiter, {
    loginLimiter,
    registerLimiter,
    forgotPasswordLimiter,
    unlockLimiter,
    resetPasswordLimiter,
} from "./authRateLimiter.middleware.js";
import sanitizeInputs from "./sanitize.middleware.js";

const middlewares = {
    dbLogger,
    errorHandler,
    requestLoggerMiddleware,
    authMiddleware,
    authorize,
    validate,
    upload,
    userMiddleware,
    authRateLimiter,
    sanitizeInputs,
    rateLimiters: {
        login: loginLimiter,
        register: registerLimiter,
        forgotPassword: forgotPasswordLimiter,
        unlock: unlockLimiter,
        resetPassword: resetPasswordLimiter,
    },
};

export {
    authMiddleware,
    authorize,
    dbLogger,
    errorHandler,
    requestLoggerMiddleware,
    userMiddleware,
    validate,
    upload,
    authRateLimiter,
    sanitizeInputs,
    loginLimiter,
    registerLimiter,
    forgotPasswordLimiter,
    unlockLimiter,
    resetPasswordLimiter,
};

export default middlewares;
