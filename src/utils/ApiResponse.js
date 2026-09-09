/**
 * @class ApiResponse
 * @description Represents an API response with status code, data, message, and optional redirect.
 * @param {number} statusCode - The HTTP status code of the response.
 * @param {any} data - The data to be returned in the response.
 * @param {string} [message="success"] - The response message, defaults to "success".
 * @param {string|null} [redirect=null] - Optional redirect URL, defaults to null.
 * @property {number} statusCode - The HTTP status code.
 * @property {any} data - The response data.
 * @property {string} message - The response message.
 * @property {boolean} success - Indicates if the response is successful (statusCode < 400).
 * @property {string|null} redirect - The redirect URL, if any.
 */
export default class ApiResponse {
    constructor(statusCode, data, message = "success", redirect = null) {
        this.statusCode = statusCode;
        this.data = data;
        this.message = message;
        this.success = statusCode < 400;
        this.redirect = redirect;
    }
}