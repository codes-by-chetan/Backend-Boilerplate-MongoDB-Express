/**
 * Enterprise NoSQL Query Injection Sanitizer Middleware
 * Defends against MongoDB operator injection ($gt, $ne, $regex, $where, etc.)
 * Recursively cleans req.body, req.query, and req.params in-place.
 */

const sanitizeInPlace = (target) => {
    if (!target || typeof target !== "object") {
        return;
    }

    if (Array.isArray(target)) {
        for (let i = 0; i < target.length; i++) {
            if (typeof target[i] === "object" && target[i] !== null) {
                sanitizeInPlace(target[i]);
            }
        }
        return;
    }

    for (const key of Object.keys(target)) {
        if (key.startsWith("$") || key.includes(".")) {
            delete target[key];
        } else if (typeof target[key] === "object" && target[key] !== null) {
            sanitizeInPlace(target[key]);
        }
    }
};

/**
 * Express middleware to sanitize incoming request data in-place without reassigning getter properties.
 */
export const sanitizeInputs = (req, res, next) => {
    try {
        if (req.body && typeof req.body === "object") {
            sanitizeInPlace(req.body);
        }
        if (req.query && typeof req.query === "object") {
            sanitizeInPlace(req.query);
        }
        if (req.params && typeof req.params === "object") {
            sanitizeInPlace(req.params);
        }
    } catch (_) {}

    next();
};

export default sanitizeInputs;
