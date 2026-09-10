import crypto from "crypto";

const SENSITIVE_KEYS = new Set([
    "password",
    "oldpassword",
    "newpassword",
    "confirmpassword",
    "currentpassword",
    "refreshtoken",
    "accesstoken",
    "token",
    "secret",
    "apikey",
    "authorization",
    "cookie",
    "set-cookie",
    "creditcard",
    "cvv",
    "ssn",
]);

/**
 * Checks if a key name matches sensitive patterns.
 * @param {string} key
 * @returns {boolean}
 */
export const isSensitiveKey = (key) => {
    if (!key || typeof key !== "string") return false;
    const lower = key.toLowerCase().replace(/[-_]/g, "");
    for (const s of SENSITIVE_KEYS) {
        if (lower === s || lower.includes(s)) return true;
    }
    return false;
};

/**
 * Encrypts a string using AES-256-GCM.
 * Format: "enc:<iv_hex>:<authTag_hex>:<ciphertext_hex>"
 *
 * @param {string} text
 * @param {string|Buffer} key
 * @returns {string}
 */
export const encryptText = (text, key) => {
    if (typeof text !== "string") {
        text = JSON.stringify(text);
    }

    try {
        const keyBuffer = Buffer.isBuffer(key)
            ? key
            : Buffer.from(key, typeof key === "string" && key.length === 64 ? "hex" : "utf8");

        // Ensure key is exactly 32 bytes (256 bits)
        const normalizedKey = crypto.createHash("sha256").update(keyBuffer).digest();

        const iv = crypto.randomBytes(12); // 96-bit IV recommended for GCM
        const cipher = crypto.createCipheriv("aes-256-gcm", normalizedKey, iv);

        let ciphertext = cipher.update(text, "utf8", "hex");
        ciphertext += cipher.final("hex");

        const authTag = cipher.getAuthTag().toString("hex");
        return `enc:${iv.toString("hex")}:${authTag}:${ciphertext}`;
    } catch (err) {
        return "[ENCRYPTION_FAILED]";
    }
};

/**
 * Decrypts an AES-256-GCM encrypted string.
 *
 * @param {string} encryptedString - Format "enc:<iv>:<tag>:<ciphertext>" or "[ENCRYPTED:enc:...]"
 * @param {string|Buffer} key
 * @returns {string}
 */
export const decryptText = (encryptedString, key) => {
    if (!encryptedString || typeof encryptedString !== "string") {
        throw new Error("Invalid encrypted payload");
    }

    let payload = encryptedString.trim();
    if (payload.startsWith("[ENCRYPTED:") && payload.endsWith("]")) {
        payload = payload.slice(11, -1);
    }

    if (!payload.startsWith("enc:")) {
        throw new Error("Payload is not in valid encrypted format");
    }

    const parts = payload.split(":");
    if (parts.length !== 4) {
        throw new Error("Malformed ciphertext structure");
    }

    const [, ivHex, tagHex, cipherHex] = parts;

    const keyBuffer = Buffer.isBuffer(key)
        ? key
        : Buffer.from(key, typeof key === "string" && key.length === 64 ? "hex" : "utf8");
    const normalizedKey = crypto.createHash("sha256").update(keyBuffer).digest();

    const decipher = crypto.createDecipheriv(
        "aes-256-gcm",
        normalizedKey,
        Buffer.from(ivHex, "hex")
    );
    decipher.setAuthTag(Buffer.from(tagHex, "hex"));

    let decrypted = decipher.update(cipherHex, "hex", "utf8");
    decrypted += decipher.final("utf8");

    return decrypted;
};

/**
 * Sanitizes a cookie header string by encrypting or redacting token values.
 * @param {string} cookieStr
 * @param {string} [key]
 * @returns {string}
 */
const sanitizeCookieHeader = (cookieStr, key) => {
    if (!cookieStr || typeof cookieStr !== "string") return cookieStr;
    return cookieStr
        .split(";")
        .map((part) => {
            const [name, ...rest] = part.trim().split("=");
            const val = rest.join("=");
            if (!val) return part;
            if (isSensitiveKey(name)) {
                const secureVal = key
                    ? `[ENCRYPTED:${encryptText(val, key)}]`
                    : "[REDACTED]";
                return `${name}=${secureVal}`;
            }
            return part;
        })
        .join("; ");
};

/**
 * Sanitizes an authorization header string.
 * @param {string} authHeader
 * @param {string} [key]
 * @returns {string}
 */
