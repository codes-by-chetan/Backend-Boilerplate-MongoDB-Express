import logger from "../config/logger.config.js";
import jwt from "jsonwebtoken";
import config from "../config/env.config.js";
import constants from "../constants/index.js";

import os from "os";

let ioInstance = null;

const liveMetrics = {
    inFlightRequests: 0,
    totalRequests: 0,
    totalSuccess: 0,
    totalErrors: 0,
    startedAt: Date.now(),
    recentRequests: [],
};

const MAX_RECENT_REQUESTS = 50;

/**
 * Get current snapshot of live metrics including full host machine resources and Node process memory.
 */
export const getLiveMetrics = () => {
    const memoryUsage = process.memoryUsage();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const loadAvg = os.loadavg().map((l) => l.toFixed(2));

    return {
        ...liveMetrics,
        uptimeSeconds: Math.floor(process.uptime()),
        serverStartedAt: liveMetrics.startedAt,
        // Full host machine resource stats
        host: {
            hostname: os.hostname(),
            platform: os.platform(),
            arch: os.arch(),
            cpuModel: os.cpus()[0]?.model || "CPU",
            cpuCores: os.cpus().length,
            loadAvg, // 1 min, 5 min, 15 min load averages
            totalMemoryGb: (totalMem / 1024 / 1024 / 1024).toFixed(2),
            usedMemoryGb: (usedMem / 1024 / 1024 / 1024).toFixed(2),
            freeMemoryGb: (freeMem / 1024 / 1024 / 1024).toFixed(2),
            totalMemoryMb: Math.round(totalMem / 1024 / 1024),
            usedMemoryMb: Math.round(usedMem / 1024 / 1024),
            freeMemoryMb: Math.round(freeMem / 1024 / 1024),
            memoryPercentUsed: ((usedMem / totalMem) * 100).toFixed(1),
            memoryPercentFree: ((freeMem / totalMem) * 100).toFixed(1),
            hostUptimeSeconds: Math.floor(os.uptime()),
        },
        // Full Node.js process memory stats
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
        // Backwards-compatible legacy key
        memory: {
            rssMb: (memoryUsage.rss / 1024 / 1024).toFixed(1),
            heapTotalMb: (memoryUsage.heapTotal / 1024 / 1024).toFixed(1),
            heapUsedMb: (memoryUsage.heapUsed / 1024 / 1024).toFixed(1),
        },
        connectedSockets: ioInstance ? ioInstance.engine?.clientsCount || 0 : 0,
    };
};

/**
 * Emit an event to the authenticated admin room.
 */
export const emitAdminEvent = (event, data) => {
    if (ioInstance) {
        ioInstance.to("admin_room").emit(event, data);
    }
};

/**
 * Track request start and broadcast to admins.
 */
export const recordRequestStart = (requestData) => {
    liveMetrics.inFlightRequests += 1;
    emitAdminEvent("request:start", {
        ...requestData,
        inFlightRequests: liveMetrics.inFlightRequests,
    });
};

/**
 * Track request finish and broadcast to admins.
 */
export const recordRequestFinish = (finishData) => {
    liveMetrics.inFlightRequests = Math.max(0, liveMetrics.inFlightRequests - 1);
    liveMetrics.totalRequests += 1;

    if (finishData.isError) {
        liveMetrics.totalErrors += 1;
    } else {
        liveMetrics.totalSuccess += 1;
    }

    // Add to recent requests (newest first)
    liveMetrics.recentRequests.unshift(finishData);
    if (liveMetrics.recentRequests.length > MAX_RECENT_REQUESTS) {
        liveMetrics.recentRequests.pop();
    }

    emitAdminEvent("request:finish", {
        ...finishData,
        metrics: {
            inFlightRequests: liveMetrics.inFlightRequests,
            totalRequests: liveMetrics.totalRequests,
            totalSuccess: liveMetrics.totalSuccess,
            totalErrors: liveMetrics.totalErrors,
        },
    });
};

/**
 * Initializes Socket.io listeners.
 *
 * @param {import("socket.io").Server} io
 */
const initializeSocket = (io) => {
    ioInstance = io;

    io.on("connection", (socket) => {
        logger.logMessage(
            "info",
            `Socket client connected: ${socket.id}`,
            "SOCKET"
        );

        // Allow an authenticated admin to join the admin room
        socket.on("join-admin", (payload) => {
            try {
                const token = typeof payload === "string" ? payload : payload?.token;
                if (!token) {
                    socket.emit("admin-error", { message: "Token is required to join admin room" });
                    return;
                }

                const decoded = jwt.verify(token, config.jwt.secret);
                if (decoded.role !== constants.UserRoles.ADMIN) {
                    socket.emit("admin-error", { message: "Admin privileges required" });
                    return;
                }

                socket.join("admin_room");
                socket.emit("admin-joined", {
                    success: true,
                    message: "Connected to real-time admin monitoring",
                    metrics: getLiveMetrics(),
                });

                logger.logMessage(
                    "info",
                    `Socket ${socket.id} (Admin: ${decoded.email || decoded.id}) joined admin_room`,
                    "SOCKET"
                );
            } catch (err) {
                socket.emit("admin-error", { message: "Invalid or expired token" });
            }
        });

        // User joins a dedicated room identified by their userId
        socket.on("join", (userId) => {
            if (!userId) return;
            const roomId = userId.toString();
            socket.join(roomId);
            logger.logMessage(
                "info",
                `User ${roomId} joined personal socket room`,
                "SOCKET"
            );
        });

        // User leaves a room
        socket.on("leave", (userId) => {
            if (!userId) return;
            const roomId = userId.toString();
            socket.leave(roomId);
            logger.logMessage(
                "info",
                `User ${roomId} left personal socket room`,
                "SOCKET"
            );
        });

        socket.on("disconnect", (reason) => {
            logger.logMessage(
                "info",
                `Socket client disconnected: ${socket.id} (reason: ${reason})`,
                "SOCKET"
            );
        });
    });

    // Periodic heartbeat to admin_room every 4 seconds
    setInterval(() => {
        if (ioInstance) {
            ioInstance.to("admin_room").emit("system:stats", getLiveMetrics());
        }
    }, 4000);
};

/**
 * Sends a notification payload to a specific user's room.
 *
 * @param {import("socket.io").Server} io
 * @param {string} userId
 * @param {Array|Object} notifications
 */
const sendNotification = async (io, userId, notifications) => {
    if (!io || !userId) return;
    const roomId = userId.toString();
    const payload = Array.isArray(notifications) ? notifications : [notifications];

    io.to(roomId).emit("notification", payload);
    logger.logMessage(
        "info",
        `Dispatched notification to user room ${roomId}`,
        "SOCKET"
    );
};

/**
 * Emits an event with data to a specific user room.
 *
 * @param {import("socket.io").Server} io
 * @param {string} userId
 * @param {string} event
 * @param {any} data
 */
const sendToUser = (io, userId, event, data) => {
    if (!io || !userId) return;
    io.to(userId.toString()).emit(event, data);
};

/**
 * Broadcasts an event to all connected clients.
 *
 * @param {import("socket.io").Server} io
 * @param {string} event
 * @param {any} data
 */
const broadcastEvent = (io, event, data) => {
    if (!io) return;
    io.emit(event, data);
};

export {
    initializeSocket,
    sendNotification,
    sendToUser,
    broadcastEvent,
};
