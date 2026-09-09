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
} from "lucide-react";
import { api } from "../../api/client";

export function SystemView({ liveMetrics, token }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

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

  useEffect(() => {
    fetchStats();
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

      {/* Raw Snapshot JSON */}
      <Card className="p-4">
        <CardTitle className="text-xs font-semibold mb-3 flex items-center gap-2">
          <Zap className="h-3.5 w-3.5 text-amber-500" />
          <span>Raw Telemetry Payload Snapshot</span>
        </CardTitle>
        <JsonViewer data={stats} title="System Snapshot JSON" />
      </Card>
    </div>
  );
}
