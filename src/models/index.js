import User from "./user.model.js";
import UserProfile from "./userProfile.model.js";
import DbLogs from "./dbLogs.model.js";
import RequestLog from "./requestLogs.model.js";
import Notification from "./notification.model.js";
import DecryptionAuditLog from "./decryptionAuditLog.model.js";

const models = {
    User,
    UserProfile,
    DbLogs,
    RequestLog,
    Notification,
    DecryptionAuditLog,
};

export {
    User,
    UserProfile,
    DbLogs,
    RequestLog,
    Notification,
    DecryptionAuditLog,
};

export default models;
