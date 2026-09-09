import models from "../models/index.js";
import ApiError from "../utils/ApiError.js";
import httpStatus from "http-status";
import { sendNotification } from "../sockets/socket.js";
import { io } from "../index.js";
import logger from "../config/logger.config.js";

/**
 * Creates and delivers a generic notification to a user.
 *
 * @param {Object} options
 * @param {string} options.recipient - Recipient user ID
 * @param {string} [options.sender] - Sender user ID
 * @param {string} [options.title] - Notification title
 * @param {string} options.message - Notification body
 * @param {string} [options.type="info"] - Notification type (info|warning|success|error|system|alert)
 * @param {string} [options.actionUrl] - Deep link / URL
 * @param {Object} [options.data] - Additional metadata payload
 * @returns {Promise<Object>} Created notification document
 */
const createNotification = async ({
    recipient,
    sender,
    title,
    message,
    type = "info",
    actionUrl,
    data,
}) => {
    const notification = new models.Notification({
        recipient,
        sender,
        title,
        message,
        type,
        actionUrl,
        data,
    });

    await notification.save();

    if (sender) {
        await notification.populate("sender", "fullName fullNameString email");
    }

    // Attempt real-time socket delivery if socket.io is initialized
    try {
        if (io) {
            await sendNotification(io, recipient, [notification]);
        }
    } catch (err) {
        logger.logMessage("warn", `Socket notification delivery failed: ${err.message}`, "SOCKET");
    }

    return notification;
};

/**
 * Retrieves notifications for a recipient.
 *
 * @param {string} recipientId
 * @param {Object} [options={}]
 * @param {string} [options.status]
 * @returns {Promise<Array>}
 */
const getNotificationsByRecipient = async (recipientId, { status } = {}) => {
    return models.Notification.findByRecipient(recipientId, status);
};

/**
 * Marks a single notification as read.
 *
 * @param {string} notificationId
 * @param {string} recipientId
 * @returns {Promise<Object>}
 */
const markAsRead = async (notificationId, recipientId) => {
    const notification = await models.Notification.findOne({
        _id: notificationId,
        recipient: recipientId,
    });

    if (!notification) {
        throw new ApiError(httpStatus.NOT_FOUND, "Notification not found.");
    }

    return notification.markAsRead();
};

/**
 * Marks all unread notifications for a user as read.
 *
 * @param {string} recipientId
 * @returns {Promise<Object>} Update result
 */
const markAllAsRead = async (recipientId) => {
    return models.Notification.updateMany(
        { recipient: recipientId, status: "Unread" },
        { status: "Read", readAt: new Date() }
    );
};

/**
 * Returns count of unread notifications for a user.
 *
 * @param {string} recipientId
 * @returns {Promise<number>}
 */
const getUnreadCount = async (recipientId) => {
    return models.Notification.getUnreadCount(recipientId);
};

/**
 * Deletes a notification (soft delete).
 *
 * @param {string} notificationId
 * @param {string} recipientId
 * @returns {Promise<Object>}
 */
const deleteNotification = async (notificationId, recipientId) => {
    const result = await models.Notification.updateOne(
        { _id: notificationId, recipient: recipientId },
        { isActive: false }
    );

    if (result.matchedCount === 0) {
        throw new ApiError(httpStatus.NOT_FOUND, "Notification not found.");
    }

    return result;
};

const notificationService = {
    createNotification,
    getNotificationsByRecipient,
    markAsRead,
    markAllAsRead,
    getUnreadCount,
    deleteNotification,
};

export default notificationService;
