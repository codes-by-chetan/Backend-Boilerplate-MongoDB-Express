import models from "../models/index.js";
import logger from "../config/logger.config.js";

class DataRetentionService {
    constructor() {
        this.SWEEP_INTERVAL_MS = 12 * 60 * 60 * 1000; // 12 hours
        this.initSweeper();
    }

    /**
     * Retrieves current data retention configuration.
     * Defaults to 45 days for Scrape Runs (if present) and 7 days for Request Logs.
     */
    async getSettings() {
        let settings = await models.SystemSettings.findOne({ key: "global_settings" });
        if (!settings) {
            settings = await models.SystemSettings.create({
                key: "global_settings",
                dataRetention: {
                    scrapeRunsDays: 45,
                    requestLogsDays: 7,
                    lastPurgeAt: null,
                    lastPurgeStats: { scrapeRunsDeleted: 0, requestLogsDeleted: 0 },
                },
            });
        }
        return settings.dataRetention;
    }

    /**
     * Updates retention thresholds from admin panel and synchronizes MongoDB TTL.
     *
     * @param {Object} payload
     * @param {number} [payload.scrapeRunsDays]
     * @param {number} [payload.requestLogsDays]
     */
    async updateSettings({ scrapeRunsDays, requestLogsDays }) {
        let settings = await models.SystemSettings.findOne({ key: "global_settings" });
        if (!settings) {
            settings = new models.SystemSettings({ key: "global_settings" });
        }

        if (scrapeRunsDays !== undefined) {
            const parsed = parseInt(scrapeRunsDays, 10);
            if (isNaN(parsed) || parsed < 1 || parsed > 365) {
                throw new Error("Scrape runs retention must be between 1 and 365 days.");
            }
            settings.dataRetention.scrapeRunsDays = parsed;
        }

        if (requestLogsDays !== undefined) {
            const parsed = parseInt(requestLogsDays, 10);
            if (isNaN(parsed) || parsed < 1 || parsed > 365) {
                throw new Error("Request logs retention must be between 1 and 365 days.");
            }
            settings.dataRetention.requestLogsDays = parsed;
        }

        await settings.save();

        // Attempt to dynamically sync MongoDB TTL index expireAfterSeconds via collMod
        await this.syncMongoTtlIndexes(
            settings.dataRetention.scrapeRunsDays,
            settings.dataRetention.requestLogsDays
        ).catch(() => {});

        logger.logMessage(
            "info",
            `[Retention] Updated data retention policies: RequestLogs=${settings.dataRetention.requestLogsDays}d`,
            "RETENTION"
        );

        return settings.dataRetention;
    }

    /**
     * Attempts to dynamically alter MongoDB TTL indexes if supported by cluster.
     */
    async syncMongoTtlIndexes(scrapeRunsDays, requestLogsDays) {
        try {
            const db = models.RequestLog.db?.db;
            if (!db) return;

            // Update ScrapeRun TTL index if model exists
            if (models.ScrapeRun && scrapeRunsDays) {
                const scrapeSeconds = scrapeRunsDays * 24 * 60 * 60;
                await db.command({
                    collMod: "scraperuns",
                    index: {
                        keyPattern: { createdAt: 1 },
                        expireAfterSeconds: scrapeSeconds,
                    },
                }).catch(() => {});
            }

            // Update RequestLog TTL index
            if (requestLogsDays) {
                const requestSeconds = requestLogsDays * 24 * 60 * 60;
                await db.command({
                    collMod: "requestlogs",
                    index: {
                        keyPattern: { createdAt: 1 },
                        expireAfterSeconds: requestSeconds,
                    },
                }).catch(() => {});
            }
        } catch (_) {
            // collMod may not be supported on all standalone / shared DB clusters;
            // our periodic background sweeper guarantees cleanups regardless.
        }
    }

    /**
     * Executes an on-demand or scheduled purge of records older than configured thresholds.
     */
    async purgeExpiredRecords() {
        const retention = await this.getSettings();
        const now = Date.now();

        const scrapeRunCutoff = new Date(now - (retention.scrapeRunsDays || 45) * 24 * 60 * 60 * 1000);
        const requestLogCutoff = new Date(now - (retention.requestLogsDays || 7) * 24 * 60 * 60 * 1000);

        logger.logMessage(
            "info",
            `[Retention] Starting expired records purge (RequestLogs older than ${requestLogCutoff.toISOString()})...`,
            "RETENTION"
        );

        const scrapePromise = models.ScrapeRun
            ? models.ScrapeRun.deleteMany({ createdAt: { $lt: scrapeRunCutoff } })
            : Promise.resolve({ deletedCount: 0 });

        const [scrapeRunsResult, requestLogsResult] = await Promise.all([
            scrapePromise,
            models.RequestLog.deleteMany({ createdAt: { $lt: requestLogCutoff } }),
        ]);

        const stats = {
            scrapeRunsDeleted: scrapeRunsResult?.deletedCount || 0,
            requestLogsDeleted: requestLogsResult?.deletedCount || 0,
            lastPurgeAt: new Date(),
        };

        await models.SystemSettings.updateOne(
            { key: "global_settings" },
            {
                $set: {
                    "dataRetention.lastPurgeAt": stats.lastPurgeAt,
                    "dataRetention.lastPurgeStats": {
                        scrapeRunsDeleted: stats.scrapeRunsDeleted,
                        requestLogsDeleted: stats.requestLogsDeleted,
                    },
                },
            }
        );

        logger.logMessage(
            "info",
            `[Retention] Purge completed: ${stats.requestLogsDeleted} request logs removed.`,
            "RETENTION"
        );

        return {
            success: true,
            ...stats,
            retentionSettings: retention,
        };
    }

    /**
     * Initializes periodic background sweeper.
     */
    initSweeper() {
        // Initial delayed sweep after 30 seconds
        const initialTimer = setTimeout(() => {
            if (models.RequestLog?.db?.readyState !== 1) return;
            this.purgeExpiredRecords().catch((err) => {
                logger.logMessage("warn", `Initial retention purge failed: ${err.message}`, "RETENTION");
            });
        }, 30000);
        if (initialTimer.unref) initialTimer.unref();

        // Periodic sweeper every 12 hours
        const timer = setInterval(() => {
            if (models.RequestLog?.db?.readyState !== 1) return;
            this.purgeExpiredRecords().catch((err) => {
                logger.logMessage("warn", `Periodic retention purge failed: ${err.message}`, "RETENTION");
            });
        }, this.SWEEP_INTERVAL_MS);

        if (timer.unref) timer.unref();
    }
}

const dataRetentionService = new DataRetentionService();
export default dataRetentionService;
