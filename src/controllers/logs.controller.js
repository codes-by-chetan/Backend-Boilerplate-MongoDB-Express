import fs from "fs";
import path from "path";
import asyncHandler from "../utils/asyncHandler.js";
import { fileURLToPath } from "url";
import logger from "../config/logger.config.js";

const getAllLogs = asyncHandler(async (req, res) => {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);

    const logsDir = path.join(__dirname, "../../logs"); // Adjust the path to your logs folder
    const files = fs.readdirSync(logsDir); // Read all files in the logs directory

    const logs = files.map((file) => {
        const filePath = path.join(logsDir, file);
        return {
            fileName: file,
            content: fs.readFileSync(filePath, "utf-8"), // Read the content of each file
        };
    });

    res.status(200).json({ logs });
});

const getLogsByDate = asyncHandler(async (req, res) => {
    const { date } = req.params;
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);

    const logsDir = path.join(__dirname, "../../logs");
    const filePath = path.join(logsDir, `logs-${date}.html`);
    
    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ message: "Log file not found" });
    }

    const content = fs.readFileSync(filePath, "utf-8");
    res.status(200).send(content);
});

const getRecentLogs = asyncHandler(async (req, res) => {
    const date = new Date().toISOString().split("T")[0];
    
    
    logger.logMessage("info", date)
    
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);

    const logsDir = path.join(__dirname, "../../logs");
    const filePath = path.join(logsDir, `logs-${date}.html`);

    if (!fs.existsSync(filePath)) {
        console.log("hello");
        
        return res.status(404).json({ message: "Log file not found" });
    }

    const content = fs.readFileSync(filePath, "utf-8");
    res.status(200).send(content);
});

const logsController = {
    getAllLogs,
    getLogsByDate,
    getRecentLogs,
};

export default logsController;
