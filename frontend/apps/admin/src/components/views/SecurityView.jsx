import React, { useState, useEffect, useCallback } from "react";
import { api } from "../../api/client";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import {
  ShieldAlert,
  ShieldCheck,
  RefreshCw,
  Search,
  KeyRound,
  Lock,
  Unlock,
  AlertTriangle,
  Globe,
  Clock,
  User,
  CheckCircle2,
  Terminal,
} from "lucide-react";

export function SecurityView() {
  const [lockedUsers, setLockedUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [search, setSearch] = useState("");
  const [unlockingId, setUnlockingId] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchLockedUsers = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    setError("");
    try {
      const res = await api.getLockedUsers();
      const users = res?.data || [];
      setLockedUsers(Array.isArray(users) ? users : []);
    } catch (err) {
      setError(err.message || "Failed to fetch locked users");
    } finally {
      if (!isSilent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLockedUsers();
  }, [fetchLockedUsers]);

  // Auto-refresh interval (every 10 seconds if enabled)
  useEffect(() => {
    if (!autoRefresh) return;
    const timer = setInterval(() => {
      fetchLockedUsers(true);
    }, 10000);
    return () => clearInterval(timer);
  }, [autoRefresh, fetchLockedUsers]);

  const handleAdminUnlock = async (userId, userEmail) => {
    setUnlockingId(userId);
    setError("");
    setSuccessMsg("");
    try {
      await api.adminUnlockUser(userId);
      setSuccessMsg(`Account for "${userEmail}" has been unlocked successfully!`);
      // Optimistically update list
      setLockedUsers((prev) => prev.filter((u) => u._id !== userId));
      setTimeout(() => setSuccessMsg(""), 4000);
    } catch (err) {
      setError(err.message || "Failed to unlock user account");
    } finally {
      setUnlockingId(null);
    }
  };

  const filteredUsers = lockedUsers.filter((u) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    const email = (u.email || "").toLowerCase();
    const name = `${u.fullName?.firstName || ""} ${u.fullName?.lastName || ""}`.toLowerCase();
    const ip = (u.lastFailedLoginIp || "").toLowerCase();
    return email.includes(q) || name.includes(q) || ip.includes(q);
  });

  const formatRemainingTime = (lockUntil) => {
    if (!lockUntil) return "Expired";
    const remMs = new Date(lockUntil).getTime() - Date.now();
    if (remMs <= 0) return "Expired (Will clear on next attempt)";
    const hours = Math.floor(remMs / (1000 * 60 * 60));
    const mins = Math.floor((remMs % (1000 * 60 * 60)) / (1000 * 60));
    if (hours > 0) return `${hours}h ${mins}m remaining`;
    return `${mins}m remaining`;
  };

  return (
    <div className="space-y-6">
      {/* View Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border/50 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-red-500/10 text-red-500 border border-red-500/20">
              <ShieldAlert className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold tracking-tight text-foreground flex items-center gap-2">
                <span>Security & Threat Management</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/10 text-red-500 border border-red-500/20 font-mono">
                  {lockedUsers.length} Locked
                </span>
              </h2>
              <p className="text-xs text-muted-foreground">
                Inspect accounts frozen by the brute-force defense engine and restore access instantly with 1-click administrative unlock.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`text-xs h-8 ${autoRefresh ? "border-emerald-500/40 text-emerald-500 bg-emerald-500/10" : "text-muted-foreground"}`}
          >
            <Clock className="h-3 w-3 mr-1" />
            <span>{autoRefresh ? "Auto-Refresh ON" : "Auto-Refresh OFF"}</span>
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fetchLockedUsers(false)}
            disabled={loading}
            className="text-xs h-8 gap-1.5"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </Button>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl border border-border/60 bg-card/60 backdrop-blur-sm space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Locked Accounts</span>
            <Lock className="h-4 w-4 text-red-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-foreground">
            {lockedUsers.length}
          </div>
          <div className="text-[11px] text-muted-foreground flex items-center gap-1">
            <span className={lockedUsers.length > 0 ? "text-red-400 font-semibold" : "text-emerald-400"}>
              {lockedUsers.length > 0 ? "Threats detected" : "All accounts nominal"}
            </span>
          </div>
        </div>

        <div className="p-4 rounded-xl border border-border/60 bg-card/60 backdrop-blur-sm space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Attack Threshold</span>
            <ShieldAlert className="h-4 w-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-foreground">
            3 Strikes
          </div>
          <div className="text-[11px] text-muted-foreground">
            24-hour lockout duration
          </div>
        </div>

        <div className="p-4 rounded-xl border border-border/60 bg-card/60 backdrop-blur-sm space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Unique Suspect IPs</span>
            <Globe className="h-4 w-4 text-sky-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-foreground">
            {new Set(lockedUsers.map((u) => u.lastFailedLoginIp).filter(Boolean)).size}
          </div>
          <div className="text-[11px] text-muted-foreground">
            Client origins logged
          </div>
        </div>

        <div className="p-4 rounded-xl border border-border/60 bg-card/60 backdrop-blur-sm space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Protection Engine</span>
            <ShieldCheck className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-emerald-400">
            ACTIVE
          </div>
          <div className="text-[11px] text-muted-foreground">
            Sliding window + Cooldown active
          </div>
        </div>
      </div>

      {/* Notifications */}
      {error && (
        <div className="flex items-center gap-2 p-3.5 rounded-lg border border-destructive/30 bg-destructive/10 text-destructive text-xs">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {successMsg && (
        <div className="flex items-center gap-2 p-3.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-500 text-xs">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Search Bar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search locked accounts by email, user name, or suspect IP..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 text-xs"
          />
        </div>
      </div>

      {/* Locked Accounts Content */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 text-center space-y-3">
          <RefreshCw className="h-8 w-8 text-muted-foreground animate-spin" />
          <p className="text-xs text-muted-foreground">Querying security records...</p>
        </div>
      ) : lockedUsers.length === 0 ? (
        <div className="p-8 rounded-xl border border-emerald-500/20 bg-emerald-500/5 text-center space-y-3">
          <div className="inline-flex p-3 rounded-full bg-emerald-500/10 text-emerald-400 mb-1">
            <ShieldCheck className="h-8 w-8" />
          </div>
          <h3 className="text-sm font-semibold text-foreground">Zero Active Lockouts</h3>
          <p className="text-xs text-muted-foreground max-w-md mx-auto leading-relaxed">
            All user accounts are operating normally. The brute-force defense engine is actively monitoring authentication traffic, and any compromised targets will appear here.
          </p>
        </div>
      ) : filteredUsers.length === 0 ? (
        <div className="p-8 rounded-xl border border-border text-center space-y-2">
          <p className="text-xs text-muted-foreground">No locked accounts match your search filter "{search}".</p>
          <Button variant="ghost" size="sm" onClick={() => setSearch("")} className="text-xs">
            Clear Search Filter
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="text-xs font-semibold text-muted-foreground flex items-center justify-between">
            <span>Detected Intrusion Targets ({filteredUsers.length})</span>
            <span className="text-[11px] font-normal">All times UTC</span>
          </div>

          <div className="space-y-3">
            {filteredUsers.map((user) => {
              const fullName = `${user.fullName?.firstName || ""} ${user.fullName?.lastName || ""}`.trim() || user.userName || "User";
              const isUnlocking = unlockingId === user._id;

              return (
                <div
                  key={user._id}
                  className="p-4 rounded-xl border border-red-500/20 bg-card/70 hover:border-red-500/40 transition-all space-y-3"
                >
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="h-9 w-9 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 flex items-center justify-center font-bold text-sm shrink-0">
                        {fullName.charAt(0).toUpperCase()}
                      </div>
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm text-foreground">{fullName}</span>
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-muted text-muted-foreground font-mono">
                            {user.role || "USER"}
                          </span>
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/15 text-red-400 border border-red-500/30 font-semibold flex items-center gap-1">
                            <Lock className="h-2.5 w-2.5" />
                            <span>{user.failedLoginAttempts || 3} / 3 Strikes</span>
                          </span>
                        </div>
                        <div className="text-xs text-muted-foreground font-mono">{user.email}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={isUnlocking}
                        onClick={() => handleAdminUnlock(user._id, user.email)}
                        className="text-xs h-8 border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/20 gap-1.5 font-medium"
                      >
                        {isUnlocking ? (
                          <>
                            <RefreshCw className="h-3 w-3 animate-spin" />
                            <span>Unlocking...</span>
                          </>
                        ) : (
                          <>
                            <Unlock className="h-3 w-3" />
                            <span>Unlock Account (1-Click)</span>
                          </>
                        )}
                      </Button>
                    </div>
                  </div>

                  {/* Forensic Metadata Strip */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2 border-t border-border/40 text-xs">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Clock className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                      <span>Lockout Duration:</span>
                      <span className="font-mono text-foreground font-semibold">
                        {formatRemainingTime(user.lockUntil)}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Globe className="h-3.5 w-3.5 text-sky-400 shrink-0" />
                      <span>Last Client IP:</span>
                      <span className="font-mono text-foreground">
                        {user.lastFailedLoginIp || "N/A"}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Terminal className="h-3.5 w-3.5 text-purple-400 shrink-0" />
                      <span>Failed Attack Time:</span>
                      <span className="font-mono text-foreground">
                        {user.lastFailedLoginAt ? new Date(user.lastFailedLoginAt).toLocaleTimeString() : "Recent"}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default SecurityView;
