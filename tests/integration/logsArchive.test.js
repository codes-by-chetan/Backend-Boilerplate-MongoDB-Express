import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import crypto from "crypto";
import app from "../../src/app.js";
import models from "../../src/models/index.js";
import jwt from "jsonwebtoken";
import config from "../../src/config/env.config.js";
import constants from "../../src/constants/index.js";

describe("Log Archive & Data Retention API Integration", () => {
    let adminToken;

    beforeAll(async () => {
        // Find or bootstrap admin user
        let adminUser = await models.User.findOne({ role: constants.UserRoles.ADMIN });
        if (!adminUser) {
            adminUser = await models.User.findOne({ email: "admin@example.com" });
        }

        if (!adminUser) {
            adminUser = await models.User.create({
                fullName: "Super Admin",
                userName: "admin_test",
                email: "admin_test@example.com",
                password: "Password123!",
                role: constants.UserRoles.ADMIN,
                status: constants.UserStatus.Active,
            });
        }

        const tokenId = crypto.randomUUID();
        const keyId = crypto.randomUUID();
        adminUser.sessions.push({
            tokenId,
            keyId,
            deviceInfo: { browser: "TestBrowser", os: "TestOS", deviceType: "desktop" },
            ipAddress: "127.0.0.1",
            loginAt: new Date(),
            expiresAt: new Date(Date.now() + 3600000),
            isActive: true,
        });
        await adminUser.save();

        adminToken = jwt.sign(
            {
                id: adminUser._id,
                email: adminUser.email,
                role: adminUser.role,
                jti: tokenId,
            },
            config.jwt.secret,
            { expiresIn: "1h" }
        );
    });

    it("should reject unauthenticated access to archive endpoints with 401", async () => {
        const res = await request(app).get("/api/logs/archive/settings");
        expect(res.status).toBe(401);
    });

    it("should retrieve archive settings for authenticated admin", async () => {
        const res = await request(app)
            .get("/api/logs/archive/settings")
            .set("Authorization", `Bearer ${adminToken}`);

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data).toHaveProperty("enabled");
        expect(res.body.data).toHaveProperty("hasToken");
    });

    it("should retrieve data retention settings", async () => {
        const res = await request(app)
            .get("/api/logs/retention-settings")
            .set("Authorization", `Bearer ${adminToken}`);

        expect(res.status).toBe(200);
        expect(res.body.data).toHaveProperty("requestLogsDays");
    });

    it("should update data retention settings", async () => {
        const res = await request(app)
            .put("/api/logs/retention-settings")
            .set("Authorization", `Bearer ${adminToken}`)
            .send({ requestLogsDays: 14 });

        expect(res.status).toBe(200);
        expect(res.body.data.requestLogsDays).toBe(14);
    });

    it("should query live MongoDB logs via the unified queryArchiveLogs endpoint", async () => {
        const res = await request(app)
            .post("/api/logs/archive/query")
            .set("Authorization", `Bearer ${adminToken}`)
            .send({
                date: "live",
                filter: {},
                page: 1,
                limit: 10,
            });

        expect(res.status).toBe(200);
        expect(res.body.data).toHaveProperty("logs");
        expect(res.body.data).toHaveProperty("pagination");
        expect(res.body.data.source).toBe("live_mongodb");
    });

    it("should retrieve live storage stats", async () => {
        const res = await request(app)
            .get("/api/logs/archive/storage-stats")
            .set("Authorization", `Bearer ${adminToken}`);

        expect(res.status).toBe(200);
        expect(res.body.data).toHaveProperty("storageSizeMb");
        expect(res.body.data).toHaveProperty("dataSizeMb");
    });

    it("should retrieve pending archive dates", async () => {
        const res = await request(app)
            .get("/api/logs/archive/pending-dates")
            .set("Authorization", `Bearer ${adminToken}`);

        expect(res.status).toBe(200);
        expect(Array.isArray(res.body.data)).toBe(true);
    });
});
