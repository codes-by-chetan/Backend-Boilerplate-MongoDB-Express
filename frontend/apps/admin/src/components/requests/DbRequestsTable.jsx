import React from "react";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Pagination } from "../common/Pagination";
import { Eye } from "lucide-react";

export const getMethodVariant = (method = "GET") => {
  const m = (method || "GET").toLowerCase();
  if (["get", "post", "put", "patch", "delete"].includes(m)) return m;
  return "default";
};

export const getStatusVariant = (status) => {
  const s = Number(status);
  if (s >= 200 && s < 300) return "success";
  if (s >= 300 && s < 400) return "info";
  if (s >= 400 && s < 500) return "warning";
  if (s >= 500) return "destructive";
  return "secondary";
};

export function DbRequestsTable({
  logs = [],
  loading = false,
  pagination = {},
  onSelectRow,
  onPageChange,
  onLimitChange,
}) {
  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full text-xs text-left">
          <thead className="bg-muted/50 border-b border-border text-muted-foreground font-semibold uppercase text-[10px]">
            <tr>
              <th className="py-2.5 px-4">Method</th>
              <th className="py-2.5 px-4">Status</th>
              <th className="py-2.5 px-4">URL</th>
              <th className="py-2.5 px-4">Client IP</th>
              <th className="py-2.5 px-4">User</th>
              <th className="py-2.5 px-4">Timestamp</th>
              <th className="py-2.5 px-4 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
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
                        onClick={() => onSelectRow && onSelectRow(row)}
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
          onPageChange={onPageChange}
          onLimitChange={onLimitChange}
        />
      </div>
    </>
  );
}

export default DbRequestsTable;
