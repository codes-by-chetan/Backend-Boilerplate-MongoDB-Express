import { getTransporter } from "../config/mailer.config.js";
import config from "../config/env.config.js";
import logger from "../config/logger.config.js";
import chalk from "chalk";

/**
 * Pretty-prints a prominent developer simulation box in the console whenever
 * the mailer is not connected or email delivery fails.
 * Guarantees tokens and clickable URLs are printed in full for instant developer copying.
 */
const logDevEmailSimulation = ({ to, subject, links = [], token = null, extra = {} }) => {
    const divider = "═".repeat(78);

    console.log("\n" + chalk.bold.yellow(`╔${divider}╗`));
    console.log(
        chalk.bold.yellow(`║ `) +
        chalk.bold.bgCyan.black(` 📧 DEV EMAIL SIMULATION `) +
        chalk.bold.white(` ${subject}`.slice(0, 52).padEnd(53)) +
        chalk.bold.yellow(`║`)
    );
    console.log(chalk.bold.yellow(`╠${divider}╣`));
    console.log(chalk.bold.yellow(`║ `) + chalk.cyan(`Recipient   : `) + chalk.bold.green(to.slice(0, 62).padEnd(64)) + chalk.bold.yellow(`║`));
    
    if (token) {
        console.log(chalk.bold.yellow(`║ `) + chalk.cyan(`Token       : `) + chalk.bold.magenta(token.slice(0, 62).padEnd(64)) + chalk.bold.yellow(`║`));
        if (token.length > 62) {
            console.log(chalk.bold.yellow(`║ `) + `              ` + chalk.bold.magenta(token.slice(62).padEnd(64)) + chalk.bold.yellow(`║`));
        }
    }
    
    links.forEach(({ label, url }) => {
        console.log(chalk.bold.yellow(`║ `) + chalk.cyan(`${(label + " :").padEnd(14)}`) + chalk.bold.blueBright(url.slice(0, 62).padEnd(64)) + chalk.bold.yellow(`║`));
        if (url.length > 62) {
            let offset = 62;
            while (offset < url.length) {
                console.log(chalk.bold.yellow(`║ `) + `              ` + chalk.bold.blueBright(url.slice(offset, offset + 62).padEnd(64)) + chalk.bold.yellow(`║`));
                offset += 62;
            }
        }
    });

    for (const [k, v] of Object.entries(extra)) {
        console.log(
            chalk.bold.yellow(`║ `) +
            chalk.gray(`${(k + " :").padEnd(14)}`) +
            chalk.gray(String(v).slice(0, 62).padEnd(64)) +
            chalk.bold.yellow(`║`)
        );
    }

    console.log(chalk.bold.yellow(`╠${divider}╣`));
    console.log(
        chalk.bold.yellow(`║ `) +
        chalk.yellowBright(`💡 Mailer not connected. Use the clickable link or raw token below:        `) +
        chalk.bold.yellow(`║`)
    );
    console.log(chalk.bold.yellow(`╚${divider}╝`));

    // Print raw lines directly so terminal emulators detect the URL as a clickable link and easy copy
    if (token) {
        console.log(chalk.bold.magenta(`🔑 Raw Token   : `) + chalk.bold.white(token));
    }
    links.forEach(({ label, url }) => {
        console.log(chalk.bold.blueBright(`🔗 Direct Link (${label}) : `) + chalk.underline.cyan(url));
    });
    console.log("");

    logger.logMessage(
        "warn",
        `[DEV EMAIL SIMULATION] To: ${to} | Subject: "${subject}" ${token ? `| Token: ${token}` : ""} | Links: ${links.map((l) => `${l.label}: ${l.url}`).join(" | ")}`
    );
};

/**
 * Sends a generic email using Nodemailer or logs to console in development.
 *
 * @param {Object} options
 * @param {string} options.to - Recipient email address
 * @param {string} options.subject - Subject line
 * @param {string} [options.text] - Plain text body
 * @param {string} [options.html] - HTML formatted body
 * @returns {Promise<Object>} Nodemailer send info or mock object
 */
