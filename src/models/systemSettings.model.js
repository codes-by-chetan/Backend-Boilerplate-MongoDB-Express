import mongoose from "mongoose";

const systemSettingsSchema = new mongoose.Schema(
    {
        key: {
            type: String,
            default: "global_settings",
            unique: true,
            index: true,
        },
        dataRetention: {
            scrapeRunsDays: {
                type: Number,
                default: 45,
                min: 1,
                max: 365,
            },
            requestLogsDays: {
                type: Number,
                default: 7,
                min: 1,
                max: 365,
            },
            lastPurgeAt: {
                type: Date,
                default: null,
            },
            lastPurgeStats: {
                scrapeRunsDeleted: { type: Number, default: 0 },
                requestLogsDeleted: { type: Number, default: 0 },
            },
        },
        security: {
            maxFailedAttempts: {
                type: Number,
                default: 3,
                min: 1,
                max: 10,
            },
            lockoutHours: {
                type: Number,
                default: 24,
                min: 1,
                max: 168,
            },
        },
        githubArchive: {
            enabled: {
                type: Boolean,
                default: false,
            },
            token: {
                type: String,
                default: "",
            },
            owner: {
                type: String,
                default: "",
            },
            repo: {
                type: String,
                default: "",
            },
            branch: {
                type: String,
                default: "main",
            },
            pathPrefix: {
                type: String,
                default: "request-logs",
            },
            autoPurgeAfterArchive: {
                type: Boolean,
                default: true,
            },
            retentionDaysInDb: {
                type: Number,
                default: 1,
                min: 0,
                max: 30,
            },
            lastArchivedDate: {
                type: String,
                default: null,
            },
            lastArchivedAt: {
                type: Date,
                default: null,
            },
            lastArchivedStatus: {
                type: String,
                enum: ["idle", "in_progress", "success", "failed"],
                default: "idle",
            },
            lastArchivedError: {
                type: String,
                default: "",
            },
            lastArchivedStats: {
                logCount: { type: Number, default: 0 },
                fileSizeKb: { type: Number, default: 0 },
                parts: { type: Number, default: 1 },
                commitSha: { type: String, default: "" },
                htmlUrl: { type: String, default: "" },
            },
        },
    },
    {
        timestamps: true,
    }
);

const SystemSettings = mongoose.model("SystemSettings", systemSettingsSchema);
export default SystemSettings;
