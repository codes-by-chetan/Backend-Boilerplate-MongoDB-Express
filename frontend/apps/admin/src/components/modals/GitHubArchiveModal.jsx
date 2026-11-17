import React, { useState, useEffect } from "react";
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "../ui/dialog";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import {
  Github,
  Key,
  Database,
  CheckCircle2,
  AlertTriangle,
  FolderPlus,
  RefreshCw,
  ExternalLink,
  ShieldCheck,
  Eye,
  EyeOff,
  GitBranch,
  Calendar,
  Trash2,
  Clock,
} from "lucide-react";
import { api } from "../../api/client";

export function GitHubArchiveModal({ isOpen, onClose, onArchivedSuccess }) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [fetchingRepos, setFetchingRepos] = useState(false);
  const [creatingRepo, setCreatingRepo] = useState(false);
  const [archiving, setArchiving] = useState(false);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  // Settings state
  const [settings, setSettings] = useState({
    enabled: false,
    token: "",
    hasToken: false,
    owner: "",
    repo: "",
    branch: "main",
    pathPrefix: "request-logs",
    autoPurgeAfterArchive: true,
    retentionDaysInDb: 1,
    lastArchivedDate: null,
    lastArchivedStatus: "idle",
    lastArchivedError: "",
    lastArchivedStats: {},
  });

  const [showToken, setShowToken] = useState(false);
  const [newTokenInput, setNewTokenInput] = useState("");
  const [githubUser, setGithubUser] = useState(null);
  const [repos, setRepos] = useState([]);
  const [repoMode, setRepoMode] = useState("select"); // "select" or "create"

  // Create repo form state
  const [newRepoName, setNewRepoName] = useState("backend-logs-archive");
  const [newRepoPrivate, setNewRepoPrivate] = useState(true);
  const [newRepoDesc, setNewRepoDesc] = useState("Cold-storage archive for HTTP request logs");

  // Custom date archive state
  const [customArchiveDate, setCustomArchiveDate] = useState(() => {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    return yesterday.toISOString().split("T")[0];
  });
  const [purgeOnCustomArchive, setPurgeOnCustomArchive] = useState(true);

  const loadSettings = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await api.getArchiveSettings();
      if (res?.data) {
        setSettings(res.data);
        if (res.data.owner && res.data.hasToken) {
          // Attempt silent repo list load
          loadRepos();
        }
      }
    } catch (err) {
      setError(err.message || "Failed to load archive settings");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadSettings();
      setMessage("");
      setError("");
      setNewTokenInput("");
    }
  }, [isOpen]);

  const handleTestToken = async () => {
    setTesting(true);
    setError("");
    setMessage("");
    try {
      const tokenToTest = newTokenInput.trim() || undefined;
      const res = await api.testArchiveConnection(tokenToTest);
      const user = res.data?.user || null;
      setGithubUser(user);
      if (user && user.hasRepoScope === false) {
        setMessage(
          `Authenticated as @${user.login}. ⚠️ Notice: This token does not have the 'repo' scope enabled. To write files or create repositories, please generate a token with 'repo' scope at https://github.com/settings/tokens.`
        );
      } else {
        setMessage(`Authenticated as @${user?.login} (${user?.name || ""})`);
      }
      // Auto fetch repos after successful test
      loadRepos(tokenToTest);
    } catch (err) {
      setError(err.message || "Failed to verify GitHub token");
      setGithubUser(null);
    } finally {
      setTesting(false);
    }
  };

  const loadRepos = async (tokenOverride) => {
    setFetchingRepos(true);
    try {
      const res = await api.getArchiveRepos(tokenOverride);
      setRepos(res.data || []);
    } catch (err) {
      // Don't show hard error if simply unconfigured
    } finally {
      setFetchingRepos(false);
    }
  };

  const handleCreateRepo = async (e) => {
    e?.preventDefault();
    if (!newRepoName.trim()) {
      setError("Please specify a repository name.");
      return;
    }

    setCreatingRepo(true);
    setError("");
    setMessage("");
    try {
      const tokenToUse = newTokenInput.trim() || undefined;
      const res = await api.createArchiveRepo({
        name: newRepoName.trim(),
        isPrivate: newRepoPrivate,
        description: newRepoDesc.trim(),
        token: tokenToUse,
      });

      const created = res.data;
      setMessage(`Repository '${created.fullName}' created successfully! Saving configuration...`);
      const updatedConfig = {
        enabled: true,
        owner: created.owner,
        repo: created.name,
        branch: created.defaultBranch || "main",
        pathPrefix: settings.pathPrefix || "request-logs",
        autoPurgeAfterArchive: settings.autoPurgeAfterArchive ?? true,
        retentionDaysInDb: Number(settings.retentionDaysInDb || 1),
      };
      if (tokenToUse) {
        updatedConfig.token = tokenToUse;
      }
      const saveRes = await api.updateArchiveSettings(updatedConfig);
      if (saveRes?.data) {
        setSettings(saveRes.data);
      }
      setNewTokenInput("");
      setMessage(`Repository '${created.fullName}' created and set as default log storage!`);
      setRepoMode("select");
      loadRepos();
    } catch (err) {
      setError(err.message || "Failed to create GitHub repository");
    } finally {
      setCreatingRepo(false);
    }
  };

  const handleSaveSettings = async (e) => {
    e?.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const payload = {
        enabled: settings.enabled,
        owner: settings.owner,
        repo: settings.repo,
        branch: settings.branch || "main",
        pathPrefix: settings.pathPrefix || "request-logs",
        autoPurgeAfterArchive: settings.autoPurgeAfterArchive,
        retentionDaysInDb: Number(settings.retentionDaysInDb),
      };

      if (newTokenInput.trim()) {
        payload.token = newTokenInput.trim();
      }

      const res = await api.updateArchiveSettings(payload);
      if (res?.data) {
        setSettings(res.data);
      }
      setNewTokenInput("");
      setMessage("GitHub archive settings saved and synchronized successfully!");
      setTimeout(() => setMessage(""), 5000);
    } catch (err) {
      setError(err.message || "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const handleTriggerArchive = async (targetDate) => {
    const dateToRun = targetDate || customArchiveDate;
    setArchiving(true);
    setError("");
    setMessage("");
    try {
      // Auto-save any newly entered token first
      if (newTokenInput.trim()) {
        const saveRes = await api.updateArchiveSettings({
          enabled: settings.enabled,
          owner: settings.owner,
          repo: settings.repo,
          branch: settings.branch || "main",
          pathPrefix: settings.pathPrefix || "request-logs",
          autoPurgeAfterArchive: settings.autoPurgeAfterArchive,
          retentionDaysInDb: Number(settings.retentionDaysInDb),
          token: newTokenInput.trim(),
        });
        if (saveRes?.data) {
          setSettings(saveRes.data);
        }
        setNewTokenInput("");
      }

      if (!settings.owner || !settings.repo) {
        setError("Please configure and save the GitHub repository before running archive.");
        setArchiving(false);
        return;
      }

      const res = await api.triggerArchiveDate({
        date: dateToRun,
        purgeFromDb: purgeOnCustomArchive,
        force: true,
      });

      const s = res?.data;
      setMessage(
        `Success! Archived ${s?.count || 0} logs for ${s?.date} to GitHub (${s?.sizeKb || 0} KB). Purged ${s?.purgedFromDb || 0} documents from MongoDB.`
      );
      loadSettings();
      onArchivedSuccess?.(s);
    } catch (err) {
      setError(err.message || "Archive operation failed");
    } finally {
      setArchiving(false);
    }
  };

  return (
    <Dialog open={isOpen} onClose={onClose} className="max-w-3xl">
      <DialogHeader>
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="p-2 rounded-lg bg-primary/10 text-primary shrink-0">
            <Github className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <DialogTitle className="text-sm sm:text-base font-bold">
              GitHub Cold-Storage Request Logs Archival Setup
            </DialogTitle>
            <DialogDescription className="text-xs">
              Archive daily HTTP request logs into a private GitHub repository to bypass MongoDB's 512 MB quota.
            </DialogDescription>
          </div>
        </div>
      </DialogHeader>

      <div className="space-y-4 py-2">
        {message && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{message}</span>
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-xs">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Status Banner */}
        <div className="p-3.5 rounded-lg border border-border/80 bg-muted/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3">
            <span
              className={`h-2.5 w-2.5 rounded-full ${
                settings.enabled ? "bg-emerald-500 animate-pulse" : "bg-muted-foreground"
              }`}
            />
            <div>
              <span className="font-semibold text-foreground">
                Automatic Daily Archival:{" "}
                <span className={settings.enabled ? "text-emerald-500" : "text-muted-foreground"}>
                  {settings.enabled ? "Enabled" : "Disabled"}
                </span>
              </span>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Target:{" "}
                {settings.owner && settings.repo ? (
                  <strong className="text-foreground font-mono">
                    {settings.owner}/{settings.repo} ({settings.branch})
                  </strong>
                ) : (
                  "Not configured yet"
                )}
              </p>
            </div>
          </div>

          {settings.lastArchivedDate && (
            <div className="text-right text-[11px] font-mono text-muted-foreground">
              <span>Last Archive: {settings.lastArchivedDate}</span>
              {settings.lastArchivedStats?.commitSha && (
                <div className="text-[10px] text-primary truncate max-w-[200px]">
                  Commit: {settings.lastArchivedStats.commitSha.slice(0, 7)}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Section 1: GitHub PAT Token */}
        <div className="p-4 rounded-xl border border-border/80 bg-card space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Key className="h-4 w-4 text-primary shrink-0" />
              <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">
                1. GitHub Personal Access Token (PAT)
              </h4>
            </div>
            {settings.hasToken && (
              <Badge variant="outline" className="text-[10px] text-emerald-500 border-emerald-500/30 shrink-0 self-start sm:self-auto">
                Token Stored Securely (AES-256)
              </Badge>
            )}
          </div>

          <p className="text-[11px] text-muted-foreground">
            Provide a GitHub Personal Access Token with <code className="bg-muted px-1 py-0.5 rounded text-[10px]">repo</code> scope (classic) or Contents Read/Write (fine-grained) to push JSON archives.
          </p>

          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <input
                type={showToken ? "text" : "password"}
                placeholder={settings.hasToken ? settings.token : "ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxx"}
                value={newTokenInput}
                onChange={(e) => setNewTokenInput(e.target.value)}
                className="w-full px-3 py-1.5 pr-9 rounded-md border border-input bg-background text-xs font-mono focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <button
                type="button"
                onClick={() => setShowToken(!showToken)}
                className="absolute right-2.5 top-2 text-muted-foreground hover:text-foreground"
              >
                {showToken ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </button>
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleTestToken}
              disabled={testing || (!newTokenInput.trim() && !settings.hasToken)}
              className="gap-1.5 text-xs shrink-0"
            >
              <RefreshCw className={`h-3 w-3 ${testing ? "animate-spin" : ""}`} />
              <span>{testing ? "Testing..." : "Test Token & Fetch Repos"}</span>
            </Button>
          </div>

          {githubUser && (
            <div className="flex items-center gap-2 p-2 rounded-md bg-muted/40 text-xs">
              {githubUser.avatarUrl && (
                <img src={githubUser.avatarUrl} alt="" className="h-5 w-5 rounded-full" />
              )}
              <span className="font-semibold text-foreground">@{githubUser.login}</span>
              <span className="text-muted-foreground">({githubUser.publicRepos} public / {githubUser.totalPrivateRepos} private repos)</span>
            </div>
          )}
        </div>

        {/* Section 2: Repository Selection or Creation */}
        <div className="p-4 rounded-xl border border-border/80 bg-card space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="flex items-center gap-2">
              <Database className="h-4 w-4 text-purple-500 shrink-0" />
              <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">
                2. Target Repository Setup
              </h4>
            </div>

            <div className="flex items-center gap-1 bg-muted p-0.5 rounded-lg text-xs self-start sm:self-auto">
              <button
                type="button"
                onClick={() => setRepoMode("select")}
                className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all ${
                  repoMode === "select" ? "bg-card shadow-xs text-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Select Existing
              </button>
              <button
                type="button"
                onClick={() => setRepoMode("create")}
                className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all ${
                  repoMode === "create" ? "bg-card shadow-xs text-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Create New Repo
              </button>
            </div>
          </div>

          {repoMode === "select" ? (
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-foreground">Repository</label>
                    <button
                      type="button"
                      onClick={() => loadRepos(newTokenInput.trim() || undefined)}
                      disabled={fetchingRepos}
                      className="text-[10px] text-primary hover:underline flex items-center gap-1"
                    >
                      <RefreshCw className={`h-2.5 w-2.5 ${fetchingRepos ? "animate-spin" : ""}`} />
                      <span>Refresh list</span>
                    </button>
                  </div>
                  {repos.length > 0 ? (
                    <select
                      value={settings.repo && settings.owner ? `${settings.owner}/${settings.repo}` : ""}
                      onChange={(e) => {
                        const val = e.target.value;
                        const [owner, repo] = val.split("/");
                        const matched = repos.find((r) => r.fullName === val);
                        setSettings((prev) => ({
                          ...prev,
                          owner: owner || "",
                          repo: repo || "",
                          branch: matched?.defaultBranch || prev.branch || "main",
                        }));
                      }}
                      className="w-full px-3 py-1.5 rounded-md border border-input bg-background text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                    >
                      <option value="">-- Choose a repository --</option>
                      {repos.map((r) => (
                        <option key={r.id} value={r.fullName}>
                          {r.fullName} {r.isPrivate ? "🔒 (Private)" : "🌐 (Public)"}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      placeholder="e.g. backend-logs-archive"
                      value={settings.repo}
                      onChange={(e) => setSettings({ ...settings, repo: e.target.value })}
                      className="w-full px-3 py-1.5 rounded-md border border-input bg-background text-xs font-mono"
                    />
                  )}
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-foreground">Account / Owner</label>
                  <input
                    type="text"
                    placeholder="e.g. your-github-username"
                    value={settings.owner}
                    onChange={(e) => setSettings({ ...settings, owner: e.target.value })}
                    className="w-full px-3 py-1.5 rounded-md border border-input bg-background text-xs font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <GitBranch className="h-3 w-3 text-muted-foreground" />
                    <span>Branch</span>
                  </label>
                  <input
                    type="text"
                    placeholder="main"
                    value={settings.branch}
                    onChange={(e) => setSettings({ ...settings, branch: e.target.value })}
                    className="w-full px-3 py-1.5 rounded-md border border-input bg-background text-xs font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-foreground">Directory Path in Repo</label>
                  <input
                    type="text"
                    placeholder="request-logs"
                    value={settings.pathPrefix}
                    onChange={(e) => setSettings({ ...settings, pathPrefix: e.target.value })}
                    className="w-full px-3 py-1.5 rounded-md border border-input bg-background text-xs font-mono"
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="p-3 rounded-lg border border-primary/20 bg-primary/5 space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground">New Repository Name</label>
                <input
                  type="text"
                  placeholder="backend-logs-archive"
                  value={newRepoName}
                  onChange={(e) => setNewRepoName(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-md border border-input bg-background text-xs font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground">Description (Optional)</label>
                <input
                  type="text"
                  placeholder="Archive for HTTP request logs"
                  value={newRepoDesc}
                  onChange={(e) => setNewRepoDesc(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-md border border-input bg-background text-xs"
                />
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                <label className="flex items-center gap-2 cursor-pointer text-xs">
                  <input
                    type="checkbox"
                    checked={newRepoPrivate}
                    onChange={(e) => setNewRepoPrivate(e.target.checked)}
                    className="rounded border-input text-primary focus:ring-primary h-3.5 w-3.5"
                  />
                  <span>Private Repository (Recommended for sensitive logs)</span>
                </label>

                <Button
                  type="button"
                  size="sm"
                  onClick={handleCreateRepo}
                  disabled={creatingRepo || !newRepoName.trim()}
                  className="gap-1.5 text-xs font-semibold self-start sm:self-auto"
                >
                  <FolderPlus className={`h-3 w-3 ${creatingRepo ? "animate-spin" : ""}`} />
                  <span>{creatingRepo ? "Creating..." : "Create Repo Now"}</span>
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Section 3: MongoDB Relief & Automation */}
        <div className="p-4 rounded-xl border border-border/80 bg-card space-y-3">
          <div className="flex items-center gap-2">
            <Trash2 className="h-4 w-4 text-rose-500" />
            <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">
              3. Automation & 512MB MongoDB Quota Relief
            </h4>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="flex items-start gap-2.5 p-3 rounded-lg border border-border/60 bg-muted/20 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.enabled}
                onChange={(e) => setSettings({ ...settings, enabled: e.target.checked })}
                className="mt-0.5 rounded border-input text-primary focus:ring-primary h-4 w-4"
              />
              <div className="space-y-0.5">
                <span className="text-xs font-semibold text-foreground block">
                  Enable Daily Auto-Archival
                </span>
                <span className="text-[11px] text-muted-foreground block">
                  Automatically serializes and pushes yesterday's HTTP traffic logs to GitHub daily.
                </span>
              </div>
            </label>

            <label className="flex items-start gap-2.5 p-3 rounded-lg border border-border/60 bg-muted/20 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.autoPurgeAfterArchive}
                onChange={(e) => setSettings({ ...settings, autoPurgeAfterArchive: e.target.checked })}
                className="mt-0.5 rounded border-input text-primary focus:ring-primary h-4 w-4"
              />
              <div className="space-y-0.5">
                <span className="text-xs font-semibold text-foreground block text-emerald-600 dark:text-emerald-400">
                  Instant MongoDB Quota Relief
                </span>
                <span className="text-[11px] text-muted-foreground block">
                  Deletes records from MongoDB once successfully pushed to GitHub to stay within the 512 MB limit.
                </span>
              </div>
            </label>
          </div>
        </div>

        {/* Section 4: Manual On-Demand Trigger */}
        <div className="p-4 rounded-xl border border-dashed border-border bg-muted/10 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-sky-500" />
              <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">
                Manual Archive & Purge Action
              </h4>
            </div>
            <span className="text-[11px] text-muted-foreground font-mono">
              Export specific date on-demand
            </span>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 min-w-0">
            <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap sm:flex-nowrap min-w-0">
              <input
                type="date"
                value={customArchiveDate}
                onChange={(e) => setCustomArchiveDate(e.target.value)}
                className="px-3 py-1.5 rounded-md border border-input bg-background text-xs font-mono focus:outline-none focus:ring-1 focus:ring-primary flex-1 sm:flex-none"
              />
              <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer whitespace-nowrap">
                <input
                  type="checkbox"
                  checked={purgeOnCustomArchive}
                  onChange={(e) => setPurgeOnCustomArchive(e.target.checked)}
                  className="rounded border-input text-primary focus:ring-primary h-3.5 w-3.5"
                />
                <span>Purge from DB</span>
              </label>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end flex-wrap sm:flex-nowrap">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleTriggerArchive("yesterday")}
                disabled={archiving || !settings.owner || !settings.repo}
                className="gap-1.5 text-xs flex-1 sm:flex-none"
              >
                <Clock className="h-3 w-3" />
                <span>Archive Yesterday</span>
              </Button>

              <Button
                type="button"
                size="sm"
                onClick={() => handleTriggerArchive(customArchiveDate)}
                disabled={archiving || !customArchiveDate || !settings.owner || !settings.repo}
                className="gap-1.5 text-xs font-semibold flex-1 sm:flex-none"
              >
                <RefreshCw className={`h-3 w-3 ${archiving ? "animate-spin" : ""}`} />
                <span>{archiving ? "Archiving..." : "Archive Date"}</span>
              </Button>
            </div>
          </div>
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" size="sm" onClick={onClose} disabled={saving || archiving}>
          Close
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={handleSaveSettings}
          disabled={saving || archiving}
          className="gap-1.5 text-xs font-semibold"
        >
          <ShieldCheck className={`h-3.5 w-3.5 ${saving ? "animate-spin" : ""}`} />
          <span>{saving ? "Saving Configuration..." : "Save GitHub Setup"}</span>
        </Button>
      </DialogFooter>
    </Dialog>
  );
}

export default GitHubArchiveModal;
