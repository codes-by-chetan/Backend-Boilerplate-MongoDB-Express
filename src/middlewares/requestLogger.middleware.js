import jwt from "jsonwebtoken";
import crypto from "crypto";
import RequestLog from "./../models/requestLogs.model.js";
import config from "../config/env.config.js";
import getIpDetails from "../utils/getIpDetails.js";
import { recordRequestStart, recordRequestFinish } from "../sockets/socket.js";

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

        // Persist into MongoDB RequestLog collection
        try {
            const logEntry = new RequestLog({
                requestType: req.headers["content-type"] || "Unknown",
                requestStatus: isError ? "Failed" : "Successful",
                errors: errorMessage,
                ipAddress: req.ipDetails,
                origin: req.headers.origin || "Unknown",
                requestMethod: req.method,
                requestUrl: req.originalUrl,
                requestHeaders: req.headers,
                requestBody: req.body,
                responseStatus: statusCode,
                responseBody: responseData,
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
