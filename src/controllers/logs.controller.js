import fs from "fs";
import path from "path";
import os from "os";
import mongoose from "mongoose";
import asyncHandler from "../utils/asyncHandler.js";
import ApiError from "../utils/ApiError.js";
import httpStatus from "http-status";
import models from "../models/index.js";
import { getLiveMetrics } from "../sockets/socket.js";
import ApiResponse from "../utils/ApiResponse.js";
import diffUtil from "../utils/diff.util.js";

const logsDirectory = path.join(process.cwd(), "logs");
const safeLogFileNamePattern = /^logs-\d{4}-\d{2}-\d{2}\.html$/;

const getLogFilePath = (date) => path.join(logsDirectory, `logs-${date}.html`);

const getValidatedFilePath = (fileName) => {
    if (!safeLogFileNamePattern.test(fileName)) {
        throw new ApiError(httpStatus.BAD_REQUEST, "Invalid log file name format");
    }
    return path.join(logsDirectory, fileName);
};

export const getAllLogs = asyncHandler(async (req, res) => {
    if (!fs.existsSync(logsDirectory)) {
        return res.status(200).json({
            logs: [],
            pagination: { page: 1, limit: 10, total: 0, totalPages: 0 },
        });
    }

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 10));
    const search = (req.query.search || "").trim().toLowerCase();
    const sortBy = req.query.sortBy || "date"; // "date" | "size" | "updatedAt"
    const order = req.query.order === "asc" ? "asc" : "desc";

    let files = fs
        .readdirSync(logsDirectory)
        .filter((file) => safeLogFileNamePattern.test(file))
        .map((file) => {
            const filePath = path.join(logsDirectory, file);
            const stats = fs.statSync(filePath);
            return {
                fileName: file,
                size: stats.size,
                updatedAt: stats.mtime.toISOString(),
            };
        });

    if (search) {
        files = files.filter((f) => f.fileName.toLowerCase().includes(search));
    }

    files.sort((a, b) => {
        let comp = 0;
        if (sortBy === "size") {
            comp = a.size - b.size;
        } else if (sortBy === "updatedAt") {
            comp = new Date(a.updatedAt) - new Date(b.updatedAt);
        } else {
            comp = a.fileName.localeCompare(b.fileName);
        }
        return order === "asc" ? comp : -comp;
    });

    const total = files.length;
    const totalPages = Math.ceil(total / limit) || 1;
    const skip = (page - 1) * limit;
    const paginatedLogs = files.slice(skip, skip + limit);

    res.status(200).json({
        logs: paginatedLogs,
        pagination: {
            page,
            limit,
            total,
            totalPages,
        },
        filters: {
            search: req.query.search || "",
            sortBy,
            order,
        },
    });
});

export const getLogByFileName = asyncHandler(async (req, res) => {
    const { fileName } = req.params;
    const filePath = getValidatedFilePath(fileName);

    if (!fs.existsSync(filePath)) {
        throw new ApiError(httpStatus.NOT_FOUND, "Log file not found");
    }

    const content = fs.readFileSync(filePath, "utf-8");
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.status(200).send(content);
});

export const getLogsByDate = asyncHandler(async (req, res) => {
    const { date } = req.params;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        throw new ApiError(httpStatus.BAD_REQUEST, "Date format must be YYYY-MM-DD");
    }

    const filePath = getLogFilePath(date);
    if (!fs.existsSync(filePath)) {
        throw new ApiError(httpStatus.NOT_FOUND, `Log file for date ${date} not found`);
    }

    const content = fs.readFileSync(filePath, "utf-8");
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.status(200).send(content);
});

export const getRecentLogs = asyncHandler(async (req, res) => {
    const date = new Date().toISOString().split("T")[0];
    const filePath = getLogFilePath(date);

    if (!fs.existsSync(filePath)) {
        throw new ApiError(httpStatus.NOT_FOUND, "Recent log file not found for today");
    }

    const content = fs.readFileSync(filePath, "utf-8");
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.status(200).send(content);
});

