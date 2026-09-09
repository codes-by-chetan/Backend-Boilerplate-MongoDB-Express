import DbLogs from "../models/dbLogs.model.js";

/**
 * Middleware to handle insert, update, and delete audit logging in MongoDB.
 *
 * @param {string} modelName - The name of the affected model/collection.
 * @returns {Function} Pre-save middleware function.
 */
function dbLogger(modelName) {
    return async function (next) {
        try {
            const operation = this.isNew
                ? "insert"
                : this.isModified()
                  ? "update"
                  : "delete";

            const { ipAddress, origin, user } = this._reqContext || {};

            if (operation === "insert") {
                const log = new DbLogs({
                    transactionType: "insert",
                    transactionDetails: `Inserted a new document into ${modelName}`,
                    status: "success",
                    affectedCollection: modelName,
                    affectedDocumentId: this._id,
                    newValue: this,
                    user,
                    ipAddress,
                    origin,
                });
                await log.save();
            } else if (operation === "update") {
                const changes = this._doc;
                const previous = this._previousData || this._doc;
                const log = new DbLogs({
                    transactionType: "update",
                    transactionDetails: `Updated a document in ${modelName}`,
                    status: "success",
                    affectedCollection: modelName,
                    affectedDocumentId: this._id,
                    previousValue: previous,
                    newValue: changes,
                    user,
                    ipAddress,
                    origin,
                });
                await log.save();
            } else if (operation === "delete") {
                const log = new DbLogs({
                    transactionType: "delete",
                    transactionDetails: `Deleted a document from ${modelName}`,
                    status: "success",
                    affectedCollection: modelName,
                    affectedDocumentId: this._id,
                    previousValue: this,
                    user,
                    ipAddress,
                    origin,
                });
                await log.save();
            }

            if (typeof next === "function") {
                next();
            }
        } catch (error) {
            console.error("Error in dbLogger transaction:", error);
            if (typeof next === "function") {
                return next(error);
            }
            throw error;
        }
    };
}

export default dbLogger;
