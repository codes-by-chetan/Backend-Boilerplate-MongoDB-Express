import fs from "fs";
import path from "path";
import axios from "axios";
import sift from "sift";
import models from "../models/index.js";
import logger from "../config/logger.config.js";
import config from "../config/env.config.js";
import cryptoUtil from "../utils/crypto.util.js";

class LogArchiveService {
    constructor() {
        this.cacheDir = path.join(process.cwd(), "data", "archive-cache");
        this.inMemoryCache = new Map(); // date -> { logs, cachedAt }
        this.MEMORY_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes (low-memory footprint)
        this.CHECK_INTERVAL_MS = 60 * 60 * 1000; // Check every 1 hour
        this.CHUNK_SIZE = 1500; // Stream in small chunks of 1,500 docs (< 5MB) for low memory & safe GitHub uploads

        this.ensureDirectories();
        this.initAutoArchiver();
    }

    /**
     * Completely purges in-memory logs cache and hints V8 garbage collection if exposed.
     */
    clearMemoryCache() {
        this.inMemoryCache.clear();
        if (typeof global.gc === "function") {
            try {
                global.gc();
            } catch (_) {}
        }
    }

    /**
     * Memory-bounded cache setter: Strictly keeps at most 1 date in memory
     * and only caches if record count is small (<= 5,000 documents) to protect RAM.
     */
    setMemoryCache(dateStr, logs) {
        if (!Array.isArray(logs) || logs.length > 5000) {
            this.inMemoryCache.clear();
            return;
        }
        this.inMemoryCache.clear(); // Evict any older dates
        this.inMemoryCache.set(dateStr, { logs, cachedAt: Date.now() });
    }

    /**
     * Uploads a single JSON chunk to GitHub cold-storage and writes to local disk cache.
     * Operates on isolated small batches to guarantee O(1) memory footprint.
     */
    async uploadChunkToGitHub({
        client,
        owner,
        repo,
        branch,
        prefix,
        year,
        month,
        dateStr,
        partNum,
        isMultiPart,
        chunk,
    }) {
        const fileName = isMultiPart
            ? `request-logs-${dateStr}-part${partNum}.json`
            : `request-logs-${dateStr}.json`;
        const gitFilePath = `${prefix}/${year}/${month}/${fileName}`;
        const jsonString = JSON.stringify(chunk);
        const sizeBytes = Buffer.byteLength(jsonString, "utf8");

        // Save to local disk cache immediately
        this.ensureDirectories();
        const localCachePath = path.join(this.cacheDir, fileName);
        fs.writeFileSync(localCachePath, jsonString, "utf8");

        // Check existing SHA on GitHub
        let existingSha = null;
        try {
            const getRes = await client.get(`/repos/${owner}/${repo}/contents/${gitFilePath}`, {
                params: { ref: branch },
            });
            existingSha = getRes.data?.sha;
        } catch (err) {
            if (err.response?.status !== 404) throw err;
        }

        // Commit & Push chunk to GitHub
        const base64Content = Buffer.from(jsonString, "utf8").toString("base64");
        const partLabel = isMultiPart ? ` (Part ${partNum})` : "";
        const putRes = await client.put(`/repos/${owner}/${repo}/contents/${gitFilePath}`, {
            message: `archive: http request logs for ${dateStr}${partLabel} [${chunk.length.toLocaleString()} records, ${Math.round(sizeBytes / 1024)} KB]`,
            content: base64Content,
            branch,
            ...(existingSha ? { sha: existingSha } : {}),
        });

        const commitSha = putRes.data?.commit?.sha || "";
        const htmlUrl = putRes.data?.content?.html_url || "";

        return {
            fileName,
            path: gitFilePath,
            count: chunk.length,
            sizeBytes,
            commitSha,
            htmlUrl,
        };
    }

    ensureDirectories() {
        if (!fs.existsSync(this.cacheDir)) {
            fs.mkdirSync(this.cacheDir, { recursive: true });
        }
    }

    /**
     * Retrieve GitHub archive settings with masked token.
     */
    async getSettings() {
        let settings = await models.SystemSettings.findOne({ key: "global_settings" });
        if (!settings) {
            settings = await models.SystemSettings.create({
                key: "global_settings",
            });
        }

        const archiveConfig = settings.githubArchive ? settings.githubArchive.toObject() : {};
        const hasToken = Boolean(archiveConfig.token && archiveConfig.token.trim().length > 0);

        let maskedToken = "";
        if (hasToken) {
            try {
                const decrypted = this.decryptToken(archiveConfig.token);
                if (decrypted.length > 8) {
                    maskedToken = `${decrypted.slice(0, 4)}••••••••${decrypted.slice(-4)}`;
                } else {
                    maskedToken = "••••••••";
                }
            } catch {
                maskedToken = "••••••••";
            }
        }

        return {
            ...archiveConfig,
            token: maskedToken,
            hasToken,
        };
    }

    /**
     * Retrieve raw unmasked token for internal operations.
     */
    async getRawToken() {
        const settings = await models.SystemSettings.findOne({ key: "global_settings" });
        if (!settings?.githubArchive?.token) return "";
        try {
            return this.decryptToken(settings.githubArchive.token);
        } catch {
            return settings.githubArchive.token;
        }
    }

    encryptToken(plainToken) {
        if (!plainToken) return "";
        return cryptoUtil.encryptText(plainToken, config.logEncryptionKey);
    }

    decryptToken(encryptedToken) {
        if (!encryptedToken) return "";
        if (!encryptedToken.startsWith("enc:") && !encryptedToken.startsWith("[ENCRYPTED:")) {
            return encryptedToken; // Legacy plaintext fallback
        }
        return cryptoUtil.decryptText(encryptedToken, config.logEncryptionKey);
    }

