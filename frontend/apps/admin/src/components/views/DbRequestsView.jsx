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
  Database,
  Search,
  RefreshCw,
  Clock,
  User,
  AlertTriangle,
  Eye,
} from "lucide-react";
import { api } from "../../api/client";

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
        </form>
      </Card>

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
    </div>
  );
}
