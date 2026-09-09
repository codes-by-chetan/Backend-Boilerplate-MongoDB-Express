import { transporter } from "../index.js";
import config from "../config/env.config.js";
import logger from "../config/logger.config.js";

/**
 * Sends a generic email using Nodemailer.
 *
 * @param {Object} options
 * @param {string} options.to - Recipient email address
 * @param {string} options.subject - Subject line
 * @param {string} [options.text] - Plain text body
 * @param {string} [options.html] - HTML formatted body
 * @returns {Promise<Object>} Nodemailer send info
 */
const sendMail = async ({ to, subject, text, html }) => {
    try {
        const mailOptions = {
            from: `"${config.email.id || 'No-Reply'}" <${config.email.id}>`,
            to,
            subject,
            text,
            html,
        };

        const info = await transporter.sendMail(mailOptions);
        logger.logMessage("info", `Email sent successfully to ${to}: ${info.messageId}`);
        return info;
    } catch (error) {
        logger.logMessage("error", `Failed to send email to ${to}: ${error.message}`);
        throw error;
    }
};

/**
 * Sends a welcome email to a newly registered user.
 *
 * @param {Object} user
 * @returns {Promise<Object>}
 */
const sendWelcomeEmail = async (user) => {
    const subject = "Welcome to the Platform!";
    const html = `
        <div style="font-family: Arial, sans-serif; padding: 20px;">
            <h2>Welcome, ${user.fullName?.firstName || 'User'}!</h2>
            <p>Thank you for signing up. Your account is now active.</p>
        </div>
    `;
    return sendMail({ to: user.email, subject, html });
};

const mailService = {
    sendMail,
    sendWelcomeEmail,
};

export default mailService;
