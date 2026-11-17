import authService from "./auth.service.js";
import userService from "./user.service.js";
import userProfileService from "./userProfile.service.js";
import notificationService from "./notification.service.js";
import mailService from "./mail.service.js";
import dataRetentionService from "./dataRetention.service.js";
import logArchiveService from "./logArchive.service.js";

const services = {
    authService,
    userService,
    userProfileService,
    notificationService,
    mailService,
    dataRetentionService,
    logArchiveService,
};

export {
    authService,
    userService,
    userProfileService,
    notificationService,
    mailService,
    dataRetentionService,
    logArchiveService,
};

export default services;
