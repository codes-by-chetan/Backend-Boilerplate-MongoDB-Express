import React, { useEffect, useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "../ui/card";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { JsonViewer } from "../common/JsonViewer";
import {
  Cpu,
  HardDrive,
  Clock,
  Server,
  Database,
  RefreshCw,
  Zap,
  Users,
  FileText,
  ShieldAlert,
  Trash2,
  Save,
  ShieldCheck,
  Calendar,
  Github,
  Archive,
} from "lucide-react";
import { api } from "../../api/client";
import { GitHubArchiveModal } from "../modals/GitHubArchiveModal";

export function SystemView({ liveMetrics, token }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Data Retention Settings state
  const [retention, setRetention] = useState({ requestLogsDays: 7 });
  const [retentionLoading, setRetentionLoading] = useState(false);
  const [retentionSaving, setRetentionSaving] = useState(false);
  const [retentionPurging, setRetentionPurging] = useState(false);
  const [retentionMsg, setRetentionMsg] = useState("");
  const [retentionError, setRetentionError] = useState("");

  // GitHub Archival state
  const [archiveSettings, setArchiveSettings] = useState(null);
  const [isGithubModalOpen, setIsGithubModalOpen] = useState(false);

  const fetchStats = async () => {
    if (!token) return;
    setLoading(true);
    setError("");
    try {
      const res = await api.getSystemStats();
      setStats(res.data || res);
    } catch (err) {
      setError(err.message || "Failed to load system telemetry");
    } finally {
      setLoading(false);
    }
  };

  const fetchRetentionSettings = async () => {
    if (!token) return;
    setRetentionLoading(true);
    try {
      const [retRes, archRes] = await Promise.all([
        api.getRetentionSettings().catch(() => null),
        api.getArchiveSettings().catch(() => null),
      ]);
      if (retRes?.data) {
        setRetention(retRes.data);
      }
      if (archRes?.data) {
        setArchiveSettings(archRes.data);
      }
    } catch (err) {
      // Silently keep default
    } finally {
      setRetentionLoading(false);
    }
  };

  const handleSaveRetention = async (e) => {
    e?.preventDefault();
    if (!token) return;
    setRetentionSaving(true);
    setRetentionMsg("");
    setRetentionError("");
    try {
      const res = await api.updateRetentionSettings({
        requestLogsDays: Number(retention.requestLogsDays),
      });
      if (res?.data) {
        setRetention((prev) => ({ ...prev, ...res.data }));
      }
      setRetentionMsg("Data retention policies updated and synchronized successfully!");
      setTimeout(() => setRetentionMsg(""), 5000);
    } catch (err) {
      setRetentionError(err.message || "Failed to save retention settings");
    } finally {
      setRetentionSaving(false);
    }
  };

  const handleRunPurge = async () => {
    if (!token) return;
    if (
      !window.confirm(
        "Are you sure you want to trigger an immediate database cleanup for records older than the configured days?"
      )
    ) {
      return;
    }
    setRetentionPurging(true);
    setRetentionMsg("");
    setRetentionError("");
    try {
      const res = await api.runRetentionPurge();
      const s = res?.data;
      setRetentionMsg(`Cleanup complete! Purged ${s?.requestLogsDeleted || 0} request logs.`);
      fetchRetentionSettings();
      setTimeout(() => setRetentionMsg(""), 7000);
    } catch (err) {
      setRetentionError(err.message || "Purge execution failed");
    } finally {
      setRetentionPurging(false);
    }
  };

  useEffect(() => {
    fetchStats();
    fetchRetentionSettings();
    const interval = setInterval(() => {
      if (token) fetchStats();
    }, 10000);
    return () => clearInterval(interval);
  }, [token]);

  const host = stats?.host || liveMetrics?.host;
  const nodeProc = stats?.nodeProcess || liveMetrics?.nodeProcess;
  const db = stats?.database;

  const formatUptime = (seconds) => {
    if (!seconds) return "0s";
    const d = Math.floor(seconds / (3600 * 24));
    const h = Math.floor((seconds % (3600 * 24)) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    const parts = [];
    if (d > 0) parts.push(`${d}d`);
    if (h > 0) parts.push(`${h}h`);
    if (m > 0) parts.push(`${m}m`);
    parts.push(`${s}s`);
    return parts.join(" ");
  };

  const memPercent = parseFloat(host?.memoryPercentUsed || 0);
  const nodeHeapPercent = nodeProc?.heapTotalMb
    ? Math.min(100, Math.round((parseFloat(nodeProc.heapUsedMb) / parseFloat(nodeProc.heapTotalMb)) * 100))
    : 0;

  return (
    <div className="space-y-4">
      {/* Top action row */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold tracking-tight">System Telemetry & V8 Metrics</h2>
          <p className="text-xs text-muted-foreground">
            Hardware resource utilization, Node.js process runtime & MongoDB health
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchStats}
          disabled={loading || !token}
          className="gap-1.5 text-xs"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          <span>Refresh</span>
        </Button>
      </div>

      {error && (
        <div className="p-3 rounded-lg border border-destructive/30 bg-destructive/10 text-destructive text-xs">
          {error}
        </div>
      )}

      {/* Primary Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* CPU Load Card */}
        <Card className="p-4">
          <div className="flex items-center justify-between pb-2">
            <span className="text-xs font-semibold text-muted-foreground">Host CPU Load</span>
            <Cpu className="h-4 w-4 text-sky-500" />
          </div>
          <div className="text-2xl font-bold font-mono tracking-tight">
            {host?.loadAvg?.[0] || "0.00"}
          </div>
          <span className="text-[10px] text-muted-foreground block mt-1">
            1m load average | {host?.cpuCores || 4} Cores
          </span>
          <div className="flex items-center gap-2 mt-3 text-[11px] font-mono text-muted-foreground">
            <span>5m: {host?.loadAvg?.[1] || "0.00"}</span>
            <span>•</span>
            <span>15m: {host?.loadAvg?.[2] || "0.00"}</span>
          </div>
        </Card>

        {/* Host Memory Card */}
        <Card className="p-4">
          <div className="flex items-center justify-between pb-2">
            <span className="text-xs font-semibold text-muted-foreground">Host RAM</span>
            <HardDrive className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold font-mono tracking-tight">
            {memPercent}%
          </div>
          <div className="w-full bg-muted rounded-full h-1.5 mt-2 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                memPercent > 85 ? "bg-rose-500" : memPercent > 70 ? "bg-amber-500" : "bg-emerald-500"
              }`}
              style={{ width: `${Math.max(2, Math.min(100, memPercent))}%` }}
            />
          </div>
          <span className="text-[10px] text-muted-foreground mt-2 block">
            {host?.usedMemoryGb || 0} GB used / {host?.totalMemoryGb || 0} GB total
          </span>
        </Card>

        {/* Node V8 Heap Card */}
        <Card className="p-4">
          <div className="flex items-center justify-between pb-2">
            <span className="text-xs font-semibold text-muted-foreground">Node V8 Heap</span>
            <Server className="h-4 w-4 text-primary" />
          </div>
          <div className="text-2xl font-bold font-mono tracking-tight">
            {nodeProc?.heapUsedMb || 0} <span className="text-sm font-normal text-muted-foreground">MB</span>
          </div>
          <div className="w-full bg-muted rounded-full h-1.5 mt-2 overflow-hidden">
            <div
              className="h-full rounded-full bg-primary transition-all duration-500"
              style={{ width: `${Math.max(2, Math.min(100, nodeHeapPercent))}%` }}
            />
          </div>
          <span className="text-[10px] text-muted-foreground mt-2 block">
            Heap Total: {nodeProc?.heapTotalMb || 0} MB | RSS: {nodeProc?.rssMb || 0} MB
          </span>
        </Card>

        {/* MongoDB Status Card */}
        <Card className="p-4">
          <div className="flex items-center justify-between pb-2">
            <span className="text-xs font-semibold text-muted-foreground">MongoDB Database</span>
            <Database className="h-4 w-4 text-purple-500" />
          </div>
          <div className="flex items-center gap-2 mt-1">
            <span className={`h-2.5 w-2.5 rounded-full ${
              db?.status === "connected" ? "bg-emerald-500 animate-pulse" : "bg-amber-500"
            }`} />
            <span className="text-lg font-bold capitalize">{db?.status || "Connected"}</span>
          </div>
          <span className="text-[10px] text-muted-foreground mt-3 block truncate font-mono">
            Host: {db?.host || "cluster0"} ({db?.name || "database"})
          </span>
        </Card>
      </div>

      {/* Secondary Information & Counters */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Database Collection Counters */}
        <Card className="p-4 space-y-3">
          <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <Database className="h-3.5 w-3.5 text-purple-500" />
            <span>MongoDB Stored Records</span>
          </CardTitle>
          <div className="divide-y divide-border text-xs font-mono">
            <div className="py-2 flex justify-between items-center">
              <span className="text-muted-foreground">Total Users:</span>
              <span className="font-bold text-foreground">{db?.totalUsers || 0}</span>
            </div>
            <div className="py-2 flex justify-between items-center">
              <span className="text-muted-foreground">HTTP Request Logs:</span>
              <span className="font-bold text-foreground">{db?.totalRequestLogs || 0}</span>
            </div>
            <div className="py-2 flex justify-between items-center">
              <span className="text-muted-foreground">Audit Trail Commits:</span>
              <span className="font-bold text-foreground">{db?.totalDbLogs || 0}</span>
            </div>
          </div>
        </Card>

        {/* Node Process Runtime */}
        <Card className="p-4 space-y-3">
          <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <Server className="h-3.5 w-3.5 text-primary" />
            <span>Node Process Details</span>
          </CardTitle>
          <div className="divide-y divide-border text-xs font-mono">
            <div className="py-2 flex justify-between">
              <span className="text-muted-foreground">PID:</span>
              <span className="font-semibold">{nodeProc?.pid || "-"}</span>
            </div>
            <div className="py-2 flex justify-between">
              <span className="text-muted-foreground">Node Version:</span>
              <span className="font-semibold">{nodeProc?.nodeVersion || "-"}</span>
            </div>

            <div className="py-2 flex justify-between">
              <span className="text-muted-foreground">Process Uptime:</span>
              <span className="font-semibold">{formatUptime(nodeProc?.uptimeSeconds || 0)}</span>
            </div>
            <div className="py-2 flex justify-between">
              <span className="text-muted-foreground">% of Host RAM:</span>
              <span className="font-semibold">{nodeProc?.percentOfHostRam || 0}%</span>
            </div>
          </div>
        </Card>

        {/* Host Machine Details */}
        <Card className="p-4 space-y-3">
          <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <Cpu className="h-3.5 w-3.5 text-sky-500" />
            <span>Host Architecture</span>
          </CardTitle>
          <div className="divide-y divide-border text-xs font-mono">
            <div className="py-2 flex justify-between">
              <span className="text-muted-foreground">Hostname:</span>
              <span className="font-semibold truncate max-w-[150px]">{host?.hostname || "localhost"}</span>
            </div>
            <div className="py-2 flex justify-between">
              <span className="text-muted-foreground">Platform / OS:</span>
              <span className="font-semibold">{host?.platform || "linux"} ({host?.arch || "x64"})</span>
            </div>
            <div className="py-2 flex justify-between">
              <span className="text-muted-foreground">Host Uptime:</span>
              <span className="font-semibold">{formatUptime(host?.uptimeSeconds || 0)}</span>
            </div>
            <div className="py-2 flex justify-between">
              <span className="text-muted-foreground">CPU Model:</span>
              <span className="font-semibold text-[10px] truncate max-w-[140px]" title={host?.cpuModel}>
                {host?.cpuModel || "x86_64"}
              </span>
            </div>
          </div>
        </Card>
      </div>

      {/* Configurable Data Retention & Automated Database Purge Card */}
      <Card className="p-5 border-border/80 bg-card/60 backdrop-blur-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-border/60">
          <div>
            <div className="flex items-center gap-2">
              <HardDrive className="h-4 w-4 text-primary" />
              <CardTitle className="text-sm font-bold">
                Automated Data Retention & MongoDB Storage Cleanup
              </CardTitle>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Configure automatic TTL expiration thresholds for HTTP request logs to keep MongoDB database storage within free tier limits.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRunPurge}
              disabled={retentionPurging || !token}
              className="gap-1.5 text-xs text-destructive border-destructive/30 hover:bg-destructive/10"
            >
              <Trash2 className={`h-3.5 w-3.5 ${retentionPurging ? "animate-spin" : ""}`} />
              <span>{retentionPurging ? "Purging..." : "Purge Expired Now"}</span>
            </Button>
          </div>
        </div>

        {retentionMsg && (
          <div className="mt-4 p-3 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 shrink-0" />
            <span>{retentionMsg}</span>
          </div>
        )}

        {retentionError && (
          <div className="mt-4 p-3 rounded-md bg-destructive/10 border border-destructive/20 text-destructive text-xs">
            {retentionError}
          </div>
        )}

        <form onSubmit={handleSaveRetention} className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Request Logs Retention */}
          <div className="p-3.5 rounded-lg border border-border/60 bg-muted/20 space-y-2 md:col-span-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-foreground">
                HTTP Request Logs Retention
              </label>
              <Badge variant="outline" className="text-[10px] text-primary border-primary/30">
                Default: 7 Days
              </Badge>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Purges RequestLog traffic documents, IP details, and payloads older than:
            </p>
            <div className="flex items-center gap-2 pt-1">
              <input
                type="number"
                min="1"
                max="365"
                value={retention.requestLogsDays ?? 7}
                onChange={(e) => setRetention({ ...retention, requestLogsDays: e.target.value })}
                className="w-24 px-3 py-1.5 rounded-md border border-input bg-background text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <span className="text-xs text-muted-foreground font-medium">Days</span>
            </div>
          </div>

          {/* Actions & Last Purge Telemetry */}
          <div className="md:col-span-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
            <div className="text-[11px] text-muted-foreground flex flex-wrap items-center gap-2">
              <span>
                Last Automated Cleanup:{" "}
                <strong className="text-foreground">
                  {retention.lastPurgeAt
                    ? new Date(retention.lastPurgeAt).toLocaleString()
                    : "Pending first scheduled cycle"}
                </strong>
              </span>
              {retention.lastPurgeStats?.requestLogsDeleted > 0 && (
                <span className="text-emerald-500 font-medium">
                  ({retention.lastPurgeStats.requestLogsDeleted} logs cleaned)
                </span>
              )}
            </div>

            <Button
              type="submit"
              size="sm"
              disabled={retentionSaving || !token}
              className="gap-1.5 text-xs font-semibold px-4 w-full sm:w-auto"
            >
              <Save className={`h-3.5 w-3.5 ${retentionSaving ? "animate-spin" : ""}`} />
              <span>{retentionSaving ? "Saving..." : "Save Policies"}</span>
            </Button>
          </div>
        </form>
      </Card>

      {/* GitHub Cold-Storage Request Logs Archival Card */}
      <Card className="p-5 border-purple-500/20 bg-card/60 backdrop-blur-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-border/60">
          <div>
            <div className="flex items-center gap-2">
              <Github className="h-4 w-4 text-purple-500" />
              <CardTitle className="text-sm font-bold">
                GitHub Cold-Storage Request Logs Archival
              </CardTitle>
              <Badge variant="outline" className="text-[10px] text-emerald-500 border-emerald-500/30">
                Solves 512MB Quota
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Automatically packages daily HTTP request logs into JSON and pushes to GitHub, purging MongoDB to keep database storage minimal.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={() => setIsGithubModalOpen(true)}
              className="gap-1.5 text-xs font-semibold"
            >
              <Github className="h-3.5 w-3.5" />
              <span>Configure GitHub Archive</span>
            </Button>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs font-mono">
          <div className="p-3 rounded-lg border border-border/60 bg-muted/20">
            <span className="text-[10px] uppercase font-bold text-muted-foreground block">Archival Status</span>
            <div className="flex items-center gap-2 mt-1">
              <span
                className={`h-2.5 w-2.5 rounded-full ${
                  archiveSettings?.enabled ? "bg-emerald-500 animate-pulse" : "bg-muted-foreground"
                }`}
              />
              <span className="font-bold text-foreground capitalize">
                {archiveSettings?.enabled ? "Daily Auto-Archival Active" : "Disabled / Inactive"}
              </span>
            </div>
          </div>

          <div className="p-3 rounded-lg border border-border/60 bg-muted/20">
            <span className="text-[10px] uppercase font-bold text-muted-foreground block">Target Repository</span>
            <span className="font-bold text-foreground mt-1 block truncate">
              {archiveSettings?.owner && archiveSettings?.repo
                ? `${archiveSettings.owner}/${archiveSettings.repo} (${archiveSettings.branch || "main"})`
                : "Not Configured"}
            </span>
          </div>

          <div className="p-3 rounded-lg border border-border/60 bg-muted/20">
            <span className="text-[10px] uppercase font-bold text-muted-foreground block">Last Archived Date</span>
            <span className="font-bold text-foreground mt-1 block">
              {archiveSettings?.lastArchivedDate || "No archives recorded yet"}
            </span>
          </div>
        </div>
      </Card>

      {/* Raw Snapshot JSON */}
      <Card className="p-4">
        <CardTitle className="text-xs font-semibold mb-3 flex items-center gap-2">
          <Zap className="h-3.5 w-3.5 text-amber-500" />
          <span>Raw Telemetry Payload Snapshot</span>
        </CardTitle>
        <JsonViewer data={stats} title="System Snapshot JSON" />
      </Card>

      <GitHubArchiveModal
        isOpen={isGithubModalOpen}
        onClose={() => setIsGithubModalOpen(false)}
        onArchivedSuccess={() => {
          fetchRetentionSettings();
        }}
      />
    </div>
  );
}
