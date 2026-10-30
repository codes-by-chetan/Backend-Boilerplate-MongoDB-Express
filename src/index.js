import mongoose from "mongoose";
import app from "./app.js";
import config from "./config/env.config.js";
import logger from "./config/logger.config.js";
import connectDB from "./db/index.js";
import ensureAdminUser from "./db/adminBootstrap.js";
import getHostIpAddress from "./utils/hostIP.js";
import { Server } from "socket.io";
import { initializeSocket } from "./sockets/socket.js";
import { getTransporter, transporter } from "./config/mailer.config.js";

let io;
let server;

// Graceful shutdown handler
const gracefulShutdown = async (signal) => {
    logger.logMessage("warn", `Received ${signal}. Initiating graceful shutdown...`);

    // Force shutdown timeout after 10s if connections refuse to drain
    const forceExitTimeout = setTimeout(() => {
        logger.logMessage("error", "Graceful shutdown timed out. Forcing process exit.");
        process.exit(1);
    }, 10000);
    if (forceExitTimeout.unref) forceExitTimeout.unref();

    try {
        if (io) {
            logger.logMessage("info", "Closing active Socket.IO connections...");
            io.close();
        }

        if (server) {
            await new Promise((resolve) => {
                server.close((err) => {
                    if (err) logger.logMessage("error", `HTTP server close error: ${err.message}`);
                    else logger.logMessage("info", "HTTP server stopped accepting new requests.");
                    resolve();
                });
            });
        }

        if (mongoose.connection.readyState === 1) {
            logger.logMessage("info", "Closing MongoDB connection pool...");
            await mongoose.connection.close(false);
            logger.logMessage("info", "MongoDB connection closed successfully.");
        }

        logger.logMessage("success", "Graceful shutdown complete. Exiting cleanly.");
        process.exit(0);
    } catch (err) {
        logger.logMessage("error", `Error during graceful shutdown: ${err.message}`);
        process.exit(1);
    }
};

process.on("SIGINT", () => gracefulShutdown("SIGINT"));
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("unhandledRejection", (err) => {
    logger.logMessage("error", `Unhandled Promise Rejection: ${err?.stack || err?.message || err}`);
});
process.on("uncaughtException", (err) => {
    logger.logMessage("error", `Uncaught Exception: ${err?.stack || err?.message || err}`);
    gracefulShutdown("uncaughtException");
});

connectDB()
    .then(async () => {
        await ensureAdminUser();
        const host = getHostIpAddress();
        const port = config.port || 5000;
        const serverUrl = `http://${host}:${port}`;

        server = app.listen(port, () => {
            logger.logMessage("success", "Server Started Successfully");
            logger.logMessage("info", `Server is listening at Port : ${port}`);
            logger.logMessage("info", `Server url ==> ${serverUrl}`);
        });

        // Setup Socket.io
        const allowedOrigins = config.cors.origin === "*"
            ? true
            : (config.cors.origin?.split(",").map((o) => o.trim()) || [
                  "http://localhost:3000",
                  "http://localhost:5173",
                  "http://localhost:4200",
              ]);

        io = new Server(server, {
            cors: {
                origin: allowedOrigins,
                credentials: true,
            },
        });

        // Initialize socket logic
        initializeSocket(io);

        // Transporter setup & logging
        if (getTransporter()) {
            logger.logMessage("info", "Email transporter ready for transactional notifications.");
        } else {
            logger.logMessage("warn", "Email credentials not configured. Password reset & account unlock tokens/links will be printed directly to the console.");
        }
    })
    .catch((err) => {
        logger.logMessage("error", `Error starting server: ${err.message}`);
        process.exit(1);
    });

export { io, transporter, getTransporter, server };
