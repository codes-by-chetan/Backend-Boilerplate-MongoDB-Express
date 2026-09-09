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

// requestLogSchema.pre("save", dbLogger("RequestLog"));

const RequestLog = mongoose.model("RequestLog", requestLogSchema);
export default RequestLog;
