import logger from "../config/logger.config.js";

/**
 * Initializes Socket.io listeners.
 *
 * @param {import("socket.io").Server} io
 */
const initializeSocket = (io) => {
    io.on("connection", (socket) => {
        logger.logMessage(
            "info",
            `Socket client connected: ${socket.id}`,
            "SOCKET"
        );

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
