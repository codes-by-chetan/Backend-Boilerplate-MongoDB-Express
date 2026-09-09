import mongoose from "mongoose";

const dbLogsSchema = new mongoose.Schema(
  {
    affectedCollection: {
      type: String,
      required: true,
      index: true,
    },
    affectedDocumentId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    version: {
      type: Number,
      required: true,
      default: 1,
      index: true,
    },
    transactionType: {
      type: String,
      enum: ["insert", "update", "delete", "rollback", "restore"],
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["success", "failed"],
      default: "success",
    },
    diff: {
      type: Object,
      default: {},
    },
    summary: {
      type: String,
      default: "",
    },
    transactionDetails: {
      type: String,
      default: "",
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    ipAddress: {
      type: String,
      default: null,
    },
    origin: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// High-speed compound indexes for version history and collection timelines
dbLogsSchema.index({ affectedCollection: 1, affectedDocumentId: 1, version: 1 });
dbLogsSchema.index({ affectedCollection: 1, createdAt: -1 });

const DbLogs = mongoose.model("DbLogs", dbLogsSchema);

export default DbLogs;
