# 🛡️ Enterprise Backend Boilerplate (Express.js + MongoDB)

> **A Production-Grade Node.js/Express Backend featuring an Enterprise Defense-in-Depth Authentication & Security Architecture, Multi-Device Session Management, Audit Trails, and Git-like Mongoose Document Versioning.**

---

## 📑 Table of Contents
1. [Overview & Philosophy](#-overview--philosophy)
2. [Enterprise Threat Mitigation Architecture](#-enterprise-threat-mitigation-architecture)
3. [Core Security Features](#-core-security-features)
4. [Project Architecture](#-project-architecture)
5. [Quick Start & Setup](#-quick-start--setup)
6. [Environment Variables Reference](#-environment-variables-reference)
7. [API Contract & HTTP Status Codes](#-api-contract--http-status-codes)
8. [Frontend Resilience & Cooldown Guide](#-frontend-resilience--cooldown-guide)
9. [Admin Monitoring & Versioning Dashboard](#-admin-monitoring--versioning-dashboard)
10. [License](#-license)

---

## 🌟 Overview & Philosophy

Most Node.js boilerplates provide basic username/password authentication with long-lived tokens, no rate limiting, and zero defense against automated botnets, credential stuffing, or email bombing.

This boilerplate is engineered from the ground up to provide **enterprise-grade defense-in-depth security** right out of the box:

- **Zero-Trust Network Perimeter:** Enforces server-side restrictions across every entry point—never relying on client-side state alone.
- **Dual-Tier Throttling:** Throttles both by **Origin IP** (sliding-window rate limiter) and by **Target Account Identity** (60-second database-enforced email cooldown).
- **Zero Information Leakage (Anti-Enumeration):** Employs timing-safe, uniform response patterns to prevent attackers from discovering whether target emails exist.
- **Fail-Closed Locking with Self-Service Recovery:** Automatically freezes compromised targets after 3 failed password attempts, while providing legitimate users with immediate, forensic-backed single-use cryptographic recovery links.
- **Instant Global Session Revocation:** Tracks unique session IDs (`jti`) per device; resetting credentials wipes all sessions across all devices instantly.

---

## 🛡️ Enterprise Threat Mitigation Architecture

The application implements a multi-layered security pipeline designed to stop attacks at the earliest possible boundary:

```mermaid
flowchart TD
    Client["Client / Attacker (Browser, curl, Botnet)"] --> L1["Layer 1: Network & Middleware Rate Limiter"]
    
    subgraph S1["Layer 1: IP Sliding Window"]
        L1 -->|Exceeds Hits/Min| Block429["HTTP 429: Too Many Requests (Retry-After Header)"]
        L1 -->|Within Quota| L2["Layer 2: Target Cooldown Guardrail"]
    end
    
    subgraph S2["Layer 2: Per-Account Cooldown"]
        L2 -->|Email Sent < 60s ago| Cooldown429["HTTP 429: Cooldown Active (waitSecs remaining)"]
        L2 -->|Cooldown Expired or First Hit| L3["Layer 3: Authentication & Lockout Engine"]
    end
    
    subgraph S3["Layer 3: Intrusion Detection & Lockout"]
        L3 -->|Password Incorrect (Attempts 1 & 2)| Warn401["HTTP 401: Failed Attempt (X attempts remaining)"]
        L3 -->|Password Incorrect (Attempt 3)| Lock403["HTTP 403: 24-Hour Account Lockout + Security Forensic Email"]
        L3 -->|Password Correct & Not Locked| Auth200["HTTP 200: Access Token (15m) + Refresh Token (7d)"]
    end

    subgraph S4["Layer 4: Self-Service Cryptographic Unlock"]
        Lock403 -.-> UnlockFlow["User receives email with single-use crypto token"]
        UnlockFlow --> ValidateToken{"Validate Token & Expiration"}
        ValidateToken -->|Valid & < 1h| ResetCounters["Reset failedLoginAttempts = 0, lockUntil = null"]
        ValidateToken -->|Invalid or Expired| RejectToken["HTTP 400 Bad Request"]
    end
```

### Threat Model Matrix

| Threat Vector | Attack Mechanics | Traditional Flaw | Boilerplate Enterprise Defense |
| :--- | :--- | :--- | :--- |
| **Password Brute-Force & Spraying** | Automated dictionaries trying passwords against targeted accounts. | Unlimited tries or simple delayed responses. | **3-Strike Progressive Lockout (24-Hour)** + IP penalty sliding window. |
| **API Denial of Service (DoS / DDoS)** | Thousands of rapid requests hitting auth endpoints to exhaust CPU/RAM. | Server thread/DB connection starvation. | **Sliding-Window IP Rate Limiter** with automated memory garbage collection. |
| **Email Inbox Spam Bombing** | Attackers cycling proxies to flood victim inboxes via "Forgot Password". | Frontend-only button disabling; backend allows infinite loops. | **Target-Account 60-Second Cooldown** enforced at the database level. |
| **Account Enumeration / Probing** | Probing `/forgot-password` to check if a target email is registered. | Returning `404 User Not Found`. | **Uniform Anti-Enumeration Responses** (`HTTP 200` with identical messages and timing). |
| **Token Replay & Stale Abuse** | Reusing intercepted or stale reset/unlock links. | Tokens stored unexpired or not cleared on first use. | **Single-Use Crypto Hex Tokens (32 bytes)** with 1-hour expiration and atomic clearance. |
| **Client Refresh Bypass** | Attackers/users refreshing browser (F5) to clear cooldown state. | In-memory component state reset on reload. | **Persistent Storage Countdown Synchronization** via `localStorage`. |
| **Session Hijacking After Breach** | Password reset leaves old compromised access tokens active. | Sessions remain active until JWT naturally expires. | **Instant Multi-Device Session Invalidation (`jti`)**; clears all active sessions. |

---

## ⚡ Core Security Features

### 1. Sliding-Window Rate Limiting (`src/middlewares/authRateLimiter.middleware.js`)
- Allocates per-endpoint hit budgets based on threat risk:
  - **Login:** 15 requests / minute
  - **Registration:** 10 requests / minute
  - **Forgot Password:** 5 requests / minute
  - **Request Unlock:** 5 requests / minute
  - **Reset Password:** 10 requests / minute
- Automatically sets standard `Retry-After: <seconds>` headers.
- Implements IP-level penalty blocks (15-minute freeze) for clients repeatedly triggering failed attempts.

### 2. Target-Account Email Cooldown
- Tracks `lastPasswordResetEmailSentAt` and `lastUnlockEmailSentAt` directly on the User model.
- Prevents distributed proxy botnets from exhausting SMTP quotas or spamming users.
- Returns HTTP 429 with `{ cooldownSeconds: waitSecs, retryAfter: waitSecs }`.

### 3. Progressive Warning & 3-Strike 24h Lockout Engine
- **Attempt 1:** 401 Unauthorized (`"Incorrect password. 2 attempt(s) remaining before a 24-hour account lockout."`)
- **Attempt 2:** 401 Unauthorized (`"Incorrect password. 1 attempt(s) remaining before a 24-hour account lockout."`)
- **Attempt 3:** 403 Forbidden (`"Account has been temporarily locked for 24 hours due to 3 consecutive failed login attempts."`)
- Automatically dispatches an asynchronous threat notification email containing:
  - Real client IP (resolved through reverse proxies via `X-Forwarded-For`).
  - Browser, Operating System, and Device parsing (via `ua-parser-js`).
  - Approximate geolocation / local network status.
  - Actionable **Unlock Account** and **Reset Password** recovery links.

### 4. Self-Service Cryptographic Unlock Protocol
- High-entropy 32-byte pseudo-random token (`crypto.randomBytes(32).toString('hex')` - 256 bits of entropy).
- 1-hour expiration window.
- Atomic token consumption: restores account access, resets failed counters, and clears tokens in a single database write.
- Dual-mode support: browser GET requests seamlessly redirect to the client frontend (`/sign-in?unlocked=true`), while API POST requests return JSON.

### 5. Dual-Token JWT & Multi-Device Session Architecture
- **Access Token:** Short-lived (15 minutes), used in `Authorization: Bearer <token>` headers.
- **Refresh Token:** Long-lived (7 days), signed with separate `REFRESH_TOKEN_SECRET_KEY`.
- **Multi-Device Tracking:** Each login session registers a unique UUID `jti` in `User.sessions`, capturing device type, browser, IP, and expiration.
- **Instant Revocation:** `/logout` revokes the specific device token; `/reset-password` revokes all active devices globally.

---

## 📁 Project Architecture

```
Backend-Boilerplate-MongoDB-Express/
├── docs/
│   └── authentication-and-security-architecture-blueprint.md  # Security Architecture Blueprint
├── frontend/
│   └── apps/admin/                  # Built-in React + Tailwind Admin Monitoring Dashboard
├── public/
│   └── admin/                       # Built static SPA assets
├── logs/                            # Real-time visual HTML log files (logs-YYYY-MM-DD.html)
├── src/
│   ├── app.js                       # Express application configuration & security headers
│   ├── index.js                     # HTTP server, Socket.io & Nodemailer initialization
│   ├── config/
│   │   ├── env.config.js            # Joi-validated environment variables
│   │   └── logger.config.js         # Dual-logging engine (Console + Styled HTML)
│   ├── constants/                   # Roles, statuses, and DB constants
│   ├── controllers/
│   │   ├── auth.controller.js       # Auth & security controllers
│   │   ├── logs.controller.js       # System stats, file logs, and document versioning
│   │   ├── notification.controller.js
│   │   └── user.controller.js
│   ├── db/
│   │   ├── index.js                 # Mongoose connection
│   │   └── adminBootstrap.js        # Automated System Admin user seeding
│   ├── middlewares/
│   │   ├── auth.middleware.js       # JWT Access Token & RBAC authorization
│   │   ├── authRateLimiter.middleware.js # Sliding-window rate limiter & IP throttler
│   │   ├── errorHandler.middleware.js    # RFC-compliant error generator & Retry-After headers
│   │   ├── requestLogger.middleware.js   # Request logging to MongoDB
│   │   └── validate.js              # Joi request schema validator
│   ├── models/
│   │   ├── plugins/
│   │   │   ├── versioning.plugin.js # Git-like Mongoose document history & rollback
│   │   │   ├── paginate.plugin.js
│   │   │   └── private.plugin.js
│   │   ├── user.model.js            # User entity with 10 threat mitigation security fields
│   │   ├── userProfile.model.js
│   │   ├── requestLogs.model.js
│   │   └── dbLogs.model.js
│   ├── routes/
│   │   ├── auth.routes.js           # Auth routes with attached rate limiters
│   │   ├── logs.routes.js           # Admin log & audit viewer routes
│   │   └── index.js
│   ├── services/
│   │   ├── auth.service.js          # Core authentication & threat mitigation engine
│   │   ├── mail.service.js          # Transactional email dispatcher (lockout alerts, resets)
│   │   └── user.service.js
│   └── utils/
│       ├── ApiError.js              # Standard error wrapper with data & cooldown support
│       ├── ApiResponse.js           # Standardized API response format
│       ├── asyncHandler.js          # Promise wrapper for Express routes
│       └── getIpDetails.js          # Real client IP resolver
├── .env.example                     # Comprehensive documented environment template
└── package.json
```

---

## 🚀 Quick Start & Setup

### Prerequisites
- **Node.js**: v18.0.0 or higher
- **MongoDB**: Local instance (`mongodb://localhost:27017`) or MongoDB Atlas URI
- **Package Manager**: `pnpm` (recommended) or `npm`

### 1. Clone & Install Dependencies
```bash
git clone <repository-url>
cd Backend-Boilerplate-MongoDB-Express
pnpm install
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Fill in your MongoDB URI, JWT secrets, and client URL (see [Environment Variables Reference](#-environment-variables-reference)).

### 3. Start the Development Server
```bash
# Starts backend with nodemon
pnpm dev
```
The server will start at `http://localhost:5000` (or configured `PORT`).

### 4. Admin User Bootstrap
If `BOOTSTRAP_ADMIN=true`, the backend automatically seeds a default administrator account on first startup:
- **Email:** `admin@example.com`
- **Password:** `admin12345`
Access the built-in Admin Monitoring Dashboard at `http://localhost:5000/admin`.

---

## ⚙️ Environment Variables Reference

| Variable | Type | Default | Description |
| :--- | :---: | :---: | :--- |
| `NODE_ENV` | `string` | `development` | Environment mode (`development`, `production`, `test`) |
| `PORT` | `number` | `5000` | Port for the Express HTTP server |
| `SELF_HOST_URL` | `string` | `http://localhost:5000` | Base URL of the backend API server |
| `CLIENT_URL` | `string` | `http://localhost:5173` | Frontend application URL (used in email recovery links) |
| `CORS_ORIGIN` | `string` | `*` | Allowed CORS origins (comma-separated list) |
| `MONGODB_URI` | `string` | *Required* | MongoDB connection URI |
| `DB_NAME` | `string` | `backend_boilerplate` | MongoDB database name |
| `ACCESS_TOKEN_SECRET_KEY` | `string` | *Required* | 256-bit secret key for short-lived JWT access tokens |
| `ACCESS_TOKEN_EXPIRY` | `string` | `15m` | Lifetime of access tokens (`15m`, `30m`, `1h`) |
| `REFRESH_TOKEN_SECRET_KEY` | `string` | *Required* | Secret key for long-lived JWT refresh tokens |
| `REFRESH_TOKEN_EXPIRY` | `string` | `7d` | Lifetime of refresh tokens (`7d`, `30d`) |
| `MAX_LOGIN_ATTEMPTS` | `number` | `3` | Failed login attempts before 24-hour lockout triggers |
| `LOCKOUT_DURATION_HOURS` | `number` | `24` | Duration of account lockout in hours |
| `EMAIL_COOLDOWN_SECONDS` | `number` | `60` | Minimum seconds between transactional emails per user |
| `RATE_LIMIT_LOGIN_MAX` | `number` | `15` | Max login requests per IP per minute |
| `RATE_LIMIT_EMAIL_MAX` | `number` | `5` | Max email dispatch requests per IP per minute |
| `EMAIL_SERVICE` | `string` | `gmail` | Nodemailer service name (optional if SMTP is configured) |
| `EMAIL_ID` | `string` | - | Email account for sending alerts |
| `EMAIL_PASSKEY` | `string` | - | App password / API key for email account |
| `EMAIL_FROM` | `string` | - | Display sender name & address |
| `SMTP_HOST` | `string` | - | Custom SMTP server hostname (SendGrid, SES, Mailgun) |
| `SMTP_PORT` | `number` | `587` | Custom SMTP port |
| `SMTP_SECURE` | `boolean` | `false` | Enable TLS/SSL for custom SMTP |
| `SMTP_USER` | `string` | - | Custom SMTP username |
| `SMTP_PASS` | `string` | - | Custom SMTP password |
| `BOOTSTRAP_ADMIN` | `boolean` | `true` | Automatically seed default admin on boot |
| `ADMIN_EMAIL` | `string` | `admin@example.com` | Bootstrap admin email |
| `ADMIN_PASSWORD` | `string` | `admin12345` | Bootstrap admin password |

---

## 📡 API Contract & HTTP Status Codes

### Authentication Endpoints

#### 1. Login
- **Endpoint:** `POST /api/auth/login`
- **Rate Limit:** 15 req / min
- **Request Body:**
  ```json
  {
    "email": "user@example.com",
    "password": "Password123"
  }
  ```
- **Responses:**
  - `200 OK`: Successful authentication.
    ```json
    {
      "statusCode": 200,
      "success": true,
      "message": "Login successful.",
      "data": {
        "accessToken": "eyJhbG...",
        "refreshToken": "eyJhbG...",
        "expiryTime": "2026-10-27T10:45:00.000Z",
        "user": { "id": "...", "email": "user@example.com", "role": "user" }
      }
    }
    ```
  - `401 Unauthorized`: Password incorrect (progressive warning).
    ```json
    {
      "statusCode": 401,
      "success": false,
      "message": "Incorrect password. 2 attempt(s) remaining before a 24-hour account lockout."
    }
    ```
  - `403 Forbidden`: Account locked due to 3 failed attempts.
    ```json
    {
      "statusCode": 403,
      "success": false,
      "message": "Account has been temporarily locked for 24 hours due to 3 consecutive failed login attempts."
    }
    ```
  - `429 Too Many Requests`: Network rate limit exceeded. `Retry-After: <seconds>` header included.

---

#### 2. Refresh Token
- **Endpoint:** `POST /api/auth/refresh-token`
- **Request Body:**
  ```json
  { "refreshToken": "eyJhbGciOi..." }
  ```
- **Responses:**
  - `200 OK`: Issues new access and refresh token pair.
  - `401 Unauthorized`: Token expired or session revoked.

---

#### 3. Forgot Password (Safe Anti-Enumeration)
- **Endpoint:** `POST /api/auth/forgot-password`
- **Rate Limit:** 5 req / min
- **Request Body:**
  ```json
  { "email": "user@example.com" }
  ```
- **Responses:**
  - `200 OK`: Uniform response regardless of whether account exists.
    ```json
    {
      "statusCode": 200,
      "success": true,
      "message": "If an account exists with that email, a password reset link has been dispatched.",
      "data": { "cooldownSeconds": 60 }
    }
    ```
  - `429 Too Many Requests`: Triggered within 60-second cooldown window.
    ```json
    {
      "statusCode": 429,
      "success": false,
      "message": "Please wait 45 seconds before requesting another password reset link.",
      "data": { "cooldownSeconds": 45, "retryAfter": 45 }
    }
    ```

---

#### 4. Reset Password
- **Endpoint:** `POST /api/auth/reset-password`
- **Rate Limit:** 10 req / min
- **Request Body:**
  ```json
  {
    "token": "64_char_hex_token_here",
    "newPassword": "NewSecurePassword123"
  }
  ```
- **Responses:**
  - `200 OK`: Updates password with bcrypt (10 rounds), resets lockout state, and revokes all active device sessions.
  - `400 Bad Request`: Token is invalid or has expired.

---

#### 5. Request Account Unlock
- **Endpoint:** `POST /api/auth/request-unlock`
- **Rate Limit:** 5 req / min
- **Request Body:**
  ```json
  { "email": "user@example.com" }
  ```
- **Responses:**
  - `200 OK`: Dispatches single-use unlock link if locked.
  - `429 Too Many Requests`: Dispatched within 60s cooldown.

---

#### 6. Unlock Account
- **Endpoint:** `GET /api/auth/unlock-account?token=...` or `POST /api/auth/unlock-account`
- **Responses:**
  - **Browser GET:** Automatically redirects to `${CLIENT_URL}/sign-in?unlocked=true`.
  - **API POST / JSON:**
    ```json
    {
      "statusCode": 200,
      "success": true,
      "message": "Account has been unlocked successfully. You may now sign in."
    }
    ```

---

#### 7. Logout & Session Revocation
- **Endpoint:** `POST /api/auth/logout` (or `GET /api/auth/logout`)
- **Headers:** `Authorization: Bearer <token>`
- **Response:** `200 OK`: Revokes matching session `jti` from database immediately.

---

#### 8. Account Support & Administrator Unlock (Admin / Help Desk Only)
- **Get All Currently Locked Accounts:**
  - **Endpoint:** `GET /api/user/admin/locked-users`
  - **Headers:** `Authorization: Bearer <admin_access_token>`
  - **Response:** `200 OK`: Returns list of all accounts currently frozen by brute-force lockout, including failed attempt counts, IP forensics, and remaining lockout minutes.
- **Unlock Any Account Immediately (Support Intervention):**
  - **Endpoint:** `POST /api/user/admin/unlock` (or `POST /api/user/admin/unlock/:userId`)
  - **Headers:** `Authorization: Bearer <admin_access_token>`
  - **Request Body:**
    ```json
    { "identifier": "user@example.com" }
    ```
  - **Response:** `200 OK`: Immediately clears lockout, resets failed attempts to 0, and restores account access.

---

## 💻 Frontend Resilience & Cooldown Guide

Frontends should prevent users from spamming buttons after page reloads by synchronizing cooldowns with `localStorage`:

```tsx
import React, { useState, useEffect } from "react";

const COOLDOWN_KEY = "auth_email_cooldown_expires";

export function CooldownButton({ onSend }: { onSend: () => Promise<void> }) {
  const [cooldown, setCooldown] = useState<number>(0);

  // 1. Restore timer across browser tab refreshes (F5)
  useEffect(() => {
    try {
      const stored = localStorage.getItem(COOLDOWN_KEY);
      if (stored) {
        const remaining = Math.ceil((Number(stored) - Date.now()) / 1000);
        if (remaining > 0) setCooldown(remaining);
        else localStorage.removeItem(COOLDOWN_KEY);
      }
    } catch (_) {}
  }, []);

  // 2. Local ticking interval
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => {
        if (prev <= 1) {
          localStorage.removeItem(COOLDOWN_KEY);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const handleAction = async () => {
    if (cooldown > 0) return;
    try {
      await onSend();
      const secs = 60;
      setCooldown(secs);
      localStorage.setItem(COOLDOWN_KEY, (Date.now() + secs * 1000).toString());
    } catch (err: any) {
      // 3. Handle server-returned 429 cooldowns
      if (err?.response?.status === 429) {
        const serverSecs = err?.response?.data?.data?.cooldownSeconds || 60;
        setCooldown(serverSecs);
        localStorage.setItem(COOLDOWN_KEY, (Date.now() + serverSecs * 1000).toString());
      }
    }
  };

  return (
    <button disabled={cooldown > 0} onClick={handleAction} className="btn-primary">
      {cooldown > 0 ? `Resend Link in ${cooldown}s` : "Send Recovery Link"}
    </button>
  );
}
```

---

## 📊 Admin Monitoring & Versioning Dashboard

The boilerplate includes a standalone Admin SPA mounted at `/admin`:

1. **Live HTML Request Logs:** View real-time color-coded HTTP requests, response times, and status messages generated in `logs/logs-YYYY-MM-DD.html`.
2. **MongoDB Audit Trails:** Search and filter historical database request logs and audit trails.
3. **Mongoose Git-Like Document Versioning:**
   - Visual version diff viewer across any entity.
   - One-click document rollback to any historical revision.
   - Complete actor and change-set audit history.

---

## 📄 License

This project is licensed under the ISC License.
