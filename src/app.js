import express from "express";
import cors from "cors";
import cookieparser from "cookie-parser";
import middlewares from "./middlewares/index.js";
import ApiResponse from "./utils/ApiResponse.js";
import logger from "./config/logger.config.js";
import config from "./config/env.config.js";
import mainRouter from "./routes/index.js";
import path from "path";
import { fileURLToPath } from "url";

const app = express();

// Determine allowed CORS origins
const allowedOrigins = config.cors.origin === "*"
    ? true
    : (config.cors.origin?.split(",").map((o) => o.trim()) || [
          "http://localhost:3000",
          "http://localhost:5173",
          "http://localhost:4200",
      ]);

const corsConfig = cors({
    origin: allowedOrigins,
    credentials: true,
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.set("trust proxy", true);

// Middlewares
app.use(logger.requestLogger);
app.use(corsConfig);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieparser());
app.use(middlewares.requestLoggerMiddleware);

// Admin Legacy Redirect - seamlessly redirect legacy log-viewer.html to in-app /admin/log-viewer
app.get("/admin/log-viewer.html", (req, res) => {
    const qs = req.url.includes("?") ? req.url.slice(req.url.indexOf("?")) : "";
    res.redirect(301, `/admin/log-viewer${qs}`);
});

// Admin SPA Fallback - Serve index.html for all /admin and /admin/* routes except static files
app.get(/^\/admin(\/.*)?$/, (req, res, next) => {
    if (path.extname(req.path)) {
        return next();
    }
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    res.sendFile(path.join(__dirname, "../public/admin/index.html"));
});



// Static files
app.use(
    express.static(path.join(__dirname, "../public"), {
        setHeaders(res, filePath) {
            if (filePath.endsWith(".html")) {
                res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
                res.setHeader("Pragma", "no-cache");
                res.setHeader("Expires", "0");
            }
        },
    })
);

// Root route / Health check
app.get("/", (req, res) => {
    const response = new ApiResponse(
        200,
        {
            status: "healthy",
            uptime: process.uptime(),
            timestamp: new Date().toISOString(),
        },
        "API Boilerplate service is running."
    );
    res.status(200).json(response);
});

// API Routes
app.use("/api", mainRouter);

// Centralized error handling
app.use(middlewares.errorHandler);

export default app;