    /**
     * Updates GitHub archive configuration.
     */
    async updateSettings(payload) {
        let settings = await models.SystemSettings.findOne({ key: "global_settings" });
        if (!settings) {
            settings = new models.SystemSettings({ key: "global_settings" });
        }

        if (!settings.githubArchive) {
            settings.githubArchive = {};
        }

        if (payload.enabled !== undefined) {
            settings.githubArchive.enabled = Boolean(payload.enabled);
        }

        if (payload.token !== undefined && payload.token.trim()) {
            const raw = payload.token.trim();
            // Don't overwrite if the masked token was submitted back
            if (!raw.includes("••••")) {
                settings.githubArchive.token = this.encryptToken(raw);
            }
        }

        if (payload.owner !== undefined) settings.githubArchive.owner = payload.owner.trim();
        if (payload.repo !== undefined) settings.githubArchive.repo = payload.repo.trim();
        if (payload.branch !== undefined) settings.githubArchive.branch = payload.branch.trim() || "main";
        if (payload.pathPrefix !== undefined) settings.githubArchive.pathPrefix = payload.pathPrefix.trim() || "request-logs";
        if (payload.autoPurgeAfterArchive !== undefined) {
            settings.githubArchive.autoPurgeAfterArchive = Boolean(payload.autoPurgeAfterArchive);
        }
        if (payload.retentionDaysInDb !== undefined) {
            const days = parseInt(payload.retentionDaysInDb, 10);
            if (!isNaN(days) && days >= 0 && days <= 30) {
                settings.githubArchive.retentionDaysInDb = days;
            }
        }

        await settings.save();
        return this.getSettings();
    }

