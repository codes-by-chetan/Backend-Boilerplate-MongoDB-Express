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
        CLOUDINARY_CLOUD_NAME: joi
            .string()
            .description("Cloudinary cloud name"),
        CLOUDINARY_API_KEY: joi.string().description("Cloudinary api key"),
        CLOUDINARY_API_SECRET: joi
            .string()
            .description("Cloudinary api secret"),
        CLOUDINARY_FOLDER: joi.string().default("UPLOADS").description("Cloudinary folder name"),
        GOOGLE_OAUTH_CLIENT_ID: joi
            .string()
            .description("Google OAuth client id"),
        GOOGLE_OAUTH_CLIENT_SECRET: joi
            .string()
            .description("Google OAuth client secret"),
        EMAIL_SERVICE: joi.string().description("Nodemailer email service name"),
        EMAIL_ID: joi.string().description("Nodemailer email address"),
        EMAIL_PASSKEY: joi.string().description("Nodemailer email passkey"),
        META_CLIENT_ID: joi.string().description("Meta / Facebook app id"),
        META_CLIENT_SECRET: joi.string().description("Meta / Facebook app secret"),
        SELF_HOST_URL: joi.string().description("Server self-host URL"),
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
            secure: envVars.NODE_ENV === "production",
            sameSite: envVars.NODE_ENV === "production" ? "none" : "lax",
            path: "/",
        },
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
    email: {
        service: envVars.EMAIL_SERVICE,
        id: envVars.EMAIL_ID,
        passkey: envVars.EMAIL_PASSKEY,
    },
    self: {
        host: {
            url: envVars.SELF_HOST_URL,
        },
    },
    admin: {
        bootstrapEnabled: envVars.BOOTSTRAP_ADMIN,
        name: envVars.ADMIN_NAME,
        email: envVars.ADMIN_EMAIL,
        password: envVars.ADMIN_PASSWORD,
    },
};

export default config;
