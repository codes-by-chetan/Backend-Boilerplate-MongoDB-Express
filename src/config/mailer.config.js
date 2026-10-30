import nodemailer from "nodemailer";
import config from "./env.config.js";
import logger from "./logger.config.js";

let transporter = null;

const hasValidCredentials = () => {
    if (config.email?.smtp?.host && config.email?.smtp?.user) {
        return true;
    }
    if (
        config.email?.id &&
        config.email?.passkey &&
        !config.email.id.includes("your_email") &&
        !config.email.id.includes("example.com")
    ) {
        return true;
    }
    return false;
};

let initialized = false;

export const initTransporter = () => {
    initialized = true;
    if (config.email?.smtp?.host && config.email?.smtp?.user) {
        transporter = nodemailer.createTransport({
            host: config.email.smtp.host,
            port: config.email.smtp.port || 587,
            secure: Boolean(config.email.smtp.secure),
            auth: {
                user: config.email.smtp.user,
                pass: config.email.smtp.pass,
            },
        });
        logger.logMessage("info", `Email transporter initialized with custom SMTP (${config.email.smtp.host})`);
    } else if (hasValidCredentials()) {
        transporter = nodemailer.createTransport({
            service: config.email.service || "gmail",
            auth: {
                user: config.email.id,
                pass: config.email.passkey,
            },
        });
        logger.logMessage("info", `Email transporter initialized with ${config.email.service || "gmail"} (${config.email.id})`);
    } else {
        transporter = null;
    }
    return transporter;
};

initTransporter();

export const getTransporter = () => {
    if (!initialized) {
        initTransporter();
    }
    return transporter;
};
export { transporter };
export default getTransporter;
