import mongoose, { Schema } from "mongoose";
import dbLogger from "../middlewares/dbLogger.middleware.js";

const requestLogSchema = new Schema(
    {
        requestType: { type: String, required: true },
        requestStatus: { type: String, required: true },
        errors: { type: String },
        ipAddress: { type: Object, required: true },
        origin: { type: String, required: true },
        requestMethod: { type: String, required: true },
        requestUrl: { type: String, required: true },
        requestHeaders: { type: Object },
        requestBody: { type: Object },
        responseStatus: { type: Number },
        responseBody: { type: Object },
        user: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, // Add user field
    },
    {
        timestamps: true,
        suppressReservedKeysWarning: true,
    }
);

// Indexes for fast sorted queries and pagination without memory sort errors
requestLogSchema.index({ createdAt: -1 });
requestLogSchema.index({ requestStatus: 1, createdAt: -1 });
requestLogSchema.index({ requestMethod: 1, createdAt: -1 });
requestLogSchema.index({ responseStatus: 1, createdAt: -1 });
requestLogSchema.index({ requestUrl: 1, createdAt: -1 });

// requestLogSchema.pre("save", dbLogger("RequestLog"));

const RequestLog = mongoose.model("RequestLog", requestLogSchema);
export default RequestLog;
