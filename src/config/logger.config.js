import morgan from "morgan";
import chalk from "chalk";
import httpStatus from "http-status";
import fs from "fs";
import path from "path";

// Function to get log file path based on current date
const getLogFilePath = () => {
    const date = new Date().toISOString().split("T")[0]; // YYYY-MM-DD format
    return path.join(process.cwd(), `logs/logs-${date}.html`);
};

// Global variable to hold the current log stream and date
let currentDate = new Date().toISOString().split("T")[0];
let logStream = fs.createWriteStream(getLogFilePath(), { flags: "a" });

// Function to initialize or update log file with HTML structure
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
        body { font-family: monospace; background: #1a1a1a; color: #fff; padding: 20px; }
        .timestamp { color: #888; font-weight: bold; }
        .info { color: #0ca8d8; }
        .warn { color: #ff0; }
        .error { color: #f00; }
        .debug { color: #f0f; }
        .success { color: #0f0; }
        .method { font-weight: bold; }
        .url { background: #555; padding: 2px 5px; }
        .status-red { color: #f00; font-weight: bold; }
        .status-green { color: #0f0; font-weight: bold; }
        .status-message { color: #ff0; }
        .content-length { font-weight: bold; }
        .response-time { font-weight: bold; }
    </style>
</head>
<body><pre>`,
            "utf8"
        );
    }
};

// Initialize the first log file
initializeLogFile(getLogFilePath());

// Function to update log stream if date changes
const updateLogStream = () => {
    const newDate = new Date().toISOString().split("T")[0];
    if (newDate !== currentDate) {
        logStream.write("</pre></body></html>"); // Close the old file
        logStream.end();
        currentDate = newDate;
        const newFilePath = getLogFilePath();
        initializeLogFile(newFilePath);
        logStream = fs.createWriteStream(newFilePath, { flags: "a" });
    }
};

// Custom Morgan format for HTTP request logging
const customMorganFormat = (tokens, req, res) => {
    updateLogStream(); // Check and update stream before logging

    const timestamp = chalk.bold(
        chalk.gray(
            new Date().toLocaleDateString() +
                " " +
                new Date().toLocaleTimeString()
        )
    );
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

    // HTML log with styled classes
    const htmlLog = `<span class="timestamp">${
        new Date().toLocaleDateString() + " " + new Date().toLocaleTimeString()
    }</span> <span class="method ${status >= 400 ? "status-red" : "status-green"}">[SERVER] [${tokens.method(req, res)}]</span> ===>> <span class="url">${tokens.url(req, res)}</span>  <span class="${status >= 400 ? "status-red" : "status-green"}">${status}</span> <span class="status-message">[${statusMessage}]</span> <span class="content-length">${tokens.res(req, res, "content-length") || "-"}</span> - <span class="response-time">${tokens["response-time"](req, res)}</span> ms\n`;

    logStream.write(htmlLog);

    return consoleLog;
};

// Morgan middleware for request logging
const requestLogger = morgan(customMorganFormat);

/**
 * Logs messages to both console and HTML file with specified log levels.
 * @param {"info"|"warn"|"error"|"debug"|"success"} type - The log level.
 * @param {string|object} message - The message or data to log.
 * @param {"SERVER"|"SOCKET"} from - The message or data to log.
 */
const logMessage = (type, message, from = "SERVER") => {
    updateLogStream(); // Check and update stream before logging

    const timestamp =
        new Date().toLocaleDateString() + " " + new Date().toLocaleTimeString();

    const logTypes = {
        info: chalk.bold(chalk.blue(`[${from}] ` + "[INFO]")),
        warn: chalk.bold(chalk.yellow(`[${from}] ` + "[WARN]")),
        error: chalk.bold(chalk.red(`[${from}] ` + "[ERROR]")),
        debug: chalk.bold(chalk.magenta(`[${from}] ` + "[DEBUG]")),
        success: chalk.bold(chalk.green(`[${from}] ` + "[SUCCESS]")),
    };

    const logType =
        logTypes[type] || chalk.bold(chalk.gray(`[${type.toUpperCase()}]`));
    const formattedMessage =
        typeof message === "object"
            ? JSON.stringify(message, null, 2)
            : message;

    // Log to console with colors
    console.log(`${chalk.gray(timestamp)} ${logType} ${formattedMessage}`);

    // Log to HTML file with styled classes
    const htmlLog = `<span class="timestamp">${timestamp}</span> <span class="${type}">[${from.toString()?.toUpperCase()}] [${type?.toUpperCase()}]</span> ${formattedMessage}\n`;
    logStream.write(htmlLog);
};

// Ensure proper closure of HTML file on process exit
process.on("exit", () => {
    logStream.write("</pre></body></html>");
    logStream.end();
});

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

