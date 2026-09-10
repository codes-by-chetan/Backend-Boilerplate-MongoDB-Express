/**
 * Accurate Deep Diff and Version Reconstruction Utility
 * Designed for MongoDB / Mongoose Document Version Control
 */

const SENSITIVE_KEYS = new Set([
    "password",
    "registrationtoken",
    "refreshtoken",
    "accesstoken",
    "token",
    "secret",
    "creditcard",
    "cvv",
    "ssn",
]);

const IGNORED_FIELDS = new Set(["__v", "_original", "_reqContext", "updatedAt"]);

/**
 * Case-insensitive sensitive key check
 */
export const isSensitiveKey = (key) => {
    if (!key || typeof key !== "string") return false;
    const lower = key.toLowerCase();
    return (
        SENSITIVE_KEYS.has(lower) ||
        lower.includes("password") ||
        lower.includes("secret") ||
        lower.includes("token") ||
        lower.includes("creditcard") ||
        lower.includes("cvv") ||
        lower.includes("ssn") ||
        lower.includes("apikey") ||
        lower.includes("authkey")
    );
};

/**
 * Modular Crypt Format (MCF) regex for standard bcrypt hashes ($2a$, $2b$, $2y$).
 */
export const BCRYPT_HASH_REGEX = /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/;

/**
 * Check if a string is already a valid bcrypt hash.
 */
export const isBcryptHash = (val) => {
    return typeof val === "string" && BCRYPT_HASH_REGEX.test(val);
};

/**
 * Check if a value is a plain JavaScript object (not Date, ObjectId, Decimal128, Buffer, etc.)
 */
export const isPlainObject = (val) => {
    return (
        val !== null &&
        typeof val === "object" &&
        !Array.isArray(val) &&
        !(val instanceof Date) &&
        !(val instanceof RegExp) &&
        !(val?._bsontype === "ObjectID" || val?.constructor?.name === "ObjectId") &&
        !(val?._bsontype === "Decimal128" || val?.constructor?.name === "Decimal128") &&
        !Buffer.isBuffer(val)
    );
};

/**
 * Normalize any MongoDB or Mongoose value into a plain, comparable JavaScript primitive or structure.
 */
export const normalizeValue = (val) => {
    if (val === undefined) return undefined;
    if (val === null) return null;

    // Handle Mongoose / BSON ObjectId
    if (val?._bsontype === "ObjectID" || val?.constructor?.name === "ObjectId" || typeof val?.toHexString === "function") {
        return val.toString();
    }

    // Handle Decimal128
    if (val?._bsontype === "Decimal128" || val?.constructor?.name === "Decimal128") {
        return val.toString();
    }

    // Handle Date
    if (val instanceof Date) {
        return val.toISOString();
    }

    // Handle Buffer
    if (Buffer.isBuffer(val)) {
        return val.toString("base64");
    }

    // Handle Mongoose documents
    if (typeof val?.toObject === "function") {
        return normalizeValue(val.toObject());
    }

    // Handle Arrays
    if (Array.isArray(val)) {
        return val.map((item) => normalizeValue(item));
    }

    // Handle Objects
    if (isPlainObject(val)) {
        const cleaned = {};
        for (const [key, value] of Object.entries(val)) {
            if (!IGNORED_FIELDS.has(key)) {
                cleaned[key] = normalizeValue(value);
            }
        }
        return cleaned;
    }

    return val;
};

/**
 * Deep equality check between two normalized values.
 */
export const isDeepEqual = (a, b) => {
    const normA = normalizeValue(a);
    const normB = normalizeValue(b);

    if (normA === normB) return true;
    if (normA === null || normB === null || normA === undefined || normB === undefined) {
        return normA === normB;
    }

    if (typeof normA !== typeof normB) return false;

    if (Array.isArray(normA) && Array.isArray(normB)) {
        if (normA.length !== normB.length) return false;
        for (let i = 0; i < normA.length; i++) {
            if (!isDeepEqual(normA[i], normB[i])) return false;
        }
        return true;
    }

    if (isPlainObject(normA) && isPlainObject(normB)) {
        const keysA = Object.keys(normA);
        const keysB = Object.keys(normB);
        if (keysA.length !== keysB.length) return false;
        for (const key of keysA) {
            if (!Object.prototype.hasOwnProperty.call(normB, key)) return false;
            if (!isDeepEqual(normA[key], normB[key])) return false;
        }
        return true;
    }

    return false;
};

