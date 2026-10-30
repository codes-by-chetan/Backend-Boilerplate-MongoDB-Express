import express from "express";
import cors from "cors";
import cookieparser from "cookie-parser";
import helmet from "helmet";
import swaggerUi from "swagger-ui-express";
import swaggerSpec from "./config/swagger.config.js";
import middlewares from "./middlewares/index.js";
import ApiResponse from "./utils/ApiResponse.js";
import logger from "./config/logger.config.js";
import config from "./config/env.config.js";
import controllers from "./controllers/index.js";
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

// Enterprise HTTP Security Headers via Helmet
app.use(
    helmet({
        contentSecurityPolicy: {
            directives: {
                defaultSrc: ["'self'"],
                scriptSrc: ["'self'", "'unsafe-inline'"],
                styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
                fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
                imgSrc: ["'self'", "data:", "blob:", "https:"],
                connectSrc: ["'self'", "ws:", "wss:", "http:", "https:"],
            },
        },
        crossOriginEmbedderPolicy: false,
    })
);

// Middlewares
app.use(logger.requestLogger);
app.use(corsConfig);
app.use(express.json({ limit: "16kb" }));
app.use(express.urlencoded({ extended: true, limit: "16kb" }));
app.use(middlewares.sanitizeInputs);
app.use(cookieparser());
app.use(middlewares.requestLoggerMiddleware);

// Admin Legacy Redirect - seamlessly redirect legacy log-viewer.html to in-app /admin/log-viewer
app.get("/admin/log-viewer.html", (req, res) => {
    const qs = req.url.includes("?") ? req.url.slice(req.url.indexOf("?")) : "";
    res.redirect(301, `/admin/log-viewer${qs}`);
});

// Direct Browser Unlock Link - Immediately unlocks account in DB when link is opened and redirects to /admin?unlocked=true
app.get("/admin/unlock-account", controllers.authController.unlockAccount);

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

// Interactive OpenAPI / Swagger Documentation
app.use(
    "/api-docs",
    swaggerUi.serve,
    swaggerUi.setup(swaggerSpec, {
        customCss: ".swagger-ui .topbar { display: none }",
        customSiteTitle: "Enterprise API Documentation",
    })
);

// API Routes
app.use("/api", mainRouter);

// Centralized error handling
app.use(middlewares.errorHandler);

export default app;