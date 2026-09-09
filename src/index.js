import app from "./app.js";
import config from "./config/env.config.js";
import logger from "./config/logger.config.js";
import connectDB from "./db/index.js";
import getHostIpAddress from "./utils/hostIP.js";
import { Server } from "socket.io";
import { initializeSocket } from "./sockets/socket.js";
import nodemailer from "nodemailer";

let io;
let transporter;

connectDB()
    .then(() => {
        const host = getHostIpAddress();
        const port = config.port || 5000;
        const serverUrl = `http://${host}:${port}`;

        const server = app.listen(port, () => {
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

        // Setup Nodemailer transporter if email credentials provided
        if (config.email?.id && config.email?.passkey) {
            transporter = nodemailer.createTransport({
                service: config.email.service || "gmail",
                auth: {
                    user: config.email.id,
                    pass: config.email.passkey,
                },
            });
        }
    })
    .catch((err) => {
        logger.logMessage("error", `Error starting server: ${err.message}`);
        process.exit(1);
    });

export { io, transporter };
