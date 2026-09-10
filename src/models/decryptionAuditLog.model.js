import mongoose from "mongoose";

const decryptionAuditLogSchema = new mongoose.Schema(
    {
        logId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "RequestLog",
            required: false,
        },
        logUrl: {
            type: String,
            trim: true,
            default: "",
        },
        fields: {
            type: [String],
            default: [],
        },
        fieldsCount: {
            type: Number,
            default: 1,
        },
        fieldName: {
            type: String,
            trim: true,
            default: "",
        },
        decryptedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: [true, "decryptedBy user is required"],
        },
        decryptedByEmail: {
            type: String,
            required: [true, "decryptedByEmail is required"],
            trim: true,
        },
        reason: {
            type: String,
            required: [true, "Decryption reason is required"],
            trim: true,
            minlength: [5, "Reason must be at least 5 characters long"],
            maxlength: [500, "Reason must be under 500 characters"],
        },
        ipAddress: {
            type: String,
            trim: true,
            default: "",
        },
        userAgent: {
            type: String,
            trim: true,
            default: "",
        },
    },
    {
        timestamps: true,
    }
);

// Indexes for fast audit queries
decryptionAuditLogSchema.index({ createdAt: -1 });
decryptionAuditLogSchema.index({ decryptedBy: 1, createdAt: -1 });
decryptionAuditLogSchema.index({ logId: 1 });

const DecryptionAuditLog = mongoose.model(
    "DecryptionAuditLog",
    decryptionAuditLogSchema
);

export default DecryptionAuditLog;
