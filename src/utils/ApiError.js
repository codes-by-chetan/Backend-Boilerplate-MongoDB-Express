export default class ApiError extends Error {
    /**
     * Creates an instance of ApiError.
     * 
     * @constructor
     * @param {number} statusCode - The HTTP status code of the error.
     * @param {string} message - The error message.
     * @param {string|null} [redirect=null] - Optional URL to redirect to in case of error.
     * @param {any} [data=null] - Optional error data payload (e.g. cooldownSeconds, retryAfter).
     */
    constructor(statusCode, message, redirect = null, data = null) {
        super(message);
        this.redirect = redirect;
        this.statusCode = statusCode;
        this.status =
            statusCode >= 400 && statusCode < 500 ? "Failed" : "Error";
        this.isOperational = true;
        this.data = data;
        Error.captureStackTrace(this, this.constructor);
    }
}
