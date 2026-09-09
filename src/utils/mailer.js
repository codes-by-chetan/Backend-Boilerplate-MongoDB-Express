import { transporter } from "../index.js";
import config from "../config/env.config.js";
import logger from "../config/logger.config.js";

/**
 * Sends a server startup status email.
 *
 * @param {Object} data
 * @param {string} data.host
 * @param {number} data.port
 * @param {string} data.url
 * @param {string} [recipientEmail]
 */
async function sendTestMail(data, recipientEmail) {
    const to = recipientEmail || config.email.id;
    if (!to || !transporter) return;

    try {
        const testMailOptions = {
            from: `"Server Notifier" <${config.email.id}>`,
            to,
            subject: "🚀 Service is Running Live!",
            html: `
                <div style="font-family: Arial, sans-serif; padding: 30px 20px; background: #f6f8fa;">
                  <div style="max-width: 600px; margin: auto; background: #fff; border-radius: 10px; box-shadow: 0 8px 20px rgba(0,0,0,0.07); padding: 24px;">
                    <h2 style="color: #28a745; margin-top: 0;">
                      ✅ Service Started Successfully
                    </h2>
                    <p style="color: #222; font-size: 1.1em;">Your server is live and running. Here are the details:</p>
                    <table style="width: 100%; margin: 18px 0 30px; border-collapse: collapse;">
                      <tr>
                        <td style="padding: 10px 0; font-weight: bold;">Hostname/IP:</td>
                        <td style="padding: 10px 0;">${data.host}</td>
                      </tr>
                      <tr>
                        <td style="padding: 10px 0; font-weight: bold;">Port:</td>
                        <td style="padding: 10px 0;">${data.port}</td>
                      </tr>
                      <tr>
                        <td style="padding: 10px 0; font-weight: bold;">URL:</td>
                        <td style="padding: 10px 0;">
                          <a href="${data.url}" style="color: #007bff; text-decoration: none;">${data.url}</a>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 10px 0; font-weight: bold;">Date & Time:</td>
                        <td style="padding: 10px 0;">${new Date().toISOString()}</td>
                      </tr>
                    </table>
                  </div>
                </div>
            `,
        };
        const info = await transporter.sendMail(testMailOptions);
        logger.logMessage("info", `Status email sent: ${info.response}`);
    } catch (error) {
        logger.logMessage("error", `Status email error: ${error.message}`);
    }
}

/**
 * Sends an email using the provided mail options.
 *
 * @param {Object} mailOptions
 */
async function sendMail(mailOptions) {
    if (!transporter) return;
    try {
        const info = await transporter.sendMail(mailOptions);
        logger.logMessage("info", `Email sent: ${info.response}`);
        return info;
    } catch (error) {
        logger.logMessage("error", `Email sending error: ${error.message}`);
        throw error;
    }
}

export { sendTestMail, sendMail };