/**
 * Sanitize document for storage in audit log (mask sensitive values recursively).
 */
export const sanitizeForDiff = (doc) => {
    const normalized = normalizeValue(doc);
    if (normalized === null || normalized === undefined) return normalized;

    if (Array.isArray(normalized)) {
        return normalized.map((item) => sanitizeForDiff(item));
    }

    if (!isPlainObject(normalized)) return normalized;

    const sanitized = {};
    for (const [key, value] of Object.entries(normalized)) {
        if (isSensitiveKey(key)) {
            sanitized[key] = "[REDACTED]";
        } else if (isPlainObject(value) || Array.isArray(value)) {
            sanitized[key] = sanitizeForDiff(value);
        } else {
            sanitized[key] = value;
        }
    }
    return sanitized;
};

/**
 * Accurately calculate deep differences between old and new document objects.
 * Returns structured changes array with exact dot-notated paths.
 *
 * @param {Object} oldDoc
 * @param {Object} newDoc
 * @param {string} [prefix=""]
 * @returns {{ changes: Array, addedCount: number, modifiedCount: number, deletedCount: number, totalChanges: number, summary: string }}
 */
export const calculateObjectDiff = (oldDoc, newDoc, prefix = "") => {
    const normOld = normalizeValue(oldDoc) || {};
    const normNew = normalizeValue(newDoc) || {};

    const changes = [];

    const allKeys = new Set([...Object.keys(normOld), ...Object.keys(normNew)]);

    for (const key of allKeys) {
        if (IGNORED_FIELDS.has(key) || key === "_id") continue;

        const path = prefix ? `${prefix}.${key}` : key;
        const isSensitive = isSensitiveKey(key);

        const hasOld = Object.prototype.hasOwnProperty.call(normOld, key);
        const hasNew = Object.prototype.hasOwnProperty.call(normNew, key);

        const rawOldVal = normOld[key];
        const rawNewVal = normNew[key];

        // 1. Key added
        if (!hasOld && hasNew) {
            if (rawNewVal !== undefined) {
                changes.push({
                    field: path,
                    type: "added",
                    oldValue: null,
                    newValue: isSensitive ? "[REDACTED]" : sanitizeForDiff(rawNewVal),
                });
            }
            continue;
        }

        // 2. Key deleted
        if (hasOld && !hasNew) {
            changes.push({
                field: path,
                type: "deleted",
                oldValue: isSensitive ? "[REDACTED]" : sanitizeForDiff(rawOldVal),
                newValue: null,
            });
            continue;
        }

        // 3. Both have key - check for changes
        if (hasOld && hasNew) {
            // Nested object comparison
            if (isPlainObject(rawOldVal) && isPlainObject(rawNewVal)) {
                const nestedDiff = calculateObjectDiff(rawOldVal, rawNewVal, path);
                changes.push(...nestedDiff.changes);
            } else if (!isDeepEqual(rawOldVal, rawNewVal)) {
                changes.push({
                    field: path,
                    type: "modified",
                    oldValue: isSensitive ? "[REDACTED]" : sanitizeForDiff(rawOldVal),
                    newValue: isSensitive ? "[REDACTED]" : sanitizeForDiff(rawNewVal),
                });
            }
        }
    }

    let addedCount = 0;
    let modifiedCount = 0;
    let deletedCount = 0;

    for (const c of changes) {
        if (c.type === "added") addedCount++;
        else if (c.type === "modified") modifiedCount++;
        else if (c.type === "deleted") deletedCount++;
    }

    const summaryParts = [];
    if (addedCount > 0) summaryParts.push(`+${addedCount} added`);
    if (modifiedCount > 0) summaryParts.push(`~${modifiedCount} modified`);
    if (deletedCount > 0) summaryParts.push(`-${deletedCount} deleted`);

    const summary = summaryParts.length > 0 ? summaryParts.join(", ") : "No changes";

    return {
        changes,
        addedCount,
        modifiedCount,
        deletedCount,
        totalChanges: changes.length,
        summary,
    };
};

