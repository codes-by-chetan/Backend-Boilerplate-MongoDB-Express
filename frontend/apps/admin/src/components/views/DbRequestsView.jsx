import React, { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "../ui/card";
import { Database, AlertTriangle, CheckCircle2 } from "lucide-react";
import { api } from "../../api/client";
import { findEncryptedFieldPaths } from "../../lib/utils";
import { DbRequestsFilters } from "../requests/DbRequestsFilters";
import { DbRequestsTable } from "../requests/DbRequestsTable";
import { RequestInspectModal } from "../modals/RequestInspectModal";
import { DecryptionReasonModal } from "../modals/DecryptionReasonModal";
import { DecryptionAuditModal } from "../modals/DecryptionAuditModal";

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

  return (
    <div className="space-y-4">
      {/* Filters Toolbar */}
      <Card className="p-4">
        <DbRequestsFilters
          search={search}
          setSearch={setSearch}
          methodFilter={methodFilter}
          setMethodFilter={setMethodFilter}
          statusFilter={statusFilter}
          setStatusFilter={setStatusFilter}
          statusCodeFilter={statusCodeFilter}
          setStatusCodeFilter={setStatusCodeFilter}
          onSearchSubmit={handleSearchSubmit}
          onOpenAuditModal={handleOpenAuditModal}
          onRefresh={() => fetchLogs(pagination.page, pagination.limit)}
          loading={loading}
        />
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
          <DbRequestsTable
            logs={logs}
            loading={loading}
            pagination={pagination}
            onSelectRow={(row) => setSelectedRow(row)}
            onPageChange={(p) => fetchLogs(p, pagination.limit)}
            onLimitChange={(l) => fetchLogs(1, l)}
          />
        </CardContent>
      </Card>

      {/* Row details inspect modal */}
      <RequestInspectModal
        isOpen={!!selectedRow}
        onClose={() => setSelectedRow(null)}
        selectedRow={selectedRow}
        hasEncryptedFields={hasEncryptedFields}
        onOpenReasonModal={handleOpenReasonModal}
        decrypting={decrypting}
      />

      {/* Decryption Justification Modal */}
      <DecryptionReasonModal
        isOpen={reasonModalOpen}
        onClose={() => setReasonModalOpen(false)}
        selectedRow={selectedRow}
        decryptionReason={decryptionReason}
        setDecryptionReason={setDecryptionReason}
        reasonError={reasonError}
        setReasonError={setReasonError}
        decrypting={decrypting}
        onConfirmDecryption={handleConfirmDecryption}
      />

      {/* Decryption Audit Trail Modal */}
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
    </div>
  );
}

export default DbRequestsView;