export const getSystemStats = asyncHandler(async (req, res) => {
    const liveMetrics = getLiveMetrics();
    const memoryUsage = process.memoryUsage();

    // Query MongoDB counters
    const [totalUsers, totalRequestLogs, totalDbLogs] = await Promise.all([
        models.User.countDocuments({ deleted: { $ne: true } }).catch(() => 0),
        models.RequestLog.countDocuments().catch(() => 0),
        models.DbLogs.countDocuments().catch(() => 0),
    ]);

    const mongoStatus = ["disconnected", "connected", "connecting", "disconnecting"][
        mongoose.connection.readyState
    ] || "unknown";

    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;

    const stats = {
        host: {
            hostname: os.hostname(),
            platform: os.platform(),
            arch: os.arch(),
            cpuModel: os.cpus()[0]?.model || "CPU",
            cpuCores: os.cpus().length,
            loadAvg: os.loadavg().map((l) => l.toFixed(2)),
            totalMemoryGb: (totalMem / 1024 / 1024 / 1024).toFixed(2),
            usedMemoryGb: (usedMem / 1024 / 1024 / 1024).toFixed(2),
            freeMemoryGb: (freeMem / 1024 / 1024 / 1024).toFixed(2),
            totalMemoryMb: Math.round(totalMem / 1024 / 1024),
            usedMemoryMb: Math.round(usedMem / 1024 / 1024),
            freeMemoryMb: Math.round(freeMem / 1024 / 1024),
            memoryPercentUsed: ((usedMem / totalMem) * 100).toFixed(1),
            memoryPercentFree: ((freeMem / totalMem) * 100).toFixed(1),
            uptimeSeconds: Math.floor(os.uptime()),
        },
        nodeProcess: {
            pid: process.pid,
            version: process.version,
            uptimeSeconds: Math.floor(process.uptime()),
            rssMb: (memoryUsage.rss / 1024 / 1024).toFixed(1),
            heapTotalMb: (memoryUsage.heapTotal / 1024 / 1024).toFixed(1),
            heapUsedMb: (memoryUsage.heapUsed / 1024 / 1024).toFixed(1),
            externalMb: (memoryUsage.external / 1024 / 1024).toFixed(1),
            percentOfHostRam: ((memoryUsage.rss / totalMem) * 100).toFixed(2),
            heapPercentUsed: ((memoryUsage.heapUsed / memoryUsage.heapTotal) * 100).toFixed(1),
        },
        server: {
            uptime: Math.floor(process.uptime()),
            pid: process.pid,
            nodeVersion: process.version,
            platform: os.platform(),
            arch: os.arch(),
            cpuCount: os.cpus().length,
            memory: {
                totalMb: (totalMem / 1024 / 1024).toFixed(0),
                freeMb: (freeMem / 1024 / 1024).toFixed(0),
                usedMb: (usedMem / 1024 / 1024).toFixed(0),
                heapUsedMb: (memoryUsage.heapUsed / 1024 / 1024).toFixed(1),
                heapTotalMb: (memoryUsage.heapTotal / 1024 / 1024).toFixed(1),
                rssMb: (memoryUsage.rss / 1024 / 1024).toFixed(1),
            },
        },
        database: {
            status: mongoStatus,
            host: mongoose.connection.host || "localhost",
            name: mongoose.connection.name || "mongodb",
            totalUsers,
            totalRequestLogs,
            totalDbLogs,
        },
        liveMetrics,
    };

    res.status(200).json(new ApiResponse(200, stats, "System metrics fetched successfully"));
});

export const getDbRequestLogs = asyncHandler(async (req, res) => {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const skip = (page - 1) * limit;

    const filter = {};
    if (req.query.status) {
        filter.requestStatus = req.query.status;
    }
    if (req.query.method) {
        filter.requestMethod = req.query.method.toUpperCase();
    }
    if (req.query.statusCode) {
        filter.responseStatus = parseInt(req.query.statusCode, 10);
    }
    if (req.query.search) {
        const searchRegex = { $regex: req.query.search.trim(), $options: "i" };
        filter.$or = [
            { requestUrl: searchRegex },
            { "ipAddress.clientIp": searchRegex },
            { errors: searchRegex },
        ];
    }
    if (req.query.dateFrom || req.query.dateTo) {
        filter.createdAt = {};
        if (req.query.dateFrom) {
            filter.createdAt.$gte = new Date(req.query.dateFrom);
        }
        if (req.query.dateTo) {
            const end = new Date(req.query.dateTo);
            end.setHours(23, 59, 59, 999);
            filter.createdAt.$lte = end;
        }
    }

    const allowedSortFields = ["createdAt", "responseStatus", "requestMethod", "requestUrl", "requestType"];
    const sortBy = allowedSortFields.includes(req.query.sortBy) ? req.query.sortBy : "createdAt";
    const order = req.query.order === "asc" ? 1 : -1;
    const sort = { [sortBy]: order };

    const [total, logs] = await Promise.all([
        models.RequestLog.countDocuments(filter),
        models.RequestLog.find(filter)
            .sort(sort)
            .skip(skip)
            .limit(limit)
            .populate("user", "email fullName role")
            .lean(),
    ]);

    res.status(200).json(
        new ApiResponse(
            200,
            {
                logs,
                pagination: {
                    page,
                    limit,
                    total,
                    totalPages: Math.ceil(total / limit) || 1,
                },
                filters: {
                    search: req.query.search || "",
                    status: req.query.status || "",
                    method: req.query.method || "",
                    statusCode: req.query.statusCode || "",
                    sortBy,
                    order: req.query.order === "asc" ? "asc" : "desc",
                },
            },
            "Request logs retrieved successfully"
        )
    );
});

