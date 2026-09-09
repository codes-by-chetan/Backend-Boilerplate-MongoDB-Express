import express from "express";
import controllers from "../controllers/index.js";
import middleware from "../middlewares/index.js";

const router = express.Router();

router.use(middleware.authMiddleware);

router.get("/", controllers.notificationController.getUserNotifications);
router.get("/unread-count", controllers.notificationController.getUnreadCount);
router.patch(
    "/mark-read/:notificationId",
    controllers.notificationController.markNotificationAsRead
);
router.patch(
    "/mark-all-read",
    controllers.notificationController.markAllNotificationsAsRead
);
router.delete(
    "/:notificationId",
    controllers.notificationController.deleteNotification
);

const notificationRouter = router;
export default notificationRouter;
