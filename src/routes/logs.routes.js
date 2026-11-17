import express from "express";
import controllers from "../controllers/index.js";
import authMiddleware, { authorize } from "../middlewares/auth.middleware.js";
import constants from "../constants/index.js";

const router = express.Router();

// Protect all log and monitoring endpoints with Admin authorization
router.use(authMiddleware, authorize(constants.UserRoles.ADMIN));

// File-based HTML logs
router.get("/", controllers.logsController.getAllLogs);
router.get("/recents", controllers.logsController.getRecentLogs);
router.get("/by-date/:date", controllers.logsController.getLogsByDate);
router.get("/file/:fileName", controllers.logsController.getLogByFileName);

// System & live metrics
router.get("/system-stats", controllers.logsController.getSystemStats);

// MongoDB persistent logs
router.get("/db-request-logs", controllers.logsController.getDbRequestLogs);
router.get("/db-audit-logs", controllers.logsController.getDbAuditLogs);
router.post("/decrypt-field", controllers.logsController.decryptField);
router.get("/decryption-audits", controllers.logsController.getDecryptionAuditLogs);

// Configurable Data Retention & Dynamic Purge
router.get("/retention-settings", controllers.logsController.getRetentionSettings);
router.put("/retention-settings", controllers.logsController.updateRetentionSettings);
router.post("/retention-purge", controllers.logsController.runRetentionPurge);

// GitHub Request Logs Archival & High-Performance Querying
router.get("/archive/settings", controllers.logsController.getArchiveSettings);
router.put("/archive/settings", controllers.logsController.updateArchiveSettings);
router.post("/archive/test-connection", controllers.logsController.testArchiveConnection);
router.get("/archive/repos", controllers.logsController.getArchiveRepos);
router.post("/archive/create-repo", controllers.logsController.createArchiveRepo);
router.post("/archive/trigger", controllers.logsController.triggerArchiveDate);
router.get("/archive/list", controllers.logsController.listArchives);
router.post("/archive/query", controllers.logsController.queryArchiveLogs);
router.get("/archive/storage-stats", controllers.logsController.getArchiveStorageStats);
router.get("/archive/pending-dates", controllers.logsController.getPendingArchiveDates);
router.post("/archive/archive-pending", controllers.logsController.archiveAllPendingDates);
router.post("/archive/reclaim-storage", controllers.logsController.reclaimStorage);

// Mongoose Git-like Versioning & Document Lifecycle Endpoints
router.get("/models", controllers.logsController.getAvailableModels);
router.get("/model-docs/:modelName", controllers.logsController.getModelDocuments);
router.get("/document-history/:modelName/:documentId", controllers.logsController.getDocumentHistory);
router.get("/document-version/:modelName/:documentId/:version", controllers.logsController.getDocumentVersion);
router.get("/document-compare/:modelName/:documentId", controllers.logsController.compareDocumentVersions);
router.post("/document-rollback/:modelName/:documentId", controllers.logsController.rollbackDocument);

const logsRouter = router;
export default logsRouter;
