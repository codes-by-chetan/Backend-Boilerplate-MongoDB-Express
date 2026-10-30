import { describe, it, expect } from "vitest";
import { passwordComplexityRegex } from "../../src/validations/auth.validation.js";

describe("Enterprise Password Complexity Policy", () => {
    it("should accept strong passwords meeting all 5 requirements", () => {
        expect(passwordComplexityRegex.test("StrongPass#2026")).toBe(true);
        expect(passwordComplexityRegex.test("Admin@12345")).toBe(true);
        expect(passwordComplexityRegex.test("C0mpl3x!Password")).toBe(true);
        expect(passwordComplexityRegex.test("P@$$w0rd2026!")).toBe(true);
    });

    it("should reject passwords that are too short (< 8 characters)", () => {
        expect(passwordComplexityRegex.test("Sh0rt!")).toBe(false);
    });

    it("should reject passwords missing an uppercase letter", () => {
        expect(passwordComplexityRegex.test("nouppercase#123")).toBe(false);
    });

    it("should reject passwords missing a lowercase letter", () => {
        expect(passwordComplexityRegex.test("NOLOWERCASE#123")).toBe(false);
    });

    it("should reject passwords missing a numeric digit", () => {
        expect(passwordComplexityRegex.test("NoNumbersHere!@#")).toBe(false);
    });

    it("should reject passwords missing a special character", () => {
        expect(passwordComplexityRegex.test("NoSpecialChar12345")).toBe(false);
    });
});
