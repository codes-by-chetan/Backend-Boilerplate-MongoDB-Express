import authController from "./auth.controller.js";
import userController from "./user.controller.js";
import notificationController from "./notification.controller.js";
import logsController from "./logs.controller.js";

const controllers = {
    authController,
    userController,
    notificationController,
    logsController,
};

export {
    authController,
    userController,
    notificationController,
    logsController,
};

export default controllers;
