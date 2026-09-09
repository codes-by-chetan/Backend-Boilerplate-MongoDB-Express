import morgan from "morgan";
import chalk from "chalk";
import httpStatus from "http-status";
import fs from "fs";
import path from "path";

const logsDirectory = path.join(process.cwd(), "logs");
if (!fs.existsSync(logsDirectory)) {
    fs.mkdirSync(logsDirectory, { recursive: true });
}

// Function to get log file path based on current date
const getLogFilePath = () => {
    const date = new Date().toISOString().split("T")[0]; // YYYY-MM-DD format
    return path.join(logsDirectory, `logs-${date}.html`);
};

// Function to initialize log file with HTML structure if not already created
const initializeLogFile = (filePath) => {
    if (!fs.existsSync(filePath)) {
        const date = new Date().toISOString().split("T")[0];
        fs.writeFileSync(
            filePath,
            `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Application Logs - ${date}</title>
    <style>
        body { font-family: monospace; background: #090d16; color: #f8fafc; padding: 20px; line-height: 1.6; }
        pre { white-space: pre-wrap; word-break: break-word; font-family: inherit; }
        .log-line { display: block; margin: 2px 0; }
        .timestamp { color: #94a3b8; font-weight: bold; }
        .info { color: #38bdf8; font-weight: bold; }
        .warn { color: #f59e0b; font-weight: bold; }
        .error { color: #ef4444; font-weight: bold; }
        .debug { color: #c084fc; font-weight: bold; }
        .success { color: #10b981; font-weight: bold; }
        .method { font-weight: bold; }
        .url { background: #1e293b; padding: 2px 6px; border-radius: 4px; }
        .status-red { color: #ef4444; font-weight: bold; }
        .status-green { color: #10b981; font-weight: bold; }
        .status-message { color: #f59e0b; }
        .content-length { font-weight: bold; }
        .response-time { font-weight: bold; }
    </style>
</head>
<body><pre>\n`,
            "utf8"
        );
    }
};

// Initialize the log file for today
initializeLogFile(getLogFilePath());

/**
 * Safely append an HTML log line to today's log file
 */
const writeHtmlLog = (htmlEntry) => {
    try {
        const filePath = getLogFilePath();
        initializeLogFile(filePath);
        fs.appendFileSync(filePath, htmlEntry, "utf8");
    } catch (error) {
        console.error("Failed to write to log file:", error);
    }
};

// Custom Morgan format for HTTP request logging
const customMorganFormat = (tokens, req, res) => {
    const timestampStr = new Date().toLocaleDateString() + " " + new Date().toLocaleTimeString();
    const timestamp = chalk.bold(chalk.gray(timestampStr));
    const status = tokens.status(req, res);
    const statusColor = status >= 400 ? chalk.red : chalk.green;
    const statusMessage = httpStatus[status] || "Unknown Status";

    // Console output with colors
    const consoleLog = [
        timestamp,
        chalk.bold(statusColor(`[SERVER]`)),
        chalk.bold(statusColor(`[${tokens.method(req, res)}]`)),
        "===>>",
        chalk.bold(chalk.bgBlackBright(tokens.url(req, res))),
        "  ",
        chalk.bold(statusColor(status)),
        chalk.yellow(`[${statusMessage}]`),
        chalk.bold(tokens.res(req, res, "content-length") || "-"),
        " - ",
        chalk.bold(tokens["response-time"](req, res)),
        "ms",
    ].join(" ");

    // HTML log with block-level structure and styled classes
    const htmlLog = `<div class="log-line"><span class="timestamp">${timestampStr}</span> <span class="method ${status >= 400 ? "status-red" : "status-green"}">[SERVER] [${tokens.method(req, res)}]</span> ===>> <span class="url">${tokens.url(req, res)}</span>  <span class="${status >= 400 ? "status-red" : "status-green"}">${status}</span> <span class="status-message">[${statusMessage}]</span> <span class="content-length">${tokens.res(req, res, "content-length") || "-"}</span> - <span class="response-time">${tokens["response-time"](req, res)}</span> ms</div>\n`;

    writeHtmlLog(htmlLog);

    return consoleLog;
};

// Morgan middleware for request logging
const requestLogger = morgan(customMorganFormat);

/**
 * Logs messages to both console and HTML file with specified log levels.
 * @param {"info"|"warn"|"error"|"debug"|"success"} type - The log level.
 * @param {string|object} message - The message or data to log.
 * @param {"SERVER"|"SOCKET"} from - The origin of the log.
 */
const logMessage = (type, message, from = "SERVER") => {
    const timestampStr = new Date().toLocaleDateString() + " " + new Date().toLocaleTimeString();

    const logTypes = {
        info: chalk.bold(chalk.blue(`[${from}] ` + "[INFO]")),
        warn: chalk.bold(chalk.yellow(`[${from}] ` + "[WARN]")),
        error: chalk.bold(chalk.red(`[${from}] ` + "[ERROR]")),
        debug: chalk.bold(chalk.magenta(`[${from}] ` + "[DEBUG]")),
        success: chalk.bold(chalk.green(`[${from}] ` + "[SUCCESS]")),
    };

    const logType = logTypes[type] || chalk.bold(chalk.gray(`[${type.toUpperCase()}]`));
    const formattedMessage = typeof message === "object" ? JSON.stringify(message, null, 2) : message;

    // Log to console with colors
    console.log(`${chalk.gray(timestampStr)} ${logType} ${formattedMessage}`);

    // Log to HTML file with block-level structure
    const htmlLog = `<div class="log-line"><span class="timestamp">${timestampStr}</span> <span class="${type}">[${from.toString()?.toUpperCase()}] [${type?.toUpperCase()}]</span> ${formattedMessage}</div>\n`;
    writeHtmlLog(htmlLog);
};

// Handle uncaught exceptions and log them
process.on("uncaughtException", (err) => {
    logMessage("error", `Uncaught Exception: ${err.message}`);
    process.exit(1);
});

// Handle unhandled promise rejections
process.on("unhandledRejection", (reason) => {
    logMessage("error", `Unhandled Rejection: ${reason}`);
});

const logger = { logMessage, requestLogger };

export default logger;