const sanitizeAuthHeader = (authHeader, key) => {
    if (!authHeader || typeof authHeader !== "string") return authHeader;
    const parts = authHeader.split(" ");
    if (parts.length === 2 && parts[0].toLowerCase() === "bearer") {
        const token = parts[1];
        const secureToken = key
            ? `[ENCRYPTED:${encryptText(token, key)}]`
            : "[REDACTED]";
        return `Bearer ${secureToken}`;
    }
    return key ? `[ENCRYPTED:${encryptText(authHeader, key)}]` : "[REDACTED]";
};

/**
 * Deeply sanitizes and encrypts confidential fields within objects, headers, and request/response payloads.
 *
 * @param {*} data - The input data to sanitize (object, array, primitive).
 * @param {Object} [options]
 * @param {string} [options.key] - Master encryption key for AES-256-GCM.
 * @param {boolean} [options.encrypt=true] - If true and key is present, encrypts; otherwise redacts to "[REDACTED]".
 * @returns {*} Sanitized deep clone of data.
 */
export const secureSanitize = (data, options = {}) => {
    const { key, encrypt = true } = options;

    if (data === null || data === undefined) return data;

    if (typeof data !== "object") {
        return data;
    }

    if (data instanceof Date || data instanceof RegExp) {
        return data;
    }

    if (Array.isArray(data)) {
        return data.map((item) => secureSanitize(item, options));
    }

    const sanitized = {};
    for (const [k, v] of Object.entries(data)) {
        const lowerKey = k.toLowerCase();

        // Special handling for cookie and authorization headers
        if (lowerKey === "cookie" && typeof v === "string") {
            sanitized[k] = sanitizeCookieHeader(v, encrypt ? key : null);
            continue;
        }

        if (lowerKey === "authorization" && typeof v === "string") {
            sanitized[k] = sanitizeAuthHeader(v, encrypt ? key : null);
            continue;
        }

        if (isSensitiveKey(k)) {
            if (encrypt && key && v !== null && v !== undefined) {
                const strVal = typeof v === "object" ? JSON.stringify(v) : String(v);
                sanitized[k] = `[ENCRYPTED:${encryptText(strVal, key)}]`;
            } else {
                sanitized[k] = "[REDACTED]";
            }
        } else if (typeof v === "object" && v !== null) {
            sanitized[k] = secureSanitize(v, options);
        } else {
            sanitized[k] = v;
        }
    }

    return sanitized;
};

/**
 * Recursively scans an object and discovers all fields containing [ENCRYPTED:enc:...] tokens,
 * returning their full dot-notation JSON paths and cipherText values.
 *
 * @param {Object} obj
 * @param {string} [prefix=""]
 * @returns {Array<{ fieldName: string, cipherText: string }>}
 */
export const findEncryptedFieldPaths = (obj, prefix = "") => {
    const items = [];
    if (!obj || typeof obj !== "object") return items;

    for (const [key, value] of Object.entries(obj)) {
        if (key.startsWith("_") && key !== "_id") continue;
        const currentPath = prefix
            ? (Array.isArray(obj) ? `${prefix}[${key}]` : `${prefix}.${key}`)
            : key;

        if (typeof value === "string") {
            if (value.includes("[ENCRYPTED:enc:")) {
                if (key.toLowerCase() === "cookie") {
                    const cookieParts = value.split(";").map((p) => p.trim());
                    for (const part of cookieParts) {
                        const [rawName, ...rawValParts] = part.split("=");
                        const cookieName = rawName?.trim();
                        const cookieVal = rawValParts.join("=").trim();
                        const m = cookieVal.match(/\[ENCRYPTED:(enc:[a-f0-9]+:[a-f0-9]+:[a-f0-9]+)\]/);
                        if (m && cookieName) {
                            items.push({
                                fieldName: `${currentPath}.${cookieName}`,
                                cipherText: m[1],
                            });
                        }
                    }
                } else {
                    const regex = /\[ENCRYPTED:(enc:[a-f0-9]+:[a-f0-9]+:[a-f0-9]+)\]/g;
                    const matches = [...value.matchAll(regex)];
                    for (let i = 0; i < matches.length; i++) {
                        const cipherText = matches[i][1];
                        items.push({
                            fieldName: matches.length > 1 ? `${currentPath}[${i}]` : currentPath,
                            cipherText,
                        });
                    }
                }
            }
        } else if (typeof value === "object" && value !== null) {
            items.push(...findEncryptedFieldPaths(value, currentPath));
        }
    }

    return items;
};

const cryptoUtil = {
    isSensitiveKey,
    encryptText,
    decryptText,
    secureSanitize,
    findEncryptedFieldPaths,
};

export default cryptoUtil;
