import models from "../models/index.js";
import config from "../config/env.config.js";
import logger from "../config/logger.config.js";
import constants from "../constants/index.js";

/**
 * Ensures an admin user exists in MongoDB.
 * If none exists and bootstrap is enabled, seeds a default admin.
 */
export const ensureAdminUser = async () => {
    if (!config.admin?.bootstrapEnabled) {
        logger.logMessage("info", "Admin bootstrap disabled. Skipping admin seed", "SERVER");
        return;
    }

    try {
        const existingAdmin = await models.User.findOne({
            role: constants.UserRoles.ADMIN,
            deleted: { $ne: true },
        });

        if (existingAdmin) {
            logger.logMessage(
                "info",
                `Admin user already exists (${existingAdmin.email}). Skipping admin seed`,
                "SERVER"
            );
            return;
        }

        const adminName = config.admin.name || "System Admin";
        const nameParts = adminName.trim().split(" ");
        const firstName = nameParts[0] || "System";
        const lastName = nameParts.slice(1).join(" ") || "Admin";
        const adminEmail = (config.admin.email || "admin@example.com").toLowerCase().trim();
        const rawUserName = adminEmail.split("@")[0].replace(/[^a-z0-9_-]/gi, "").toLowerCase() || "admin";

        // Check if an account with this email exists already
        let userWithEmail = await models.User.findOne({ email: adminEmail });
        if (userWithEmail) {
            userWithEmail.role = constants.UserRoles.ADMIN;
            userWithEmail.status = constants.UserStatus.Active;
            await userWithEmail.save();
            logger.logMessage(
                "success",
                `Existing user (${adminEmail}) promoted to Admin role`,
                "SERVER"
            );
            return;
        }

        const newAdmin = new models.User({
            fullName: {
                firstName,
                lastName,
            },
            email: adminEmail,
            userName: rawUserName,
            password: config.admin.password || "admin12345",
            role: constants.UserRoles.ADMIN,
            status: constants.UserStatus.Active,
        });

        await newAdmin.save();
        logger.logMessage(
            "success",
            `Seeded bootstrap admin user: ${adminEmail} (password: ${config.admin.password || "admin12345"})`,
            "SERVER"
        );
    } catch (error) {
        logger.logMessage("error", `Failed to seed bootstrap admin user: ${error.message}`, "SERVER");
    }
};

export default ensureAdminUser;
