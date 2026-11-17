import { describe, it, expect, beforeEach } from "vitest";
import logArchiveService from "../../src/services/logArchive.service.js";

describe("LogArchiveService Unit Tests", () => {
    const testDate = "2026-11-15";
    const sampleLogs = [
        {
            _id: "6727a1b1234567890abcdef1",
            requestMethod: "GET",
            requestUrl: "/api/user/profile",
            responseStatus: 200,
            ipAddress: { clientIp: "192.168.1.10" },
            createdAt: "2026-11-15T10:15:00.000Z",
            origin: "http://localhost:5173",
        },
        {
            _id: "6727a1b1234567890abcdef2",
            requestMethod: "POST",
            requestUrl: "/api/auth/login",
            responseStatus: 401,
            errors: "Invalid credentials",
            ipAddress: { clientIp: "10.0.0.5" },
            createdAt: "2026-11-15T11:20:00.000Z",
            origin: "http://localhost:5173",
        },
        {
            _id: "6727a1b1234567890abcdef3",
            requestMethod: "GET",
            requestUrl: "/api/logs/system-stats",
            responseStatus: 500,
            errors: "Database connection timeout",
            ipAddress: { clientIp: "192.168.1.10" },
            createdAt: "2026-11-15T12:05:00.000Z",
            origin: "http://localhost:5173",
        },
        {
            _id: "6727a1b1234567890abcdef4",
            requestMethod: "DELETE",
            requestUrl: "/api/items/123",
            responseStatus: 204,
            ipAddress: { clientIp: "172.16.0.2" },
            createdAt: "2026-11-15T14:30:00.000Z",
            origin: "https://admin.example.com",
        },
    ];

    beforeEach(() => {
        logArchiveService.clearMemoryCache();
        logArchiveService.inMemoryCache.set(testDate, { logs: sampleLogs, cachedAt: Date.now() });
    });

    it("should encrypt and decrypt GitHub personal access tokens safely", () => {
        const plainToken = "ghp_TestSecretToken1234567890abcdef";
        const encrypted = logArchiveService.encryptToken(plainToken);
        expect(encrypted).not.toBe(plainToken);
        expect(encrypted).toContain("enc:");

        const decrypted = logArchiveService.decryptToken(encrypted);
        expect(decrypted).toBe(plainToken);
    });

    it("should query archived logs with exact status match", async () => {
        const result = await logArchiveService.queryArchiveLogs({
            date: testDate,
            filter: { responseStatus: 200 },
        });

        expect(result.pagination.total).toBe(1);
        expect(result.logs[0].requestUrl).toBe("/api/user/profile");
    });

    it("should evaluate MongoDB range operator ($gte 400) to find all error logs", async () => {
        const result = await logArchiveService.queryArchiveLogs({
            date: testDate,
            filter: { responseStatus: { $gte: 400 } },
        });

        expect(result.pagination.total).toBe(2);
        expect(result.stats.errorCount).toBe(2);
        expect(result.stats.byStatus["4xx"]).toBe(1);
        expect(result.stats.byStatus["5xx"]).toBe(1);
    });

    it("should support $in operator for HTTP methods", async () => {
        const result = await logArchiveService.queryArchiveLogs({
            date: testDate,
            filter: { requestMethod: { $in: ["POST", "DELETE"] } },
        });

        expect(result.pagination.total).toBe(2);
        expect(result.stats.byMethod.POST).toBe(1);
        expect(result.stats.byMethod.DELETE).toBe(1);
    });

    it("should filter logs using full-text search", async () => {
        const result = await logArchiveService.queryArchiveLogs({
            date: testDate,
            filter: {},
            search: "timeout",
        });

        expect(result.pagination.total).toBe(1);
        expect(result.logs[0].responseStatus).toBe(500);
        expect(result.logs[0].errors).toContain("Database connection timeout");
    });

    it("should correctly sort archived logs by timestamp", async () => {
        const ascResult = await logArchiveService.queryArchiveLogs({
            date: testDate,
            filter: {},
            sort: { createdAt: 1 },
        });

        expect(ascResult.logs[0].requestUrl).toBe("/api/user/profile");
        expect(ascResult.logs[ascResult.logs.length - 1].requestUrl).toBe("/api/items/123");

        const descResult = await logArchiveService.queryArchiveLogs({
            date: testDate,
            filter: {},
            sort: { createdAt: -1 },
        });

        expect(descResult.logs[0].requestUrl).toBe("/api/items/123");
    });

    it("should handle pagination limit and offsets cleanly", async () => {
        const page1 = await logArchiveService.queryArchiveLogs({
            date: testDate,
            filter: {},
            page: 1,
            limit: 2,
        });

        expect(page1.logs.length).toBe(2);
        expect(page1.pagination.totalPages).toBe(2);
        expect(page1.pagination.total).toBe(4);

        const page2 = await logArchiveService.queryArchiveLogs({
            date: testDate,
            filter: {},
            page: 2,
            limit: 2,
        });

        expect(page2.logs.length).toBe(2);
        expect(page2.pagination.page).toBe(2);
    });
});