export const getDbAuditLogs = asyncHandler(async (req, res) => {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const skip = (page - 1) * limit;

    const filter = {};
    if (req.query.collection) {
        filter.affectedCollection = req.query.collection;
    }
    if (req.query.transactionType) {
        filter.transactionType = req.query.transactionType;
    }
    if (req.query.status) {
        filter.status = req.query.status;
    }
    if (req.query.search) {
        const searchRegex = { $regex: req.query.search.trim(), $options: "i" };
        filter.$or = [
            { affectedCollection: searchRegex },
            { transactionDetails: searchRegex },
            { origin: searchRegex },
        ];
    }
    if (req.query.dateFrom || req.query.dateTo) {
        filter.createdAt = {};
        if (req.query.dateFrom) {
            filter.createdAt.$gte = new Date(req.query.dateFrom);
        }
        if (req.query.dateTo) {
            const end = new Date(req.query.dateTo);
            end.setHours(23, 59, 59, 999);
            filter.createdAt.$lte = end;
        }
    }

    const allowedSortFields = ["createdAt", "transactionType", "affectedCollection", "status"];
    const sortBy = allowedSortFields.includes(req.query.sortBy) ? req.query.sortBy : "createdAt";
    const order = req.query.order === "asc" ? 1 : -1;
    const sort = { [sortBy]: order };

    const [total, logs, distinctCollections] = await Promise.all([
        models.DbLogs.countDocuments(filter),
        models.DbLogs.find(filter)
            .sort(sort)
            .skip(skip)
            .limit(limit)
            .populate("user", "email fullName role")
            .lean(),
        models.DbLogs.distinct("affectedCollection").catch(() => []),
    ]);

    res.status(200).json(
        new ApiResponse(
            200,
            {
                logs,
                availableCollections: distinctCollections || [],
                pagination: {
                    page,
                    limit,
                    total,
                    totalPages: Math.ceil(total / limit) || 1,
                },
                filters: {
                    search: req.query.search || "",
                    collection: req.query.collection || "",
                    transactionType: req.query.transactionType || "",
                    status: req.query.status || "",
                    sortBy,
                    order: req.query.order === "asc" ? "asc" : "desc",
                },
            },
            "DB audit logs retrieved successfully"
        )
    );
});

/**
 * Get registered Mongoose models available for versioning exploration.
 */
export const getAvailableModels = asyncHandler(async (req, res) => {
    const registered = Object.keys(mongoose.models).filter((name) => {
        return name !== "DbLogs" && name !== "RequestLog";
    });

    res.status(200).json(
        new ApiResponse(200, { models: registered }, "Available models retrieved successfully")
    );
});

/**
 * Get paginated document list for a specific model, including both active and deleted documents.
 */
