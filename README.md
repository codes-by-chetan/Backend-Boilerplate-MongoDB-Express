# 🚀 Production-Ready MongoDB & Express Backend Boilerplate

A modular, enterprise-grade backend boilerplate built with **Node.js**, **Express 5**, **MongoDB (Mongoose 9)**, **Socket.IO**, and an integrated **React + Vite Admin Dashboard**. 

Featuring **Git-like document versioning & time-travel rollback**, **dual-layer audit logging**, **multi-device JWT authentication**, **RBAC authorization**, and **real-time WebSocket log streaming**.

---

## 📑 Table of Contents

- [Features Overview](#-features-overview)
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
- [Authentication & Multi-Device Sessions](#-authentication--multi-device-sessions)
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
- [Standardized API Response & Error Handling](#-standardized-api-response--error-handling)
- [Available Scripts](#-available-scripts)
- [License](#-license)

---

## 🌟 Features Overview

- **🛡️ Modern Authentication & Security**:
  - Stateless JWT authentication via HTTP-only Cookies and Authorization Headers.
  - Multi-device session tracking with device, OS, browser, and IP detection (`ua-parser-js`).
  - Automatic expiration and session clean-up hooks.
  - Role-Based Access Control (**RBAC**): `admin`, `manager`, `user`, `employee`, `supervisor`.
  - Social OAuth integration support (Google OAuth, Meta ready).
  - Bcrypt hashing with automated idempotency guards (prevents accidental double-hashing).
  - Automatic Admin User Bootstrapping upon initial server boot.

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
  - Real-time log streams, request inspector, audit viewer, visual diff comparisons, and one-click rollback modals.

- **☁️ Cloud Uploads & Email Delivery**:
  - Multer file uploads with Cloudinary cloud media storage integration.
  - Nodemailer transporter configured for transactional emails.

- **🧩 Clean Code & Extensibility**:
  - Clean layered architecture: `controllers` ➔ `services` ➔ `models` ➔ `routes` ➔ `middlewares`.
  - Reusable Mongoose schemas: `address`, `avatar`, `contactNumber`, `fullName`, `logo`.
  - Built-in Mongoose plugins: `paginate`, `privatePlugin`, `softDelete`, `versioning`.
  - Request validation via Joi schemas.

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

Access the pre-built admin panel at **`http://localhost:5000/admin`**.

### Dashboard Features:
1. **System Health**: Real-time CPU, memory, heap usage, and server uptime cards.
2. **Live Stream**: Real-time event monitor with pause/resume, search filter, and auto-scroll.
3. **HTTP Request Inspector**: Filter requests by HTTP status (2xx, 3xx, 4xx, 5xx), method, and duration.
4. **Audit Log Trail**: Explore all insert, update, delete, and rollback transactions across collections.
5. **Git Versioning & Time-Travel Explorer**:
   - Browse documents by model (`User`, `UserProfile`, `Notification`, etc.).
   - Visual commit timeline modal showing user details, timestamp, and diff summary.
   - Side-by-side JSON diff comparison viewer between any two versions.
   - **One-Click Rollback / Resurrection Modal**: Select any previous revision to restore or resurrect deleted records.

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
| `PATCH` | `/api/user/:userId/role` | Update user role (`admin`, `manager`, `user`, etc.) | Admin Only |

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
Adds `deleted` and `deletedAt` flags and filters deleted documents by default on find queries.

### 4. Reusable Schemas (`src/models/reusableSchemas`)
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
