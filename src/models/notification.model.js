import mongoose from "mongoose";
import plugins from "./plugins/index.js";
import middlewares from "../middlewares/index.js";

/**
 * Generic schema for storing user notifications.
 */
const notificationSchema = new mongoose.Schema(
    {
        recipient: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: [true, "Recipient is required for notification."],
            index: true,
        },
        sender: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: false,
            index: true,
        },
        title: {
            type: String,
            trim: true,
            maxlength: [120, "Title cannot exceed 120 characters."],
            required: false,
        },
        message: {
            type: String,
            required: [true, "Message is required for notification."],
            trim: true,
            maxlength: [500, "Message cannot exceed 500 characters."],
        },
        type: {
            type: String,
            enum: ["info", "warning", "success", "error", "system", "alert"],
            default: "info",
            index: true,
        },
        status: {
            type: String,
            enum: ["Unread", "Read", "Dismissed"],
            default: "Unread",
            index: true,
        },
        readAt: {
            type: Date,
            required: false,
        },
        actionUrl: {
            type: String,
            trim: true,
            required: false,
        },
        data: {
            type: mongoose.Schema.Types.Mixed,
            required: false,
        },
        isActive: {
            type: Boolean,
            default: true,
        },
    },
    {
        timestamps: true,
        toJSON: { virtuals: true },
        toObject: { virtuals: true },
    }
);

// Plugins
notificationSchema.plugin(plugins.versioning);
notificationSchema.plugin(plugins.paginate);
notificationSchema.plugin(plugins.privatePlugin);

// Indexes
notificationSchema.index({ recipient: 1, status: 1, createdAt: -1 });

// Methods
notificationSchema.methods.markAsRead = async function () {
    this.status = "Read";
    this.readAt = new Date();
    return this.save();
};

notificationSchema.methods.markAsDismissed = async function () {
    this.status = "Dismissed";
    return this.save();
};

// Statics
notificationSchema.statics.findByRecipient = async function (recipientId, status) {
    const query = { recipient: recipientId };
    if (status) {
        query.status = status;
    }
    return this.find(query).populate("sender", "fullName email avatar").sort({ createdAt: -1 });
};

notificationSchema.statics.getUnreadCount = async function (recipientId) {
    return this.countDocuments({ recipient: recipientId, status: "Unread" });
};

const Notification = mongoose.model("Notification", notificationSchema);

export default Notification;