export const getModelDocuments = asyncHandler(async (req, res) => {
    const { modelName } = req.params;
    const Model = mongoose.models[modelName];
    if (!Model) {
        throw new ApiError(httpStatus.BAD_REQUEST, `Model '${modelName}' not found`);
    }

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 10));
    const skip = (page - 1) * limit;
    const search = (req.query.search || "").trim();
    const status = req.query.status || "all"; // all, active, deleted

    // 1. Fetch active documents (unless status === "deleted")
    let activeDocs = [];
    if (status !== "deleted") {
        const activeFilter = {};
        if (search) {
            const searchRegex = { $regex: search, $options: "i" };
            const stringPaths = Object.keys(Model.schema.paths).filter((p) => {
                const type = Model.schema.paths[p].instance;
                return type === "String" && !p.startsWith("_") && p !== "password";
            });
            if (stringPaths.length > 0) {
                activeFilter.$or = stringPaths.map((p) => ({ [p]: searchRegex }));
            }
            if (mongoose.Types.ObjectId.isValid(search)) {
                activeFilter.$or = (activeFilter.$or || []).concat({ _id: new mongoose.Types.ObjectId(search) });
            }
        }

        activeDocs = await Model.find(activeFilter)
            .sort({ updatedAt: -1 })
            .lean();
    }

    // 2. Fetch deleted documents from DbLogs (unless status === "active")
    let deletedDocs = [];
    if (status !== "active") {
        const deleteCommits = await models.DbLogs.find({
            affectedCollection: modelName,
            transactionType: "delete",
        })
            .sort({ createdAt: -1 })
            .lean();

        const seenDocIds = new Set();
        for (const commit of deleteCommits) {
            const docIdStr = commit.affectedDocumentId.toString();
            if (seenDocIds.has(docIdStr)) continue;
            seenDocIds.add(docIdStr);

            const existsInActive = await Model.exists({ _id: commit.affectedDocumentId });
            if (!existsInActive) {
                const title =
                    commit.diff?.snapshot?.email ||
                    commit.diff?.snapshot?.userName ||
                    commit.diff?.snapshot?.fullName?.firstName ||
                    commit.diff?.snapshot?.displayName ||
                    commit.diff?.snapshot?.title ||
                    docIdStr;

                deletedDocs.push({
                    _id: commit.affectedDocumentId,
                    displayTitle: typeof title === "object" ? JSON.stringify(title) : String(title),
                    status: "deleted",
                    currentVersion: commit.version,
                    updatedAt: commit.createdAt,
                    summary: commit.summary || "Deleted document",
                    rawDoc: commit.diff?.snapshot || {},
                });
            }
        }

        if (search) {
            const searchLower = search.toLowerCase();
            deletedDocs = deletedDocs.filter((d) => {
                return (
                    d.displayTitle.toLowerCase().includes(searchLower) ||
                    d._id.toString().toLowerCase().includes(searchLower)
                );
            });
        }
    }

    // 3. Format active documents with their version info from DbLogs
    const formattedActive = await Promise.all(
        activeDocs.map(async (doc) => {
            const latestCommit = await models.DbLogs.findOne({
                affectedCollection: modelName,
                affectedDocumentId: doc._id,
            })
                .sort({ version: -1 })
                .select("version summary createdAt")
                .lean();

            const title =
                doc.email ||
                doc.userName ||
                doc.fullName?.firstName ||
                doc.displayName ||
                doc.title ||
                doc._id.toString();

            return {
                _id: doc._id,
                displayTitle: typeof title === "object" ? JSON.stringify(title) : String(title),
                status: "active",
                currentVersion: latestCommit?.version || 1,
                updatedAt: doc.updatedAt || doc.createdAt,
                summary: latestCommit?.summary || "Active document",
                rawDoc: doc,
            };
        })
    );

    // 4. Combine based on requested status
    let combined = [];
    if (status === "active") combined = formattedActive;
    else if (status === "deleted") combined = deletedDocs;
    else combined = [...formattedActive, ...deletedDocs];

    combined.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

    const total = combined.length;
    const paginatedDocs = combined.slice(skip, skip + limit);

    res.status(200).json(
        new ApiResponse(
            200,
            {
                modelName,
                documents: paginatedDocs,
                pagination: {
                    page,
                    limit,
                    total,
                    totalPages: Math.ceil(total / limit) || 1,
                },
                counts: {
                    total,
                    active: formattedActive.length,
                    deleted: deletedDocs.length,
                },
            },
            `Documents for model ${modelName} fetched successfully`
        )
    );
});

/**
 * Get all commits/revisions for a specific document.
 */
export const getDocumentHistory = asyncHandler(async (req, res) => {
    const { modelName, documentId } = req.params;
    const Model = mongoose.models[modelName];
    if (!Model) {
        throw new ApiError(httpStatus.BAD_REQUEST, `Model '${modelName}' not found`);
    }

    const commits = await models.DbLogs.find({
        affectedCollection: modelName,
        affectedDocumentId: documentId,
    })
        .sort({ version: 1 })
        .populate("user", "email fullName role")
        .lean();

    const activeDoc = await Model.findById(documentId).lean();
    const currentStatus = activeDoc ? "active" : "deleted";

    res.status(200).json(
        new ApiResponse(
            200,
            {
                documentId,
                modelName,
                currentStatus,
                latestVersion: commits[commits.length - 1]?.version || 0,
                totalCommits: commits.length,
                commits,
            },
            "Document history retrieved successfully"
        )
    );
});

