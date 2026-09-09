import authMiddleware, { authorize } from "./auth.middleware.js";
import dbLogger from "./dbLogger.middleware.js";
import errorHandler from "./errorHandler.middleware.js";
import { upload } from "./multer.middleware.js";
import requestLoggerMiddleware from "./requestLogger.middleware.js";
import userMiddleware from "./user.middleware.js";
import validate from "./validate.js";

const middlewares = {
    dbLogger,
    errorHandler,
    requestLoggerMiddleware,
    authMiddleware,
    authorize,
    validate,
    upload,
    userMiddleware,
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
};

export default middlewares;
