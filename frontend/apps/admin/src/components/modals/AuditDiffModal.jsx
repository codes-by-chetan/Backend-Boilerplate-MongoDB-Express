import React from "react";
import { Dialog, DialogHeader, DialogTitle, DialogDescription } from "../ui/dialog";
import { Badge } from "../ui/badge";
import { JsonViewer } from "../common/JsonViewer";
import { GitCommit } from "lucide-react";
import { getActionVariant } from "../audits/DbAuditsTable";

export function AuditDiffModal({
  selectedAudit,
  isOpen,
  onClose,
}) {
  if (!selectedAudit) return null;

  return (
    <Dialog open={isOpen} onClose={onClose} className="max-w-3xl">
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
  );
}

export default AuditDiffModal;
