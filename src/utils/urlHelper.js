import config from "../config/env.config.js";

/**
 * Dynamically resolves the frontend client application base URL and specific subpath.
 * Automatically inspects the incoming request context (custom headers, browser origin,
 * referer, or host headers) so that when the React Admin app is served directly from Express
 * (e.g. at http://localhost:3000/admin or on any host/port/domain in the browser),
 * all generated recovery URLs (unlock account, reset password) point to the exact
 * hostname, port, and scheme being used by the user in their browser.
 *
 * @param {import("express").Request} [req] - Incoming Express request
 * @param {string} [subPath=""] - Target path or query string (e.g., "/unlock-account?token=..." or "?unlocked=true")
 * @returns {string} The fully qualified, browser-aligned URL
 */
export const resolveClientAppUrl = (req, subPath = "") => {
    let baseUrl = "";

    // 1. Explicit clientUrl provided by frontend API client (body, query, or custom header)
    const explicitUrl =
        req?.body?.clientUrl ||
        req?.query?.clientUrl ||
        req?.get?.("x-client-url") ||
        req?.headers?.["x-client-url"];

    if (explicitUrl && typeof explicitUrl === "string") {
        baseUrl = explicitUrl.replace(/\/+$/, "");
    }

    // 2. Explicit clientOrigin from headers, body, or browser Origin header
    if (!baseUrl) {
        const origin =
            req?.body?.clientOrigin ||
            req?.query?.clientOrigin ||
            req?.get?.("x-client-origin") ||
            req?.headers?.["x-client-origin"] ||
            (req?.get?.("origin") && req?.get?.("origin") !== "null" ? req.get("origin") : null) ||
            (req?.headers?.origin && req?.headers?.origin !== "null" ? req.headers.origin : null);

        if (origin && typeof origin === "string") {
            const cleanOrigin = origin.replace(/\/+$/, "");
            baseUrl = `${cleanOrigin}/admin`;
        }
    }

    // 3. Browser Referer header (e.g. "http://localhost:3000/admin" or "http://localhost:3000/admin/db-requests")
    if (!baseUrl) {
        const referer = req?.get?.("referer") || req?.headers?.["referer"];
        if (referer) {
            try {
                const parsed = new URL(referer);
                baseUrl = `${parsed.origin}/admin`;
            } catch (_) {}
        }
    }

    // 4. Derive dynamically from Host header and protocol (trust proxy enabled)
    if (!baseUrl && (req?.get?.("host") || req?.headers?.host)) {
        const proto = req.protocol || (req.secure ? "https" : "http");
        const host = req.get?.("host") || req.headers.host;
        baseUrl = `${proto}://${host}/admin`;
    }

    // 5. Fallback to configured CLIENT_URL or SELF_HOST_URL
    if (!baseUrl) {
        const envUrl = config.client?.url || config.selfHostUrl || `http://localhost:${config.port || 3000}`;
        baseUrl = envUrl.replace(/\/+$/, "");
        if (!baseUrl.includes("/admin") && !baseUrl.includes(":5173")) {
            baseUrl = `${baseUrl}/admin`;
        }
    }

    const cleanSubPath = subPath
        ? subPath.startsWith("?") || subPath.startsWith("/")
            ? subPath
            : `/${subPath}`
        : "";

    return `${baseUrl}${cleanSubPath}`;
};

export default {
    resolveClientAppUrl,
};
