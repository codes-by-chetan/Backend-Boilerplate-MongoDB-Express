import React, { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Badge } from "../ui/badge";
import { Select } from "../ui/select";
import { Pagination } from "../common/Pagination";
import { Dialog, DialogHeader, DialogTitle, DialogDescription } from "../ui/dialog";
import { JsonViewer } from "../common/JsonViewer";
import {
  ShieldCheck,
  Search,
  RefreshCw,
  GitCommit,
  AlertTriangle,
  Eye,
} from "lucide-react";
import { api } from "../../api/client";

export function DbAuditsView() {
  const [audits, setAudits] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, totalItems: 0, limit: 20 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [collectionFilter, setCollectionFilter] = useState("");
  const [availableCollections, setAvailableCollections] = useState([]);
  const [selectedAudit, setSelectedAudit] = useState(null);

  const fetchAudits = async (page = 1, limit = 20) => {
    setLoading(true);
    setError("");
    try {
      const params = {
        page,
        limit,
        ...(search && { search }),
        ...(collectionFilter && { collection: collectionFilter }),
        ...(typeFilter && { transactionType: typeFilter }),
        ...(statusFilter && { status: statusFilter }),
      };
      const res = await api.getDbAuditLogs(params);
      const data = res.data || res;
      setAudits(data.logs || data.audits || data.items || (Array.isArray(data) ? data : []));
      if (data.availableCollections) {
        setAvailableCollections(data.availableCollections);
      }
      if (data.pagination) {
        setPagination({
          page: data.pagination.page,
          limit: data.pagination.limit,
          totalPages: data.pagination.totalPages || 1,
          totalItems: data.pagination.total || 0,
        });
      }
    } catch (err) {
      setError(err.message || "Failed to load audit logs from MongoDB");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAudits(1, pagination.limit);
  }, [typeFilter, statusFilter, collectionFilter]);


  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchAudits(1, pagination.limit);
  };

  const getActionVariant = (action = "update") => {
    const a = (action || "update").toLowerCase();
    if (a.includes("insert") || a.includes("create")) return "success";
    if (a.includes("delete") || a.includes("remove")) return "destructive";
    if (a.includes("rollback") || a.includes("restore")) return "warning";
    return "info";
  };

  return (
    <div className="space-y-4">
      {/* Filter toolbar */}
      <Card className="p-4">
        <form onSubmit={handleSearchSubmit} className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-48 sm:w-64">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search collection, details, ID..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 h-8 text-xs"
              />
            </div>

            <Select
              value={collectionFilter}
              onChange={(e) => setCollectionFilter(e.target.value)}
              className="h-8 text-xs"
            >
              <option value="">All Collections</option>
              {availableCollections.map((col) => (
                <option key={col} value={col}>
                  {col}
                </option>
              ))}
            </Select>

            <Select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="h-8 text-xs"
            >

              <option value="">All Mutation Types</option>
              <option value="insert">INSERT</option>
              <option value="update">UPDATE</option>
              <option value="delete">DELETE</option>
              <option value="rollback">ROLLBACK</option>
              <option value="restore">RESTORE</option>
            </Select>

            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-8 text-xs"
            >
              <option value="">All Statuses</option>
              <option value="success">Success</option>
              <option value="failed">Failed</option>
            </Select>

            <Button type="submit" size="sm" className="h-8 text-xs">
              Filter
            </Button>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fetchAudits(pagination.page, pagination.limit)}
            disabled={loading}
            className="h-8 text-xs gap-1.5"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </Button>
        </form>
      </Card>

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg border border-destructive/30 bg-destructive/10 text-destructive text-xs">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Audits Table */}
      <Card>
        <CardHeader className="p-4 border-b border-border flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-primary" />
            <CardTitle className="text-sm font-semibold">MongoDB Mutation Audit Trail</CardTitle>
          </div>
          <span className="text-xs text-muted-foreground">
            {pagination.totalItems} immutable revision records
          </span>
        </CardHeader>

        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-muted/40 border-b border-border text-[11px] text-muted-foreground uppercase font-semibold">
                <tr>
                  <th className="py-2.5 px-4">Time</th>
                  <th className="py-2.5 px-4">Type</th>
                  <th className="py-2.5 px-4">Collection</th>
                  <th className="py-2.5 px-4">Document ID</th>
                  <th className="py-2.5 px-4">Details</th>
                  <th className="py-2.5 px-4">Status</th>
                  <th className="py-2.5 px-4 text-right">Inspect</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-muted-foreground">
                      Loading audit history records...
                    </td>
                  </tr>
                ) : audits.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-muted-foreground">
                      No audit trails found matching your filter criteria.
                    </td>
                  </tr>
                ) : (
                  audits.map((row, idx) => {
                    const collection = row.affectedCollection || row.collectionName || row.modelName || "-";
                    const docId = row.affectedDocumentId || row.documentId || row.docId || "-";
                    const type = row.transactionType || row.action || "UPDATE";
                    const status = row.status || "success";
                    const details = row.transactionDetails || row.summary || (row.diff?.changes?.length ? `${row.diff.changes.length} field(s) modified` : "-");

                    return (
                      <tr
                        key={row._id || idx}
                        className="hover:bg-muted/40 transition-colors"
                      >
                        <td className="py-2.5 px-4 whitespace-nowrap text-muted-foreground text-[11px]">
                          {new Date(row.createdAt || row.timestamp || Date.now()).toLocaleString()}
                        </td>
                        <td className="py-2.5 px-4 whitespace-nowrap">
                          <Badge variant={getActionVariant(type)}>
                            {type.toUpperCase()}
                          </Badge>
                        </td>
                        <td className="py-2.5 px-4 whitespace-nowrap font-semibold text-foreground">
                          {collection}
                        </td>
                        <td className="py-2.5 px-4 whitespace-nowrap text-muted-foreground text-[11px]">
                          {String(docId).slice(-8)}
                        </td>
                        <td className="py-2.5 px-4 max-w-xs truncate text-muted-foreground">
                          {details}
                        </td>
                        <td className="py-2.5 px-4 whitespace-nowrap">
                          <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${
                            status === "success" ? "bg-emerald-500/10 text-emerald-500" : "bg-rose-500/10 text-rose-500"
                          }`}>
                            {status}
                          </span>
                        </td>
                        <td className="py-2.5 px-4 whitespace-nowrap text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSelectedAudit(row)}
                            className="h-6 text-[10px] gap-1"
                          >
                            <Eye className="h-3 w-3" />
                            <span>Diff</span>
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
              onPageChange={(p) => fetchAudits(p, pagination.limit)}
              onLimitChange={(l) => fetchAudits(1, l)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Audit Diff Modal */}
      {selectedAudit && (
        <Dialog open={!!selectedAudit} onClose={() => setSelectedAudit(null)} className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Badge variant={getActionVariant(selectedAudit.transactionType || selectedAudit.action)}>
                {selectedAudit.transactionType || selectedAudit.action}
              </Badge>
              <span className="font-mono text-sm">{selectedAudit.affectedCollection || selectedAudit.modelName}</span>
              <span className="font-mono text-xs text-muted-foreground">
                ({selectedAudit.affectedDocumentId || selectedAudit.documentId})
              </span>
            </DialogTitle>
            <DialogDescription>
              Committed at {new Date(selectedAudit.createdAt || selectedAudit.timestamp).toLocaleString()} by {selectedAudit.user?.email || "System"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-3">
            {/* Diff View if changes array is available */}
            {selectedAudit.diff?.changes?.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <GitCommit className="h-3.5 w-3.5 text-primary" />
                  <span>Field Mutation Diffs ({selectedAudit.diff.changes.length})</span>
                </h4>
                <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-2 font-mono text-xs max-h-60 overflow-y-auto">
                  {selectedAudit.diff.changes.map((ch, i) => (
                    <div key={i} className="flex items-start gap-2 p-1.5 rounded bg-background/50 border border-border/50">
                      <span className={`text-[10px] px-1 rounded font-bold ${
                        ch.type === "added" ? "bg-emerald-500/20 text-emerald-500" :
                        ch.type === "modified" ? "bg-amber-500/20 text-amber-500" :
                        "bg-rose-500/20 text-rose-500"
                      }`}>
                        {ch.type === "added" ? "+" : ch.type === "modified" ? "~" : "-"}
                      </span>
                      <div className="flex-1 overflow-hidden">
                        <span className="font-semibold text-foreground">{ch.field}: </span>
                        {ch.type === "modified" ? (
                          <div className="mt-0.5 space-y-0.5">
                            <span className="text-rose-500 line-through block truncate">
                              - {JSON.stringify(ch.oldValue)}
                            </span>
                            <span className="text-emerald-500 block truncate">
                              + {JSON.stringify(ch.newValue)}
                            </span>
                          </div>
                        ) : ch.type === "added" ? (
                          <span className="text-emerald-500 truncate">
                            {JSON.stringify(ch.newValue)}
                          </span>
                        ) : (
                          <span className="text-rose-500 line-through truncate">
                            {JSON.stringify(ch.oldValue)}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <JsonViewer data={selectedAudit} title="Full Audit Trail Document" />
          </div>
        </Dialog>
      )}
    </div>
  );
}
