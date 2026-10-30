import { describe, it, expect } from "vitest";
import { sanitizeInputs } from "../../src/middlewares/sanitize.middleware.js";

describe("NoSQL Query Injection Sanitizer Middleware", () => {
    it("should strip top-level MongoDB operators ($gt, $ne, $where)", () => {
        const req = {
            body: {
                email: "user@example.com",
                $gt: "",
                $where: "1 == 1",
            },
            query: {
                search: "hello",
                $regex: ".*",
            },
            params: {
                id: "123",
            },
        };
        const next = () => {};

        sanitizeInputs(req, {}, next);

        expect(req.body.email).toBe("user@example.com");
        expect(req.body.$gt).toBeUndefined();
        expect(req.body.$where).toBeUndefined();
        expect(req.query.search).toBe("hello");
        expect(req.query.$regex).toBeUndefined();
        expect(req.params.id).toBe("123");
    });

    it("should strip nested MongoDB operators and dot-notation tampering", () => {
        const req = {
            body: {
                filter: {
                    $ne: null,
                    nested: {
                        $gt: 0,
                        validKey: "allowedValue",
                    },
                },
                "admin.role": "admin",
            },
        };
        const next = () => {};

        sanitizeInputs(req, {}, next);

        expect(req.body["admin.role"]).toBeUndefined();
        expect(req.body.filter.$ne).toBeUndefined();
        expect(req.body.filter.nested.$gt).toBeUndefined();
        expect(req.body.filter.nested.validKey).toBe("allowedValue");
    });

    it("should handle arrays of objects recursively", () => {
        const req = {
            body: {
                items: [
                    { name: "Item 1", $dropMe: true },
                    { name: "Item 2", safe: true },
                ],
            },
        };
        const next = () => {};

        sanitizeInputs(req, {}, next);

        expect(req.body.items[0].name).toBe("Item 1");
        expect(req.body.items[0].$dropMe).toBeUndefined();
        expect(req.body.items[1].safe).toBe(true);
    });
});