    /**
     * Create Axios instance for GitHub API with token.
     */
    getGitHubClient(token) {
        if (!token) throw new Error("GitHub Personal Access Token (PAT) is required.");
        return axios.create({
            baseURL: "https://api.github.com",
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: "application/vnd.github.v3+json",
                "User-Agent": "BackendBoilerplate-LogsArchiver",
            },
            timeout: 30000,
        });
    }

    /**
     * Validates a GitHub PAT and fetches user details.
     */
    async testConnection(tokenInput) {
        const token = tokenInput || (await this.getRawToken());
        if (!token) {
            throw new Error("No GitHub token provided to test connection.");
        }

        const client = this.getGitHubClient(token);
        try {
            const { data, headers } = await client.get("/user");
            const scopes = headers["x-oauth-scopes"] || "";
            return {
                valid: true,
                user: {
                    login: data.login,
                    name: data.name || data.login,
                    avatarUrl: data.avatar_url,
                    htmlUrl: data.html_url,
                    publicRepos: data.public_repos,
                    totalPrivateRepos: data.total_private_repos || 0,
                    scopes: scopes ? scopes.split(",").map((s) => s.trim()) : [],
                    hasRepoScope: scopes.includes("repo") || scopes.includes("public_repo"),
                },
            };
        } catch (err) {
            const msg = err.response?.data?.message || err.message;
            throw new Error(`GitHub validation failed: ${msg}`);
        }
    }

    /**
     * Lists repositories accessible to the GitHub token.
     */
    async getRepos(tokenInput) {
        const token = tokenInput || (await this.getRawToken());
        if (!token) {
            throw new Error("GitHub token is required to list repositories.");
        }

        const client = this.getGitHubClient(token);
        try {
            const { data } = await client.get("/user/repos", {
                params: {
                    per_page: 100,
                    sort: "updated",
                    type: "all",
                },
            });

            return data.map((r) => ({
                id: r.id,
                name: r.name,
                fullName: r.full_name,
                owner: r.owner.login,
                isPrivate: r.private,
                defaultBranch: r.default_branch || "main",
                description: r.description || "",
                htmlUrl: r.html_url,
                updatedAt: r.updated_at,
            }));
        } catch (err) {
            const msg = err.response?.data?.message || err.message;
            throw new Error(`Failed to fetch repositories: ${msg}`);
        }
    }

    /**
     * Creates a new repository on GitHub for storing log archives.
     */
    async createRepo({ name, isPrivate = true, description = "", tokenInput }) {
        const token = tokenInput || (await this.getRawToken());
        if (!token) throw new Error("GitHub token is required to create a repository.");
        if (!name || !name.trim()) throw new Error("Repository name is required.");

        const client = this.getGitHubClient(token);
        try {
            const { data } = await client.post("/user/repos", {
                name: name.trim(),
                description: description || "Automated daily HTTP request logs archive for Backend Boilerplate",
                private: Boolean(isPrivate),
                auto_init: true,
            });

            return {
                id: data.id,
                name: data.name,
                fullName: data.full_name,
                owner: data.owner.login,
                isPrivate: data.private,
                defaultBranch: data.default_branch || "main",
                htmlUrl: data.html_url,
            };
        } catch (err) {
            let msg = err.response?.data?.message || err.message;
            if (err.response?.status === 404 || err.response?.status === 403) {
                msg = `GitHub rejected repository creation (${err.response?.data?.message || "Not Found"}). Ensure your GitHub PAT has the 'repo' scope enabled.`;
            }
            throw new Error(`Failed to create repository '${name}': ${msg}`);
        }
    }

    /**
     * Archives request logs for a specific date (YYYY-MM-DD).
     */
    async archiveDate(dateStr, options = {}) {
        const { purgeFromDb = true, force = false, triggeredBy = "manual" } = options;

        if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
            throw new Error("Date must be in YYYY-MM-DD format.");
        }

        const settingsDoc = await models.SystemSettings.findOne({ key: "global_settings" });
        const configArchive = settingsDoc?.githubArchive;

        if (!configArchive?.owner || !configArchive?.repo) {
            throw new Error("GitHub archive repository (owner/repo) is not configured in settings.");
        }

        const rawToken = await this.getRawToken();
        if (!rawToken) {
            throw new Error("GitHub Personal Access Token is missing.");
        }

        const client = this.getGitHubClient(rawToken);
        const owner = configArchive.owner;
        const repo = configArchive.repo;
        const branch = configArchive.branch || "main";
        const prefix = (configArchive.pathPrefix || "request-logs").replace(/^\/+|\/+$/g, "");

        logger.logMessage(
            "info",
            `[LogArchive] Starting archival for date ${dateStr} (Owner: ${owner}, Repo: ${repo}, Trigger: ${triggeredBy})...`,
            "ARCHIVE"
        );

        // Update status to in_progress
        await models.SystemSettings.updateOne(
            { key: "global_settings" },
            {
                $set: {
                    "githubArchive.lastArchivedStatus": "in_progress",
                    "githubArchive.lastArchivedError": "",
                },
            }
        );

        try {
            // 1. Fetch total count of request logs for that day (zero memory footprint)
            const start = new Date(`${dateStr}T00:00:00.000Z`);
            const end = new Date(`${dateStr}T23:59:59.999Z`);
            const [year, month] = dateStr.split("-");

            const totalCount = await models.RequestLog.countDocuments({
                createdAt: { $gte: start, $lte: end },
            });

            if (totalCount === 0) {
                logger.logMessage("info", `[LogArchive] No request logs found in database for ${dateStr}. Skipping GitHub commit.`, "ARCHIVE");
                await models.SystemSettings.updateOne(
                    { key: "global_settings" },
                    {
                        $set: {
                            "githubArchive.lastArchivedStatus": "idle",
                            "githubArchive.lastArchivedDate": dateStr,
                            "githubArchive.lastArchivedAt": new Date(),
                            "githubArchive.lastArchivedStats": {
                                logCount: 0,
                                fileSizeKb: 0,
                                commitSha: "",
                                htmlUrl: "",
                            },
                        },
                    }
                );
                return {
                    success: true,
                    date: dateStr,
                    count: 0,
                    sizeKb: 0,
                    message: `No request logs found for ${dateStr}.`,
                    purgedFromDb: 0,
                };
            }

            // 2. Stream and upload in small chunks of CHUNK_SIZE (1,500 records) to keep memory < 15MB
            const CHUNK_SIZE = this.CHUNK_SIZE || 1500;
            const isMultiPart = totalCount > CHUNK_SIZE;
            const files = [];
            let totalSizeBytes = 0;
            let lastCommitSha = "";
            let lastHtmlUrl = "";
            let processedCount = 0;
            let currentChunk = [];
            let partNum = 1;

            const cursor = models.RequestLog.find({
                createdAt: { $gte: start, $lte: end },
            })
                .sort({ createdAt: 1 })
                .populate("user", "email fullName role")
                .lean()
                .batchSize(Math.min(500, CHUNK_SIZE))
                .cursor();

            for await (const doc of cursor) {
                currentChunk.push(doc);
                processedCount++;

                if (currentChunk.length >= CHUNK_SIZE) {
                    const chunkRes = await this.uploadChunkToGitHub({
                        client,
                        owner,
                        repo,
                        branch,
                        prefix,
                        year,
                        month,
                        dateStr,
                        partNum,
                        isMultiPart,
                        chunk: currentChunk,
                    });

                    files.push(chunkRes);
                    totalSizeBytes += chunkRes.sizeBytes;
                    lastCommitSha = chunkRes.commitSha;
                    lastHtmlUrl = chunkRes.htmlUrl;

                    partNum++;
                    currentChunk = []; // Immediately dereference chunk to release RAM
                }
            }

            // Upload any remaining logs in the final chunk
            if (currentChunk.length > 0) {
                const chunkRes = await this.uploadChunkToGitHub({
                    client,
                    owner,
                    repo,
                    branch,
                    prefix,
                    year,
                    month,
                    dateStr,
                    partNum,
                    isMultiPart,
                    chunk: currentChunk,
                });

                files.push(chunkRes);
                totalSizeBytes += chunkRes.sizeBytes;
                lastCommitSha = chunkRes.commitSha;
                lastHtmlUrl = chunkRes.htmlUrl;

                currentChunk = []; // Free memory
            }

            const totalSizeKb = Math.round(totalSizeBytes / 1024);

            // 3. Update manifest in GitHub repo and local disk
            const primaryFileName = files[0]?.fileName || `request-logs-${dateStr}.json`;
            const primaryGitFilePath = files[0]?.path || `${prefix}/${year}/${month}/${primaryFileName}`;
            await this.updateGitHubManifest(client, owner, repo, branch, prefix, {
                date: dateStr,
                fileName: primaryFileName,
                path: primaryGitFilePath,
                count: processedCount,
                sizeBytes: totalSizeBytes,
                parts: files.length,
                files,
                commitSha: lastCommitSha,
                htmlUrl: lastHtmlUrl,
                archivedAt: new Date().toISOString(),
            });

            // 4. Purge records from MongoDB to relieve storage if requested
            let purgedCount = 0;
            const shouldPurge = purgeFromDb ?? configArchive.autoPurgeAfterArchive ?? true;
            if (shouldPurge && processedCount > 0) {
                const delRes = await models.RequestLog.deleteMany({
                    createdAt: { $gte: start, $lte: end },
                });
                purgedCount = delRes.deletedCount || 0;
                logger.logMessage(
                    "info",
                    `[LogArchive] Purged ${purgedCount} request log documents from MongoDB for ${dateStr} to relieve storage.`,
                    "ARCHIVE"
                );
            }

            // 5. Update SystemSettings stats
            await models.SystemSettings.updateOne(
                { key: "global_settings" },
                {
                    $set: {
                        "githubArchive.lastArchivedDate": dateStr,
                        "githubArchive.lastArchivedAt": new Date(),
                        "githubArchive.lastArchivedStatus": "success",
                        "githubArchive.lastArchivedError": "",
                        "githubArchive.lastArchivedStats": {
                            logCount: processedCount,
                            fileSizeKb: totalSizeKb,
                            parts: files.length,
                            commitSha: lastCommitSha,
                            htmlUrl: lastHtmlUrl,
                        },
                    },
                }
            );

            // Ensure memory is completely freed
            this.clearMemoryCache();

            logger.logMessage(
                "info",
                `[LogArchive] Successfully archived ${processedCount} logs for ${dateStr} (${files.length} parts, ${totalSizeKb} KB) to GitHub repo ${owner}/${repo}.`,
                "ARCHIVE"
            );

            return {
                success: true,
                date: dateStr,
                count: processedCount,
                sizeKb: totalSizeKb,
                parts: files.length,
                files,
                commitSha: lastCommitSha,
                htmlUrl: lastHtmlUrl,
                gitFilePath: primaryGitFilePath,
                purgedFromDb: purgedCount,
            };
        } catch (err) {
            this.clearMemoryCache();
            let errorMsg = err.response?.data?.message || err.message;
            if (err.response?.status === 404 || err.response?.status === 403) {
                errorMsg = "GitHub rejected write access (" + (err.response?.data?.message || "Not Found") + "). Your GitHub PAT token likely lacks the 'repo' scope (for classic tokens) or 'Contents: Read and write' permission (for fine-grained tokens). Please ensure 'repo' scope is checked when creating the token at https://github.com/settings/tokens.";
            }
            logger.logMessage("error", `[LogArchive] Archival failed for ${dateStr}: ${errorMsg}`, "ARCHIVE");

            await models.SystemSettings.updateOne(
                { key: "global_settings" },
                {
                    $set: {
                        "githubArchive.lastArchivedStatus": "failed",
                        "githubArchive.lastArchivedError": errorMsg,
                    },
                }
            );
            throw new Error(`Archival failed: ${errorMsg}`);
        }
    }

    /**
     * Convenience method to archive yesterday's logs.
     */
    async archiveYesterday(options = {}) {
        const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split("T")[0];
        return this.archiveDate(yesterday, options);
    }

    /**
     * Updates the manifest.json file in the GitHub repo and local disk.
     */
    async updateGitHubManifest(client, owner, repo, branch, prefix, newEntry) {
        const manifestGitPath = `${prefix}/manifest.json`;
        let manifest = { lastUpdated: new Date().toISOString(), archives: [] };
        let manifestSha = null;

        try {
            const res = await client.get(`/repos/${owner}/${repo}/contents/${manifestGitPath}`, {
                params: { ref: branch },
            });
            manifestSha = res.data?.sha;
            if (res.data?.content) {
                const decoded = Buffer.from(res.data.content, "base64").toString("utf8");
                manifest = JSON.parse(decoded);
            }
        } catch (err) {
            // Not found is fine for first run
        }

        if (!Array.isArray(manifest.archives)) {
            manifest.archives = [];
        }

        // Remove existing entry for same date if updating
        manifest.archives = manifest.archives.filter((a) => a.date !== newEntry.date);
        manifest.archives.push(newEntry);
        manifest.archives.sort((a, b) => b.date.localeCompare(a.date));
        manifest.lastUpdated = new Date().toISOString();

        const manifestJsonStr = JSON.stringify(manifest, null, 2);

        // Save local copy
        fs.writeFileSync(path.join(this.cacheDir, "manifest.json"), manifestJsonStr, "utf8");

        // Commit manifest to GitHub
        try {
            await client.put(`/repos/${owner}/${repo}/contents/${manifestGitPath}`, {
                message: `chore: update log archives manifest [${newEntry.date}]`,
                content: Buffer.from(manifestJsonStr, "utf8").toString("base64"),
                branch,
                ...(manifestSha ? { sha: manifestSha } : {}),
            });
        } catch (err) {
            logger.logMessage("warn", `[LogArchive] Failed to commit manifest to GitHub: ${err.message}`, "ARCHIVE");
        }
    }

    /**
     * Lists all archived dates with metadata from local cache and GitHub manifest.
     */
    async listArchives() {
        const localManifestPath = path.join(this.cacheDir, "manifest.json");
        let manifest = { archives: [] };

        if (fs.existsSync(localManifestPath)) {
            try {
                manifest = JSON.parse(fs.readFileSync(localManifestPath, "utf8"));
            } catch (_) {}
        }

        // Discover local cache files (both single files and chunked parts)
        const localFiles = fs.existsSync(this.cacheDir)
            ? fs.readdirSync(this.cacheDir).filter((f) => /^request-logs-\d{4}-\d{2}-\d{2}(?:-part\d+)?\.json$/.test(f))
            : [];

        const localDatesMap = new Map();
        for (const f of localFiles) {
            const m = f.match(/^request-logs-(\d{4}-\d{2}-\d{2})(?:-part(\d+))?\.json$/);
            if (m) {
                const date = m[1];
                const stats = fs.statSync(path.join(this.cacheDir, f));
                const existing = localDatesMap.get(date) || {
                    fileName: `request-logs-${date}.json`,
                    sizeBytes: 0,
                    parts: 0,
                    updatedAt: stats.mtime,
                };
                existing.sizeBytes += stats.size;
                existing.parts += 1;
                if (stats.mtime > existing.updatedAt) existing.updatedAt = stats.mtime;
                localDatesMap.set(date, existing);
            }
        }

        // Try syncing remote manifest if we have a token
        const rawToken = await this.getRawToken().catch(() => "");
        const settings = await models.SystemSettings.findOne({ key: "global_settings" });
        const configArchive = settings?.githubArchive;

        if (rawToken && configArchive?.owner && configArchive?.repo) {
            try {
                const client = this.getGitHubClient(rawToken);
                const prefix = (configArchive.pathPrefix || "request-logs").replace(/^\/+|\/+$/g, "");
                const rawManifest = await this.fetchGitHubFileContent(
                    client,
                    configArchive.owner,
                    configArchive.repo,
                    `${prefix}/manifest.json`,
                    rawToken,
                    configArchive.branch || "main"
                );
                if (rawManifest) {
                    manifest = typeof rawManifest === "string" ? JSON.parse(rawManifest) : rawManifest;
                    fs.writeFileSync(localManifestPath, typeof rawManifest === "string" ? rawManifest : JSON.stringify(manifest, null, 2), "utf8");
                }
            } catch (_) {}
        }

        const entriesMap = new Map();

        // Add from manifest
        if (Array.isArray(manifest.archives)) {
            for (const a of manifest.archives) {
                entriesMap.set(a.date, {
                    ...a,
                    isCachedLocally: localDatesMap.has(a.date),
                });
            }
        }

        // Add any local files that weren't in manifest
        for (const [date, info] of localDatesMap.entries()) {
            if (!entriesMap.has(date)) {
                entriesMap.set(date, {
                    date,
                    fileName: info.fileName,
                    path: info.fileName,
                    count: 0,
                    sizeBytes: info.sizeBytes,
                    commitSha: "",
                    htmlUrl: "",
                    archivedAt: info.updatedAt.toISOString(),
                    isCachedLocally: true,
                });
            }
        }

        const list = Array.from(entriesMap.values());
        list.sort((a, b) => b.date.localeCompare(a.date));
        return list;
    }

    /**
     * Reliably fetches file text/JSON content from GitHub, supporting:
     * 1. Small files (<= 1MB) with inlined base64 content
     * 2. Large files (> 1MB up to 100MB) where GitHub Contents API omits inline content and provides download_url or blob sha
     */
    async fetchGitHubFileContent(client, owner, repo, filePath, token, branch = "main") {
        if (!client || !owner || !repo || !filePath) {
            throw new Error(`Invalid arguments provided to fetchGitHubFileContent: path=${filePath}`);
        }

        // Strategy 1: Query Contents API metadata
        let metaRes;
        try {
            metaRes = await client.get(`/repos/${owner}/${repo}/contents/${filePath}`, {
                params: { ref: branch },
            });
        } catch (err) {
            throw new Error(`GitHub Contents API request failed for ${filePath}: ${err.response?.data?.message || err.message}`);
        }

        // Case A: File is <= 1MB, content is inlined in base64
        if (metaRes.data?.content) {
            return Buffer.from(metaRes.data.content, "base64").toString("utf8");
        }

        // Case B: File is > 1MB, GitHub provides download_url for raw stream
        if (metaRes.data?.download_url) {
            try {
                const headers = {
                    "User-Agent": "BackendBoilerplate-LogsArchiver",
                };
                if (token) {
                    headers.Authorization = `Bearer ${token}`;
                }
                const dlRes = await axios.get(metaRes.data.download_url, {
                    headers,
                    responseType: "text",
                    transformResponse: [(d) => d],
                    maxContentLength: 100 * 1024 * 1024,
                    maxBodyLength: 100 * 1024 * 1024,
                    timeout: 60000,
                });
                if (dlRes.data && (typeof dlRes.data === "string" || typeof dlRes.data === "object")) {
                    return typeof dlRes.data === "string" ? dlRes.data : JSON.stringify(dlRes.data);
                }
            } catch (dlErr) {
                logger.logMessage("warn", `[LogArchive] Failed fetching download_url for ${filePath}: ${dlErr.message}. Trying Git Blob API...`, "ARCHIVE");
            }
        }

        // Case C: Fallback to Git Blobs API using blob SHA (supports up to 100MB)
        if (metaRes.data?.sha) {
            // First attempt raw stream via git/blobs endpoint
            try {
                const blobRawRes = await client.get(`/repos/${owner}/${repo}/git/blobs/${metaRes.data.sha}`, {
                    headers: {
                        Accept: "application/vnd.github.raw",
                    },
                    responseType: "text",
                    transformResponse: [(d) => d],
                    maxContentLength: 100 * 1024 * 1024,
                    maxBodyLength: 100 * 1024 * 1024,
                    timeout: 60000,
                });
                if (blobRawRes.data) {
                    return typeof blobRawRes.data === "string" ? blobRawRes.data : JSON.stringify(blobRawRes.data);
                }
            } catch (_) {}

            // Second attempt base64 blob endpoint
            try {
                const blobJsonRes = await client.get(`/repos/${owner}/${repo}/git/blobs/${metaRes.data.sha}`, {
                    timeout: 60000,
                });
                if (blobJsonRes.data?.content && blobJsonRes.data.encoding === "base64") {
                    return Buffer.from(blobJsonRes.data.content, "base64").toString("utf8");
                }
            } catch (blobErr) {
                logger.logMessage("warn", `[LogArchive] Failed fetching Git Blob ${metaRes.data.sha} for ${filePath}: ${blobErr.message}`, "ARCHIVE");
            }
        }

        // Case D: Direct raw media request on contents API
        try {
            const rawDirect = await client.get(`/repos/${owner}/${repo}/contents/${filePath}`, {
                params: { ref: branch },
                headers: {
                    Accept: "application/vnd.github.raw",
                },
                responseType: "text",
                transformResponse: [(d) => d],
                maxContentLength: 100 * 1024 * 1024,
                maxBodyLength: 100 * 1024 * 1024,
                timeout: 60000,
            });
            if (rawDirect.data) {
                return typeof rawDirect.data === "string" ? rawDirect.data : JSON.stringify(rawDirect.data);
            }
        } catch (_) {}

        throw new Error(`File content empty or unavailable on GitHub for ${filePath} (Size: ${metaRes.data?.size || "unknown"} bytes).`);
    }

    /**
     * Retrieves logs for a specific date:
     * 1. Checks in-memory cache
     * 2. Checks local disk cache
     * 3. Falls back to downloading from GitHub repository (supports chunked manifest and large files > 1MB)
     *
     * @param {string} dateStr - Date string in YYYY-MM-DD
     * @returns {Promise<Array>} Array of parsed RequestLog documents
     */
    async getArchiveLogs(dateStr) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
            throw new Error("Date must be in YYYY-MM-DD format.");
        }

        // 1. Check in-memory cache
        const memEntry = this.inMemoryCache.get(dateStr);
        if (memEntry && Date.now() - memEntry.cachedAt < this.MEMORY_CACHE_TTL_MS) {
            return memEntry.logs;
        }

        // 2. Check local disk cache (handles both multi-part chunks and single files)
        const localPartFiles = fs.existsSync(this.cacheDir)
            ? fs.readdirSync(this.cacheDir)
                  .filter((f) => new RegExp(`^request-logs-${dateStr}-part(\\d+)\\.json$`).test(f))
                  .sort((a, b) => {
                      const numA = parseInt(a.match(/-part(\d+)\.json$/)[1], 10);
                      const numB = parseInt(b.match(/-part(\d+)\.json$/)[1], 10);
                      return numA - numB;
                  })
            : [];

        if (localPartFiles.length > 0) {
            try {
                let combined = [];
                for (const pf of localPartFiles) {
                    const chunk = JSON.parse(fs.readFileSync(path.join(this.cacheDir, pf), "utf8"));
                    if (Array.isArray(chunk)) {
                        for (let k = 0; k < chunk.length; k++) {
                            combined.push(chunk[k]);
                        }
                    }
                }
                this.setMemoryCache(dateStr, combined);
                return combined;
            } catch (err) {
                logger.logMessage("warn", `[LogArchive] Failed reading local parts for ${dateStr}: ${err.message}`, "ARCHIVE");
            }
        }

        const fileName = `request-logs-${dateStr}.json`;
        const localCachePath = path.join(this.cacheDir, fileName);

        if (fs.existsSync(localCachePath)) {
            try {
                const content = fs.readFileSync(localCachePath, "utf8");
                const parsed = JSON.parse(content);
                const parsedArray = Array.isArray(parsed) ? parsed : [];
                this.setMemoryCache(dateStr, parsedArray);
                return parsedArray;
            } catch (err) {
                logger.logMessage("warn", `[LogArchive] Failed to parse local cached file ${fileName}: ${err.message}`, "ARCHIVE");
            }
        }

        // 3. Fallback: Fetch from GitHub repository (supports chunked manifest and large files > 1MB)
        const rawToken = await this.getRawToken();
        const settings = await models.SystemSettings.findOne({ key: "global_settings" });
        const configArchive = settings?.githubArchive;

        if (!rawToken || !configArchive?.owner || !configArchive?.repo) {
            throw new Error(`Archive file for date ${dateStr} not found locally, and GitHub repo is not configured.`);
        }

        const client = this.getGitHubClient(rawToken);
        const [year, month] = dateStr.split("-");
        const prefix = (configArchive.pathPrefix || "request-logs").replace(/^\/+|\/+$/g, "");
        const branch = configArchive.branch || "main";

        // Check manifest for file parts list
        let manifestEntry = null;
        try {
            const manifestRaw = await this.fetchGitHubFileContent(
                client,
                configArchive.owner,
                configArchive.repo,
                `${prefix}/manifest.json`,
                rawToken,
                branch
            );
            if (manifestRaw) {
                const manifest = typeof manifestRaw === "string" ? JSON.parse(manifestRaw) : manifestRaw;
                manifestEntry = manifest.archives?.find((a) => a.date === dateStr);
            }
        } catch (_) {}

        try {
            if (manifestEntry?.files && manifestEntry.files.length > 0) {
                let combinedLogs = [];
                for (const f of manifestEntry.files) {
                    const chunkStr = await this.fetchGitHubFileContent(
                        client,
                        configArchive.owner,
                        configArchive.repo,
                        f.path,
                        rawToken,
                        branch
                    );
                    const chunk = typeof chunkStr === "string" ? JSON.parse(chunkStr) : chunkStr;
                    try {
                        this.ensureDirectories();
                        fs.writeFileSync(
                            path.join(this.cacheDir, f.fileName),
                            typeof chunkStr === "string" ? chunkStr : JSON.stringify(chunk),
                            "utf8"
                        );
                    } catch (_) {}
                    if (Array.isArray(chunk)) {
                        for (let k = 0; k < chunk.length; k++) {
                            combinedLogs.push(chunk[k]);
                        }
                    }
                }
                this.setMemoryCache(dateStr, combinedLogs);
                return combinedLogs;
            }

            // Single file fallback (supports large files > 1MB up to 100MB)
            const gitFilePath = manifestEntry?.path || `${prefix}/${year}/${month}/${fileName}`;
            const jsonStr = await this.fetchGitHubFileContent(
                client,
                configArchive.owner,
                configArchive.repo,
                gitFilePath,
                rawToken,
                branch
            );

            const logs = typeof jsonStr === "string" ? JSON.parse(jsonStr) : jsonStr;
            const parsedArray = Array.isArray(logs) ? logs : [];

            // Write to disk cache
            try {
                this.ensureDirectories();
                fs.writeFileSync(
                    localCachePath,
                    typeof jsonStr === "string" ? jsonStr : JSON.stringify(parsedArray),
                    "utf8"
                );
            } catch (_) {}

            this.setMemoryCache(dateStr, parsedArray);
            return parsedArray;
        } catch (err) {
            const msg = err.response?.data?.message || err.message;
            throw new Error(`Could not retrieve archive for ${dateStr} from GitHub: ${msg}`);
        }
    }

    /**
     * Executes MongoDB-like queries over archived logs (or live database) with high speed.
     *
     * @param {Object} options
     * @param {string} options.date - Date in YYYY-MM-DD or "live"
     * @param {Object|string} [options.filter={}] - MongoDB query object (e.g. { responseStatus: { $gte: 400 } })
     * @param {Object} [options.sort={ createdAt: -1 }]
     * @param {number} [options.page=1]
     * @param {number} [options.limit=50]
     * @param {string} [options.search=""]
     */
    async queryArchiveLogs(options = {}) {
        const {
            date,
            filter: rawFilter = {},
            sort = { createdAt: -1 },
            page = 1,
            limit = 50,
            search = "",
        } = options;

        const startTime = performance.now();
        const parsedPage = Math.max(1, parseInt(page, 10) || 1);
        const parsedLimit = Math.min(200, Math.max(1, parseInt(limit, 10) || 50));

        let mongoFilter = rawFilter;
        if (typeof rawFilter === "string") {
            try {
                mongoFilter = rawFilter.trim() ? JSON.parse(rawFilter) : {};
            } catch (err) {
                throw new Error(`Invalid MongoDB filter JSON: ${err.message}`);
            }
        }

        // If date is "live", query MongoDB directly with the exact same filter
        if (date === "live") {
            const skip = (parsedPage - 1) * parsedLimit;
            const sortField = Object.keys(sort)[0] || "createdAt";
            const sortOrder = sort[sortField] === 1 || sort[sortField] === "asc" ? 1 : -1;

            const [total, logs] = await Promise.all([
                models.RequestLog.countDocuments(mongoFilter),
                models.RequestLog.find(mongoFilter)
                    .sort({ [sortField]: sortOrder })
                    .skip(skip)
                    .limit(parsedLimit)
                    .populate("user", "email fullName role")
                    .lean(),
            ]);

            const execTimeMs = Math.round(performance.now() - startTime);

            return {
                logs,
                pagination: {
                    page: parsedPage,
                    limit: parsedLimit,
                    total,
                    totalPages: Math.ceil(total / parsedLimit) || 1,
                },
                stats: {
                    total,
                    errorCount: logs.filter((l) => (l.responseStatus || 0) >= 400).length,
                },
                executionTimeMs: execTimeMs,
                source: "live_mongodb",
                date: "live",
            };
        }

        // Otherwise, load archived JSON logs for the specified date
        if (!date) {
            throw new Error("Date parameter is required to query archived logs.");
        }

        const logs = await this.getArchiveLogs(date);

        // Apply sift (MongoDB query evaluator)
        const siftFn = sift.default || sift;
        let matcher;
        try {
            matcher = siftFn(mongoFilter);
        } catch (err) {
            throw new Error(`MongoDB filter syntax error: ${err.message}`);
        }

        let filtered = logs.filter(matcher);

        // Optional full-text string search across matched documents
        if (search && search.trim()) {
            const lowerSearch = search.trim().toLowerCase();
            filtered = filtered.filter((doc) => {
                const url = (doc.requestUrl || "").toLowerCase();
                const ip = (doc.ipAddress?.clientIp || "").toLowerCase();
                const err = (doc.errors || "").toLowerCase();
                const email = (doc.user?.email || "").toLowerCase();
                return (
                    url.includes(lowerSearch) ||
                    ip.includes(lowerSearch) ||
                    err.includes(lowerSearch) ||
                    email.includes(lowerSearch)
                );
            });
        }

        // Compute summary metrics on filtered subset
        let count2xx = 0;
        let count3xx = 0;
        let count4xx = 0;
        let count5xx = 0;
        const methodCounts = {};

        for (const doc of filtered) {
            const st = doc.responseStatus || 0;
            if (st >= 200 && st < 300) count2xx++;
            else if (st >= 300 && st < 400) count3xx++;
            else if (st >= 400 && st < 500) count4xx++;
            else if (st >= 500) count5xx++;

            const m = doc.requestMethod || "UNKNOWN";
            methodCounts[m] = (methodCounts[m] || 0) + 1;
        }

        // Apply sorting
        const sortField = Object.keys(sort)[0] || "createdAt";
        const sortOrder = sort[sortField] === 1 || sort[sortField] === "asc" ? 1 : -1;

        filtered.sort((a, b) => {
            const valA = this.getNestedValue(a, sortField);
            const valB = this.getNestedValue(b, sortField);

            if (valA === valB) return 0;
            if (valA === undefined || valA === null) return 1;
            if (valB === undefined || valB === null) return -1;

            if (sortField === "createdAt" || sortField === "updatedAt") {
                const timeA = new Date(valA).getTime();
                const timeB = new Date(valB).getTime();
                return (timeA - timeB) * sortOrder;
            }

            if (typeof valA === "number" && typeof valB === "number") {
                return (valA - valB) * sortOrder;
            }

            return String(valA).localeCompare(String(valB)) * sortOrder;
        });

        // Apply pagination
        const total = filtered.length;
        const totalPages = Math.ceil(total / parsedLimit) || 1;
        const paginatedLogs = filtered.slice((parsedPage - 1) * parsedLimit, parsedPage * parsedLimit);

        const executionTimeMs = Math.round(performance.now() - startTime);

        return {
            logs: paginatedLogs,
            pagination: {
                page: parsedPage,
                limit: parsedLimit,
                total,
                totalPages,
            },
            stats: {
                totalMatched: total,
                totalInArchive: logs.length,
                byStatus: {
                    "2xx": count2xx,
                    "3xx": count3xx,
                    "4xx": count4xx,
                    "5xx": count5xx,
                },
                byMethod: methodCounts,
                errorCount: count4xx + count5xx,
            },
            executionTimeMs,
            source: "github_archive_cache",
            date,
        };
    }

    getNestedValue(obj, dotPath) {
        if (!obj || !dotPath) return undefined;
        const parts = dotPath.split(".");
        let cur = obj;
        for (const p of parts) {
            if (cur === null || cur === undefined) return undefined;
            cur = cur[p];
        }
        return cur;
    }

    /**
     * Initializes background recurring checker for automated daily archiving.
     */
    initAutoArchiver() {
        // Initial delayed check 2 minutes after boot (allows Node.js & Mongo connection to stabilize)
        const initialTimer = setTimeout(() => {
            this.runScheduledArchiveCheck().catch((err) => {
                logger.logMessage("warn", `[LogArchive] Initial check failed: ${err.message}`, "ARCHIVE");
            });
        }, 120000);
        if (initialTimer.unref) initialTimer.unref();

        // Recurring hourly check
        const interval = setInterval(() => {
            this.runScheduledArchiveCheck().catch((err) => {
                logger.logMessage("warn", `[LogArchive] Scheduled check failed: ${err.message}`, "ARCHIVE");
            });
        }, this.CHECK_INTERVAL_MS);
        if (interval.unref) interval.unref();
    }

    async runScheduledArchiveCheck() {
        if (models.SystemSettings.db?.readyState !== 1) return;

        const settings = await models.SystemSettings.findOne({ key: "global_settings" });
        const configArchive = settings?.githubArchive;

        if (!configArchive?.enabled || !configArchive?.owner || !configArchive?.repo) {
            return; // Not configured or disabled
        }

        // Catch up on any pending historical dates older than today
        const pending = await this.getPendingDates();
        if (pending.length > 0 && configArchive.lastArchivedStatus !== "in_progress") {
            logger.logMessage(
                "info",
                `[LogArchive] Auto-archiving ${pending.length} pending backlog dates (${pending.map((p) => p.date).join(", ")}) to GitHub repo ${configArchive.owner}/${configArchive.repo}...`,
                "ARCHIVE"
            );
            for (const item of pending) {
                try {
                    this.clearMemoryCache();
                    await this.archiveDate(item.date, {
                        purgeFromDb: configArchive.autoPurgeAfterArchive ?? true,
                        triggeredBy: "auto-backlog",
                    });
                    // Yield 1000ms between dates to let V8 garbage collection & event loop run smoothly
                    await new Promise((resolve) => setTimeout(resolve, 1000));
                } catch (err) {
                    logger.logMessage("error", `[LogArchive] Failed auto-archiving backlog date ${item.date}: ${err.message}`, "ARCHIVE");
                    break; // Stop loop on failure to prevent rate limit or cascade errors
                } finally {
                    this.clearMemoryCache();
                }
            }
        }
    }

    /**
     * Get live MongoDB storage and collection statistics for RequestLog.
     */
    async getStorageStats() {
        const db = models.RequestLog.db.db;
        const stats = await db.command({ collStats: "requestlogs" }).catch(() => null);
        if (!stats) {
            return {
                count: 0,
                dataSizeMb: 0,
                storageSizeMb: 0,
                freeStorageSizeMb: 0,
                totalIndexSizeMb: 0,
                avgObjSizeBytes: 0,
                indexes: 0,
            };
        }

        return {
            count: stats.count || 0,
            dataSizeBytes: stats.size || 0,
            dataSizeMb: Number(((stats.size || 0) / (1024 * 1024)).toFixed(2)),
            storageSizeBytes: stats.storageSize || 0,
            storageSizeMb: Number(((stats.storageSize || 0) / (1024 * 1024)).toFixed(2)),
            freeStorageSizeBytes: stats.freeStorageSize || 0,
            freeStorageSizeMb: Number((((stats.freeStorageSize || 0)) / (1024 * 1024)).toFixed(2)),
            totalIndexSizeBytes: stats.totalIndexSize || 0,
            totalIndexSizeMb: Number(((stats.totalIndexSize || 0) / (1024 * 1024)).toFixed(2)),
            avgObjSizeBytes: Math.round(stats.avgObjSize || 0),
            indexes: stats.nindexes || 0,
        };
    }

    /**
     * List all dates in MongoDB RequestLog that are strictly older than today and pending archival.
     */
    async getPendingDates() {
        const today = new Date().toISOString().split("T")[0];
        const result = await models.RequestLog.aggregate([
            {
                $group: {
                    _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
                    count: { $sum: 1 },
                },
            },
            { $sort: { _id: 1 } },
        ]);

        return result
            .filter((r) => r._id && r._id < today)
            .map((r) => ({ date: r._id, count: r.count }));
    }

    /**
     * Archives all pending historical dates sequentially and purges them from MongoDB.
     */
    async archiveAllPendingDates(options = {}) {
        const pending = await this.getPendingDates();
        const results = [];

        for (const item of pending) {
            try {
                this.clearMemoryCache();
                const res = await this.archiveDate(item.date, {
                    ...options,
                    triggeredBy: options.triggeredBy || "batch-manual",
                });
                results.push({
                    date: item.date,
                    success: true,
                    count: res.count,
                    purgedFromDb: res.purgedFromDb,
                    sizeKb: res.sizeKb,
                    commitSha: res.commitSha,
                });
                // Yield between backlog dates for memory safety
                await new Promise((resolve) => setTimeout(resolve, 800));
            } catch (err) {
                results.push({
                    date: item.date,
                    success: false,
                    error: err.message,
                });
                if (err.message?.includes("Personal Access Token") || err.message?.includes("Bad credentials")) {
                    break;
                }
            } finally {
                this.clearMemoryCache();
            }
        }

        return {
            totalPending: pending.length,
            processed: results.length,
            results,
        };
    }

    /**
     * Reclaims physical disk space on MongoDB Atlas by rotating/rebuilding the collection.
     * Uses server-side $out aggregation (0 bytes Node.js memory) with micro-batch streaming fallback,
     * atomically dropping the bloated WiredTiger data files without exceeding container memory limits.
     */
    async reclaimStorage({ retainHours = 24, autoArchivePending = true } = {}) {
        this.clearMemoryCache();
        const db = models.RequestLog.db.db;
        const preStats = await db.command({ collStats: "requestlogs" }).catch(() => null);

        // 1. If requested, automatically archive and purge any pending backlog dates first to prevent data loss
        let archivedPending = [];
        if (autoArchivePending) {
            const pendingRes = await this.archiveAllPendingDates({ purgeFromDb: true, triggeredBy: "reclaim-prep" });
            archivedPending = pendingRes.results || [];
        }

        // 2. Retention cutoff timestamp
        const cutoff = new Date(Date.now() - retainHours * 60 * 60 * 1000);
        const retainedCount = await models.RequestLog.countDocuments({ createdAt: { $gte: cutoff } });

        logger.logMessage(
            "info",
            `[LogArchive] Starting Atlas storage reclaim: Preserving ${retainedCount} recent logs (past ${retainHours}h). Pre-storage: ${preStats ? (preStats.storageSize / 1024 / 1024).toFixed(2) : "N/A"} MB...`,
            "ARCHIVE"
        );

        // 3. Populate pristine temporary collection using zero-memory server-side aggregation ($out)
        const tempCollectionName = `requestlogs_rebuild_${Date.now()}`;
        const tempCol = db.collection(tempCollectionName);

        if (retainedCount > 0) {
            try {
                // Strategy A: Server-side $out aggregation pipeline.
                // 100% executed in MongoDB WiredTiger engine. Zero bytes transferred into Node.js memory!
                await models.RequestLog.aggregate([
                    { $match: { createdAt: { $gte: cutoff } } },
                    { $out: tempCollectionName },
                ]);
            } catch (aggErr) {
                logger.logMessage(
                    "warn",
                    `[LogArchive] Server-side $out aggregation failed (${aggErr.message}). Falling back to low-memory batched cursor streaming...`,
                    "ARCHIVE"
                );
                // Strategy B: Constant O(1) low-memory cursor stream in micro-batches of 200 documents
                const cursor = models.RequestLog.find({ createdAt: { $gte: cutoff } })
                    .lean()
                    .batchSize(200)
                    .cursor();

                let batch = [];
                for await (const doc of cursor) {
                    batch.push(doc);
                    if (batch.length >= 200) {
                        await tempCol.insertMany(batch, { ordered: false });
                        batch = [];
                    }
                }
                if (batch.length > 0) {
                    await tempCol.insertMany(batch, { ordered: false });
                    batch = [];
                }
            }
        } else {
            // No recent logs to retain, create empty pristine collection
            await db.createCollection(tempCollectionName).catch(() => {});
        }

        // 4. Atomically swap collection in MongoDB catalog using rename with dropTarget: true
        // This drops the old bloated WiredTiger data and index files, reclaiming physical disk on Atlas
        await tempCol.rename("requestlogs", { dropTarget: true });

        // 5. Reinitialize all schema indexes cleanly on the compacted collection
        await models.RequestLog.init();

        // 6. Gather post-reclaim stats
        const postStats = await db.command({ collStats: "requestlogs" }).catch(() => null);
        const preMb = preStats ? preStats.storageSize / (1024 * 1024) : 0;
        const postMb = postStats ? postStats.storageSize / (1024 * 1024) : 0;
        const reclaimedMb = Math.max(0, preMb - postMb);

        this.clearMemoryCache();

        logger.logMessage(
            "info",
            `[LogArchive] Storage reclaim complete! Physical storage dropped from ${preMb.toFixed(2)} MB to ${postMb.toFixed(2)} MB (Reclaimed: ${reclaimedMb.toFixed(2)} MB).`,
            "ARCHIVE"
        );

        return {
            success: true,
            reclaimedMb: Number(reclaimedMb.toFixed(2)),
            preStorageMb: Number(preMb.toFixed(2)),
            postStorageMb: Number(postMb.toFixed(2)),
            preDocCount: preStats?.count || 0,
            postDocCount: postStats?.count ?? retainedCount,
            retainedHours: retainHours,
            archivedPending,
        };
    }
}

const logArchiveService = new LogArchiveService();
export default logArchiveService;
