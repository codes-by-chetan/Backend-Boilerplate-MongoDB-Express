import ApiResponse from "../utils/ApiResponse.js";
import logger from "../config/logger.config.js";
const errorResponseGenerator = (err) => {
    let error = { ...err };
    error.message = err.message;

    let response = new ApiResponse(
        error.statusCode,
        null,
        error.message,
        error.redirect || null
    );

    if (error?.errorResponse?.code === 11000) {
        response = handleDuplicateKeyError(error);
    } else if (error.name === "ValidationError") {
        response = handleValidationError(error);
    } else if (error.name === "CastError") {
        response = handleCastError(error);
    } else if (error.name === "JsonWebTokenError") {
        response = handleJWTError(error);
    } else if (error.name === "TokenExpiredError") {
        response = handleTokenExpiredError(error);
    } else if (error.name === "SyntaxError") {
        response = handleSyntaxError(error);
    } else if (error.name === "ReferenceError") {
        response = handleReferenceError(error);
    } else if (error.name === "TypeError") {
        response = handleTypeError(error);
    }

    return response;
};

const handleDuplicateKeyError = (err) => {
    const message = `Duplicate field value entered for ${Object.keys(err.errorResponse.keyValue)} `;
    return new ApiResponse(400, null, message);
};

const handleValidationError = (err) => {
    const errors = Object.values(err.errors).map((el) => el.message);
    const message = `Validation error: ${errors.join(". ")}`;
    return new ApiResponse(400, null, message);
};

const handleCastError = (err) => {
    const message = `Invalid ${err.path}: ${err.value}`;
    return new ApiResponse(400, null, message);
};

const handleJWTError = (err) => {
    const message = "Invalid token. Please log in again!";
    return new ApiResponse(401, null, message);
};

const handleTokenExpiredError = (err) => {
    const message = "Your token has expired! Please log in again.";
    return new ApiResponse(401, null, message);
};

const handleSyntaxError = (err) => {
    const message = "Syntax error. Please check your request syntax.";
    return new ApiResponse(400, null, message);
};

const handleReferenceError = (err) => {
    const message = "Reference error. Please check your request.";
    return new ApiResponse(400, null, message);
};

const handleTypeError = (err) => {
    const message = "Type error. Please check your request.";
    return new ApiResponse(400, null, message);
};

const errorHandler = (error, req, res, next) => {
    error.statusCode = error.statusCode || 500;
    error.status = error.status || "error";
    logger.logMessage("error", error.message);
    console.error(error);

    const response = errorResponseGenerator(error);
    res.status(error.statusCode).json(response);
};

export default errorHandler;