/**
 * Reconstruct document at any given version.
 */
export const getDocumentVersion = asyncHandler(async (req, res) => {
    const { modelName, documentId, version } = req.params;
    const Model = mongoose.models[modelName];
    if (!Model) {
        throw new ApiError(httpStatus.BAD_REQUEST, `Model '${modelName}' not found`);
    }

    const targetVersion = parseInt(version, 10);
    const commits = await models.DbLogs.find({
        affectedCollection: modelName,
        affectedDocumentId: documentId,
    })
        .sort({ version: 1 })
        .populate("user", "email fullName role")
        .lean();

    if (!commits || commits.length === 0) {
        throw new ApiError(httpStatus.NOT_FOUND, "No commit history found for this document");
    }

    const reconstruction = diffUtil.reconstructDocumentAtVersion(commits, targetVersion);

    res.status(200).json(
        new ApiResponse(
            200,
            {
                documentId,
                modelName,
                requestedVersion: targetVersion,
                reconstructedVersion: reconstruction.currentVersion,
                isDeleted: reconstruction.isDeleted,
                state: reconstruction.state,
                lastCommit: reconstruction.lastCommit,
            },
            `Document reconstructed at version ${targetVersion}`
        )
    );
});

/**
 * Compare two versions of a document to produce a Git-like diff tree.
 */
export const compareDocumentVersions = asyncHandler(async (req, res) => {
    const { modelName, documentId } = req.params;
    const Model = mongoose.models[modelName];
    if (!Model) {
        throw new ApiError(httpStatus.BAD_REQUEST, `Model '${modelName}' not found`);
    }

    const v1 = parseInt(req.query.v1, 10);
    const v2 = parseInt(req.query.v2, 10);

    if (isNaN(v1) || isNaN(v2)) {
        throw new ApiError(httpStatus.BAD_REQUEST, "v1 and v2 query parameters must be integers");
    }

    const commits = await models.DbLogs.find({
        affectedCollection: modelName,
        affectedDocumentId: documentId,
    })
        .sort({ version: 1 })
        .lean();

    if (!commits || commits.length === 0) {
        throw new ApiError(httpStatus.NOT_FOUND, "No history found for document");
    }

    const recon1 = diffUtil.reconstructDocumentAtVersion(commits, v1);
    const recon2 = diffUtil.reconstructDocumentAtVersion(commits, v2);

    const diff = diffUtil.calculateObjectDiff(recon1.state, recon2.state);

    res.status(200).json(
        new ApiResponse(
            200,
            {
                documentId,
                modelName,
                v1: { version: v1, state: recon1.state, isDeleted: recon1.isDeleted },
                v2: { version: v2, state: recon2.state, isDeleted: recon2.isDeleted },
                diff,
            },
            `Comparison between version ${v1} and ${v2} generated successfully`
        )
    );
});

/**
 * Rollback or restore a document to a target version.
 */
export const rollbackDocument = asyncHandler(async (req, res) => {
    const { modelName, documentId } = req.params;
    const Model = mongoose.models[modelName];
    if (!Model) {
        throw new ApiError(httpStatus.BAD_REQUEST, `Model '${modelName}' not found`);
    }

    const targetVersion = parseInt(req.body.targetVersion ?? req.body.version, 10);
    if (isNaN(targetVersion) || targetVersion < 1) {
        throw new ApiError(httpStatus.BAD_REQUEST, "Valid targetVersion is required");
    }

    if (typeof Model.rollbackDocToVersion !== "function") {
        throw new ApiError(httpStatus.BAD_REQUEST, `Model '${modelName}' does not support versioning rollback`);
    }

    const userContext = {
        user: req.user?._id || null,
        ipAddress: req.ip || null,
        origin: req.get("origin") || null,
    };

    const result = await Model.rollbackDocToVersion(documentId, targetVersion, userContext);

    res.status(200).json(
        new ApiResponse(
            200,
            result,
            `Document successfully restored to version ${targetVersion} (new revision: v${result.version})`
        )
    );
});

const logsController = {
    getAllLogs,
    getLogByFileName,
    getLogsByDate,
    getRecentLogs,
    getSystemStats,
    getDbRequestLogs,
    getDbAuditLogs,
    getAvailableModels,
    getModelDocuments,
    getDocumentHistory,
    getDocumentVersion,
    compareDocumentVersions,
    rollbackDocument,
};

export default logsController;
