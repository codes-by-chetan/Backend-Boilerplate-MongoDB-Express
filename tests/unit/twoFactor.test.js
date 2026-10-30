import { describe, it, expect } from "vitest";
import { generateSecret, generate, verify, generateURI } from "otplib";

describe("Layer 7: Two-Factor Authentication (TOTP Engine)", () => {
    it("should generate high-entropy base32 secret and valid 6-digit TOTP token", async () => {
        const secret = generateSecret();
        expect(secret).toBeDefined();
        expect(secret.length).toBeGreaterThanOrEqual(16);

        const token = await generate({ secret });
        expect(token).toMatch(/^\d{6}$/);

        const result = await verify({ token, secret });
        expect(result?.valid).toBe(true);
    });

    it("should reject an invalid or tampered 6-digit code", async () => {
        const secret = generateSecret();
        const fakeToken = "000000";

        let isValid = false;
        try {
            const res = await verify({ token: fakeToken, secret });
            isValid = res?.valid === true;
        } catch (_) {
            isValid = false;
        }

        expect(isValid).toBe(false);
    });

    it("should generate formatted otpauth uri for QR code scanning", () => {
        const secret = generateSecret();
        const uri = generateURI({ secret, label: "admin@example.com", issuer: "ExpressSentinel" });

        expect(uri).toContain("otpauth://totp/");
        expect(uri).toContain("admin%40example.com");
        expect(uri).toContain("ExpressSentinel");
    });
});
