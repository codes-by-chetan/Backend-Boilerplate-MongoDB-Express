import mongoose from "mongoose";
import config from "../config/env.config.js";
import constants from "../constants/index.js";
import logger from "../config/logger.config.js";

const connectDB = async () => {
    try {
        const dbName = constants.DB_CONSTANTS.DB_NAME;
        const baseUri = config.mongoose.url;
        const uri = baseUri.endsWith("/") ? `${baseUri}${dbName}` : `${baseUri}/${dbName}`;

        // Mask credentials when logging
        const maskedUri = uri.replace(/:([^:@]+)@/, ":****@");
        logger.logMessage("info", `Connecting to MongoDB database: ${maskedUri}`);

        const connectionInstance = await mongoose.connect(uri);
        logger.logMessage(
            "success",
            `MongoDB Connected Successfully! Hostname: ${connectionInstance.connections[0]?.host}`
        );
    } catch (error) {
        logger.logMessage("error", `MongoDB connection error: ${error.message}`);
        process.exit(1);
    }
};

export default connectDB;
