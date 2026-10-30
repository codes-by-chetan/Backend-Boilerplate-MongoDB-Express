/**
 * OpenAPI 3.0.0 Specification for Enterprise Express & MongoDB Boilerplate
 */

export const swaggerSpec = {
    openapi: "3.0.0",
    info: {
        title: "Enterprise Backend API Boilerplate",
        version: "1.0.0",
        description:
            "Production-grade Express.js & MongoDB API with 7-layer defense-in-depth security, sliding-window rate limiting, 3-strike brute-force lockout, self-service cryptographic recovery, multi-device session management, and Git-like document versioning.",
        contact: {
            name: "Backend Security Team",
            email: "security@boilerplate.local",
        },
    },
    servers: [
        {
            url: "http://localhost:3000",
            description: "Local Development Server",
        },
    ],
    components: {
        securitySchemes: {
            bearerAuth: {
                type: "http",
                scheme: "bearer",
                bearerFormat: "JWT",
                description: "Enter your JWT access token issued by /api/auth/login",
            },
        },
        schemas: {
            ApiResponse: {
                type: "object",
                properties: {
                    statusCode: { type: "integer", example: 200 },
                    data: { type: "object", nullable: true },
                    message: { type: "string", example: "Operation completed successfully." },
                    success: { type: "boolean", example: true },
                },
            },
            ApiError: {
                type: "object",
                properties: {
                    statusCode: { type: "integer", example: 400 },
                    data: { type: "object", nullable: true },
                    message: { type: "string", example: "Invalid request payload." },
                    success: { type: "boolean", example: false },
                },
            },
            LoginPayload: {
                type: "object",
                required: ["password"],
                properties: {
                    email: { type: "string", format: "email", example: "admin@example.com" },
                    userName: { type: "string", example: "admin" },
                    password: { type: "string", format: "password", example: "Admin@12345" },
                },
            },
            RegisterPayload: {
                type: "object",
                required: ["email", "fullName", "password", "contactNumber"],
                properties: {
                    email: { type: "string", format: "email", example: "user@example.com" },
                    userName: { type: "string", example: "johndoe" },
                    fullName: {
                        type: "object",
                        required: ["firstName", "lastName"],
                        properties: {
                            firstName: { type: "string", example: "John" },
                            lastName: { type: "string", example: "Doe" },
                        },
                    },
                    password: {
                        type: "string",
                        format: "password",
                        example: "SecurePass#2026",
                        description: "Min 8 chars, 1 uppercase, 1 lowercase, 1 number, 1 special symbol.",
                    },
                    contactNumber: {
                        type: "object",
                        required: ["number"],
                        properties: {
                            countryCode: { type: "string", example: "+1" },
                            number: { type: "string", example: "5551234567" },
                        },
                    },
                },
            },
            RequestUnlockPayload: {
                type: "object",
                required: ["email"],
                properties: {
                    email: { type: "string", format: "email", example: "admin@example.com" },
                },
            },
            UnlockAccountPayload: {
                type: "object",
                required: ["token"],
                properties: {
                    token: {
                        type: "string",
                        example: "3a7b9c1d4e6f8a0b2c4d6e8f0a2b4c6d8e0a2b4c6d8e0a2b4c6d8e0a2b4c6d8e",
                        description: "64-character hexadecimal single-use cryptographic token dispatched via email/terminal.",
                    },
                },
            },
            ForgotPasswordPayload: {
                type: "object",
                required: ["email"],
                properties: {
                    email: { type: "string", format: "email", example: "admin@example.com" },
                },
            },
            ResetPasswordPayload: {
                type: "object",
                required: ["token", "newPassword"],
                properties: {
                    token: { type: "string", example: "a1b2c3d4e5f6..." },
                    newPassword: { type: "string", format: "password", example: "NewSecure#Pass99" },
                },
            },
            LockedUser: {
                type: "object",
                properties: {
                    _id: { type: "string", example: "660c1d4e8b3a..." },
                    email: { type: "string", example: "locked.user@example.com" },
                    failedLoginAttempts: { type: "integer", example: 3 },
                    lockUntil: { type: "string", format: "date-time" },
                    lastFailedLoginIp: { type: "string", example: "192.168.1.100" },
                    lastFailedLoginAt: { type: "string", format: "date-time" },
                },
            },
        },
    },
    paths: {
        "/api/auth/register": {
            post: {
                tags: ["Authentication"],
                summary: "Register a new user",
                description: "Registers a user and enforces enterprise password complexity. Throttled by registration rate limiter.",
                requestBody: {
                    required: true,
                    content: { "application/json": { schema: { $ref: "#/components/schemas/RegisterPayload" } } },
                },
                responses: {
                    201: { description: "User registered successfully", content: { "application/json": { schema: { $ref: "#/components/schemas/ApiResponse" } } } },
                    400: { description: "Validation error or email already in use", content: { "application/json": { schema: { $ref: "#/components/schemas/ApiError" } } } },
                    429: { description: "Rate limit exceeded" },
                },
            },
        },
        "/api/auth/login": {
            post: {
                tags: ["Authentication"],
                summary: "Sign in with email/username and password",
                description: "Authenticates credentials. Protected by sliding-window IP rate limiter and 3-strike brute-force lockout.",
                requestBody: {
                    required: true,
                    content: { "application/json": { schema: { $ref: "#/components/schemas/LoginPayload" } } },
                },
                responses: {
                    200: { description: "Authentication successful, returns JWT access and refresh tokens" },
                    401: { description: "Invalid password (returns remaining attempts before lockout)" },
                    403: { description: "Account temporarily locked (24 hours) due to consecutive failed attempts" },
                    429: { description: "Too many requests from origin IP" },
                },
            },
        },
        "/api/auth/forgot-password": {
            post: {
                tags: ["Authentication"],
                summary: "Request a password reset link",
                description: "Dispatches a single-use 1-hour reset token. Enforces anti-enumeration and 60-second account cooldown.",
                requestBody: {
                    required: true,
                    content: { "application/json": { schema: { $ref: "#/components/schemas/ForgotPasswordPayload" } } },
                },
                responses: {
                    200: { description: "Reset link dispatched (uniform response regardless of user existence)" },
                    429: { description: "Cooldown active or IP rate limit exceeded" },
                },
            },
        },
        "/api/auth/reset-password": {
            post: {
                tags: ["Authentication"],
                summary: "Set a new password using reset token",
                description: "Validates cryptographic token, hashes new password with bcrypt (10 rounds), resets lockout counters, and revokes active sessions.",
                requestBody: {
                    required: true,
                    content: { "application/json": { schema: { $ref: "#/components/schemas/ResetPasswordPayload" } } },
                },
                responses: {
                    200: { description: "Password updated successfully" },
                    400: { description: "Invalid or expired token" },
                },
            },
        },
        "/api/auth/request-unlock": {
            post: {
                tags: ["Authentication"],
                summary: "Request self-service account unlock link",
                description: "Generates a 64-character cryptographic unlock token and sends it via email (or logs to terminal in dev). Enforces 60-second target cooldown.",
                requestBody: {
                    required: true,
                    content: { "application/json": { schema: { $ref: "#/components/schemas/RequestUnlockPayload" } } },
                },
                responses: {
                    200: { description: "Unlock link dispatched" },
                    429: { description: "Cooldown active (returns remaining seconds in Retry-After)" },
                },
            },
        },
        "/api/auth/unlock-account": {
            get: {
                tags: ["Authentication"],
                summary: "Unlock account via direct link (Browser GET)",
                description: "Clicked from email or terminal. Validates token, clears lockout in DB, and redirects cleanly to /admin?unlocked=true.",
                parameters: [
                    { name: "token", in: "query", required: true, schema: { type: "string" } },
                ],
                responses: {
                    302: { description: "Redirects to /admin?unlocked=true (or unlocked=false on error)" },
                },
            },
            post: {
                tags: ["Authentication"],
                summary: "Unlock account via JSON API token (Mobile/SPA POST)",
                requestBody: {
                    required: true,
                    content: { "application/json": { schema: { $ref: "#/components/schemas/UnlockAccountPayload" } } },
                },
                responses: {
                    200: { description: "Account unlocked successfully" },
                    400: { description: "Invalid or expired unlock token" },
                },
            },
        },
        "/api/auth/refresh-token": {
            post: {
                tags: ["Authentication"],
                summary: "Refresh expired JWT access token",
                requestBody: {
                    required: true,
                    content: { "application/json": { schema: { type: "object", properties: { refreshToken: { type: "string" } } } } },
                },
                responses: {
                    200: { description: "New access token generated" },
                    401: { description: "Refresh token expired or invalid" },
                },
            },
        },
        "/api/auth/2fa/generate": {
            post: {
                tags: ["Two-Factor Authentication"],
                summary: "Generate TOTP secret and QR code for 2FA setup",
                security: [{ bearerAuth: [] }],
                responses: {
                    200: { description: "QR code data URL and base32 secret returned" },
                },
            },
        },
        "/api/auth/2fa/enable": {
            post: {
                tags: ["Two-Factor Authentication"],
                summary: "Verify 6-digit TOTP code and enable 2FA",
                security: [{ bearerAuth: [] }],
                requestBody: {
                    required: true,
                    content: { "application/json": { schema: { type: "object", required: ["token"], properties: { token: { type: "string", example: "123456" } } } } },
                },
                responses: {
                    200: { description: "2FA enabled and 8 one-time emergency recovery codes generated" },
                    400: { description: "Invalid 6-digit code" },
                },
            },
        },
        "/api/auth/2fa/disable": {
            post: {
                tags: ["Two-Factor Authentication"],
                summary: "Disable 2FA with password confirmation",
                security: [{ bearerAuth: [] }],
                requestBody: {
                    required: true,
                    content: { "application/json": { schema: { type: "object", required: ["password"], properties: { password: { type: "string" }, token: { type: "string" } } } } },
                },
                responses: {
                    200: { description: "2FA disabled successfully" },
                },
            },
        },
        "/api/auth/2fa/verify-login": {
            post: {
                tags: ["Two-Factor Authentication"],
                summary: "Step-up verification: complete login challenge using TOTP or recovery code",
                requestBody: {
                    required: true,
                    content: { "application/json": { schema: { type: "object", required: ["tempToken", "code"], properties: { tempToken: { type: "string" }, code: { type: "string", example: "123456" } } } } },
                },
                responses: {
                    200: { description: "Full JWT access and refresh tokens returned" },
                    401: { description: "Invalid code or expired temporary session" },
                },
            },
        },
        "/api/user/admin/locked-users": {
            get: {
                tags: ["Admin Security"],
                summary: "List all currently locked accounts (Admin Only)",
                security: [{ bearerAuth: [] }],
                responses: {
                    200: {
                        description: "List of locked accounts with intrusion forensics",
                        content: {
                            "application/json": {
                                schema: {
                                    type: "object",
                                    properties: {
                                        statusCode: { type: "integer", example: 200 },
                                        data: { type: "array", items: { $ref: "#/components/schemas/LockedUser" } },
                                    },
                                },
                            },
                        },
                    },
                    403: { description: "Admin privilege required" },
                },
            },
        },
        "/api/user/admin/unlock/{userId}": {
            post: {
                tags: ["Admin Security"],
                summary: "1-Click administrative unlock for a user account (Admin Only)",
                security: [{ bearerAuth: [] }],
                parameters: [
                    { name: "userId", in: "path", required: true, schema: { type: "string" } },
                ],
                responses: {
                    200: { description: "User account unlocked successfully" },
                    404: { description: "User not found" },
                },
            },
        },
        "/api/logs/system-stats": {
            get: {
                tags: ["System Telemetry"],
                summary: "Get real-time V8 heap and system telemetry (Admin Only)",
                security: [{ bearerAuth: [] }],
                responses: {
                    200: { description: "Telemetry snapshot (CPU, Memory, Uptime, OS)" },
                },
            },
        },
    },
};

export default swaggerSpec;
