import dotenv from "dotenv";
import joi from "joi";
import ApiError from "../utils/ApiError.js";

dotenv.config({ path: ".env" });

const envVarSchema = joi
    .object({
        NODE_ENV: joi
            .string()
            .valid("development", "production", "test")
            .default("development")
            .description("Node environment type"),
        PORT: joi.number().default(3000).description("Server port"),
        MONGODB_URI: joi.string().description("MongoDB connection string"),
        DB_NAME: joi.string().default("backend_boilerplate").description("Database name"),
        CORS_ORIGIN: joi.string().default("*").description("CORS origin url"),
        
        // JWT & Tokens
        ACCESS_TOKEN_SECRET_KEY: joi
            .string()
            .description("Access token secret key"),
        ACCESS_TOKEN_EXPIRY: joi
            .string()
            .default("15m")
            .description("Access token expiry time"),
        REFRESH_TOKEN_SECRET_KEY: joi
            .string()
            .description("Refresh token secret key"),
        REFRESH_TOKEN_EXPIRY: joi
            .string()
            .default("7d")
            .description("Refresh token expiry time"),
        LOG_ENCRYPTION_KEY: joi
            .string()
            .default("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855")
            .description("AES-256-GCM secret key for encrypting sensitive request log payloads"),

        // Cookies
        COOKIE_SECRET: joi.string().default("cookie_secret_key").description("Cookie secret"),
        COOKIE_SECURE: joi.boolean().default(false).description("Cookie secure flag"),
        COOKIE_SAME_SITE: joi.string().valid("lax", "strict", "none").default("lax").description("Cookie same site"),

        // Threat Mitigation & Security Policy
        MAX_LOGIN_ATTEMPTS: joi.number().default(3).description("Max login attempts before lockout"),
        LOCKOUT_DURATION_HOURS: joi.number().default(24).description("Lockout duration in hours"),
        EMAIL_COOLDOWN_SECONDS: joi.number().default(60).description("Email cooldown in seconds"),
        RATE_LIMIT_LOGIN_MAX: joi.number().default(15).description("Login rate limit hits per min"),
        RATE_LIMIT_EMAIL_MAX: joi.number().default(5).description("Email rate limit hits per min"),

        // Client & Host URLs
        CLIENT_URL: joi.string().default("http://localhost:5173").description("Frontend client URL"),
        SELF_HOST_URL: joi.string().description("Server self-host URL"),

        // Email / SMTP
        EMAIL_SERVICE: joi.string().description("Nodemailer email service name"),
        EMAIL_ID: joi.string().description("Nodemailer email address"),
        EMAIL_PASSKEY: joi.string().description("Nodemailer email passkey"),
        EMAIL_FROM: joi.string().description("Sender email address / name"),
        SMTP_HOST: joi.string().description("SMTP host"),
        SMTP_PORT: joi.number().description("SMTP port"),
        SMTP_SECURE: joi.boolean().default(false).description("SMTP secure SSL/TLS"),
        SMTP_USER: joi.string().description("SMTP user"),
        SMTP_PASS: joi.string().description("SMTP password"),

        // Geolocation / Threat Forensics
        IPINFO_API_TOKEN: joi.string().description("IPInfo API token"),

        // Cloudinary Media Storage
        CLOUDINARY_CLOUD_NAME: joi
            .string()
            .description("Cloudinary cloud name"),
        CLOUDINARY_API_KEY: joi.string().description("Cloudinary api key"),
        CLOUDINARY_API_SECRET: joi
            .string()
            .description("Cloudinary api secret"),
        CLOUDINARY_FOLDER: joi.string().default("UPLOADS").description("Cloudinary folder name"),

        // OAuth
        GOOGLE_OAUTH_CLIENT_ID: joi
            .string()
            .description("Google OAuth client id"),
        GOOGLE_OAUTH_CLIENT_SECRET: joi
            .string()
            .description("Google OAuth client secret"),
        META_CLIENT_ID: joi.string().description("Meta / Facebook app id"),
        META_CLIENT_SECRET: joi.string().description("Meta / Facebook app secret"),

        // Admin Bootstrap
        BOOTSTRAP_ADMIN: joi.boolean().default(true).description("Enable bootstrap admin seeding"),
        ADMIN_NAME: joi.string().default("Admin").description("Bootstrap admin name"),
        ADMIN_EMAIL: joi.string().email().default("admin@example.com").description("Bootstrap admin email"),
        ADMIN_PASSWORD: joi.string().default("admin12345").description("Bootstrap admin password"),
    })
    .unknown();