const sendMail = async ({ to, subject, text, html }) => {
    const transporter = getTransporter();
    const sender = config.email.from || (config.email.id ? `"No-Reply" <${config.email.id}>` : '"Enterprise Security" <noreply@boilerplate.local>');
    
    if (!transporter) {
        logDevEmailSimulation({ to, subject });
        return { messageId: "dev-mock-id", devMock: true };
    }

    try {
        const mailOptions = {
            from: sender,
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
        logDevEmailSimulation({ to, subject: `${subject} (SMTP Failed: ${error.message})` });
        return { messageId: "dev-fallback-id", devMock: true, error: error.message };
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
        <div style="font-family: Arial, sans-serif; padding: 24px; background: #0f172a; color: #f8fafc; border-radius: 8px;">
            <h2 style="color: #38bdf8; margin-top: 0;">Welcome, ${user.fullName?.firstName || 'User'}!</h2>
            <p style="color: #cbd5e1; font-size: 15px; line-height: 1.6;">Thank you for signing up. Your account is now active and ready to use.</p>
        </div>
    `;
    return sendMail({ to: user.email, subject, html });
};

/**
 * Sends an automated intrusion alert email when an account is locked after 3 consecutive failed attempts.
 * Implements Layer 3 of the Security Blueprint with actionable recovery links and forensic metadata.
 *
 * @param {Object} user - User document
 * @param {Object} forensicData - Intrusion forensics { ip, browser, os, device, location, timestamp }
 * @param {string} unlockLink - Direct single-use unlock URL
 * @param {string} resetPasswordLink - Direct password reset URL
 */
const sendAccountLockoutAlertEmail = async (user, forensicData, unlockLink, resetPasswordLink) => {
    const subject = "🚨 Security Alert: Account Temporarily Locked (Failed Logins Detected)";
    const firstName = user.fullName?.firstName || "User";
    const unlockToken = unlockLink.includes("token=") ? unlockLink.split("token=")[1].split("&")[0] : null;
    const resetToken = resetPasswordLink.includes("token=") ? resetPasswordLink.split("token=")[1].split("&")[0] : null;

    // Development Console Simulation when mailer credentials are not configured
    const transporter = getTransporter();
    if (!transporter) {
        logDevEmailSimulation({
            to: user.email,
            subject,
            token: unlockToken,
            links: [
                { label: "Unlock URL", url: unlockLink },
                { label: "Reset URL", url: resetPasswordLink },
            ],
            extra: {
                "Lockout": "24 Hours (Brute-Force Protection)",
                "Client IP": forensicData?.ip || "Unknown",
                "OS / Browser": `${forensicData?.os || "Unknown"} / ${forensicData?.browser || "Unknown"}`,
            },
        });
        return { devMock: true, unlockToken, resetToken, unlockLink, resetPasswordLink };
    }

    const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Security Alert</title>
        </head>
        <body style="margin: 0; padding: 0; background-color: #0b0f19; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #f1f5f9;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #0b0f19; padding: 30px 15px;">
                <tr>
                    <td align="center">
                        <table role="presentation" width="100%" style="max-width: 600px; background-color: #111827; border: 1px solid #1f2937; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.5);">
                            <tr>
                                <td style="padding: 24px 30px; background-color: #7f1d1d; border-bottom: 2px solid #ef4444;">
                                    <h2 style="margin: 0; color: #ffffff; font-size: 20px; font-weight: 700; letter-spacing: 0.5px;">
                                        🚨 Account Locked: Brute-Force Defense Triggered
                                    </h2>
                                </td>
                            </tr>
                            <tr>
                                <td style="padding: 30px;">
                                    <p style="font-size: 16px; margin-top: 0; color: #f3f4f6;">
                                        Hello <strong>${firstName}</strong>,
                                    </p>
                                    <p style="font-size: 15px; color: #cbd5e1; line-height: 1.6;">
                                        Your account has been temporarily locked for <strong>24 hours</strong> because <strong>3 consecutive failed password attempts</strong> were detected against your account.
                                    </p>
                                    <div style="background-color: #1e293b; border-radius: 8px; padding: 18px; margin: 24px 0; border: 1px solid #334155;">
                                        <h4 style="margin: 0 0 12px 0; color: #38bdf8; font-size: 14px; text-transform: uppercase; letter-spacing: 1px;">
                                            Activity Forensics
                                        </h4>
                                        <table width="100%" style="font-size: 13px; color: #94a3b8; border-collapse: collapse;">
                                            <tr>
                                                <td style="padding: 6px 0; font-weight: 600; width: 35%;">IP Address:</td>
                                                <td style="padding: 6px 0; color: #e2e8f0; font-family: monospace;">${forensicData.ip || 'Unknown'}</td>
                                            </tr>
                                            <tr>
                                                <td style="padding: 6px 0; font-weight: 600;">Device & OS:</td>
                                                <td style="padding: 6px 0; color: #e2e8f0;">${forensicData.device || 'Desktop'} (${forensicData.os || 'Unknown OS'})</td>
                                            </tr>
                                            <tr>
                                                <td style="padding: 6px 0; font-weight: 600;">Browser:</td>
                                                <td style="padding: 6px 0; color: #e2e8f0;">${forensicData.browser || 'Unknown'}</td>
                                            </tr>
                                            <tr>
                                                <td style="padding: 6px 0; font-weight: 600;">Approx. Location:</td>
                                                <td style="padding: 6px 0; color: #e2e8f0;">${forensicData.location || 'Local / Private Network'}</td>
                                            </tr>
                                            <tr>
                                                <td style="padding: 6px 0; font-weight: 600;">Timestamp:</td>
                                                <td style="padding: 6px 0; color: #e2e8f0;">${forensicData.timestamp || new Date().toUTCString()}</td>
                                            </tr>
                                        </table>
                                    </div>
                                    <div style="background-color: #3b2810; border-left: 4px solid #f59e0b; padding: 14px 16px; border-radius: 4px; margin-bottom: 24px;">
                                        <p style="margin: 0; color: #fde68a; font-size: 13.5px; line-height: 1.5;">
                                            <strong>Important Security Guidance:</strong><br>
                                            • <em>If you remember your password:</em> Click <strong>Unlock Account</strong> below.<br>
                                            • <em>If you do NOT remember your password:</em> Click <strong>Reset Password</strong>.
                                        </p>
                                    </div>
                                    <table width="100%" cellspacing="0" cellpadding="0" style="margin: 24px 0;">
                                        <tr>
                                            <td align="center" style="padding-bottom: 12px;">
                                                <a href="${unlockLink}" style="display: inline-block; background-color: #2563eb; color: #ffffff; text-decoration: none; font-weight: 600; font-size: 15px; padding: 12px 28px; border-radius: 6px; box-shadow: 0 4px 12px rgba(37,99,235,0.3);">
                                                    🔓 Unlock Account (1-Hour Expiry)
                                                </a>
                                            </td>
                                        </tr>
                                        <tr>
                                            <td align="center">
                                                <a href="${resetPasswordLink}" style="display: inline-block; background-color: #374151; color: #e5e7eb; text-decoration: none; font-weight: 500; font-size: 14px; padding: 10px 24px; border-radius: 6px; border: 1px solid #4b5563;">
                                                    🔑 Reset Your Password Instead
                                                </a>
                                            </td>
                                        </tr>
                                    </table>
                                </td>
                            </tr>
                        </table>
                    </td>
                </tr>
            </table>
        </body>
        </html>
    `;

    try {
        return await sendMail({ to: user.email, subject, html });
    } catch (err) {
        logDevEmailSimulation({
            to: user.email,
            subject: `${subject} [SMTP Fallback]`,
            token: unlockToken,
            links: [
                { label: "Unlock URL", url: unlockLink },
                { label: "Reset URL", url: resetPasswordLink },
            ],
        });
        return { devMock: true, fallback: true, unlockToken, unlockLink };
    }
};

/**
 * Sends a password reset email with a single-use 1-hour cryptographic link.
 *
 * @param {Object} user - User document
 * @param {string} resetLink - Password reset URL
 */
const sendPasswordResetEmail = async (user, resetLink) => {
    const subject = "🔑 Password Reset Request";
    const firstName = user.fullName?.firstName || "User";
    const token = resetLink.includes("token=") ? resetLink.split("token=")[1].split("&")[0] : null;

    const transporter = getTransporter();
    if (!transporter) {
        logDevEmailSimulation({
            to: user.email,
            subject,
            token,
            links: [{ label: "Reset URL", url: resetLink }],
            extra: { "Expiration": "60 Minutes (Single Use)" },
        });
        return { devMock: true, token, resetLink };
    }

    const html = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0f172a; color: #f8fafc; padding: 32px 24px; border-radius: 10px; max-width: 580px; margin: auto;">
            <h2 style="color: #38bdf8; margin-top: 0;">Password Reset Request</h2>
            <p style="color: #cbd5e1; font-size: 15px; line-height: 1.6;">
                Hello <strong>${firstName}</strong>,<br>
                We received a request to reset the password for your account. Click the button below to set a new password:
            </p>
            <div style="text-align: center; margin: 30px 0;">
                <a href="${resetLink}" style="background-color: #2563eb; color: #ffffff; text-decoration: none; font-weight: 600; font-size: 15px; padding: 12px 28px; border-radius: 6px; display: inline-block; box-shadow: 0 4px 12px rgba(37,99,235,0.3);">
                    Reset Password (1-Hour Expiry)
                </a>
            </div>
            <p style="color: #94a3b8; font-size: 13px; line-height: 1.5;">
                This link is single-use and will expire in <strong>60 minutes</strong>.
            </p>
            <hr style="border: none; border-top: 1px solid #334155; margin: 24px 0;">
            <p style="color: #64748b; font-size: 12px; margin: 0;">
                <a href="${resetLink}" style="color: #38bdf8; word-break: break-all;">${resetLink}</a>
            </p>
        </div>
    `;

    try {
        return await sendMail({ to: user.email, subject, html });
    } catch (err) {
        logDevEmailSimulation({
            to: user.email,
            subject: `${subject} [SMTP Fallback]`,
            token,
            links: [{ label: "Reset URL", url: resetLink }],
        });
        return { devMock: true, fallback: true, token, resetLink };
    }
};

/**
 * Sends a self-service account unlock email with a single-use 1-hour cryptographic link.
 *
 * @param {Object} user - User document
 * @param {string} unlockLink - Direct unlock URL
 */
const sendAccountUnlockEmail = async (user, unlockLink) => {
    const subject = "🔓 Account Unlock Link";
    const firstName = user.fullName?.firstName || "User";
    const token = unlockLink.includes("token=") ? unlockLink.split("token=")[1].split("&")[0] : null;

    const transporter = getTransporter();
    if (!transporter) {
        logDevEmailSimulation({
            to: user.email,
            subject,
            token,
            links: [{ label: "Unlock URL", url: unlockLink }],
            extra: { "Expiration": "60 Minutes (Single Use)" },
        });
        return { devMock: true, token, unlockLink };
    }

    const html = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0f172a; color: #f8fafc; padding: 32px 24px; border-radius: 10px; max-width: 580px; margin: auto;">
            <h2 style="color: #10b981; margin-top: 0;">Unlock Your Account</h2>
            <p style="color: #cbd5e1; font-size: 15px; line-height: 1.6;">
                Hello <strong>${firstName}</strong>,<br>
                You requested a self-service link to unlock your temporarily locked account. Click below to restore access immediately:
            </p>
            <div style="text-align: center; margin: 30px 0;">
                <a href="${unlockLink}" style="background-color: #059669; color: #ffffff; text-decoration: none; font-weight: 600; font-size: 15px; padding: 12px 28px; border-radius: 6px; display: inline-block; box-shadow: 0 4px 12px rgba(5,150,105,0.3);">
                    Unlock My Account
                </a>
            </div>
            <p style="color: #94a3b8; font-size: 13px; line-height: 1.5;">
                This link is valid for <strong>60 minutes</strong>. Once used, your failed attempt counter and lockout will be completely reset.
            </p>
            <hr style="border: none; border-top: 1px solid #334155; margin: 24px 0;">
            <p style="color: #64748b; font-size: 12px; margin: 0;">
                <a href="${unlockLink}" style="color: #38bdf8; word-break: break-all;">${unlockLink}</a>
            </p>
        </div>
    `;

    try {
        return await sendMail({ to: user.email, subject, html });
    } catch (err) {
        logDevEmailSimulation({
            to: user.email,
            subject: `${subject} [SMTP Fallback]`,
            token,
            links: [{ label: "Unlock URL", url: unlockLink }],
        });
        return { devMock: true, fallback: true, token, unlockLink };
    }
};

const mailService = {
    sendMail,
    sendWelcomeEmail,
    sendAccountLockoutAlertEmail,
    sendPasswordResetEmail,
    sendAccountUnlockEmail,
};

export default mailService;
