import jwt from "jsonwebtoken";
import crypto from "crypto";
import RequestLog from "./../models/requestLogs.model.js";
import config from "../config/env.config.js";
import getIpDetails from "../utils/getIpDetails.js";
import { recordRequestStart, recordRequestFinish } from "../sockets/socket.js";
import { secureSanitize } from "../utils/crypto.util.js";

const requestLoggerMiddleware = async (req, res, next) => {
    // Ignore internal socket.io polling packets to prevent feedback loops
    if (req.originalUrl && req.originalUrl.startsWith("/socket.io")) {
        return next();
    }

    const start = Date.now();
    const reqId = crypto.randomUUID();
    req.requestId = reqId;

    let userId = null;
    let errorMessage = null;

    try {
        const token = req.headers.authorization?.split(" ")[1] || req.cookies?.token;
        if (token) {
            const decodedToken = jwt.verify(token, config.jwt.secret);
            userId = decodedToken?.id || null;
        }
    } catch (error) {
        // Token verification fail silently for request logging
    }

    req.ipDetails = getIpDetails(req);
    const clientIp = req.ipDetails?.clientIp || req.ip || "Unknown";

    // Broadcast request start to real-time admin monitoring
    recordRequestStart({
        id: reqId,
        method: req.method,
        url: req.originalUrl,
        ip: clientIp,
        origin: req.headers.origin || "Unknown",
        startTime: start,
        userId,
    });

    // Intercept and capture response data
    const originalSend = res.send;
    let responseData = null;

    res.send = function (body) {
        try {
            responseData = JSON.parse(body);
        } catch (error) {
            responseData = body;
        }
        return originalSend.apply(this, arguments);
    };

    // Capture completion
    res.on("finish", async () => {
        const durationMs = Date.now() - start;
        const statusCode = res.statusCode;
        const isError = statusCode >= 400;

        if (isError) {
            errorMessage = responseData?.message || "Unknown error occurred";
        }

        // Broadcast finish event to real-time admin monitoring
        recordRequestFinish({
            id: reqId,
            method: req.method,
            url: req.originalUrl,
            statusCode,
            durationMs,
            isError,
            errorMessage,
            finishTime: Date.now(),
            userId,
        });

        // Persist into MongoDB RequestLog collection with confidential fields securely encrypted
        try {
            const encryptionKey = config.logEncryptionKey;
            const sanitizedHeaders = secureSanitize(req.headers, { key: encryptionKey });
            const sanitizedBody = secureSanitize(req.body, { key: encryptionKey });
            
            // Prevent recursive log-query explosion: Omit bulk log arrays from responseBody
            let sanitizedResponse;
            const url = req.originalUrl || "";

            if (url.includes("/api/logs/db-request-logs")) {
                sanitizedResponse = {
                    _omitted: true,
                    description: "Response logs omitted from RequestLog to prevent recursive bloat",
                    logCount: responseData?.data?.logs?.length || 0,
                    logIds: (responseData?.data?.logs || []).map((l) => l._id),
                    pagination: responseData?.data?.pagination,
                    statusCode: responseData?.statusCode,
                    message: responseData?.message,
                };
            } else if (url.includes("/api/logs/decrypt-field")) {
                sanitizedResponse = {
                    _omitted: true,
                    description: "Decrypted payload omitted from RequestLog to prevent recursion",
                    fieldsCount: responseData?.data?.fieldsCount || 0,
                    fields: responseData?.data?.fields?.slice(0, 15),
                    auditLogId: responseData?.data?.auditLogId,
                    message: responseData?.message,
                };
            } else if (url.includes("/api/logs/db-audit-logs") || url.includes("/api/logs/decryption-audits")) {
                sanitizedResponse = {
                    _omitted: true,
                    description: "Audit trail results omitted from RequestLog to prevent recursive bloat",
                    count: responseData?.data?.audits?.length || 0,
                    auditIds: (responseData?.data?.audits || []).map((a) => a._id),
                    pagination: responseData?.data?.pagination,
                    statusCode: responseData?.statusCode,
                    message: responseData?.message,
                };
            } else {
                sanitizedResponse = secureSanitize(responseData, { key: encryptionKey });
            }

            // Universal Size Guard: Ensure no single log's responseBody or requestBody exceeds 50 KB
            const MAX_LOG_PAYLOAD_SIZE = 50 * 1024; // 50 KB

            let finalResponseBody = sanitizedResponse;
            try {
                const resStr = JSON.stringify(sanitizedResponse);
                if (resStr && resStr.length > MAX_LOG_PAYLOAD_SIZE) {
                    finalResponseBody = {
                        _truncated: true,
                        description: `Response body truncated (${(resStr.length / 1024).toFixed(1)} KB exceeds 50 KB limit)`,
                        statusCode: responseData?.statusCode,
                        message: responseData?.message,
                    };
                }
            } catch (e) {
                finalResponseBody = "[Unserializable Response]";
            }

            let finalRequestBody = sanitizedBody;
            try {
                const reqStr = JSON.stringify(sanitizedBody);
                if (reqStr && reqStr.length > MAX_LOG_PAYLOAD_SIZE) {
                    finalRequestBody = {
                        _truncated: true,
                        description: `Request body truncated (${(reqStr.length / 1024).toFixed(1)} KB exceeds 50 KB limit)`,
                    };
                }
            } catch (e) {
                finalRequestBody = "[Unserializable Request Body]";
            }

            const logEntry = new RequestLog({
                requestType: req.headers["content-type"] || "Unknown",
                requestStatus: isError ? "Failed" : "Successful",
                errors: errorMessage,
                ipAddress: req.ipDetails,
                origin: req.headers.origin || "Unknown",
                requestMethod: req.method,
                requestUrl: req.originalUrl,
                requestHeaders: sanitizedHeaders,
                requestBody: finalRequestBody,
                responseStatus: statusCode,
                responseBody: finalResponseBody,
                user: userId,
                createdAt: new Date(),
            });

            await logEntry.save();
        } catch (error) {
            console.error("Error saving request log to MongoDB:", error);
        }
    });

    next();
};

export default requestLoggerMiddleware;
