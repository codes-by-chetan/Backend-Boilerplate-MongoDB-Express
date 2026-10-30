import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

/**
 * Recursively scans an object and discovers all fields containing [ENCRYPTED:enc:...] tokens,
 * returning their full dot-notation JSON paths and cipherText values as stored in the database.
 *
 * @param {Object} obj
 * @param {string} [prefix=""]
 * @returns {Array<{ fieldName: string, cipherText: string }>}
 */
export function findEncryptedFieldPaths(obj, prefix = "") {
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
}

