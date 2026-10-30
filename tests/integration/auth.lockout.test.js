import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "../../src/app.js";

describe("Layer 3: Brute-Force Lockout & Intrusion Detection", () => {
    it("should return HTTP 400 when invalid credentials format is supplied", async () => {
        const res = await request(app)
            .post("/api/auth/login")
            .send({ email: "invalid-email-format" });

        expect(res.status).toBe(400);
        expect(res.body.success).toBe(false);
    });

    it("should safely sanitize NoSQL injection attempts in login payload", async () => {
        const res = await request(app)
            .post("/api/auth/login")
            .send({
                email: { $gt: "" },
                password: "Password123!",
            });

        // $gt was stripped, so email is empty object and rejected by Joi validator
        expect(res.status).toBe(400);
        expect(res.body.message).toContain('"email" must be a string');
    });

    it("should enforce anti-enumeration on password reset requests", async () => {
        const res = await request(app)
            .post("/api/auth/forgot-password")
            .send({ email: "nonexistent-user@example.com" });

        // Must return uniform HTTP 200 without revealing if email exists in DB
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.message).toContain("If an account exists");
    });
});