/**
 * Set a nested property on an object by dot-notation path (e.g. "profile.bio").
 */
export const setNestedValue = (obj, path, value) => {
    if (!obj || typeof obj !== "object") return;
    const parts = path.split(".");
    let current = obj;
    for (let i = 0; i < parts.length - 1; i++) {
        const part = parts[i];
        if (!current[part] || typeof current[part] !== "object") {
            current[part] = {};
        }
        current = current[part];
    }
    current[parts[parts.length - 1]] = value;
};

/**
 * Delete a nested property on an object by dot-notation path.
 */
export const deleteNestedValue = (obj, path) => {
    if (!obj || typeof obj !== "object") return;
    const parts = path.split(".");
    let current = obj;
    for (let i = 0; i < parts.length - 1; i++) {
        const part = parts[i];
        if (!current[part] || typeof current[part] !== "object") return;
        current = current[part];
    }
    delete current[parts[parts.length - 1]];
};

/**
 * Apply a delta change list to a base document.
 */
export const applyDeltaToDocument = (baseDoc, changes) => {
    const result = JSON.parse(JSON.stringify(normalizeValue(baseDoc) || {}));

    if (!Array.isArray(changes)) return result;

    for (const change of changes) {
        if (change.type === "added" || change.type === "modified") {
            setNestedValue(result, change.field, change.newValue);
        } else if (change.type === "deleted") {
            deleteNestedValue(result, change.field);
        }
    }

    return result;
};

/**
 * Reconstruct document state from a chronological array of version commits.
 *
 * @param {Array} commits - Sorted by version ascending (1, 2, 3...)
 * @param {number} [targetVersion] - Version to reconstruct up to
 * @returns {{ state: Object, currentVersion: number, isDeleted: boolean, lastCommit: Object }}
 */
export const reconstructDocumentAtVersion = (commits = [], targetVersion = null) => {
    if (!Array.isArray(commits) || commits.length === 0) {
        return { state: null, currentVersion: 0, isDeleted: false, lastCommit: null };
    }

    let state = {};
    let isDeleted = false;
    let reachedVersion = 0;
    let lastCommit = null;

    for (const commit of commits) {
        if (targetVersion !== null && commit.version > targetVersion) {
            break;
        }

        reachedVersion = commit.version;
        lastCommit = commit;

        if (commit.transactionType === "insert") {
            state = JSON.parse(
                JSON.stringify(
                    commit.diff?.snapshot || commit.diff?.added || commit.newValue || {}
                )
            );
            isDeleted = false;
        } else if (commit.transactionType === "update") {
            if (commit.diff?.changes?.length) {
                state = applyDeltaToDocument(state, commit.diff.changes);
            } else if (commit.newValue) {
                state = JSON.parse(JSON.stringify(commit.newValue));
            }
            isDeleted = false;
        } else if (commit.transactionType === "rollback" || commit.transactionType === "restore") {
            if (commit.diff?.snapshot) {
                state = JSON.parse(JSON.stringify(commit.diff.snapshot));
            } else if (commit.diff?.changes?.length) {
                state = applyDeltaToDocument(state, commit.diff.changes);
            }
            isDeleted = false;
        } else if (commit.transactionType === "delete") {
            isDeleted = true;
            // Retain the last known state in case caller wants to preview what was deleted
            if (commit.diff?.snapshot) {
                state = JSON.parse(JSON.stringify(commit.diff.snapshot));
            }
        }
    }

    return {
        state: normalizeValue(state),
        currentVersion: reachedVersion,
        isDeleted,
        lastCommit,
    };
};

/**
 * Compare any two document states to produce a complete Git-like diff tree.
 */
export const compareTwoVersions = (docA, docB) => {
    return calculateObjectDiff(docA, docB);
};

export default {
    calculateObjectDiff,
    compareTwoVersions,
    reconstructDocumentAtVersion,
    applyDeltaToDocument,
    normalizeValue,
    sanitizeForDiff,
    isDeepEqual,
    isSensitiveKey,
    isBcryptHash,
    BCRYPT_HASH_REGEX,
};
