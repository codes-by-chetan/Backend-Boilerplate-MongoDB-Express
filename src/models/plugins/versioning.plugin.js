import DbLogs from "../dbLogs.model.js";
import {
    calculateObjectDiff,
    reconstructDocumentAtVersion,
    sanitizeForDiff,
    normalizeValue,
    isSensitiveKey,
} from "../../utils/diff.util.js";

const toPlainDoc = (doc) => {
    if (!doc) return {};
    if (typeof doc.toObject === "function") {
        return normalizeValue(doc.toObject({ virtuals: false, getters: false, depopulate: true }));
    }
    return normalizeValue(doc);
};

/**
 * Reusable Mongoose Plugin for Git-like Document Versioning & Time-Travel Rollback.
 *
 * @param {import("mongoose").Schema} schema
 * @param {Object} [options]
 * @param {string} [options.collectionName]
 */
const versioningPlugin = (schema, options = {}) => {
    // 1. Hook post("init"): Cache initial clean state when document is loaded from MongoDB
    schema.post("init", function () {
        try {
            this._original = JSON.parse(JSON.stringify(toPlainDoc(this)));
        } catch {
            this._original = null;
        }
    });

    // 2. Hook post("save"): Keep _original updated with final persisted state
    schema.post("save", function () {
        try {
            this._original = JSON.parse(JSON.stringify(toPlainDoc(this)));
        } catch {
            // ignore
        }
    });

    // 3. Hook pre("save"): Track inserts and deep delta updates
    schema.pre("save", async function () {
        // If this save is part of an explicit rollback/resurrect operation, do not emit duplicate commits
        if (this._isRollbackOperation || this.$locals?.isRollback) {
            return;
        }

        const modelName = options.collectionName || this.constructor.modelName;
        const context = this._reqContext || {};

        if (this.isNew) {
            // Initial commit (v1)
            const plainDoc = toPlainDoc(this);
            const sanitizedSnapshot = sanitizeForDiff(plainDoc);
            delete sanitizedSnapshot._id;

            await DbLogs.create({
                affectedCollection: modelName,
                affectedDocumentId: this._id,
                version: 1,
                transactionType: "insert",
                diff: {
                    snapshot: sanitizedSnapshot,
                    totalChanges: Object.keys(sanitizedSnapshot).length,
                    summary: `Initial commit (v1 created in ${modelName})`,
                },
                summary: `Initial commit (v1)`,
                transactionDetails: `Created document in ${modelName}`,
                user: context.user || null,
                ipAddress: context.ipAddress || null,
                origin: context.origin || null,
            });
        } else if (this.isModified()) {
            // Fetch baseline state
            let baseState = this._original;
            if (!baseState) {
                const existing = await this.constructor.findById(this._id).lean();
                baseState = existing ? normalizeValue(existing) : {};
            }

            const currentDoc = toPlainDoc(this);
            const diff = calculateObjectDiff(baseState, currentDoc);

            // If no actual user fields changed, avoid wasteful empty commit
            if (diff.totalChanges === 0) {
                return;
            }

            // Determine next incremental version
            const latestCommit = await DbLogs.findOne({
                affectedCollection: modelName,
                affectedDocumentId: this._id,
            })
                .sort({ version: -1 })
                .select("version")
                .lean();

            const nextVersion = (latestCommit?.version || 1) + 1;

            await DbLogs.create({
                affectedCollection: modelName,
                affectedDocumentId: this._id,
                version: nextVersion,
                transactionType: "update",
                diff,
                summary: diff.summary,
                transactionDetails: `Updated ${modelName} (${diff.summary})`,
                user: context.user || null,
                ipAddress: context.ipAddress || null,
                origin: context.origin || null,
            });
        }
    });

    // Helper to log tombstone commit on deletion
    const recordDeleteCommit = async (modelName, documentId, docObject, context = {}) => {
        try {
            const latestCommit = await DbLogs.findOne({
                affectedCollection: modelName,
                affectedDocumentId: documentId,
            })
                .sort({ version: -1 })
                .select("version transactionType")
                .lean();

            // Prevent duplicate delete commit if already recorded
            if (latestCommit?.transactionType === "delete") {
                return;
            }

            const nextVersion = (latestCommit?.version || 1) + 1;
            const plainDoc = toPlainDoc(docObject);
            const tombstoneSnapshot = sanitizeForDiff(plainDoc);

            await DbLogs.create({
                affectedCollection: modelName,
                affectedDocumentId: documentId,
                version: nextVersion,
                transactionType: "delete",
                diff: {
                    snapshot: tombstoneSnapshot,
                    totalChanges: 1,
                    summary: `Deleted document from ${modelName}`,
                },
                summary: `Deleted document (v${nextVersion})`,
                transactionDetails: `Deleted document from ${modelName}`,
                user: context?.user || null,
                ipAddress: context?.ipAddress || null,
                origin: context?.origin || null,
            });
        } catch (err) {
            // Silently catch logging errors to avoid breaking primary database operation
        }
    };

    // 3a. Hook pre("deleteOne", { document: true }): Track deletions via document instance
    schema.pre(
        "deleteOne",
        { document: true, query: false },
        async function () {
            const modelName = options.collectionName || this.constructor.modelName;
            await recordDeleteCommit(modelName, this._id, this.toObject(), this._reqContext);
        }
    );

    // 3b. Hook pre("findOneAndDelete"): Track deletions via findByIdAndDelete / findOneAndDelete
    schema.pre("findOneAndDelete", async function () {
        try {
            const modelName = options.collectionName || this.model.modelName;
            const doc = await this.model.findOne(this.getQuery()).lean();
            if (doc && doc._id) {
                await recordDeleteCommit(modelName, doc._id, doc, this.options?._reqContext);
            }
        } catch {
            // ignore
        }
    });

    // 3c. Hook pre("deleteOne", { query: true }): Track deletions via Model.deleteOne({ _id })
    schema.pre("deleteOne", { document: false, query: true }, async function () {
        try {
            const modelName = options.collectionName || this.model.modelName;
            const doc = await this.model.findOne(this.getQuery()).lean();
            if (doc && doc._id) {
                await recordDeleteCommit(modelName, doc._id, doc, this.options?._reqContext);
            }
        } catch {
            // ignore
        }
    });

    // ==========================================
    // Model Static Methods for Version Control
    // ==========================================

    /**
     * Fetch complete revision history for a document.
     */
    schema.statics.getDocHistory = async function (documentId) {
        const modelName = options.collectionName || this.modelName;
        return DbLogs.find({
            affectedCollection: modelName,
            affectedDocumentId: documentId,
        })
            .sort({ version: 1 })
            .populate("user", "email fullName role")
            .lean();
    };

    /**
     * Reconstruct document state at any specific version number.
     */
    schema.statics.reconstructDocVersion = async function (documentId, targetVersion = null) {
        const history = await this.getDocHistory(documentId);
        return reconstructDocumentAtVersion(history, targetVersion);
    };

    /**
     * Rollback or restore document to any specific historical version.
     * If document was deleted, this resurrects it back into the active collection with its original _id.
     */
    schema.statics.rollbackDocToVersion = async function (documentId, targetVersion, userContext = {}) {
        const modelName = options.collectionName || this.modelName;
        const history = await this.getDocHistory(documentId);

        if (!history || history.length === 0) {
            throw new Error(`No version history found for document ${documentId}`);
        }

        const reconstruction = reconstructDocumentAtVersion(history, targetVersion);
        if (!reconstruction.state) {
            throw new Error(`Unable to reconstruct document at version ${targetVersion}`);
        }

        const restoredData = { ...reconstruction.state };
        delete restoredData.__v;
        delete restoredData.createdAt;
        delete restoredData.updatedAt;

        // Check if document currently exists in the active collection
        let activeDoc = await this.findById(documentId);

        const latestVersion = history[history.length - 1]?.version || 1;
        const newVersion = latestVersion + 1;

        const userExcluded = options.excludeFieldsOnRollback || [];
        const isExcludedOnRollback = (key) => {
            if (userExcluded.includes(key)) return true;
            if (options.includeSensitiveOnRollback !== true && isSensitiveKey(key)) return true;
            return false;
        };

        if (!activeDoc) {
            // Document was deleted! Resurrect it with its original _id
            restoredData._id = documentId;

            // Strip placeholder "[REDACTED]" values to avoid corrupting resurrected documents
            for (const [key, value] of Object.entries(restoredData)) {
                if (value === "[REDACTED]") {
                    delete restoredData[key];
                }
            }

            activeDoc = new this(restoredData);
            activeDoc._isRollbackOperation = true;
            if (activeDoc.$locals) activeDoc.$locals.isRollback = true;
            activeDoc._reqContext = userContext;
            await activeDoc.save();
        } else {
            // Document exists! Overwrite its fields with the restored state
            for (const [key, value] of Object.entries(restoredData)) {
                if (key !== "_id") {
                    // 1. NEVER overwrite an active document's value with "[REDACTED]"
                    if (value === "[REDACTED]") continue;

                    // 2. Do not overwrite sensitive or explicitly excluded fields on active docs
                    if (isExcludedOnRollback(key)) continue;

                    activeDoc.set(key, value);
                }
            }
            activeDoc._isRollbackOperation = true;
            if (activeDoc.$locals) activeDoc.$locals.isRollback = true;
            activeDoc._reqContext = userContext;
            await activeDoc.save();
        }

        // Record a dedicated "rollback" commit in DbLogs
        await DbLogs.create({
            affectedCollection: modelName,
            affectedDocumentId: documentId,
            version: newVersion,
            transactionType: "rollback",
            diff: {
                snapshot: sanitizeForDiff(activeDoc.toObject()),
                targetVersion,
                summary: `Rolled back to version ${targetVersion}`,
            },
            summary: `Rolled back to v${targetVersion}`,
            transactionDetails: `Restored ${modelName} to version ${targetVersion}`,
            user: userContext.user || null,
            ipAddress: userContext.ipAddress || null,
            origin: userContext.origin || null,
        });

        return {
            document: activeDoc,
            version: newVersion,
            rolledBackToVersion: targetVersion,
        };
    };
};

export default versioningPlugin;
