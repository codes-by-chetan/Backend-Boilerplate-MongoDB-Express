import services from "../services/index.js";
import ApiResponse from "../utils/ApiResponse.js";
import httpStatus from "http-status";
import asyncHandler from "../utils/asyncHandler.js";

const getUserNotifications = asyncHandler(async (req, res) => {
    const { status } = req.query;
    const notifications = await services.notificationService.getNotificationsByRecipient(
        req.user._id,
        { status }
    );
    const response = new ApiResponse(
        httpStatus.OK,
        notifications,
        "Notifications fetched successfully."
    );
    res.status(httpStatus.OK).json(response);
});

const getUnreadCount = asyncHandler(async (req, res) => {
    const count = await services.notificationService.getUnreadCount(req.user._id);
    const response = new ApiResponse(
        httpStatus.OK,
        { unreadCount: count },
        "Unread notification count fetched successfully."
    );
    res.status(httpStatus.OK).json(response);
});

const markNotificationAsRead = asyncHandler(async (req, res) => {
    const notification = await services.notificationService.markAsRead(
        req.params.notificationId,
        req.user._id
    );
    const response = new ApiResponse(
        httpStatus.OK,
        notification,
        "Notification marked as read."
    );
    res.status(httpStatus.OK).json(response);
});

const markAllNotificationsAsRead = asyncHandler(async (req, res) => {
    await services.notificationService.markAllAsRead(req.user._id);
    const response = new ApiResponse(
        httpStatus.OK,
        null,
        "All notifications marked as read."
    );
    res.status(httpStatus.OK).json(response);
});

const deleteNotification = asyncHandler(async (req, res) => {
    await services.notificationService.deleteNotification(
        req.params.notificationId,
        req.user._id
    );
    const response = new ApiResponse(
        httpStatus.OK,
        null,
        "Notification deleted successfully."
    );
    res.status(httpStatus.OK).json(response);
});

const notificationController = {
    getUserNotifications,
    getUnreadCount,
    markNotificationAsRead,
    markAllNotificationsAsRead,
    deleteNotification,
};

export default notificationController;
