/**
 * Deprecated DB Logger middleware.
 * Models now utilize the automatic Git-like versioning plugin:
 *   schema.plugin(plugins.versioning)
 */
function dbLogger(modelName) {
    return async function (next) {
        // Handled automatically via versioning plugin
        if (typeof next === "function") {
            next();
        }
    };
}

export default dbLogger;
