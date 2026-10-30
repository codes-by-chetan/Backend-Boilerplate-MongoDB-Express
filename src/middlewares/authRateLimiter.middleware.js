import config from "../config/env.config.js";
import ApiResponse from "../utils/ApiResponse.js";

/**
 * Enterprise Sliding-Window Rate Limiter & IP Throttler
 * Defends against API Denial-of-Service (DoS), Credential Stuffing, and Automated Password Spraying.
 */
class AuthRateLimiter {
    constructor() {
        this.ipHits = new Map(); // ip -> [timestamp1, timestamp2, ...]
        this.ipFailedAttempts = new Map(); // ip -> { count, firstFailedAt, blockUntil }

        // Self-cleaning memory garbage collection every 5 minutes
        const sweeper = setInterval(() => this.cleanup(), 5 * 60 * 1000);
        if (sweeper.unref) sweeper.unref();
    }

    /**
     * Resolves real client IP across reverse proxies and load balancers.
     */
    getClientIp(req) {
        return (
            req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
            req.headers["x-real-ip"] ||
            req.headers["x-client-ip"] ||
            req.socket?.remoteAddress ||
            req.ip ||
            "unknown_ip"
        );
    }

    /**
     * Removes stale timestamps older than 15 minutes to prevent memory leaks.
     */
    cleanup() {
        const now = Date.now();
        for (const [ip, timestamps] of this.ipHits.entries()) {
            const valid = timestamps.filter((t) => now - t < 15 * 60 * 1000);
            if (valid.length === 0) {
                this.ipHits.delete(ip);
            } else {
                this.ipHits.set(ip, valid);
            }
        }

        for (const [ip, record] of this.ipFailedAttempts.entries()) {
            if (record.blockUntil && record.blockUntil < now) {
                this.ipFailedAttempts.delete(ip);
            }
        }
    }

    /**
     * Registers a failed authentication attempt against an IP for penalty escalation.
     */
    recordFailedAttempt(ip, penaltyThreshold = 5, penaltyDurationMs = 15 * 60 * 1000) {
        const now = Date.now();
        const record = this.ipFailedAttempts.get(ip) || { count: 0, firstFailedAt: now };
        record.count += 1;

        if (record.count >= penaltyThreshold) {
            record.blockUntil = now + penaltyDurationMs;
        }

        this.ipFailedAttempts.set(ip, record);
    }

    /**
     * Clears failed attempt tracking on successful authentication.
     */
    resetFailedAttempts(ip) {
        this.ipFailedAttempts.delete(ip);
    }

    /**
     * Generates an Express middleware with customizable limits.
     */
    middleware({
        maxHitsPerMinute = 15,
        windowMs = 60 * 1000,
        message = "Too many authentication requests from this network. Rate limit exceeded.",
    } = {}) {
        return (req, res, next) => {
            const ip = this.getClientIp(req);
            const now = Date.now();

            // 1. Check IP-level penalty block
            const failedRecord = this.ipFailedAttempts.get(ip);
            if (failedRecord?.blockUntil && failedRecord.blockUntil > now) {
                const waitSecs = Math.ceil((failedRecord.blockUntil - now) / 1000);
                res.setHeader("Retry-After", waitSecs);
                const response = new ApiResponse(
                    429,
                    { retryAfter: waitSecs, cooldownSeconds: waitSecs },
                    `Too many failed attempts from your IP. Brute-force protection activated. Please wait ${waitSecs}s.`
                );
                return res.status(429).json(response);
            }

            // 2. Sliding window check
            let timestamps = (this.ipHits.get(ip) || []).filter((t) => now - t < windowMs);
            if (timestamps.length >= maxHitsPerMinute) {
                const oldestInWindow = timestamps[0];
                const waitSecs = Math.max(1, Math.ceil((oldestInWindow + windowMs - now) / 1000));
                res.setHeader("Retry-After", waitSecs);
                const response = new ApiResponse(
                    429,
                    { retryAfter: waitSecs, cooldownSeconds: waitSecs },
                    message
                );
                return res.status(429).json(response);
            }

            timestamps.push(now);
            this.ipHits.set(ip, timestamps);
            next();
        };
    }
}

export const authRateLimiterInstance = new AuthRateLimiter();

// Preconfigured limiters mapped to endpoint threat profiles
export const loginLimiter = authRateLimiterInstance.middleware({
    maxHitsPerMinute: config.security?.rateLimitLoginMax || 15,
    message: "Too many login attempts from this network. Please wait before trying again.",
});

export const registerLimiter = authRateLimiterInstance.middleware({
    maxHitsPerMinute: 10,
    message: "Too many registration attempts. Mass account creation is restricted.",
});

export const forgotPasswordLimiter = authRateLimiterInstance.middleware({
    maxHitsPerMinute: config.security?.rateLimitEmailMax || 5,
    message: "Too many password reset requests from this network. Please wait before retrying.",
});

export const unlockLimiter = authRateLimiterInstance.middleware({
    maxHitsPerMinute: config.security?.rateLimitEmailMax || 5,
    message: "Too many unlock requests from this network. Please wait before retrying.",
});

export const resetPasswordLimiter = authRateLimiterInstance.middleware({
    maxHitsPerMinute: 10,
    message: "Too many password reset submissions. Please wait before trying again.",
});

export default authRateLimiterInstance;
