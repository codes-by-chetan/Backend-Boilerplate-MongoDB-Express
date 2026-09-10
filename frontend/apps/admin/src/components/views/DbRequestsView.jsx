import React, { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Badge } from "../ui/badge";
import { Select } from "../ui/select";
import { Pagination } from "../common/Pagination";
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "../ui/dialog";
import { JsonViewer } from "../common/JsonViewer";
import {
  Database,
  Search,
  RefreshCw,
  Clock,
  User,
  AlertTriangle,
  Eye,
  KeyRound,
  Loader2,
  Unlock,
  ShieldCheck,
  FileText,
  Lock,
  Shield,
  CheckCircle2,
} from "lucide-react";
import { api } from "../../api/client";
import { findEncryptedFieldPaths } from "../../lib/utils";

export function DbRequestsView() {
  const [logs, setLogs] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, totalItems: 0, limit: 20 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [methodFilter, setMethodFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [statusCodeFilter, setStatusCodeFilter] = useState("");
  const [selectedRow, setSelectedRow] = useState(null);

  // Decryption justification modal state
  const [reasonModalOpen, setReasonModalOpen] = useState(false);
  const [decryptionReason, setDecryptionReason] = useState("");
  const [reasonError, setReasonError] = useState("");
  const [decrypting, setDecrypting] = useState(false);
  const [decryptSuccessMsg, setDecryptSuccessMsg] = useState("");

  // Decryption audit history modal state
  const [auditModalOpen, setAuditModalOpen] = useState(false);
  const [auditLogs, setAuditLogs] = useState([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditSearch, setAuditSearch] = useState("");
  const [auditPagination, setAuditPagination] = useState({ page: 1, totalPages: 1, total: 0 });

  const hasEncryptedFields = (row) => {
    if (!row) return false;
    const str = JSON.stringify(row);
    return str.includes("[ENCRYPTED:enc:");
  };

  const handleOpenReasonModal = () => {
    setDecryptionReason("");
    setReasonError("");
    setReasonModalOpen(true);
  };

  const handleConfirmDecryption = async () => {
    if (!selectedRow) return;
    if (!decryptionReason || decryptionReason.trim().length < 5) {
      setReasonError("A valid justification/reason of at least 5 characters is required by security policy.");
      return;
    }

    setDecrypting(true);
    setReasonError("");
    try {
      const jsonStr = JSON.stringify(selectedRow);
      const encRegex = /\[ENCRYPTED:(enc:[a-f0-9]+:[a-f0-9]+:[a-f0-9]+)\]/g;
      const matches = [...jsonStr.matchAll(encRegex)];
      if (matches.length === 0) return;

      // Extract accurate recursive database key paths (requestBody.*, responseBody.data.*, requestHeaders.*, etc.)
      const discovered = findEncryptedFieldPaths(selectedRow);
      const items = [];
      const seenCiphers = new Set();

      for (const it of discovered) {
        if (it && it.cipherText && !seenCiphers.has(it.cipherText)) {
          items.push(it);
          seenCiphers.add(it.cipherText);
        }
      }

      // Catch any remaining ciphers that weren't matched by recursive traversal
      matches.forEach((m, idx) => {
        const cipherText = m[1];
        if (!seenCiphers.has(cipherText)) {
          items.push({ fieldName: `field_${idx + 1}`, cipherText });
          seenCiphers.add(cipherText);
        }
      });

      // Send ONE single batch request to backend
      const payload = {
        reason: decryptionReason.trim(),
        logId: selectedRow._id,
      };

      // If logId exists and items is large (e.g. inspecting bulk query logs with thousands of entries),
      // the backend resolves all fields directly from the MongoDB record to avoid multi-megabyte payloads.
      if (!selectedRow._id || items.length <= 50) {
        payload.items = items;
      }

      const res = await api.decryptLogFields(payload);

      const decryptedResults = res.data?.decryptedResults || [];
      let updatedStr = jsonStr;
      for (const item of decryptedResults) {
        if (item.plainText) {
          const fullToken = `[ENCRYPTED:${item.cipherText}]`;
          updatedStr = updatedStr.replaceAll(fullToken, `[DECRYPTED: ${item.plainText}]`);
        }
      }

      setSelectedRow(JSON.parse(updatedStr));
      setReasonModalOpen(false);
      setDecryptSuccessMsg(
        `Successfully decrypted ${res.data?.fieldsCount || items.length} confidential field(s) with a single audit entry recorded.`
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

  const fetchLogs = async (page = 1, limit = 20) => {
    setLoading(true);
    setError("");
    try {
      const params = {
        page,
        limit,
        ...(search && { search }),
        ...(methodFilter && { method: methodFilter }),
        ...(statusFilter && { status: statusFilter }),
        ...(statusCodeFilter && { statusCode: statusCodeFilter }),
      };
      const res = await api.getDbRequestLogs(params);
      const data = res.data || res;
      setLogs(data.logs || data.items || (Array.isArray(data) ? data : []));
      if (data.pagination) {
        setPagination({
          page: data.pagination.page,
          limit: data.pagination.limit,
          totalPages: data.pagination.totalPages || 1,
          totalItems: data.pagination.total || 0,
        });
      }
    } catch (err) {
      setError(err.message || "Failed to load database request logs");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs(1, pagination.limit);
  }, [methodFilter, statusFilter, statusCodeFilter]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchLogs(1, pagination.limit);
  };

  const getMethodVariant = (method = "GET") => {
    const m = (method || "GET").toLowerCase();
    if (["get", "post", "put", "patch", "delete"].includes(m)) return m;
    return "default";
  };

  const getStatusVariant = (status) => {
    const s = Number(status);
    if (s >= 200 && s < 300) return "success";
    if (s >= 300 && s < 400) return "info";
    if (s >= 400 && s < 500) return "warning";
    if (s >= 500) return "destructive";
    return "secondary";
  };

  return (
    <div className="space-y-4">
      {/* Filters Toolbar */}
      <Card className="p-4">
        <form onSubmit={handleSearchSubmit} className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-48 sm:w-60">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search URL, IP, errors..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 h-8 text-xs"
              />
            </div>

            <Select
              value={methodFilter}
              onChange={(e) => setMethodFilter(e.target.value)}
              className="h-8 text-xs"
            >
              <option value="">All Methods</option>
              <option value="GET">GET</option>
              <option value="POST">POST</option>
              <option value="PUT">PUT</option>
              <option value="DELETE">DELETE</option>
              <option value="PATCH">PATCH</option>
            </Select>

            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-8 text-xs"
            >
              <option value="">All Statuses</option>
              <option value="Successful">Successful</option>
              <option value="Failed">Failed</option>
            </Select>

            <Select
              value={statusCodeFilter}
              onChange={(e) => setStatusCodeFilter(e.target.value)}
              className="h-8 text-xs"
            >
              <option value="">All Codes</option>
              <option value="200">200 OK</option>
              <option value="201">201 Created</option>
              <option value="400">400 Bad Request</option>
              <option value="401">401 Unauthorized</option>
              <option value="403">403 Forbidden</option>
              <option value="404">404 Not Found</option>
              <option value="500">500 Server Error</option>
            </Select>

            <Button type="submit" size="sm" className="h-8 text-xs">
              Filter
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleOpenAuditModal}
              className="h-8 text-xs gap-1.5 text-purple-600 dark:text-purple-400 border-purple-500/30 hover:bg-purple-500/10 hover:border-purple-500/60"
              title="View immutable security decryption audit trail"
            >
              <ShieldCheck className="h-3.5 w-3.5" />
              <span>Decryption Audits</span>
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fetchLogs(pagination.page, pagination.limit)}
              disabled={loading}
              className="h-8 text-xs gap-1.5"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              <span>Refresh</span>
            </Button>
          </div>
        </form>
      </Card>

      {decryptSuccessMsg && (
        <div className="flex items-center gap-2 p-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs animate-in fade-in">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{decryptSuccessMsg}</span>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg border border-destructive/30 bg-destructive/10 text-destructive text-xs">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Table */}
      <Card>
        <CardHeader className="p-4 border-b border-border flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <Database className="h-4 w-4 text-primary" />
            <CardTitle className="text-sm font-semibold">MongoDB HTTP Request Logs</CardTitle>
          </div>
          <span className="text-xs text-muted-foreground">
            {pagination.totalItems} logged requests
          </span>
        </CardHeader>

        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-muted/40 border-b border-border text-[11px] text-muted-foreground uppercase font-semibold">
                <tr>
                  <th className="py-2.5 px-4">Method</th>
                  <th className="py-2.5 px-4">Status</th>
                  <th className="py-2.5 px-4">URL</th>
                  <th className="py-2.5 px-4">Client IP</th>
                  <th className="py-2.5 px-4">User</th>
                  <th className="py-2.5 px-4">Timestamp</th>
                  <th className="py-2.5 px-4 text-right">Inspect</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-muted-foreground">
                      Loading database request records...
                    </td>
                  </tr>
                ) : logs.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-muted-foreground">
                      No request records found in database matching your filter.
                    </td>
                  </tr>
                ) : (
                  logs.map((row, idx) => {
                    const method = row.requestMethod || row.method || "GET";
                    const url = row.requestUrl || row.route || row.url || "/";
                    const status = row.responseStatus || row.statusCode || row.requestStatus || 200;
                    const ip = typeof row.ipAddress === "object" ? row.ipAddress?.clientIp || "127.0.0.1" : row.ipAddress || row.ip || "127.0.0.1";
                    const userEmail = row.user?.email || (typeof row.user === "string" ? row.user : "Guest");

                    return (
                      <tr
                        key={row._id || idx}
                        className="hover:bg-muted/40 transition-colors"
                      >
                        <td className="py-2 px-4 whitespace-nowrap">
                          <Badge variant={getMethodVariant(method)}>
                            {method}
                          </Badge>
                        </td>
                        <td className="py-2 px-4 whitespace-nowrap">
                          <Badge variant={getStatusVariant(status)}>
                            {status}
                          </Badge>
                        </td>
                        <td className="py-2 px-4 font-semibold text-foreground max-w-xs truncate">
                          {url}
                        </td>
                        <td className="py-2 px-4 whitespace-nowrap text-muted-foreground">
                          {ip}
                        </td>
                        <td className="py-2 px-4 whitespace-nowrap text-muted-foreground">
                          {userEmail}
                        </td>
                        <td className="py-2 px-4 whitespace-nowrap text-muted-foreground text-[11px]">
                          {new Date(row.createdAt || row.timestamp || Date.now()).toLocaleString()}
                        </td>
                        <td className="py-2 px-4 whitespace-nowrap text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSelectedRow(row)}
                            className="h-6 text-[10px] gap-1"
                          >
                            <Eye className="h-3 w-3" />
                            <span>Inspect</span>
                          </Button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="p-4">
            <Pagination
              pagination={pagination}
              onPageChange={(p) => fetchLogs(p, pagination.limit)}
              onLimitChange={(l) => fetchLogs(1, l)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Row details modal */}
      {selectedRow && (
        <Dialog open={!!selectedRow} onClose={() => setSelectedRow(null)} className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Badge variant={getMethodVariant(selectedRow.requestMethod || selectedRow.method)}>
                {selectedRow.requestMethod || selectedRow.method}
              </Badge>
              <span className="font-mono text-sm">{selectedRow.requestUrl || selectedRow.url}</span>
              <Badge variant={getStatusVariant(selectedRow.responseStatus || selectedRow.statusCode)}>
                {selectedRow.responseStatus || selectedRow.statusCode}
              </Badge>
            </DialogTitle>
            <DialogDescription>
              Database record ID: {selectedRow._id} | Recorded at {new Date(selectedRow.createdAt || selectedRow.timestamp).toLocaleString()}
            </DialogDescription>
            {hasEncryptedFields(selectedRow) && (
              <div className="pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleOpenReasonModal}
                  disabled={decrypting}
                  className="h-7 text-[11px] gap-1.5 text-purple-600 dark:text-purple-400 border-purple-500/30 bg-purple-500/10 hover:bg-purple-500/20"
                >
                  {decrypting ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <KeyRound className="h-3.5 w-3.5" />
                  )}
                  <span>{decrypting ? "Decrypting Payload..." : "Decrypt Confidential Fields (Master Key)"}</span>
                </Button>
              </div>
            )}
          </DialogHeader>

          <div className="space-y-4 py-3">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <div className="p-2 rounded bg-muted/40 border border-border">
                <span className="text-muted-foreground block text-[10px] uppercase font-bold">Status</span>
                <span className="font-mono font-semibold">{selectedRow.requestStatus || "Completed"}</span>
              </div>
              <div className="p-2 rounded bg-muted/40 border border-border">
                <span className="text-muted-foreground block text-[10px] uppercase font-bold">Client IP</span>
                <span className="font-mono font-semibold">
                  {typeof selectedRow.ipAddress === "object" ? selectedRow.ipAddress?.clientIp || "127.0.0.1" : selectedRow.ipAddress || "127.0.0.1"}
                </span>
              </div>
              <div className="p-2 rounded bg-muted/40 border border-border">
                <span className="text-muted-foreground block text-[10px] uppercase font-bold">User</span>
                <span className="font-mono font-semibold truncate block">
                  {selectedRow.user?.email || "Guest"}
                </span>
              </div>
              <div className="p-2 rounded bg-muted/40 border border-border">
                <span className="text-muted-foreground block text-[10px] uppercase font-bold">Type</span>
                <span className="font-mono font-semibold">
                  {selectedRow.requestType || "REST"}
                </span>
              </div>
            </div>

            {selectedRow.errors && (
              <div className="p-3 rounded-lg border border-destructive/30 bg-destructive/10 text-destructive text-xs font-mono">
                <strong>Error: </strong> {selectedRow.errors}
              </div>
            )}

            {selectedRow.requestBody && (
              <JsonViewer data={selectedRow.requestBody} title="Request Body Payload" />
            )}

            {selectedRow.responseBody && (
              <JsonViewer data={selectedRow.responseBody} title="Response Body Payload" />
            )}

            {selectedRow.requestHeaders && (
              <JsonViewer data={selectedRow.requestHeaders} title="Request Headers" />
            )}

            <JsonViewer data={selectedRow} title="Complete Document from MongoDB" />
          </div>
        </Dialog>
      )}

      {/* Decryption Justification Modal */}
      <Dialog
        open={reasonModalOpen}
        onClose={() => !decrypting && setReasonModalOpen(false)}
        className="max-w-md"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5 text-purple-500" />
            <span>Confidential Data Decryption Justification</span>
          </DialogTitle>
          <DialogDescription>
            Target: <span className="font-mono text-xs font-semibold text-foreground">{selectedRow?.requestMethod} {selectedRow?.requestUrl}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-3 text-xs">
          <div className="p-3 rounded-lg border border-purple-500/30 bg-purple-500/10 text-purple-700 dark:text-purple-300 space-y-1">
            <div className="flex items-center gap-1.5 font-semibold">
              <Shield className="h-4 w-4 shrink-0" />
              <span>Security Compliance & Audit Policy</span>
            </div>
            <p className="text-[11px] leading-relaxed opacity-90">
              Decryption of confidential fields (raw credentials, tokens, session cookies) is an auditable operation. Your Administrator account, client IP address, and stated justification will be permanently saved to the security audit trail.
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="font-semibold text-foreground flex items-center justify-between">
              <span>Reason / Justification for Decryption *</span>
              <span className={`text-[10px] font-mono ${decryptionReason.trim().length >= 5 ? "text-emerald-500" : "text-muted-foreground"}`}>
                {decryptionReason.trim().length}/5 min characters
              </span>
            </label>
            <textarea
              rows={3}
              value={decryptionReason}
              onChange={(e) => {
                setDecryptionReason(e.target.value);
                if (reasonError) setReasonError("");
              }}
              placeholder="e.g., Investigating user authentication failure incident #402, authorized security review..."
              className="w-full p-2.5 text-xs rounded-md border border-input bg-background focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
              disabled={decrypting}
            />
            {reasonError && (
              <p className="text-[11px] text-destructive flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                <span>{reasonError}</span>
              </p>
            )}
          </div>
        </div>

        <DialogFooter className="pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setReasonModalOpen(false)}
            disabled={decrypting}
          >
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleConfirmDecryption}
            disabled={decrypting || decryptionReason.trim().length < 5}
            className="bg-purple-600 hover:bg-purple-700 text-white gap-1.5"
          >
            {decrypting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <KeyRound className="h-3.5 w-3.5" />
            )}
            <span>{decrypting ? "Authorizing & Decrypting..." : "Authorize & Decrypt"}</span>
          </Button>
        </DialogFooter>
      </Dialog>

      {/* Decryption Audit Trail Modal */}
      <Dialog
        open={auditModalOpen}
        onClose={() => setAuditModalOpen(false)}
        className="max-w-4xl"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-purple-500" />
            <span>Confidential Decryption Audit Trail</span>
          </DialogTitle>
          <DialogDescription>
            Permanent immutable record of all confidential data decryptions performed by administrators.
          </DialogDescription>
        </DialogHeader>

        <div className="py-3 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="relative w-64">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Filter by admin, reason, URL..."
                value={auditSearch}
                onChange={(e) => setAuditSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && fetchAuditLogs(1)}
                className="pl-8 h-8 text-xs"
              />
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchAuditLogs(auditPagination.page)}
              disabled={auditLoading}
              className="h-8 text-xs gap-1.5"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${auditLoading ? "animate-spin" : ""}`} />
              <span>Refresh</span>
            </Button>
          </div>

          <div className="rounded-lg border border-border overflow-hidden">
            <div className="overflow-x-auto max-h-[50vh]">
              <table className="w-full text-xs text-left">
                <thead className="bg-muted/50 border-b border-border text-muted-foreground font-semibold uppercase text-[10px] sticky top-0">
                  <tr>
                    <th className="py-2.5 px-3">Timestamp</th>
                    <th className="py-2.5 px-3">Decrypted By</th>
                    <th className="py-2.5 px-3">Request URL</th>
                    <th className="py-2.5 px-3">Decrypted Fields</th>
                    <th className="py-2.5 px-3 text-center">Count</th>
                    <th className="py-2.5 px-3 min-w-[200px]">Justification / Reason</th>
                    <th className="py-2.5 px-3">Admin IP</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {auditLoading ? (
                    <tr>
                      <td colSpan={7} className="py-10 text-center text-muted-foreground">
                        <RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2 text-primary" />
                        Loading decryption audit trail...
                      </td>
                    </tr>
                  ) : auditLogs.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-muted-foreground text-xs">
                        No confidential decryption records found.
                      </td>
                    </tr>
                  ) : (
                    auditLogs.map((a) => (
                      <tr key={a._id} className="hover:bg-muted/30 transition-colors">
                        <td className="py-2.5 px-3 whitespace-nowrap text-[11px] text-muted-foreground font-mono">
                          {new Date(a.createdAt).toLocaleString()}
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="font-medium text-foreground">{a.decryptedBy?.fullNameString || a.decryptedByEmail}</div>
                          <div className="text-[10px] text-muted-foreground font-mono">{a.decryptedByEmail}</div>
                        </td>
                        <td className="py-2.5 px-3 font-mono text-[11px] text-primary truncate max-w-[160px]" title={a.logUrl}>
                          {a.logUrl || "—"}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-[10px]">
                          {Array.isArray(a.fields) && a.fields.length > 0 ? (
                            <div className="flex flex-wrap gap-1 max-w-[320px]">
                              {a.fields.slice(0, 10).map((f, fi) => (
                                <Badge key={fi} variant="outline" className="text-[10px] px-1.5 py-0 font-normal bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30">
                                  {f}
                                </Badge>
                              ))}
                              {a.fields.length > 10 && (
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-normal text-muted-foreground bg-muted/40" title={`${a.fields.length - 10} more fields`}>
                                  +{a.fields.length - 10} more
                                </Badge>
                              )}
                            </div>
                          ) : (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-normal">
                              {a.fieldName || "payload"}
                            </Badge>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span className="inline-flex items-center justify-center px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/30">
                            {a.fieldsCount || a.fields?.length || 1}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-[11px] text-foreground">
                          <span className="font-medium text-foreground italic">"{a.reason}"</span>
                        </td>
                        <td className="py-2.5 px-3 font-mono text-[11px] text-muted-foreground whitespace-nowrap">
                          {a.ipAddress || "—"}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <DialogFooter className="flex items-center justify-between sm:justify-between w-full pt-2">
          <span className="text-xs text-muted-foreground">
            Total Records: <strong className="text-foreground">{auditPagination.total}</strong>
          </span>
          <Button variant="outline" size="sm" onClick={() => setAuditModalOpen(false)} className="h-8 text-xs">
            Close
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}
