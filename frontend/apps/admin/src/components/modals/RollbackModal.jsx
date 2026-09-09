import React, { useState } from "react";
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "../ui/dialog";
import { Button } from "../ui/button";
import { Select } from "../ui/select";
import { RotateCcw, AlertTriangle, CheckCircle2, Sparkles } from "lucide-react";
import { api } from "../../api/client";

export function RollbackModal({ rollbackTarget, onClose, onSuccess }) {
  const [targetVersion, setTargetVersion] = useState(
    rollbackTarget?.version || 1
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  if (!rollbackTarget) return null;

  const maxVersion = Math.max(1, rollbackTarget.maxVersion || 1);

  const handleRollback = async () => {
    setLoading(true);
    setError("");
    setSuccessMsg("");
    try {
      const res = await api.rollbackDocument(
        rollbackTarget.modelName,
        rollbackTarget.docId,
        targetVersion
      );
      setSuccessMsg(res.message || `Successfully rolled back to version ${targetVersion}`);
      setTimeout(() => {
        onSuccess?.();
        onClose();
      }, 1000);
    } catch (err) {
      setError(err.message || "Failed to execute rollback");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={!!rollbackTarget} onClose={() => !loading && onClose()} className="max-w-md">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          {rollbackTarget.isDeleted ? (
            <>
              <Sparkles className="h-4 w-4 text-emerald-500" />
              <span>Resurrect Deleted Document</span>
            </>
          ) : (
            <>
              <RotateCcw className="h-4 w-4 text-amber-500" />
              <span>Rollback Document Revision</span>
            </>
          )}
        </DialogTitle>
        <DialogDescription>
          Target: <strong className="text-foreground">{rollbackTarget.title}</strong> (
          {rollbackTarget.modelName})
        </DialogDescription>
      </DialogHeader>

      <div className="py-3 space-y-4 text-xs">
        {error && (
          <div className="flex items-center gap-2 p-3 rounded-lg border border-destructive/30 bg-destructive/10 text-destructive text-xs">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div className="flex items-center gap-2 p-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-500 text-xs">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        <div className="space-y-1.5">
          <label className="font-semibold text-foreground">Select Version to Restore:</label>
          <Select
            value={targetVersion}
            onChange={(e) => setTargetVersion(Number(e.target.value))}
            className="w-full text-xs font-semibold"
            disabled={loading}
          >
            {Array.from({ length: maxVersion }, (_, i) => i + 1).map((v) => (
              <option key={v} value={v}>
                Restore to Version {v}
              </option>
            ))}
          </Select>
        </div>

        <div className="p-3 rounded-lg border border-border bg-muted/40 space-y-1.5">
          {rollbackTarget.isDeleted ? (
            <p className="text-emerald-600 dark:text-emerald-400 font-medium">
              ✓ This will resurrect the deleted document back into active MongoDB collection with its original _id.
            </p>
          ) : (
            <p className="text-amber-600 dark:text-amber-400 font-medium">
              ⚠ This will overwrite current document fields with the historical state at Version {targetVersion}.
            </p>
          )}
          <p className="text-muted-foreground text-[11px]">
            A new rollback transaction commit will be recorded in the audit trail, preserving full historical auditability.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            variant={rollbackTarget.isDeleted ? "success" : "warning"}
            onClick={handleRollback}
            disabled={loading}
          >
            {loading ? "Restoring Document..." : rollbackTarget.isDeleted ? "Confirm Resurrection" : "Confirm Rollback"}
          </Button>
        </DialogFooter>
      </div>
    </Dialog>
  );
}
