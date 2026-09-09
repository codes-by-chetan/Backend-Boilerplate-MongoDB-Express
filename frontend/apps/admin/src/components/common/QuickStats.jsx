import React from "react";
import { Card } from "../ui/card";
import {
  Activity,
  Rocket,
  HardDrive,
  Cpu,
  Clock,
  Radio,
} from "lucide-react";

export function QuickStats({ liveMetrics, systemStats }) {
  const host = liveMetrics?.host || systemStats?.host;
  const nodeProc = liveMetrics?.nodeProcess || systemStats?.nodeProcess;

  const inFlight = liveMetrics?.inFlightRequests || 0;
  const totalReq = liveMetrics?.totalRequests || systemStats?.liveMetrics?.totalRequests || 0;
  const totalSuccess = liveMetrics?.totalSuccess || systemStats?.liveMetrics?.totalSuccess || 0;
  const totalErrors = liveMetrics?.totalErrors || systemStats?.liveMetrics?.totalErrors || 0;
  const successRate = totalReq > 0 ? Math.round((totalSuccess / totalReq) * 100) : 100;

  const hostRamUsed = host?.usedMemoryGb || (systemStats?.memory?.usedMemMb ? (systemStats.memory.usedMemMb / 1024).toFixed(1) : null);
  const hostRamTotal = host?.totalMemoryGb || (systemStats?.memory?.totalMemMb ? (systemStats.memory.totalMemMb / 1024).toFixed(1) : null);
  const hostRamPercent = parseFloat(host?.memoryPercentUsed || systemStats?.memory?.percentUsed || 0);

  const nodeRss = nodeProc?.rssMb || systemStats?.nodeProcess?.rssMb || liveMetrics?.memory?.rssMb || "0";
  const nodeHeap = nodeProc?.heapUsedMb || systemStats?.nodeProcess?.heapUsedMb || "0";
  const nodeRamPercent = parseFloat(nodeProc?.percentOfHostRam || 0);

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

  const getUsageColor = (percent) => {
    if (percent >= 85) return "bg-rose-500";
    if (percent >= 70) return "bg-amber-500";
    return "bg-emerald-500";
  };

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      {/* 1. In-Flight Requests */}
      <Card className={`p-3.5 flex flex-col justify-between transition-all ${
        inFlight > 0 ? "border-primary/50 bg-primary/5 shadow-sm" : ""
      }`}>
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            In-Flight
          </span>
          <span className={`h-2 w-2 rounded-full ${
            inFlight > 0 ? "bg-primary animate-ping" : "bg-muted-foreground/30"
          }`} />
        </div>
        <div className="text-2xl font-bold font-mono tracking-tight my-1.5">
          {inFlight}
        </div>
        <div className="text-[10px] text-muted-foreground truncate">
          {inFlight > 0 ? "Processing right now" : "Idle (listening)"}
        </div>
      </Card>

      {/* 2. Total Requests */}
      <Card className="p-3.5 flex flex-col justify-between">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            Total Calls
          </span>
          <Rocket className="h-3.5 w-3.5 text-primary" />
        </div>
        <div className="text-2xl font-bold font-mono tracking-tight my-1.5">
          {totalReq}
        </div>
        <div className="text-[10px] text-muted-foreground truncate">
          {totalReq > 0 ? (
            <span>
              <strong className="text-emerald-500">{successRate}% ok</strong> ({totalSuccess} ok / {totalErrors} err)
            </span>
          ) : (
            "Lifetime API calls"
          )}
        </div>
      </Card>

      {/* 3. Host Machine RAM */}
      <Card className="p-3.5 flex flex-col justify-between">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            Host RAM
          </span>
          <HardDrive className="h-3.5 w-3.5 text-emerald-500" />
        </div>
        <div className="text-xl font-bold font-mono tracking-tight my-1.5">
          {hostRamUsed ? `${hostRamUsed} / ${hostRamTotal}` : "—"}{" "}
          <span className="text-xs font-medium text-muted-foreground">GB</span>
        </div>
        <div className="space-y-1">
          <div className="w-full bg-muted rounded-full h-1 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${getUsageColor(hostRamPercent)}`}
              style={{ width: `${Math.min(100, Math.max(2, hostRamPercent))}%` }}
            />
          </div>
          <div className="text-[10px] text-muted-foreground truncate">
            {host?.freeMemoryGb ? `${host.freeMemoryGb} GB free` : `${hostRamPercent}% used`}
          </div>
        </div>
      </Card>

      {/* 4. Node Process RAM */}
      <Card className="p-3.5 flex flex-col justify-between">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            Node RSS
          </span>
          <Cpu className="h-3.5 w-3.5 text-sky-500" />
        </div>
        <div className="text-xl font-bold font-mono tracking-tight my-1.5">
          {nodeRss}{" "}
          <span className="text-xs font-medium text-muted-foreground">MB</span>
        </div>
        <div className="space-y-1">
          <div className="w-full bg-muted rounded-full h-1 overflow-hidden">
            <div
              className="h-full rounded-full bg-sky-500 transition-all duration-500"
              style={{ width: `${Math.min(100, Math.max(2, nodeRamPercent * 4))}%` }}
            />
          </div>
          <div className="text-[10px] text-muted-foreground truncate">
            {nodeRamPercent}% of Host | Heap: {nodeHeap} MB
          </div>
        </div>
      </Card>

      {/* 5. Server & Host Uptime */}
      <Card className="p-3.5 flex flex-col justify-between col-span-2 sm:col-span-1">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            Uptime
          </span>
          <Clock className="h-3.5 w-3.5 text-amber-500" />
        </div>
        <div className="text-xl font-bold font-mono tracking-tight my-1.5">
          {formatUptime(liveMetrics?.uptimeSeconds || systemStats?.host?.uptimeSeconds || systemStats?.uptime || 0)}
        </div>
        <div className="text-[10px] text-muted-foreground truncate">
          Host: {formatUptime(host?.hostUptimeSeconds || host?.uptimeSeconds || 0)}
        </div>
      </Card>
    </div>
  );
}
