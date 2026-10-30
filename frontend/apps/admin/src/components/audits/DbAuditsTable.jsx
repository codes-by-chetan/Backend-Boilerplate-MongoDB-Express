import React from "react";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Pagination } from "../common/Pagination";
import { Eye } from "lucide-react";

export const getActionVariant = (action = "update") => {
  const a = (action || "update").toLowerCase();
  if (a.includes("insert") || a.includes("create")) return "success";
  if (a.includes("delete") || a.includes("remove")) return "destructive";
  if (a.includes("rollback") || a.includes("restore")) return "warning";
  return "info";
};

export function DbAuditsTable({
  audits = [],
  loading = false,
  pagination = {},
  onSelectAudit,
  onPageChange,
  onLimitChange,
}) {
  return (
    <>
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
                        onClick={() => onSelectAudit && onSelectAudit(row)}
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
          onPageChange={onPageChange}
          onLimitChange={onLimitChange}
        />
      </div>
    </>
  );
}

export default DbAuditsTable;
