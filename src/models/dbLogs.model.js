import mongoose from "mongoose";

const dbLogsSchema = new mongoose.Schema(
  {
    previousValue: { type: Object },
    newValue: { type: Object },
    status: {
      type: String,
      enum: ["success", "failed"],
      required: true,
    },
    transactionType: {
      type: String,
      enum: ["insert", "update", "delete"],
      required: true,
    },
    transactionDetails: { type: String },
    affectedCollection: { type: String, required: true },
    affectedDocumentId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    ipAddress: { type: String },
    origin: { type: String },
  },
  {
    timestamps: true,
  }
);


const DbLogs = mongoose.model("DbLogs", dbLogsSchema);

export default DbLogs;
