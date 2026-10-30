import React from "react";
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "../ui/dialog";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Badge } from "../ui/badge";
import { ShieldCheck, Search, RefreshCw } from "lucide-react";

export function DecryptionAuditModal({
  isOpen,
  onClose,
  auditLogs = [],
  auditLoading = false,
  auditSearch = "",
  setAuditSearch,
  auditPagination = { page: 1, totalPages: 1, total: 0 },
  fetchAuditLogs,
}) {
  return (
    <Dialog
      open={isOpen}
      onClose={onClose}
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
              onKeyDown={(e) => e.key === "Enter" && fetchAuditLogs && fetchAuditLogs(1)}
              className="pl-8 h-8 text-xs"
            />
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchAuditLogs && fetchAuditLogs(auditPagination.page)}
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
        <Button variant="outline" size="sm" onClick={onClose} className="h-8 text-xs">
          Close
        </Button>
      </DialogFooter>
    </Dialog>
  );
}

export default DecryptionAuditModal;
