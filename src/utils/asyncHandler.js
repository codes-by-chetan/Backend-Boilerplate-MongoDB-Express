/**
 * @function asyncHandler
 * @description A utility function to wrap async route handlers, catching errors and passing them to the next middleware.
 * @param {Function} func - The async function to be wrapped, which takes req, res, and next as arguments.
 * @returns {Function} A middleware function that executes the provided async function and handles any errors.
 * @example
 * const myRoute = asyncHandler(async (req, res, next) => {
 *     const data = await someAsyncOperation();
 *     res.json(data);
 * });
 */
const asyncHandler = (func) => {
    return (req, res, next) => {
        func(req, res, next).catch((err) => {
            next(err);
        });
    };
};

export default asyncHandler;