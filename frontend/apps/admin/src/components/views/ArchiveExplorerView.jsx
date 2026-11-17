import React, { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "../ui/card";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "../ui/dialog";
import { JsonViewer } from "../common/JsonViewer";
import { Pagination } from "../common/Pagination";
import {
  Database,
  Archive,
  Search,
  RefreshCw,
  Terminal,
  Zap,
  Filter,
  Github,
  Play,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Code,
  FileText,
  Clock,
  HardDrive,
  Copy,
  ExternalLink,
  ChevronRight,
  Layers,
  ArrowUpDown,
  Lock,
  KeyRound,
  Shield,
  Loader2,
} from "lucide-react";
import { api } from "../../api/client";
import { findEncryptedFieldPaths } from "../../lib/utils";
import { GitHubArchiveModal } from "../modals/GitHubArchiveModal";
import { DecryptionReasonModal } from "../modals/DecryptionReasonModal";
import { DecryptionAuditModal } from "../modals/DecryptionAuditModal";

export function ArchiveExplorerView() {
  const [archives, setArchives] = useState([]);
  const [selectedDate, setSelectedDate] = useState("live");
  const [loadingArchives, setLoadingArchives] = useState(false);

  // Storage Stats & Optimization State
  const [storageStats, setStorageStats] = useState(null);
  const [pendingDates, setPendingDates] = useState([]);
  const [isReclaiming, setIsReclaiming] = useState(false);
  const [isArchivingPending, setIsArchivingPending] = useState(false);
  const [storageActionNotice, setStorageActionNotice] = useState("");
  const [storageActionError, setStorageActionError] = useState("");

  // MongoDB Query State
  const [mongoQuery, setMongoQuery] = useState('{\n  "responseStatus": { "$gte": 400 }\n}');
  const [jsonValid, setJsonValid] = useState(true);
  const [jsonError, setJsonError] = useState("");
  const [freeTextSearch, setFreeTextSearch] = useState("");
  const [sortField, setSortField] = useState("createdAt");
  const [sortOrder, setSortOrder] = useState("desc"); // "desc" | "asc"

  // Query Results State
  const [logs, setLogs] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 50, total: 0, totalPages: 1 });
  const [stats, setStats] = useState(null);
  const [execTimeMs, setExecTimeMs] = useState(null);
  const [querySource, setQuerySource] = useState("");
  const [executing, setExecuting] = useState(false);
  const [queryError, setQueryError] = useState("");

  // Inspect Modal State
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [copiedDoc, setCopiedDoc] = useState(false);

  // GitHub Setup Modal State
  const [isGithubModalOpen, setIsGithubModalOpen] = useState(false);

  // Decryption Justification & Audit State
  const [reasonModalOpen, setReasonModalOpen] = useState(false);
  const [decryptionReason, setDecryptionReason] = useState("");
  const [reasonError, setReasonError] = useState("");
  const [decrypting, setDecrypting] = useState(false);
  const [decryptSuccessMsg, setDecryptSuccessMsg] = useState("");
  const [targetDocForDecryption, setTargetDocForDecryption] = useState(null);

  // Decryption Audit History Modal State
  const [auditModalOpen, setAuditModalOpen] = useState(false);
  const [auditLogs, setAuditLogs] = useState([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditSearch, setAuditSearch] = useState("");
  const [auditPagination, setAuditPagination] = useState({ page: 1, totalPages: 1, total: 0 });

  // Detect if document has encrypted confidential fields
  const hasEncryptedFields = (doc) => {
    if (!doc) return false;
    const str = JSON.stringify(doc);
    return str.includes("[ENCRYPTED:enc:") || str.includes("enc:");
  };

  // Count number of encrypted tokens in document
  const countEncryptedFields = (doc) => {
    if (!doc) return 0;
    const discovered = findEncryptedFieldPaths(doc);
    if (discovered.length > 0) return discovered.length;
    const jsonStr = JSON.stringify(doc);
    const encRegex = /(?:\[ENCRYPTED:)?(enc:[a-f0-9]+:[a-f0-9]+:[a-f0-9]+)\]?/g;
    const matches = [...jsonStr.matchAll(encRegex)];
    return matches.length;
  };

  const handleOpenReasonModal = (doc = null) => {
    const target = doc || selectedDoc;
    setTargetDocForDecryption(target);
    setDecryptionReason("");
    setReasonError("");
    setReasonModalOpen(true);
  };

  const handleConfirmDecryption = async () => {
    const target = targetDocForDecryption || selectedDoc;
    if (!target) return;
    if (!decryptionReason || decryptionReason.trim().length < 5) {
      setReasonError("A valid justification/reason of at least 5 characters is required by security policy.");
      return;
    }

    setDecrypting(true);
    setReasonError("");
    try {
      const jsonStr = JSON.stringify(target);
      const encRegex = /(?:\[ENCRYPTED:)?(enc:[a-f0-9]+:[a-f0-9]+:[a-f0-9]+)\]?/g;
      const matches = [...jsonStr.matchAll(encRegex)];
      if (matches.length === 0) return;

      const discovered = findEncryptedFieldPaths(target);
      const items = [];
      const seenCiphers = new Set();

      for (const it of discovered) {
        if (it && it.cipherText && !seenCiphers.has(it.cipherText)) {
          items.push(it);
          seenCiphers.add(it.cipherText);
        }
      }

      // Catch any remaining ciphers not discovered by path scan
      matches.forEach((m, idx) => {
        const cipherText = m[1];
        if (!seenCiphers.has(cipherText)) {
          items.push({ fieldName: `field_${idx + 1}`, cipherText });
          seenCiphers.add(cipherText);
        }
      });

      const payload = {
        reason: decryptionReason.trim(),
        logId: target._id,
        logUrl: target.requestUrl || target.url || "",
        items,
      };

      const res = await api.decryptLogFields(payload);
      const decryptedResults = res.data?.decryptedResults || [];
      let updatedStr = jsonStr;

      for (const item of decryptedResults) {
        if (item.plainText !== undefined && item.plainText !== null) {
          const fullToken = `[ENCRYPTED:${item.cipherText}]`;
          if (updatedStr.includes(fullToken)) {
            updatedStr = updatedStr.replaceAll(fullToken, `[DECRYPTED: ${item.plainText}]`);
          } else {
            updatedStr = updatedStr.replaceAll(item.cipherText, `[DECRYPTED: ${item.plainText}]`);
          }
        }
      }

      const decryptedDoc = JSON.parse(updatedStr);

      if (selectedDoc && (selectedDoc._id === target._id || selectedDoc === target)) {
        setSelectedDoc(decryptedDoc);
      }

      setLogs((prev) =>
        prev.map((l) => (l._id === target._id || l === target ? decryptedDoc : l))
      );

      setReasonModalOpen(false);
      setDecryptSuccessMsg(
        `Successfully decrypted ${res.data?.fieldsCount || items.length} confidential field(s) with an immutable audit entry recorded.`
      );
      setTimeout(() => setDecryptSuccessMsg(""), 5000);
    } catch (err) {
      setReasonError(err.message || "Decryption failed");
    } finally {
      setDecrypting(false);
    }
  };

  const fetchAuditLogs = async (page = 1) => {
    setAuditLoading(true);
    try {
      const res = await api.getDecryptionAudits({
        page,
        limit: 15,
        ...(auditSearch && { search: auditSearch }),
      });
      const data = res.data || res;
      setAuditLogs(data.audits || []);
      if (data.pagination) {
        setAuditPagination({
          page: data.pagination.page,
          totalPages: data.pagination.totalPages,
          total: data.pagination.total,
        });
      }
    } catch (err) {
      console.error("Failed to load decryption audit logs:", err);
    } finally {
      setAuditLoading(false);
    }
  };

  const handleOpenAuditModal = () => {
    setAuditModalOpen(true);
    fetchAuditLogs(1);
  };

  // Validate JSON on query text change
  const handleQueryChange = (val) => {
    setMongoQuery(val);
    const trimmed = val.trim();
    if (!trimmed) {
      setJsonValid(true);
      setJsonError("");
      return;
    }
    try {
      JSON.parse(trimmed);
      setJsonValid(true);
      setJsonError("");
    } catch (err) {
      setJsonValid(false);
      setJsonError(err.message);
    }
  };

  // Fetch list of archived dates
  const fetchArchivesList = async () => {
    setLoadingArchives(true);
    try {
      const res = await api.listArchives();
      const list = res.data || [];
      setArchives(list);

      // Auto-select latest archived date if none selected, or fallback to live
      if (!selectedDate && list.length > 0) {
        setSelectedDate(list[0].date);
      } else if (!selectedDate) {
        setSelectedDate("live");
      }
    } catch (err) {
      console.error("Failed to load archive manifest:", err);
      if (!selectedDate) setSelectedDate("live");
    } finally {
      setLoadingArchives(false);
    }
  };

  // Fetch live storage metrics & pending dates
  const fetchStorageStats = async () => {
    try {
      const [statsRes, pendingRes] = await Promise.all([
        api.getArchiveStorageStats(),
        api.getPendingArchiveDates(),
      ]);
      setStorageStats(statsRes.data || null);
      setPendingDates(pendingRes.data || []);
    } catch (err) {
      console.error("Failed to load storage stats:", err);
    }
  };

  const handleArchivePending = async () => {
    if (
      !window.confirm(
        `Archive ${pendingDates.length} pending historical day(s) to GitHub and purge them from MongoDB?`
      )
    ) {
      return;
    }
    setIsArchivingPending(true);
    setStorageActionNotice("");
    setStorageActionError("");
    try {
      const res = await api.archivePendingDates({ purgeFromDb: true });
      setStorageActionNotice(
        `Successfully processed ${res.data?.totalPending || 0} date(s) to GitHub!`
      );
      await Promise.all([fetchArchivesList(), fetchStorageStats()]);
    } catch (err) {
      setStorageActionError(err.message || "Failed to archive pending dates.");
    } finally {
      setIsArchivingPending(false);
    }
  };

  const handleReclaimStorage = async () => {
    if (
      !window.confirm(
        "Rebuild requestlogs collection to reclaim physical disk space on MongoDB Atlas? Recent logs from the past 24 hours will be preserved."
      )
    ) {
      return;
    }
    setIsReclaiming(true);
    setStorageActionNotice("");
    setStorageActionError("");
    try {
      const res = await api.reclaimStorage({ retainHours: 24, autoArchivePending: true });
      const { reclaimedMb, preStorageMb, postStorageMb } = res.data || {};
      setStorageActionNotice(
        `Physical storage reclaimed! Dropped from ${preStorageMb} MB to ${postStorageMb} MB (Freed: ${reclaimedMb} MB).`
      );
      await Promise.all([fetchArchivesList(), fetchStorageStats()]);
    } catch (err) {
      setStorageActionError(err.message || "Failed to reclaim storage.");
    } finally {
      setIsReclaiming(false);
    }
  };

  useEffect(() => {
    fetchArchivesList();
    fetchStorageStats();
  }, []);

  // Execute Query
  const runQuery = async (targetPage = 1, targetLimit = pagination.limit) => {
    if (!selectedDate) return;

    let parsedFilter = {};
    const trimmed = mongoQuery.trim();
    if (trimmed) {
      try {
        parsedFilter = JSON.parse(trimmed);
      } catch (err) {
        setQueryError(`Query Syntax Error: ${err.message}`);
        return;
      }
    }

    setExecuting(true);
    setQueryError("");
    try {
      const payload = {
        date: selectedDate,
        filter: parsedFilter,
        sort: { [sortField]: sortOrder === "asc" ? 1 : -1 },
        page: targetPage,
        limit: targetLimit,
        search: freeTextSearch.trim(),
      };

      const res = await api.queryArchiveLogs(payload);
      const data = res.data || {};

      setLogs(data.logs || []);
      setPagination(data.pagination || { page: 1, limit: targetLimit, total: 0, totalPages: 1 });
      setStats(data.stats || null);
      setExecTimeMs(data.executionTimeMs ?? 0);
      setQuerySource(data.source || "");
    } catch (err) {
      setQueryError(err.message || "Failed to execute MongoDB query");
      setLogs([]);
    } finally {
      setExecuting(false);
    }
  };

  // Run query whenever selected archive date changes
  useEffect(() => {
    if (selectedDate) {
      runQuery(1, pagination.limit);
    }
  }, [selectedDate, sortField, sortOrder]);

  const handlePresetClick = (presetFilter) => {
    const formatted = JSON.stringify(presetFilter, null, 2);
    setMongoQuery(formatted);
    setJsonValid(true);
    setJsonError("");
  };

  const handleCopyDoc = () => {
    if (!selectedDoc) return;
    navigator.clipboard.writeText(JSON.stringify(selectedDoc, null, 2));
    setCopiedDoc(true);
    setTimeout(() => setCopiedDoc(false), 2000);
  };

  const getMethodBadgeClass = (method) => {
    switch (method?.toUpperCase()) {
      case "GET":
        return "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20";
      case "POST":
        return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20";
      case "PUT":
        return "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20";
      case "PATCH":
        return "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20";
      case "DELETE":
        return "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20";
      default:
        return "bg-muted text-muted-foreground border-border";
    }
  };

  const getStatusBadgeClass = (status) => {
    const code = Number(status) || 0;
    if (code >= 200 && code < 300) {
      return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20";
    }
    if (code >= 300 && code < 400) {
      return "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20";
    }
    if (code >= 400 && code < 500) {
      return "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20";
    }
    if (code >= 500) {
      return "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20";
    }
    return "bg-muted text-muted-foreground border-border";
  };

  const currentArchiveMeta = archives.find((a) => a.date === selectedDate);

  return (
    <div className="space-y-4">
      {/* Top Header & Action Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
              <Terminal className="h-5 w-5" />
            </div>
            <h2 className="text-base font-bold tracking-tight">
              Log Archives & MongoDB Query Engine
            </h2>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Query cold-storage JSON archives from GitHub or live traffic using MongoDB syntax & in-memory caching.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchArchivesList}
            disabled={loadingArchives}
            className="gap-1.5 text-xs"
            title="Reload available archives from manifest"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loadingArchives ? "animate-spin" : ""}`} />
            <span>Sync Manifest</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleOpenAuditModal}
            className="gap-1.5 text-xs text-purple-600 dark:text-purple-400 border-purple-500/30 bg-purple-500/10 hover:bg-purple-500/20"
            title="View Security Decryption Audit Trail"
          >
            <Shield className="h-3.5 w-3.5" />
            <span>Decryption Audits</span>
          </Button>

          <Button
            size="sm"
            onClick={() => setIsGithubModalOpen(true)}
            className="gap-1.5 text-xs font-semibold shadow-xs"
          >
            <Github className="h-3.5 w-3.5" />
            <span>GitHub Setup<span className="hidden sm:inline"> & Auto-Archival</span></span>
          </Button>
        </div>
      </div>

      {/* Archive Selector & Source Bar */}
      <Card className="p-4 bg-card/60 backdrop-blur-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Date Picker / Archive Dropdown */}
          <div className="flex-1 space-y-1.5 min-w-0">
            <div className="flex items-center justify-between min-w-0 flex-wrap gap-1">
              <label className="text-xs font-semibold text-foreground flex items-center gap-1.5 truncate">
                <Archive className="h-3.5 w-3.5 text-primary shrink-0" />
                <span>Select Log Archive Date / Source</span>
              </label>
              {currentArchiveMeta?.isCachedLocally && (
                <span className="text-[10px] text-emerald-500 font-medium flex items-center gap-1 shrink-0">
                  <Zap className="h-3 w-3 fill-emerald-500" />
                  <span>Cached In-Memory (Zero Network Latency)</span>
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 min-w-0">
              <select
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="flex-1 min-w-0 max-w-full px-3 py-2 rounded-lg border border-input bg-background text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-primary truncate"
              >
                <option value="live">⚡ Live Active MongoDB Database (Current Traffic)</option>
                {archives.map((a) => (
                  <option key={a.date} value={a.date}>
                    📅 {a.date} — {a.count > 0 ? `${a.count.toLocaleString()} logs` : "Archived"}{" "}
                    {a.sizeBytes ? `(${(a.sizeBytes / 1024 / 1024).toFixed(2)} MB)` : ""}{" "}
                    {a.isCachedLocally ? "• [Cached ⚡]" : "• [GitHub 🌐]"}
                  </option>
                ))}
              </select>

              {currentArchiveMeta?.htmlUrl && (
                <a
                  href={currentArchiveMeta.htmlUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-2 rounded-lg border border-border/80 bg-muted/40 hover:bg-muted text-xs font-medium text-muted-foreground hover:text-foreground flex items-center gap-1.5 shrink-0"
                  title="View archive raw JSON file on GitHub"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">GitHub File</span>
                </a>
              )}
            </div>
          </div>

          {/* Quick Stats Pill Strip */}
          <div className="flex items-center gap-2 flex-wrap text-xs">
            {execTimeMs !== null && (
              <Badge variant="outline" className="gap-1 py-1 px-2.5 font-mono text-[11px] border-primary/30 text-primary">
                <Zap className="h-3 w-3" />
                <span>{execTimeMs}ms query time</span>
              </Badge>
            )}

            <Badge variant="outline" className="py-1 px-2.5 font-mono text-[11px]">
              Matched: <strong>{pagination.total.toLocaleString()}</strong>
              {stats?.totalInArchive ? ` / ${stats.totalInArchive.toLocaleString()} in archive` : ""}
            </Badge>

            {querySource && (
              <Badge variant="outline" className="py-1 px-2.5 text-[11px] capitalize text-muted-foreground">
                Source: {querySource.replace(/_/g, " ")}
              </Badge>
            )}
          </div>
        </div>
      </Card>

      {/* Storage Optimization & Disk Reclaim Bar */}
      <Card className="p-3.5 bg-card/60 border border-border/80">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 min-w-0">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="h-8 w-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
              <Database className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap min-w-0">
                <span className="text-xs font-bold text-foreground">MongoDB Live RequestLogs Storage</span>
                {storageStats?.freeStorageSizeMb > 5 && (
                  <Badge variant="warning" className="text-[10px] py-0 px-1.5 font-mono shrink-0">
                    {storageStats.freeStorageSizeMb} MB WiredTiger Free-List Slack
                  </Badge>
                )}
                {pendingDates.length > 0 && (
                  <Badge variant="outline" className="text-[10px] py-0 px-1.5 border-amber-500/40 text-amber-600 dark:text-amber-400 font-mono shrink-0">
                    {pendingDates.length} Unarchived Day{pendingDates.length > 1 ? "s" : ""}
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2.5 text-[11px] text-muted-foreground mt-0.5 font-mono flex-wrap min-w-0">
                <span>Disk: <strong className="text-foreground">{storageStats?.storageSizeMb || "0"} MB</strong></span>
                <span>•</span>
                <span>Data: <strong className="text-foreground">{storageStats?.dataSizeMb || "0"} MB</strong></span>
                <span>•</span>
                <span>Docs: <strong className="text-foreground">{(storageStats?.count || 0).toLocaleString()}</strong></span>
                <span>•</span>
                <span>Index: <strong className="text-foreground">{storageStats?.totalIndexSizeMb || "0"} MB</strong></span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {pendingDates.length > 0 && (
              <Button
                size="sm"
                variant="outline"
                onClick={handleArchivePending}
                disabled={isArchivingPending || isReclaiming}
                className="gap-1.5 text-xs border-amber-500/40 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10"
                title="Archive all historical days older than today to GitHub and purge them from MongoDB"
              >
                <Archive className={`h-3.5 w-3.5 ${isArchivingPending ? "animate-spin" : ""}`} />
                <span>Archive {pendingDates.length} Pending Day{pendingDates.length > 1 ? "s" : ""}</span>
              </Button>
            )}

            <Button
              size="sm"
              variant="outline"
              onClick={handleReclaimStorage}
              disabled={isReclaiming || isArchivingPending}
              className="gap-1.5 text-xs border-emerald-500/40 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 font-semibold"
              title="Atomically rebuilds collection to eliminate WiredTiger free list slack and release disk space back to Atlas"
            >
              <RotateCcw className={`h-3.5 w-3.5 ${isReclaiming ? "animate-spin" : ""}`} />
              <span>{isReclaiming ? "Reclaiming..." : "Reclaim Storage"}</span>
            </Button>
          </div>
        </div>
      </Card>

      {/* Storage Action Notices */}
      {storageActionNotice && (
        <div className="flex items-center gap-2 p-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{storageActionNotice}</span>
        </div>
      )}

      {storageActionError && (
        <div className="flex items-center gap-2 p-3 rounded-lg border border-destructive/30 bg-destructive/10 text-destructive text-xs">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>{storageActionError}</span>
        </div>
      )}

      {/* MongoDB Compass / Shell Style Query Box */}
      <Card className="p-4 border-primary/20 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Code className="h-4 w-4 text-emerald-500" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
              MongoDB Query Filter (JSON Document)
            </h3>
            {jsonValid ? (
              <span className="text-[10px] text-emerald-500 flex items-center gap-1 font-mono">
                <CheckCircle2 className="h-3 w-3" />
                <span>Valid JSON</span>
              </span>
            ) : (
              <span className="text-[10px] text-destructive flex items-center gap-1 font-mono">
                <AlertTriangle className="h-3 w-3" />
                <span>{jsonError}</span>
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handlePresetClick({})}
              className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1"
            >
              <RotateCcw className="h-3 w-3" />
              <span>Reset</span>
            </button>
          </div>
        </div>

        {/* Monospace Query Editor Input */}
        <div className="relative rounded-lg overflow-hidden border border-input focus-within:ring-1 focus-within:ring-primary bg-background">
          <div className="absolute left-3 top-2.5 select-none font-mono text-xs text-muted-foreground font-semibold">
            db.logs.find(
          </div>
          <textarea
            value={mongoQuery}
            onChange={(e) => handleQueryChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                runQuery(1, pagination.limit);
              }
            }}
            rows={3}
            className="w-full pl-28 pr-4 py-2 font-mono text-xs bg-transparent focus:outline-none resize-y min-h-[70px] leading-relaxed"
            placeholder='{ "responseStatus": { "$gte": 400 } }'
          />
          <div className="absolute right-3 bottom-2 select-none font-mono text-xs text-muted-foreground font-semibold">
            )
          </div>
        </div>

        {/* Quick Filter Presets Strip */}
        <div className="flex items-center gap-1.5 flex-wrap pt-1">
          <span className="text-[11px] text-muted-foreground mr-1 flex items-center gap-1">
            <Filter className="h-3 w-3" />
            <span>Presets:</span>
          </span>

          <button
            type="button"
            onClick={() => handlePresetClick({ responseStatus: { $gte: 400 } })}
            className="px-2.5 py-1 rounded-md bg-muted/60 hover:bg-muted text-[11px] font-mono border border-border/60 transition-colors"
          >
            All Errors (≥ 400)
          </button>

          <button
            type="button"
            onClick={() => handlePresetClick({ responseStatus: 500 })}
            className="px-2.5 py-1 rounded-md bg-muted/60 hover:bg-muted text-[11px] font-mono border border-border/60 text-rose-500 transition-colors"
          >
            500 Server Errors
          </button>

          <button
            type="button"
            onClick={() => handlePresetClick({ responseStatus: { $in: [401, 403] } })}
            className="px-2.5 py-1 rounded-md bg-muted/60 hover:bg-muted text-[11px] font-mono border border-border/60 text-amber-500 transition-colors"
          >
            401/403 Auth Failures
          </button>

          <button
            type="button"
            onClick={() => handlePresetClick({ requestMethod: { $in: ["POST", "PUT", "DELETE"] } })}
            className="px-2.5 py-1 rounded-md bg-muted/60 hover:bg-muted text-[11px] font-mono border border-border/60 text-sky-500 transition-colors"
          >
            Mutations (POST/PUT/DEL)
          </button>

          <button
            type="button"
            onClick={() => handlePresetClick({ errors: { $exists: true, $ne: null } })}
            className="px-2.5 py-1 rounded-md bg-muted/60 hover:bg-muted text-[11px] font-mono border border-border/60 transition-colors"
          >
            Logged Exceptions
          </button>

          <button
            type="button"
            onClick={() => handlePresetClick({ "ipAddress.clientIp": "127.0.0.1" })}
            className="px-2.5 py-1 rounded-md bg-muted/60 hover:bg-muted text-[11px] font-mono border border-border/60 transition-colors"
          >
            IP Match
          </button>

          <button
            type="button"
            onClick={() => handlePresetClick({})}
            className="px-2.5 py-1 rounded-md bg-muted/40 hover:bg-muted text-[11px] font-mono border border-border/60 text-muted-foreground transition-colors"
          >
            All Logs &#123;&#125;
          </button>
        </div>

        {/* Secondary Filters & Run Toolbar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t border-border/60 min-w-0">
          <div className="flex items-center gap-2 w-full sm:w-auto flex-1 flex-wrap sm:flex-nowrap min-w-0">
            <div className="relative flex-1 min-w-[140px] max-w-sm">
              <Search className="h-3.5 w-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
              <input
                type="text"
                placeholder="String search (URL, IP, error, user)..."
                value={freeTextSearch}
                onChange={(e) => setFreeTextSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && runQuery(1, pagination.limit)}
                className="w-full pl-8 pr-3 py-1.5 rounded-md border border-input bg-background text-xs focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            {/* Sort Toggle */}
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground shrink-0 flex-wrap">
              <ArrowUpDown className="h-3.5 w-3.5" />
              <select
                value={sortField}
                onChange={(e) => setSortField(e.target.value)}
                className="px-2 py-1.5 rounded-md border border-input bg-background text-xs font-mono"
              >
                <option value="createdAt">Timestamp</option>
                <option value="responseStatus">Status Code</option>
                <option value="requestMethod">Method</option>
                <option value="requestUrl">URL</option>
              </select>

              <select
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value)}
                className="px-2 py-1.5 rounded-md border border-input bg-background text-xs font-mono"
              >
                <option value="desc">DESC (Newest)</option>
                <option value="asc">ASC (Oldest)</option>
              </select>
            </div>
          </div>

          <Button
            type="button"
            size="sm"
            onClick={() => runQuery(1, pagination.limit)}
            disabled={executing || !jsonValid}
            className="gap-2 text-xs font-semibold px-5 w-full sm:w-auto"
          >
            <Play className={`h-3.5 w-3.5 ${executing ? "animate-spin" : "fill-current"}`} />
            <span>{executing ? "Executing Query..." : "Execute MongoDB Query (Ctrl+Enter)"}</span>
          </Button>
        </div>
      </Card>

      {queryError && (
        <div className="flex items-center gap-2 p-3 rounded-lg border border-destructive/30 bg-destructive/10 text-destructive text-xs">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>{queryError}</span>
        </div>
      )}

      {/* Query Aggregations & Status Breakdown */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2.5">
          <div className="p-3 rounded-lg border border-border/80 bg-card">
            <span className="text-[10px] uppercase font-bold text-muted-foreground block">Total Matched</span>
            <span className="text-lg font-bold font-mono tracking-tight text-foreground">
              {stats.totalMatched ?? pagination.total}
            </span>
          </div>

          <div className="p-3 rounded-lg border border-emerald-500/20 bg-emerald-500/5">
            <span className="text-[10px] uppercase font-bold text-emerald-600 dark:text-emerald-400 block">2xx Success</span>
            <span className="text-lg font-bold font-mono tracking-tight text-emerald-600 dark:text-emerald-400">
              {stats.byStatus?.["2xx"] || 0}
            </span>
          </div>

          <div className="p-3 rounded-lg border border-sky-500/20 bg-sky-500/5">
            <span className="text-[10px] uppercase font-bold text-sky-600 dark:text-sky-400 block">3xx Redirects</span>
            <span className="text-lg font-bold font-mono tracking-tight text-sky-600 dark:text-sky-400">
              {stats.byStatus?.["3xx"] || 0}
            </span>
          </div>

          <div className="p-3 rounded-lg border border-amber-500/20 bg-amber-500/5">
            <span className="text-[10px] uppercase font-bold text-amber-600 dark:text-amber-400 block">4xx Client Errors</span>
            <span className="text-lg font-bold font-mono tracking-tight text-amber-600 dark:text-amber-400">
              {stats.byStatus?.["4xx"] || 0}
            </span>
          </div>

          <div className="p-3 rounded-lg border border-rose-500/20 bg-rose-500/5">
            <span className="text-[10px] uppercase font-bold text-rose-600 dark:text-rose-400 block">5xx Server Errors</span>
            <span className="text-lg font-bold font-mono tracking-tight text-rose-600 dark:text-rose-400">
              {stats.byStatus?.["5xx"] || 0}
            </span>
          </div>

          <div className="p-3 rounded-lg border border-border/80 bg-card">
            <span className="text-[10px] uppercase font-bold text-muted-foreground block">Query Latency</span>
            <span className="text-lg font-bold font-mono tracking-tight text-primary">
              {execTimeMs ?? 0} ms
            </span>
          </div>
        </div>
      )}

      {/* Query Results Table */}
      <Card>
        <CardHeader className="p-4 border-b border-border flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-primary" />
            <CardTitle className="text-sm font-semibold">
              Query Document Results ({pagination.total.toLocaleString()} total)
            </CardTitle>
          </div>
          <span className="text-xs text-muted-foreground font-mono">
            Page {pagination.page} of {pagination.totalPages}
          </span>
        </CardHeader>

        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead className="bg-muted/40 border-b border-border text-muted-foreground uppercase text-[10px] font-semibold tracking-wider">
                <tr>
                  <th className="py-2.5 px-3">Timestamp</th>
                  <th className="py-2.5 px-3">Method</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Request URL / Route</th>
                  <th className="py-2.5 px-3">Client IP</th>
                  <th className="py-2.5 px-3">Origin / Host</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border font-mono">
                {executing ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-muted-foreground">
                      <RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2 text-primary" />
                      <span>Evaluating query filter...</span>
                    </td>
                  </tr>
                ) : logs.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-muted-foreground font-sans text-xs">
                      No logs matched the current MongoDB filter or date selection.
                    </td>
                  </tr>
                ) : (
                  logs.map((row, idx) => {
                    const timeStr = row.createdAt
                      ? new Date(row.createdAt).toLocaleTimeString()
                      : "-";
                    const ip = row.ipAddress?.clientIp || row.ipAddress || "-";

                    return (
                      <tr
                        key={row._id || idx}
                        onClick={() => setSelectedDoc(row)}
                        className="hover:bg-muted/40 cursor-pointer transition-colors"
                      >
                        <td className="py-2.5 px-3 text-muted-foreground whitespace-nowrap text-[11px]">
                          {timeStr}
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold border ${getMethodBadgeClass(
                                row.requestMethod
                              )}`}
                            >
                              {row.requestMethod || "GET"}
                            </span>
                            {hasEncryptedFields(row) && (
                              <span
                                className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-purple-500/15 text-purple-400 border border-purple-500/30 flex items-center gap-1"
                                title="Contains encrypted confidential data"
                              >
                                <Lock className="h-2.5 w-2.5" />
                                Encrypted
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold border ${getStatusBadgeClass(
                              row.responseStatus
                            )}`}
                          >
                            {row.responseStatus || 200}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-foreground font-medium truncate max-w-[280px]" title={row.requestUrl}>
                          {row.requestUrl}
                        </td>
                        <td className="py-2.5 px-3 text-muted-foreground whitespace-nowrap text-[11px]">
                          {typeof ip === "object" ? JSON.stringify(ip) : ip}
                        </td>
                        <td className="py-2.5 px-3 text-muted-foreground truncate max-w-[140px]" title={row.origin}>
                          {row.origin || "-"}
                        </td>
                        <td className="py-2.5 px-3 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1">
                            {hasEncryptedFields(row) && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenReasonModal(row);
                                }}
                                className="h-6 px-2 text-[11px] gap-1 text-purple-400 hover:text-purple-300 hover:bg-purple-500/10 font-sans"
                                title="Decrypt confidential fields in this archived log"
                              >
                                <KeyRound className="h-3 w-3" />
                                <span>Decrypt</span>
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedDoc(row);
                              }}
                              className="h-6 px-2 text-[11px] gap-1 hover:text-primary font-sans"
                            >
                              <span>Inspect</span>
                              <ChevronRight className="h-3 w-3" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Toolbar */}
          <div className="p-3 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground font-mono">
                Showing {pagination.total > 0 ? ((pagination.page - 1) * pagination.limit + 1).toLocaleString() : 0} -{" "}
                {Math.min(pagination.page * pagination.limit, pagination.total).toLocaleString()} of{" "}
                {pagination.total.toLocaleString()} records
              </span>

              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span>Rows:</span>
                <select
                  value={pagination.limit}
                  onChange={(e) => runQuery(1, Number(e.target.value))}
                  className="h-7 py-0 px-2 text-xs rounded-md border border-input bg-background font-mono focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>
            </div>

            <Pagination
              pagination={pagination}
              onPageChange={(p) => runQuery(p, pagination.limit)}
              buttonsOnly={true}
            />
          </div>
        </CardContent>
      </Card>

      {/* Document Inspector Modal */}
      <Dialog open={!!selectedDoc} onClose={() => setSelectedDoc(null)} className="max-w-3xl">
        <DialogHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 min-w-0">
            <div className="flex items-center gap-2 flex-wrap min-w-0 flex-1">
              <span
                className={`px-2 py-0.5 rounded text-xs font-bold border font-mono shrink-0 ${getMethodBadgeClass(
                  selectedDoc?.requestMethod
                )}`}
              >
                {selectedDoc?.requestMethod || "GET"}
              </span>
              <span
                className={`px-2 py-0.5 rounded text-xs font-bold border font-mono shrink-0 ${getStatusBadgeClass(
                  selectedDoc?.responseStatus
                )}`}
              >
                {selectedDoc?.responseStatus || 200}
              </span>
              <DialogTitle className="text-xs sm:text-sm font-mono break-all min-w-0 flex-1">
                {selectedDoc?.requestUrl}
              </DialogTitle>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={handleCopyDoc}
              className="gap-1.5 text-xs mr-6 shrink-0 self-start sm:self-auto"
            >
              {copiedDoc ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
              <span>{copiedDoc ? "Copied JSON!" : "Copy Document"}</span>
            </Button>
          </div>
          <DialogDescription className="text-xs font-mono break-all">
            Document ID: {selectedDoc?._id || "in-memory-doc"} • Timestamp: {selectedDoc?.createdAt}
          </DialogDescription>

          {hasEncryptedFields(selectedDoc) && (
            <div className="pt-2 flex flex-wrap items-center justify-between gap-2 border-t border-border/60 mt-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleOpenReasonModal(selectedDoc)}
                disabled={decrypting}
                className="h-7 text-[11px] gap-1.5 text-purple-600 dark:text-purple-400 border-purple-500/30 bg-purple-500/10 hover:bg-purple-500/20"
              >
                {decrypting ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <KeyRound className="h-3.5 w-3.5" />
                )}
                <span>
                  {decrypting
                    ? "Decrypting Fields..."
                    : `Decrypt Confidential Fields (${countEncryptedFields(selectedDoc)} Encrypted)`}
                </span>
              </Button>
              <span className="text-[11px] text-muted-foreground">
                Requires administrator justification • Logged to security audit trail
              </span>
            </div>
          )}

          {decryptSuccessMsg && (
            <div className="p-2 rounded border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-xs flex items-center gap-1.5 mt-1 font-sans">
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
              <span>{decryptSuccessMsg}</span>
            </div>
          )}
        </DialogHeader>

        <div className="py-2">
          <JsonViewer data={selectedDoc} title="MongoDB Log Document Snapshot" />
        </div>

        <DialogFooter className="flex items-center justify-between w-full">
          <div>
            {hasEncryptedFields(selectedDoc) && (
              <Button
                size="sm"
                onClick={() => handleOpenReasonModal(selectedDoc)}
                disabled={decrypting}
                className="h-8 text-xs gap-1.5 bg-purple-600 hover:bg-purple-700 text-white"
              >
                <KeyRound className="h-3.5 w-3.5" />
                <span>Decrypt Payload</span>
              </Button>
            )}
          </div>
          <Button variant="outline" size="sm" onClick={() => setSelectedDoc(null)}>
            Close
          </Button>
        </DialogFooter>
      </Dialog>

      {/* Decryption Justification Modal */}
      <DecryptionReasonModal
        isOpen={reasonModalOpen}
        onClose={() => setReasonModalOpen(false)}
        selectedRow={targetDocForDecryption || selectedDoc}
        decryptionReason={decryptionReason}
        setDecryptionReason={setDecryptionReason}
        reasonError={reasonError}
        setReasonError={setReasonError}
        decrypting={decrypting}
        onConfirmDecryption={handleConfirmDecryption}
      />

      {/* Decryption Audit Trail History Modal */}
      <DecryptionAuditModal
        isOpen={auditModalOpen}
        onClose={() => setAuditModalOpen(false)}
        auditLogs={auditLogs}
        auditLoading={auditLoading}
        auditSearch={auditSearch}
        setAuditSearch={setAuditSearch}
        auditPagination={auditPagination}
        fetchAuditLogs={fetchAuditLogs}
      />

      {/* GitHub Archival Setup Modal */}
      <GitHubArchiveModal
        isOpen={isGithubModalOpen}
        onClose={() => setIsGithubModalOpen(false)}
        onArchivedSuccess={() => {
          fetchArchivesList();
          runQuery(1, pagination.limit);
        }}
      />
    </div>
  );
}

export default ArchiveExplorerView;