const { value: envVars, error } = envVarSchema
    .prefs({ errors: { label: "key" } })
    .validate(process.env);

if (error) {
    throw new ApiError(500, `ENV config validation error : ${error.message}`);
}

const config = {
    env: envVars.NODE_ENV,
    port: envVars.PORT,
    mongoose: {
        url: envVars.MONGODB_URI,
        dbName: envVars.DB_NAME,
        options: {},
    },
    cors: {
        origin: envVars.CORS_ORIGIN,
    },
    jwt: {
        secret: envVars.ACCESS_TOKEN_SECRET_KEY,
        expiry: envVars.ACCESS_TOKEN_EXPIRY || "15m",
        refreshSecret: envVars.REFRESH_TOKEN_SECRET_KEY || envVars.ACCESS_TOKEN_SECRET_KEY,
        refreshExpiry: envVars.REFRESH_TOKEN_EXPIRY || "7d",
        cookieOptions: {
            httpOnly: true,
            secure: envVars.COOKIE_SECURE !== undefined ? envVars.COOKIE_SECURE : envVars.NODE_ENV === "production",
            sameSite: envVars.COOKIE_SAME_SITE || (envVars.NODE_ENV === "production" ? "none" : "lax"),
            path: "/",
        },
    },
    cookies: {
        secret: envVars.COOKIE_SECRET,
        secure: envVars.COOKIE_SECURE,
        sameSite: envVars.COOKIE_SAME_SITE,
    },
    security: {
        maxLoginAttempts: envVars.MAX_LOGIN_ATTEMPTS,
        lockoutDurationHours: envVars.LOCKOUT_DURATION_HOURS,
        emailCooldownSeconds: envVars.EMAIL_COOLDOWN_SECONDS,
        rateLimitLoginMax: envVars.RATE_LIMIT_LOGIN_MAX,
        rateLimitEmailMax: envVars.RATE_LIMIT_EMAIL_MAX,
    },
    client: {
        url: envVars.CLIENT_URL,
    },
    self: {
        host: {
            url: envVars.SELF_HOST_URL,
        },
    },
    email: {
        service: envVars.EMAIL_SERVICE,
        id: envVars.EMAIL_ID,
        passkey: envVars.EMAIL_PASSKEY,
        from: envVars.EMAIL_FROM || envVars.EMAIL_ID,
        smtp: {
            host: envVars.SMTP_HOST,
            port: envVars.SMTP_PORT,
            secure: envVars.SMTP_SECURE,
            user: envVars.SMTP_USER,
            pass: envVars.SMTP_PASS,
        },
    },
    geolocation: {
        ipinfoToken: envVars.IPINFO_API_TOKEN,
    },
    logEncryptionKey: envVars.LOG_ENCRYPTION_KEY || "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    cloudinary: {
        cloudName: envVars.CLOUDINARY_CLOUD_NAME,
        apiKey: envVars.CLOUDINARY_API_KEY,
        apiSecret: envVars.CLOUDINARY_API_SECRET,
        folder: envVars.CLOUDINARY_FOLDER,
    },
    google: {
        clientId: envVars.GOOGLE_OAUTH_CLIENT_ID,
        clientSecret: envVars.GOOGLE_OAUTH_CLIENT_SECRET,
    },
    google_client_id: envVars.GOOGLE_OAUTH_CLIENT_ID,
    meta: {
        appId: envVars.META_CLIENT_ID,
        appSecret: envVars.META_CLIENT_SECRET,
    },
    admin: {
        bootstrapEnabled: envVars.BOOTSTRAP_ADMIN,
        name: envVars.ADMIN_NAME,
        email: envVars.ADMIN_EMAIL,
        password: envVars.ADMIN_PASSWORD,
    },
};

export default config;
