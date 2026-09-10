# 🚀 Production-Ready MongoDB & Express Backend Boilerplate

A modular, enterprise-grade backend boilerplate built with **Node.js**, **Express 5**, **MongoDB (Mongoose 9)**, **Socket.IO**, and an integrated **React + Vite Admin Dashboard**. 

Featuring **Git-like document versioning & time-travel rollback**, **dual-layer audit logging**, **multi-device JWT authentication**, **RBAC authorization**, and **real-time WebSocket log streaming**.

---

## 📑 Table of Contents

- [Features Overview](#-features-overview)
- [Admin Dashboard & Visual Tour](#-admin-dashboard--visual-tour)
- [Architecture & Tech Stack](#-architecture--tech-stack)
- [Project Directory Structure](#-project-directory-structure)
- [Getting Started](#-getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Environment Configuration](#environment-configuration)
  - [Running the Project](#running-the-project)
- [Git-Like Document Versioning & Time-Travel](#-git-like-document-versioning--time-travel)
  - [How It Works](#how-it-works)
  - [Using Versioning in Your Models](#using-versioning-in-your-models)
  - [Rollback & Sensitive Field Protection](#rollback--sensitive-field-protection)
- [Authentication & Multi-Device Sessions](#-authentication-tokens--multi-device-sessions)
- [User Management & Active Sessions Control](#-user-management--active-sessions-control)
- [Confidential Data Encryption in Request Logs](#-confidential-data-encryption-in-request-logs)
- [Confidential Decryption Audit Trail](#-confidential-decryption-audit-trail-dual-layer--immutable-auditing)
- [High-Scale Request Logging & Recursion Prevention](#-high-scale-request-logging--recursion-prevention)
- [Dual-Layer Logging & Monitoring](#-dual-layer-logging--monitoring)
- [Integrated React Admin Dashboard](#-integrated-react-admin-dashboard)
- [API Reference](#-api-reference)
  - [System & Health](#system--health)
  - [Authentication (`/api/auth`)](#authentication-apiauth)
  - [User Management (`/api/user`)](#user-management-apiuser)
  - [Profiles (`/api/profiles`)](#profiles-apiprofiles)
  - [Notifications (`/api/notifications`)](#notifications-apinotifications)
  - [Audit, Versioning & Logs (`/api/logs`)](#audit-versioning--logs-apilogs)
- [Mongoose Plugins & Reusable Schemas](#-mongoose-plugins--reusable-schemas)
  - [1. `paginate` Plugin](#1-paginate-plugin)
  - [2. `privatePlugin`](#2-privateplugin)
  - [3. `softDelete` Plugin](#3-softdelete-plugin)
  - [4. `versioning` Plugin (Complete Guide)](#4-versioning-plugin)
  - [5. Reusable Schemas](#5-reusable-schemas-srcmodelsreusableschemas)
- [Standardized API Response & Error Handling](#-standardized-api-response--error-handling)
- [Available Scripts](#-available-scripts)
- [License](#-license)

---

## 🌟 Features Overview

- **🛡️ Modern Authentication & Security**:
  - Stateless JWT authentication via HTTP-only Cookies and Authorization Headers.
  - Multi-device session tracking with device, OS, browser, and IP detection (`ua-parser-js`).
  - Dedicated Admin Portal login (`/api/auth/admin/login`) enforcing strict `role === "admin"`.
  - Automatic expiration and session clean-up hooks.
  - Role-Based Access Control (**RBAC**): `admin`, `manager`, `user`, `employee`, `supervisor`.
  - Social OAuth integration support (Google OAuth, Meta ready).
  - Bcrypt hashing with automated idempotency guards (prevents accidental double-hashing).
  - Automatic Admin User Bootstrapping upon initial server boot.

- **👥 User Management & Active Sessions Control**:
  - Complete User Directory with role promotion/demotion and account status controls.
  - Deep multi-device active session tracking with individual remote session termination.
  - Granular session revocation via unique token IDs (`jti`) matching database session records.

- **🔒 Confidential Data Encryption at Rest in Request Logs**:
  - Zero-leak HTTP request logging: raw credentials (passwords), JWT tokens (`accessToken`, `refreshToken`), and cookie headers are encrypted before persisting to MongoDB using AES-256-GCM.
  - Selective cookie header parsing encrypts only sensitive tokens while preserving cookie syntax.
  - Automatic recursive object tree traversal for nested sensitive data.

- **📜 Confidential Decryption Audit Trail (Dual-Layer & Immutable Auditing)**:
  - Role-gated on-demand decryption for authorized administrators with master key.
  - Mandatory justification policy (min 5 characters) before decryption is permitted.
  - Exactly ONE consolidated immutable audit log entry per batch operation recording admin identity, IP, justification, timestamp, target URL, and canonical MongoDB dot-notation field paths (`requestBody.password`, `responseBody.data.accessToken`, etc.).
  - Dedicated Audit Trail Inspector in Admin Portal with search, pagination, and count badges.

- **⚡ High-Scale Request Logging & Recursion Prevention**:
  - Prevents recursive log bloat by omitting bulk log arrays from `RequestLog.responseBody` and storing reference IDs.
  - Universal 50 KB size guard per log payload.
  - B-Tree indexes on `{ createdAt: -1 }`, `{ requestStatus: 1, createdAt: -1 }`, etc., preventing MongoDB in-memory sort memory limit errors.
  - High-throughput body parser configured to 50 MB (`express.json({ limit: "50mb" })`).

- **🕰️ Git-Like Document Versioning & Time-Travel**:
  - Automatic revision commit tracking (`insert`, `update`, `delete`, `rollback`).
  - Deep delta calculation showing field additions, modifications, and deletions with dot-notation.
  - Document reconstruction at any historical version $v$.
  - Time-travel rollback and resurrection of deleted documents with original `_id`.
  - Sensitive credential protection (redaction masking and preservation of active credentials).

- **📊 Dual-Layer Logging & Real-Time Monitoring**:
  - **File-based Logs**: Daily rotating HTML & text logs powered by Winston and Morgan.
  - **MongoDB Database Logs**: `RequestLog` (HTTP duration, status, IP) and `DbLogs` (audit commits).
  - **Real-Time WebSockets**: Live log and audit streaming over Socket.IO.
  - Live system stats: CPU usage, memory utilization, heap allocation, and uptime.

- **🖥️ Built-In Admin Dashboard SPA**:
  - Single Page Application built with **React 18**, **Vite 6**, **Tailwind CSS**, and **Lucide Icons**.
  - Hosted directly at `/admin` (or runnable in standalone dev mode via Vite).
  - Real-time log streams, request inspector, audit viewer, user management, decryption audit trail, and one-click rollback modals.

- **☁️ Cloud Uploads & Email Delivery**:
  - Multer file uploads with Cloudinary cloud media storage integration.
  - Nodemailer transporter configured for transactional emails.

- **🧩 Clean Code & Extensibility**:
  - Clean layered architecture: `controllers` ➔ `services` ➔ `models` ➔ `routes` ➔ `middlewares`.
  - Reusable Mongoose schemas: `address`, `avatar`, `contactNumber`, `fullName`, `logo`.
  - Built-in Mongoose plugins: `paginate`, `privatePlugin`, `softDelete`, `versioning`.
  - Request validation via Joi schemas.

---

## 📸 Admin Dashboard & Visual Tour

The boilerplate includes a production-grade observability and administrative control center located at **`/admin`** (served directly by Express or run independently with Vite).

Below is an interactive visual tour of the primary dashboards:

---

### 1. ⚡ System Telemetry & V8 Metrics
*Real-time hardware resource monitoring, memory allocation, Node.js process internals, and MongoDB cluster status.*

![System Telemetry Dashboard](https://raw.githubusercontent.com/codes-by-chetan/Backend-Boilerplate-MongoDB-Express/main/public/screenshots/01-system-telemetry.png)

- **Hardware Gauges**: Live CPU load averages (1m, 5m, 15m), Host RAM utilization percentage, and Node.js V8 Heap memory distribution.
- **Process & Cluster Health**: Live process uptime counter, Process ID (PID), Host architecture diagnostics, and MongoDB cluster connection state.
- **Record Counters**: Live count badges for registered users, HTTP request logs, and versioned database audit commits.
- **Raw Telemetry JSON**: Expandable and copyable full system snapshot payload for automated diagnostic reporting.

---

### 2. 📡 Real-Time WebSocket Log Stream
*Live streaming event console with instant search filtering, pause/resume controls, and in-flight request tracking.*

![Real-Time Log Stream](https://raw.githubusercontent.com/codes-by-chetan/Backend-Boilerplate-MongoDB-Express/main/public/screenshots/02-realtime-stream.png)

- **Bi-Directional Socket.IO Telemetry**: Instant push of newly recorded HTTP requests, errors, and database commits.
- **In-Flight Request Counter**: Real-time tracker showing concurrent active requests currently executing on the server.
- **Interactive Controls**: Auto-scroll toggles, instant pause/resume buffer, and dynamic log level filtering (`INFO`, `WARN`, `ERROR`).

---

### 3. 🛡️ HTTP Request Logs & Zero-Leak Encryption at Rest
*Comprehensive MongoDB request logging with automatic cryptographic protection of sensitive payloads.*

![MongoDB HTTP Request Logs](https://raw.githubusercontent.com/codes-by-chetan/Backend-Boilerplate-MongoDB-Express/main/public/screenshots/03-http-request-logs.png)

- **Complete Request History**: Paginated table detailing HTTP Method (`GET`, `POST`, `PUT`, `DELETE`), Response Status (`200`, `201`, `400`, `401`, `500`), Client IP, Authenticated User Email, and precise Execution Timestamp.
- **Advanced Filtering**: Instant filtering by Method, Status category (Successful vs. Failed), HTTP status code, and free-text search across URLs and IPs.
- **Encrypted Payloads at Rest**: Raw passwords, authorization headers, refresh tokens, and cookies are automatically stored as `[ENCRYPTED:AES-256-GCM]` ciphertexts, guaranteeing zero plaintext credential leakage in databases or backups.

---

### 4. 🔑 Role-Gated Confidential Data Decryption
*Authorized administrators can temporarily decrypt confidential fields with mandatory justification logging.*

![Confidential Field Decryption Justification](https://raw.githubusercontent.com/codes-by-chetan/Backend-Boilerplate-MongoDB-Express/main/public/screenshots/04-confidential-field-decryption.png)

- **Security Compliance Policy**: Enforces strict SOC2, HIPAA, and PCI-DSS compliance before confidential data can be accessed.
- **Mandatory Justification**: Administrators must provide a non-empty business justification (minimum 5 characters, e.g. *"Auditing authentication credentials and verifying token entropy for SOC2 compliance"*).
- **Target Context**: Clearly displays target endpoint (`POST /api/auth/admin/login`), detected encrypted field badges (`requestBody.password`, `responseBody.data.accessToken`, etc.), and provides a dedicated loading state (`Loader2`) during cryptographic computation.

---

### 5. 📜 Permanent Immutable Decryption Audit Trail
*Every decryption action is recorded permanently in MongoDB with full administrator attribution and canonical field paths.*

![Confidential Decryption Audit Trail](https://raw.githubusercontent.com/codes-by-chetan/Backend-Boilerplate-MongoDB-Express/main/public/screenshots/05-decryption-audit-trail.png)

- **Tamper-Proof Audit Records**: Tracks exact timestamp, administrator name & email, target endpoint URL, administrator client IP address, and stated justification reason.
- **Canonical Database Dot-Notation**: Displays exact database field paths decrypted (`requestBody.password`, `responseBody.data.refreshToken`, `requestHeaders.authorization`) rather than generic placeholders.
- **Single Consolidated Commit**: One immutable log entry per batch decryption with exact decrypted fields count badge.

---

### 6. 👥 User Management & Multi-Device Active Sessions
*Granular user directory with role-based access control and multi-device session inspector.*

![User Management and Active Sessions](https://raw.githubusercontent.com/codes-by-chetan/Backend-Boilerplate-MongoDB-Express/main/public/screenshots/06-user-management-sessions.png)

- **User Directory**: View account statuses (`ACTIVE` vs. `SUSPENDED`), role badges (`ADMIN`, `USER`, `MANAGER`), avatar initials, and active session counters.
- **Multi-Device Session Inspector**: Click any session badge to view all active connected devices for that user, including device type (Desktop, Mobile, Tablet), browser, operating system, client IP, login timestamp, and token expiration.
- **Remote Revocation**: Revoke individual suspect sessions with the **Terminate** button or revoke all active logins instantly with the **Terminate All Sessions** kill switch.

---

### 7. 🕰️ Git-Like Document Versioning & Time Machine
*Enterprise revision tracking, deep delta diff inspection, and point-in-time document rollback.*

![Document Revision Timeline](https://raw.githubusercontent.com/codes-by-chetan/Backend-Boilerplate-MongoDB-Express/main/public/screenshots/07-versioning-time-machine.png)

- **Visual Commit Timeline**: Chronological revision history (v1, v2, v3, ...) for any versioned Mongoose model (`User`, `UserProfile`, `Notification`, etc.).
- **Transaction Types**: Clear color-coded badges for `INSERT` (initial commit), `UPDATE` (field modification), `DELETE` (tombstone commit), and `ROLLBACK`.
- **Deep Git-Like Diffs**: Highlights exact field changes with old vs. new values and path notation.
- **Reconstruct & Rollback**: "Reconstruct State" allows previewing the document snapshot at any historical version, and "Rollback to vX" restores or resurrects the document in a single click.

---

### 8. 🗄️ Database Audit Commits Explorer
*Unified audit commit explorer across all collections in the MongoDB database.*

![Database Audit Commits](https://raw.githubusercontent.com/codes-by-chetan/Backend-Boilerplate-MongoDB-Express/main/public/screenshots/08-database-audit-logs.png)

- **Collection Explorer**: Filter transactions across affected collections, review commit summaries, affected document IDs, and actor attribution.

---

## 🛠️ Architecture & Tech Stack

| Domain | Technologies |
|---|---|
| **Runtime & Framework** | Node.js (v18+), Express 5 (ES Modules) |
| **Database & ODM** | MongoDB, Mongoose 9.x |
| **Real-time Engine** | Socket.IO 4.x |
| **Security & Auth** | JWT (`jsonwebtoken`), Bcrypt 6, Validator |
| **Validation** | Joi |
| **Media & Storage** | Multer, Cloudinary SDK |
| **Logging & Metrics** | Winston (Daily Rotate File), Morgan, Chalk |
| **Admin UI Frontend** | React 18, Vite 6, Tailwind CSS, Lucide React, React Router 7 |
| **Package Management** | pnpm (Monorepo Workspace) / npm |

---

## 📂 Project Directory Structure

```text
Backend-Boilerplate-MongoDB-Express/
├── .env.example                     # Environment variable template
├── package.json                     # Root package config and scripts
├── pnpm-workspace.yaml              # Monorepo workspace configuration
├── frontend/                        # Frontend workspace applications
│   └── apps/
│       └── admin/                   # React + Vite Admin Dashboard
│           ├── src/
│           │   ├── components/      # UI components, modals, and view tabs
│           │   ├── hooks/           # Socket.IO and theme custom hooks
│           │   ├── api/             # API client and service endpoints
│           │   └── index.css        # Tailwind and custom theme styles
│           └── vite.config.js       # Vite configuration
├── public/                          # Static assets and compiled admin SPA
│   ├── admin/                       # Built Admin SPA (served at /admin)
│   └── temp/images/                 # Temporary local upload cache
├── logs/                            # Winston daily rotated file logs
└── src/                             # Express backend source code
    ├── app.js                       # Express app configuration & middleware pipeline
    ├── index.js                     # Server entry point, DB connect & Socket.IO init
    ├── config/                      # Environment and Winston logger configs
    ├── constants/                   # User roles, status, and DB constants
    ├── controllers/                 # Route controllers (request/response orchestration)
    ├── db/                          # MongoDB connection & admin bootstrapping
    ├── middlewares/                 # Auth, RBAC, error handling, upload, request logger
    ├── models/                      # Mongoose models (User, DbLogs, RequestLog, etc.)
    │   ├── plugins/                 # Custom plugins (versioning, paginate, private)
    │   └── reusableSchemas/         # Reusable nested schemas (address, avatar, etc.)
    ├── routes/                      # Modular API route definitions
    ├── services/                    # Business logic and database operations
    ├── sockets/                     # Socket.IO handlers and real-time streaming
    ├── utils/                       # ApiError, ApiResponse, diff.util, mailer, Cloudinary
    └── validations/                 # Joi validation schemas
```

---

## 🚦 Getting Started

### Prerequisites

- **Node.js**: v18.0.0 or higher (v20+ recommended)
- **MongoDB**: Local MongoDB instance (default port `27017`) or MongoDB Atlas URI
- **Package Manager**: `pnpm` (recommended for monorepo workspace) or `npm`

### Installation

Clone the repository and install all dependencies:

```bash
# Clone the repository
git clone <repository-url>
cd Backend-Boilerplate-MongoDB-Express

# Install dependencies for both backend and frontend workspace
pnpm install
# OR if using npm:
# npm install
```

### Environment Configuration

Create a `.env` file in the root directory by copying `.env.example`:

```bash
cp .env.example .env
```

Configure your variables:

```env
# Server Configuration
NODE_ENV=development
PORT=5000
SELF_HOST_URL=http://localhost:5000
CORS_ORIGIN=*

# MongoDB Connection
MONGODB_URI=mongodb://localhost:27017
DB_NAME=backend_boilerplate

# JWT Secrets & Expiry
ACCESS_TOKEN_SECRET_KEY=your_super_secret_access_jwt_key_here
ACCESS_TOKEN_EXPIRY=15m

REFRESH_TOKEN_SECRET_KEY=your_super_secret_refresh_jwt_key_here
REFRESH_TOKEN_EXPIRY=7d

# AES-256-GCM Encryption Key for Confidential Request Logging (64-character hex or string)
LOG_ENCRYPTION_KEY=e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855

# Admin Auto-Bootstrap (creates default admin account on startup)
BOOTSTRAP_ADMIN=true
ADMIN_NAME=Admin
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=admin12345

# Cloudinary (Optional - For file/avatar uploads)
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
CLOUDINARY_FOLDER=UPLOADS

# Email (Optional - For Nodemailer notifications)
EMAIL_SERVICE=gmail
EMAIL_ID=your_email@gmail.com
EMAIL_PASSKEY=your_app_password
```

### Running the Project

#### 1. Start the Backend API (Development Mode)
```bash
pnpm dev
# OR: npm run dev
```
- API starts at: `http://localhost:5000`
- Health check: `http://localhost:5000/`
- Pre-built Admin Dashboard: `http://localhost:5000/admin`

#### 2. Start the Admin Dashboard Frontend in Hot-Reload Dev Mode
```bash
pnpm dev:admin
# Starts Vite dev server at http://localhost:5173
```

#### 3. Build the Admin Dashboard for Production
When making modifications to `frontend/apps/admin`, build the production bundle:
```bash
pnpm build:admin
# Builds optimized assets directly to public/admin
```

---

## 🕰️ Git-Like Document Versioning & Time-Travel

This boilerplate contains a built-in, Git-inspired version control engine for MongoDB documents.

### How It Works

1. **Initial Commit ($v1$)**: When a document is inserted, a snapshot commit is recorded in `DbLogs` with `transactionType: "insert"`.
2. **Delta Updates ($v2, v3, \dots$)**: When a document is updated, the pre-save hook computes a deep difference against the baseline state using `calculateObjectDiff()`. Only changed keys and their nested dot-notation paths are committed (`transactionType: "update"`).
3. **Tombstone Commits**: When a document is deleted via `.deleteOne()` or `.findOneAndDelete()`, a `delete` commit records the tombstone state.
4. **Reconstruction**: `reconstructDocumentAtVersion(commits, targetVersion)` dynamically walks the commit tree and reconstructs the document to its exact state at that version.
5. **Time-Travel Rollback & Resurrection**:
   - For active documents: Overwrites the current fields with the historical state.
   - For deleted documents: **Resurrects** the document back into the active MongoDB collection retaining its original `_id`.
   - Records a dedicated `rollback` commit in `DbLogs` to maintain an immutable audit trail.

### Using Versioning in Your Models

To enable versioning on any Mongoose schema:

```javascript
import mongoose from "mongoose";
import plugins from "./plugins/index.js";

const articleSchema = new mongoose.Schema({
    title: { type: String, required: true },
    content: { type: String, required: true },
    author: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
});

// Register the versioning plugin
articleSchema.plugin(plugins.versioning, {
    collectionName: "Article", // optional, defaults to modelName
    excludeFieldsOnRollback: ["internalNotes"], // optional fields to protect on rollback
});

const Article = mongoose.model("Article", articleSchema);
export default Article;
```

#### Model Static Methods Provided:
```javascript
// 1. Fetch entire commit history
const history = await Article.getDocHistory(documentId);

// 2. Reconstruct document state at version 3
const { state, currentVersion, isDeleted } = await Article.reconstructDocVersion(documentId, 3);

// 3. Rollback document to version 2 (or resurrect if deleted)
const result = await Article.rollbackDocToVersion(documentId, 2, { user: req.user._id });
```

### Rollback & Sensitive Field Protection

When handling sensitive fields like `password`, the engine employs three layers of defense:
- **`[REDACTED]` Shield**: Sanitized values (`"[REDACTED]"`) in historical snapshots are never written back to active documents during rollback.
- **Rollback Flag**: `doc._isRollbackOperation = true` informs pre-save hooks to skip password re-encryption during rollback.
- **Bcrypt Regex Guard**: Automatically detects standard `$2a$`, `$2b$`, and `$2y$` hashes and prevents double-hashing even if set directly.

---

## 🔐 Authentication, Tokens & Multi-Device Sessions

This boilerplate implements a production-ready **Dual-Token Authentication Architecture**:

- **Short-Lived Access Tokens (`15m`)**:
  - Contains user claims (`id`, `email`, `role`, `userName`, `fullName`, `jti`, `type: "access"`).
  - Used to authorize all protected API requests.
- **Long-Lived Refresh Tokens (`7d`)**:
  - Signed with a dedicated `REFRESH_TOKEN_SECRET_KEY` (`type: "refresh"`).
  - Tracked against active sessions in MongoDB.
  - Used exclusively to obtain new token pairs via `/api/auth/refresh-tokens`.
- **Token Rotation & Replay Protection**:
  - Every time `/api/auth/refresh-tokens` is invoked, the previous session identifier is revoked and a fresh token pair is generated.
  - If a revoked or invalid refresh token is presented, the request is rejected with `401 Unauthorized`.
- **Dual Transport Flexibility**:
  - **Cookies**: Tokens are set as secure HTTP-only cookies (`accessToken` and `refreshToken`), shielding SPAs from XSS attacks.
  - **Headers & Body**: Returned in JSON response bodies (`accessToken`, `refreshToken`) and accepted via standard `Authorization: Bearer <token>` headers for mobile apps and external API clients.
- **Multi-Device Tracking & Remote Logout**:
  - Each login creates a tracked session in `user.sessions` with browser, OS, device, IP, and expiration.
  - Users can log out from the current device (`/api/auth/logout`) or all devices at once (`/api/auth/logout-all`).
  - Automatic session cleanup prunes expired sessions via a Mongoose pre-find hook.
- **Admin Dashboard Silent Auto-Refresh**:
  - The built-in React Admin SPA intercepts `401 Access Token Expired` responses.
  - Automatically invokes `/api/auth/refresh-tokens` in the background with a request-queue mutex to prevent duplicate calls.
  - Updates active telemetry and Socket.IO connections without forcing the admin to re-authenticate.

---

## 👥 User Management & Active Sessions Control

Enterprise application security requires continuous visibility and control over user identities, assigned privileges, and all active authentication sessions.

### Purpose
To provide administrators with centralized governance over the user directory, allow role delegation (`admin`, `manager`, `user`), and give real-time visibility into all connected devices and active sessions with surgical remote revocation capabilities.

### How to Use

#### 1. Via the Admin Portal (`/admin/users`)
- Navigate to the **Users** tab in the Admin Dashboard.
- **Search & Filter**: Search users by name, username, or email; filter by role (`admin`, `manager`, `user`) or status.
- **Inspect Sessions**: Click the **Devices / Sessions** button on any user card or row to open the active sessions modal.
- **Review Connected Devices**: View the device type (Desktop, Mobile, Tablet), operating system (macOS, Windows, Linux, iOS, Android), browser (Chrome, Firefox, Safari), IP address, login timestamp, and last activity time.
- **Terminate Session**: Click the red **Revoke** button on any specific session to instantly disconnect that specific device without logging the user out from their other trusted devices.
- **Promote / Demote Roles**: Use the role selector to assign or change user roles (`admin`, `manager`, `user`).

#### 2. Via REST API
```bash
# List all users with pagination and search
GET /api/user/all-users?page=1&limit=20&search=john&role=user
Authorization: Bearer <ADMIN_ACCESS_TOKEN>

# Update a user's role
PATCH /api/user/:userId/role
Content-Type: application/json
Authorization: Bearer <ADMIN_ACCESS_TOKEN>

{
  "role": "manager"
}

# Fetch all active sessions for a user
GET /api/user/:userId/sessions
Authorization: Bearer <ADMIN_ACCESS_TOKEN>

# Revoke a specific active session remotely
DELETE /api/user/:userId/sessions/:tokenId
Authorization: Bearer <ADMIN_ACCESS_TOKEN>
```

### Why We Improvised This
Traditional authentication systems provide only two blunt options: rely on passive token expiration or force a global "log out everywhere" when suspicious activity is suspected. In modern enterprise environments:
- Users frequently login from multiple devices (work laptops, personal phones, shared workstations).
- Security teams need granular visibility into device fingerprints to detect account sharing, credential stuffing, or suspicious logins from anomalous IP ranges.
- Administrators must be empowered to surgically terminate a compromised session (e.g. a lost phone or unauthorized login) immediately without disrupting the user on their primary active workstations.

### How We Maintain Security
- **Unique Token Identifiers (`jti`)**: Every issued JWT contains a unique cryptographic `jti` claim mapped 1-to-1 to a record in `user.sessions`.
- **Instant Revocation**: When a session is terminated, its `tokenId` is deleted from MongoDB. Middleware validates incoming tokens against active database sessions—if a session is revoked, subsequent requests are immediately blocked with `401 Unauthorized` even if the JWT has not reached its cryptographic expiry.
- **Role-Based Authorization (`requireAdmin`)**: Session inspection and role modification endpoints are strictly gated by RBAC middleware, forbidding non-admin users from viewing or modifying other users' credentials or sessions.

---

## 🔒 Confidential Data Encryption in Request Logs

In production systems, standard request loggers capture raw HTTP request and response payloads. Without specialized protection, sensitive data like user passwords, bearer tokens, and session cookies are leaked directly into log databases in plaintext.

### Purpose
To achieve **zero-leak request logging** by automatically intercepting and encrypting confidential fields (such as plaintext passwords in login payloads, JSON Web Tokens, refresh tokens, and authentication cookies) before persisting HTTP transactions to MongoDB.

### How It Works & How to Use
Encryption is completely automated and transparent:
1. Configure a master 256-bit encryption key in your `.env`:
   ```env
   LOG_ENCRYPTION_KEY=e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
   ```
2. Any request processed by `requestLoggerMiddleware` is recursively scanned:
   - **Request Bodies**: Passwords, secrets, pins, and tokens (e.g., `req.body.password`) are encrypted.
   - **Request Headers**: The `Cookie` header is parsed, and authentication cookies (`accessToken`, `refreshToken`, `token`) are isolated and encrypted while keeping cookie syntax valid.
   - **Response Bodies**: Tokens and expiry timestamps returned in authentication responses (e.g., `/api/auth/login`, `/api/auth/admin/login`) are encrypted before database insertion.
3. In MongoDB `requestlogs`, sensitive fields are stored with the secure tag format:
   ```json
   {
     "requestBody": {
       "email": "user@example.com",
       "password": "[ENCRYPTED:enc:1ab42c59eecfaaeccbed9e9f:34614a0f33925f095e505205a43ae776:5751db9d0f77f23d7076]"
     }
   }
   ```

### Why We Improvised This
Standard application logging is one of the most common vectors for catastrophic credential leakage:
- During user registration, login, and password change requests, raw passwords travel in request payloads.
- Authentication responses return long-lived refresh tokens and access tokens.
- If logged in cleartext, anyone with read-only database access, log access, or access to database backups possesses plaintext user passwords and live session tokens, enabling total account compromise without cracking password hashes.
- Compliance standards (PCI-DSS §3.4, GDPR Art. 32, HIPAA §164.312, SOC2) mandate cryptographic protection of sensitive authentication data at rest.

### How We Maintain Security
- **AES-256-GCM Authenticated Encryption**: We employ AES-256 in Galois/Counter Mode (GCM), providing both confidentiality and cryptographic integrity verification.
- **Unique Per-Value Nonces (IV)**: Every single encrypted field uses a cryptographically random 12-byte initialization vector (`crypto.randomBytes(12)`). Encrypting the exact same password multiple times produces completely different ciphertexts, defeating rainbow table attacks.
- **Authentication Tags**: A 16-byte GCM authentication tag verifies that the ciphertext has not been tampered with or corrupted.
- **Selective Cookie Header Encryption**: Rather than redacting the entire `Cookie` header (which would destroy diagnostic utility), `sanitizeCookieHeader` parses the cookie key-value pairs, encrypts only sensitive token values, and preserves non-sensitive cookies.
- **Graceful Fallback**: If no encryption key is configured, the system automatically falls back to `[REDACTED]` masking, preventing accidental plaintext leakage under all circumstances.

---

## 📜 Confidential Decryption Audit Trail (Dual-Layer & Immutable Auditing)

When troubleshooting production issues, authenticating third-party integrations, or conducting forensic investigations, authorized administrators may occasionally require temporary access to encrypted log data.

### Purpose
To provide authorized administrators with controlled, role-gated on-demand decryption of confidential fields while enforcing a strict justification policy and recording a **permanent, immutable audit trail** in MongoDB.

### How to Use

#### 1. In the Admin Portal (`/admin/db-requests`)
- Navigate to **HTTP Requests** in the Admin Dashboard.
- When viewing a request that contains encrypted fields (indicated with a purple badge and `[ENCRYPTED:enc:...]` values), click **"Decrypt Confidential Fields (Master Key)"**.
- **Mandatory Justification**: A modal prompts for an audit justification (minimum 5 characters, e.g. *"Investigating authentication failure for customer ticket #412"*).
- Click **"Authorize & Decrypt"**: The button displays a dedicated spinner (`Loader2`), sends the request, and instantly decrypts the tokens in place inside the JSON viewer (`[DECRYPTED: ...]`).
- **Inspect Audit Trail**: Click the **"Decryption Audits"** button in the top toolbar to open the **Confidential Decryption Audit Trail** modal:
  - View timestamp, administrator email, target request URL, justification, admin IP address, and count.
  - Review **Decrypted Fields** badges showing the exact database key names decrypted.

#### 2. Via REST API
```bash
# Batch decrypt confidential fields for a request log
POST /api/logs/decrypt-field
Content-Type: application/json
Authorization: Bearer <ADMIN_ACCESS_TOKEN>

{
  "logId": "6aa2725c433a80e45eaa1f54",
  "reason": "Security audit verification of proxy token validity"
}

# Fetch the permanent decryption audit trail
GET /api/logs/decryption-audits?page=1&limit=15&search=proxy
Authorization: Bearer <ADMIN_ACCESS_TOKEN>
```

### Why We Improvised This
1. **Single Consolidated Audit Entry**: Initial implementations generated a separate audit log for every single decrypted field, resulting in 6 to 3,500 audit entries for a single button click. We redesigned the engine to produce **exactly ONE consolidated audit log entry** per batch operation containing an array of all decrypted fields (`fields`) and the total count (`fieldsCount`).
2. **Canonical Database Key Name Resolution**: Earlier versions displayed fallback placeholders like `field_1`, `field_2` or generic `body.password` because top-level scans failed to inspect nested response bodies. We introduced `findEncryptedFieldPaths`, which recursively resolves the exact MongoDB document paths:
   - `requestBody.password`
   - `responseBody.data.accessToken`
   - `responseBody.data.refreshToken`
   - `responseBody.data.token`
   - `responseBody.data.accessTokenExpiryTime`
   - `responseBody.data.refreshTokenExpiryTime`
   - `requestHeaders.cookie.accessToken`
3. **Dual-Layer Resolution**: Even if legacy clients or external scripts submit generic field names, the backend fetches the MongoDB `RequestLog` document by `logId` and maps every ciphertext back to its canonical database path.

### How We Maintain Security
- **Strict Role Gating**: Decryption endpoints are accessible only to authenticated accounts with `role === "admin"`.
- **Mandatory Reason Requirement**: Decryption without a valid reason of at least 5 characters is rejected with `400 Bad Request`.
- **Permanent Immutability**: Decryption logs are written to the dedicated `DecryptionAuditLog` collection, storing admin identity (`decryptedBy`, `decryptedByEmail`), IP address, user agent, target URL, and timestamp. Audit logs cannot be updated or deleted via API.
- **Server-Side Key Isolation**: The master key `LOG_ENCRYPTION_KEY` never leaves the backend environment. Plaintext values are only returned in the transient HTTP response for the authorized session.

---

## ⚡ High-Scale Request Logging & Recursion Prevention

When building comprehensive observability in Express and MongoDB, logging endpoints can inadvertently trigger catastrophic recursive feedback loops.

### Purpose & Problem Encountered
When an administrator loads the HTTP request logs (`GET /api/logs/db-request-logs?page=1&limit=20`), the server returns 20 historical request logs. Because `requestLoggerMiddleware` captures outgoing responses, it logged the response of `/api/logs/db-request-logs`—embedding all 20 previous logs inside the new log's `responseBody`!
- Each subsequent log query embedded previous logs in an exponential cascade.
- Individual documents ballooned to **15 MB each**, and the collection inflated to **~50 MB**.
- When sorting queries with `limit > 10`, MongoDB crashed with:
  `Executor error during find command: backend_boilerplate.requestlogs :: caused by :: Sort exceeded memory limit of 33554432 bytes, but did not opt in to external sorting. Aborting operation.`
- HTTP clients failed with `413 Request Entity Too Large` when attempting to decrypt these massive logs.

### How We Improvised This
1. **Omit Bulk Log Arrays & Store Reference IDs**:
   When `requestLoggerMiddleware` logs queries to log endpoints (`db-request-logs`, `decrypt-field`, `db-audit-logs`, `decryption-audits`), it omits the nested log documents from `responseBody` and stores clean reference metadata:
   ```json
   {
     "_omitted": true,
     "description": "Response logs omitted from RequestLog to prevent recursive bloat",
     "logCount": 20,
     "logIds": ["6aa27d2eaa44162cb6090e10", "6aa27d2daa44162cb6090e0f", ...],
     "pagination": { "page": 1, "limit": 20, "total": 218 },
     "statusCode": 200
   }
   ```
   All request headers, IP address, status, method, URL, execution time, and user identity are 100% preserved.
2. **Universal 50 KB Size Guard**:
   For any request or response body across the entire application, if the serialized payload exceeds 50 KB, it is automatically truncated in the log. **No single `RequestLog` can ever exceed 50 KB.**
3. **MongoDB B-Tree Indexes**:
   Added compound indexes on `{ createdAt: -1 }`, `{ requestStatus: 1, createdAt: -1 }`, `{ requestMethod: 1, createdAt: -1 }`, and `{ responseStatus: 1, createdAt: -1 }`. MongoDB uses the B-Tree index for $O(\text{limit})$ sorted queries without buffering documents into RAM.
4. **Allow Disk Use**:
   Added `.allowDiskUse(true)` to `RequestLog.find()` in `logs.controller.js`.
5. **High-Throughput Body Parser**:
   Configured `express.json({ limit: "50mb" })` and `express.urlencoded({ extended: true, limit: "50mb" })` in `app.js`.
6. **Smart Database-Level Resolution**:
   When decrypting logs in the Admin UI, the client sends `{ logId, reason }` directly instead of uploading multi-megabyte JSON arrays over HTTP. The backend resolves and decrypts 3,500+ fields directly from the database in under 1 second.

---

## 📊 Dual-Layer Logging & Monitoring

```text
Incoming HTTP Request
       │
       ├──► Morgan ──► Daily Rotating File (logs/YYYY-MM-DD.html)
       │
       ├──► requestLoggerMiddleware ──► MongoDB (RequestLog collection)
       │                                     │
       │                                     └──► Socket.IO ('stream:db-requests')
       │
       └──► Mongoose Versioning ──────► MongoDB (DbLogs collection)
                                             │
                                             └──► Socket.IO ('stream:db-audits')
```

- **File-Based Logs**: Stored under `/logs` categorized by date. Formatted with styled HTML tables for easy reading in standard browsers.
- **MongoDB Request Logs**: Tracks response time in milliseconds, HTTP method, URL, status code, IP address, and authenticated user.
- **Socket.IO Live Streaming**:
  - Connect to Socket.IO namespace.
  - Emit `stream:start` with channel (`logs`, `db-requests`, `db-audits`).
  - Listen on `stream:data` for live log events.

---

## 🖥️ Integrated React Admin Dashboard

Access the production admin panel at **`http://localhost:3000/admin`** (or configured `PORT`).

> [!TIP]
> **Default Admin Credentials (Bootstrap Account)**:
> - **Email**: `admin@example.com`
> - **Password**: `admin12345`
> - *Auto-bootstrapped upon first server startup with full `admin` role privileges.*

### Dashboard Capabilities:
1. **System Health & Telemetry**: Live CPU, memory, V8 heap usage, process uptime, and MongoDB cluster status.
2. **Live WebSocket Stream**: Real-time event monitor with pause/resume, search filter, and auto-scroll.
3. **HTTP Request Inspector & Encryption**: Filter requests by HTTP status (2xx, 3xx, 4xx, 5xx), method, and duration with zero-leak field encryption.
4. **Role-Gated Confidential Decryption**: Temporarily decrypt confidential fields (passwords, tokens, cookies) with mandatory justification.
5. **Permanent Decryption Audit Trail**: Immutable security audit records of all administrator decryptions with canonical database key paths.
6. **User Directory & Multi-Device Sessions**: Manage user accounts, status, RBAC roles, inspect active device sessions, and perform remote termination.
7. **Git-Like Time Machine (Versioning & Rollback)**:
   - Browse documents by model (`User`, `UserProfile`, `Notification`, etc.).
   - Visual commit timeline modal showing user details, timestamp, and diff summary.
   - Side-by-side JSON diff comparison viewer between any two versions.
   - **One-Click Rollback / Resurrection Modal**: Select any previous revision to restore or resurrect deleted records.

👉 **See the complete [Admin Dashboard & Visual Tour](#-admin-dashboard--visual-tour) for full-resolution screenshots of every screen.**

---

## 📡 API Reference

### System & Health

| Method | Endpoint | Description | Auth |
|---|---|---|---|
| `GET` | `/` | API Health Check and Uptime | Public |

---

### Authentication (`/api/auth`)

| Method | Endpoint | Description | Auth |
|---|---|---|---|
| `POST` | `/api/auth/register` | Register new user account (sets cookies & returns tokens) | Public |
| `POST` | `/api/auth/login` | Login with email/username & password (sets cookies & returns tokens) | Public |
| `POST` | `/api/auth/admin/login` | Dedicated Admin Portal login (enforces `role === "admin"`) | Public (Admin credentials) |
| `POST` | `/api/auth/verify-social-token` | Authenticate via Google OAuth token | Public |
| `POST` | `/api/auth/refresh-tokens` | Rotate and issue new access & refresh tokens (via cookie or body) | Public / Refresh Token |
| `POST` | `/api/auth/change-password` | Update current user password | Authenticated |
| `GET` | `/api/auth/refresh-user` | Get current authenticated user details | Authenticated |
| `GET` / `POST` | `/api/auth/logout` | Invalidate current session & clear auth cookies | Authenticated |
| `POST` | `/api/auth/logout-all` | Revoke all active sessions across all devices | Authenticated |

---

### User Management (`/api/user`)

| Method | Endpoint | Description | Auth |
|---|---|---|---|
| `GET` | `/api/user/profile` | Get current user's profile | Authenticated |
| `GET` | `/api/user/profile-whole` | Get complete user profile with nested relations | Authenticated |
| `POST` | `/api/user/update/profile` | Update profile details (address, bio, contacts) | Authenticated |
| `POST` | `/api/user/avatar` | Upload avatar image (Cloudinary integration) | Authenticated |
| `GET` | `/api/user/all-users` | Get paginated user directory with search and role filters | Admin Only |
| `PATCH` | `/api/user/:userId/role` | Update user role (`admin`, `manager`, `user`, etc.) | Admin Only |
| `GET` | `/api/user/:userId/sessions` | List all active multi-device sessions for a user | Admin Only |
| `DELETE` | `/api/user/:userId/sessions/:tokenId` | Remotely revoke a specific active user session | Admin Only |

---

### Profiles (`/api/profiles`)

| Method | Endpoint | Description | Auth |
|---|---|---|---|
| `GET` | `/api/profiles/:userId` | Get public profile by User ID | Public |

---

### Notifications (`/api/notifications`)

| Method | Endpoint | Description | Auth |
|---|---|---|---|
| `GET` | `/api/notifications` | Get paginated notifications for current user | Authenticated |
| `GET` | `/api/notifications/unread-count` | Get total unread notifications count | Authenticated |
| `PATCH` | `/api/notifications/mark-read/:id` | Mark specific notification as read | Authenticated |
| `PATCH` | `/api/notifications/mark-all-read` | Mark all notifications as read | Authenticated |
| `DELETE` | `/api/notifications/:id` | Delete notification | Authenticated |

---

### Audit, Versioning & Logs (`/api/logs`)
*(Requires `admin` role)*

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/logs` | List all file-based log records |
| `GET` | `/api/logs/recents` | Get recent file-based log entries |
| `GET` | `/api/logs/by-date/:date` | Get file logs for specific date (`YYYY-MM-DD`) |
| `GET` | `/api/logs/system-stats` | Get live server CPU, memory & heap statistics |
| `GET` | `/api/logs/db-request-logs` | Query paginated HTTP request logs from MongoDB |
| `GET` | `/api/logs/db-audit-logs` | Query paginated audit commits from MongoDB |
| `POST` | `/api/logs/decrypt-field` | Batch decrypt confidential fields for a request log (requires justification) |
| `GET` | `/api/logs/decryption-audits` | Query permanent immutable decryption audit trail |
| `GET` | `/api/logs/models` | List all Mongoose models supporting versioning |
| `GET` | `/api/logs/model-docs/:modelName` | Get paginated documents for a specific model |
| `GET` | `/api/logs/document-history/:modelName/:docId` | Get complete revision history for a document |
| `GET` | `/api/logs/document-version/:modelName/:docId/:v` | Reconstruct document state at version `v` |
| `GET` | `/api/logs/document-compare/:modelName/:docId?v1=X&v2=Y` | Generate deep Git-like diff between version X and Y |
| `POST` | `/api/logs/document-rollback/:modelName/:docId` | Rollback document or resurrect deleted document to version `targetVersion` |

---

## 🧩 Mongoose Plugins & Reusable Schemas

### 1. `paginate` Plugin
Provides clean pagination, dynamic sorting, and field population:
```javascript
const filter = { role: "user" };
const options = {
    sortBy: "createdAt:desc",
    limit: 10,
    page: 1,
    populate: "profile",
};
const result = await User.paginate(filter, options);
// result: { results, page, limit, totalPages, totalResults }
```

### 2. `privatePlugin`
Automatically strips fields marked `private: true`, password hashes, and `__v` from JSON serialization:
```javascript
const userSchema = new mongoose.Schema({
    password: { type: String, private: true },
});
userSchema.plugin(plugins.privatePlugin);
```

### 3. `softDelete` Plugin
Adds `deleted` and `deletedAt` flags and filters deleted documents by default on find queries:
```javascript
const userSchema = new mongoose.Schema({ ... });
userSchema.plugin(plugins.softDelete);

// Documents can be soft deleted:
await user.softDelete();
```

### 4. `versioning` Plugin (Complete Step-by-Step Guide)

The `versioning` plugin (`src/models/plugins/versioning.plugin.js`) gives any Mongoose model enterprise-grade Git-like revision history, deep delta calculation, point-in-time reconstruction, and one-click rollback/resurrection.

![Document Revision Timeline in Admin Time Machine](https://raw.githubusercontent.com/codes-by-chetan/Backend-Boilerplate-MongoDB-Express/main/public/screenshots/07-versioning-time-machine.png)

---

#### Step 1: Import & Register on Schema

Register the plugin on any Mongoose schema before compiling the model:

```javascript
import mongoose from "mongoose";
import plugins from "./plugins/index.js"; // or import versioning from "./plugins/versioning.plugin.js"

const articleSchema = new mongoose.Schema({
    title: { type: String, required: true },
    content: { type: String, required: true },
    tags: [{ type: String }],
    status: { type: String, enum: ["draft", "published", "archived"], default: "draft" },
    publishedAt: { type: Date },
}, { timestamps: true });

// Attach the versioning plugin with optional configurations
articleSchema.plugin(plugins.versioning, {
    collectionName: "Article",                     // Name stored in DbLogs.affectedCollection (defaults to model name)
    excludeFieldsOnRollback: ["publishedAt"],     // Fields preserved and not overwritten during rollbacks
    includeSensitiveOnRollback: false,            // Shields passwords, tokens, and secrets from historical overwrite
});

const Article = mongoose.model("Article", articleSchema);
export default Article;
```

#### Plugin Options Reference:
| Option | Type | Default | Description |
|---|---|---|---|
| `collectionName` | `string` | `model.modelName` | Name of the collection stored in `DbLogs.affectedCollection`. |
| `excludeFieldsOnRollback` | `string[]` | `[]` | Array of field keys that will not be overwritten when rolling back to an older version. |
| `includeSensitiveOnRollback` | `boolean` | `false` | When `false`, fields matching sensitive keywords (`password`, `token`, `secret`, `hash`) are never overwritten with historical values during rollback. |

---

#### Step 2: Attaching User Attribution Context (`_reqContext`)

When saving or updating a document from an Express controller or service, attach `_reqContext` to the Mongoose document before calling `.save()`. The plugin automatically captures this context and attributes the revision commit to the user and their IP address:

```javascript
// In your controller or service:
const updateArticle = async (req, res) => {
    const article = await Article.findById(req.params.id);
    if (!article) throw new ApiError(404, "Article not found");

    article.title = req.body.title;
    article.content = req.body.content;

    // Attach user attribution context before saving
    article._reqContext = {
        user: req.user?._id || null,
        ipAddress: req.ipDetails?.clientIp || req.ip,
        origin: req.headers.origin,
    };

    await article.save();
    // Automatically generates a v(n+1) update commit in DbLogs linked to req.user._id!
};
```

---

#### Step 3: How Revision Commits Are Recorded Automatically

The plugin hooks into Mongoose lifecycle events (`post("init")`, `pre("save")`, `post("save")`, and `pre("deleteOne")`):

1. **Initial Creation (`isNew`)**:
   - Creates revision **`v1`** with `transactionType: "insert"`.
   - Stores a complete baseline snapshot of all document fields (excluding `_id`) in `DbLogs`.
2. **Deep Delta Updates (`isModified()`)**:
   - Calculates a recursive field-level diff between the original baseline and the current modified document.
   - Computes added, modified, and deleted properties in dot-notation (`tags.0`, `status`, etc.).
   - Increments the version number (**`v2`**, **`v3`**, ...) and stores only the delta patch.
   - **No Wasteful Commits**: If no actual business fields changed, no empty commit is generated.
3. **Deletions / Soft-Deletes**:
   - When calling `doc.deleteOne()` or `doc.softDelete()`, the plugin records a tombstone revision commit with `transactionType: "delete"` and a final snapshot of the document before removal.

---

#### Step 4: Fetching Document Revision History

Use the model static method `getDocHistory(docId)` to fetch the complete chronological commit log:

```javascript
const commits = await Article.getDocHistory(articleId);

// Returns array of DbLogs records:
// [
//   { version: 1, transactionType: "insert", summary: "Initial commit (v1)", createdAt: ... },
//   { version: 2, transactionType: "update", summary: "title modified, status modified", diff: { ... }, user: { email: ... } },
//   { version: 3, transactionType: "update", summary: "content modified", diff: { ... } }
// ]
```

---

#### Step 5: Point-in-Time State Reconstruction

Reconstruct what a document looked like at any historical version $v$ without modifying the database:

```javascript
// Reconstruct Article at version 1
const { state, currentVersion, isDeleted } = await Article.reconstructDocVersion(articleId, 1);

console.log("Reconstructed document state at v1:", state);
console.log("Active live version in DB:", currentVersion);
console.log("Is document currently deleted?", isDeleted);
```

The reconstruction algorithm fetches the initial baseline snapshot (v1) and sequentially applies all forward delta patches up to version $v$.

---

#### Step 6: Rolling Back or Resurrecting a Document

Use `rollbackDocToVersion(docId, targetVersion, context)` to revert an active document to an older version OR resurrect a deleted document:

```javascript
// Rollback article to version 1
const rollbackResult = await Article.rollbackDocToVersion(articleId, 1, {
    user: req.user._id,
    ipAddress: req.ip,
    origin: req.headers.origin,
});

console.log(rollbackResult);
// Output:
// {
//   document: { _id: ..., title: "Original Title", ... },
//   version: 4,                      // Newly generated incremental rollback commit
//   rolledBackToVersion: 1,          // Target version restored
//   restoredPropertiesCount: 3,
//   preservedFields: ["publishedAt"] // Excluded fields preserved as configured
// }
```

**Key Rollback Features:**
- **Audit-Safe**: Rather than deleting historical commit records, rollback creates a brand new incremental commit (e.g. `v4`) with `transactionType: "rollback"`, preserving a full audit trail of the restoration.
- **Resurrection Support**: If the document was hard-deleted or soft-deleted, `rollbackDocToVersion` automatically resurrects it with its original `_id`.
- **Sensitive Credential Shielding**: If `includeSensitiveOnRollback: false` (default), sensitive fields (such as `password` hashes, active session tokens, and API secrets) are never overwritten with obsolete historical values.

---

#### Step 7: Managing Versions via Admin Portal

All models with the `versioning` plugin are automatically discovered and accessible in the **Time Machine** tab of the React Admin Dashboard (`/admin/versions`):
- View all versioned models in real time (`Article`, `User`, `UserProfile`, `Notification`).
- Click **"Revisions"** to inspect the visual commit timeline.
- Click **"Compare"** to view side-by-side Git diffs between any two versions.
- Click **"Rollback to vX"** to trigger instantaneous time-travel rollback or resurrection with user confirmation.

### 5. Reusable Schemas (`src/models/reusableSchemas`)
- `fullNameSchema`: Standardized `{ firstName, lastName }` with trimming and validation.
- `addressSchema`: City, state, country, pincode, and street address.
- `contactNumberSchema`: Country code and phone number validation.
- `avatarSchema` & `logoSchema`: Cloudinary asset reference (`publicId`, `url`, `secureUrl`).

---

## 📦 Standardized API Response & Error Handling

All controllers return responses adhering to a consistent JSON format:

### Success Response (`ApiResponse`)
```json
{
  "statusCode": 200,
  "data": { ... },
  "message": "Operation completed successfully",
  "success": true
}
```

### Error Response (`ApiError`)
```json
{
  "statusCode": 400,
  "message": "Invalid credentials provided",
  "errors": [],
  "success": false,
  "stack": "..." // included only in development mode
}
```

---

## ⌨️ Available Scripts

| Command | Description |
|---|---|
| `pnpm dev` | Start backend with nodemon hot-reload |
| `pnpm start` | Start backend in production mode with node |
| `pnpm dev:admin` | Start Vite development server for admin dashboard |
| `pnpm build:admin` | Compile admin dashboard SPA to `public/admin` |
| `pnpm build:frontend` | Build all workspace frontend packages |

---

## 📄 License

This project is licensed under the [ISC License](LICENSE).
Feel free to fork, customize, and use this boilerplate for your personal and commercial projects.
