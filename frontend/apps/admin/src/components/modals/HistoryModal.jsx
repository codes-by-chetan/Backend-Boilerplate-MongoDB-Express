import React, { useState, useEffect } from "react";
import { Dialog, DialogHeader, DialogTitle, DialogDescription } from "../ui/dialog";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { JsonViewer } from "../common/JsonViewer";
import { GitCommit, History, RotateCcw, Eye, Clock, User, AlertCircle } from "lucide-react";
import { api } from "../../api/client";

export function HistoryModal({
  historyDoc,
  onClose,
  onOpenRollback,
}) {
  const [historyData, setHistoryData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [reconstructedVersion, setReconstructedVersion] = useState(null);
  const [reconstructedData, setReconstructedData] = useState(null);
  const [loadingVersion, setLoadingVersion] = useState(false);

  useEffect(() => {
    if (!historyDoc) return;
    const loadHistory = async () => {
      setLoading(true);
      setError("");
      try {
        const res = await api.getDocumentHistory(historyDoc.modelName, historyDoc.docId);
        setHistoryData(res.data || res);
      } catch (err) {
        setError(err.message || "Failed to load document revision history");
      } finally {
        setLoading(false);
      }
    };
    loadHistory();
  }, [historyDoc]);

  const loadReconstructed = async (version) => {
    if (reconstructedVersion === version && reconstructedData) {
      // Toggle close
      setReconstructedVersion(null);
      setReconstructedData(null);
      return;
    }
    setLoadingVersion(true);
    try {
      const res = await api.getDocumentVersion(historyDoc.modelName, historyDoc.docId, version);
      setReconstructedVersion(version);
      setReconstructedData(res.data || res);
    } catch (err) {
      alert("Failed to reconstruct version: " + err.message);
    } finally {
      setLoadingVersion(false);
    }
  };

  if (!historyDoc) return null;

  const commits = historyData?.commits || historyData?.history || [];

  return (
    <Dialog open={!!historyDoc} onClose={onClose} className="max-w-4xl">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <History className="h-4 w-4 text-primary" />
          <span>Document Revision Timeline</span>
        </DialogTitle>
        <DialogDescription>
          Model: <strong className="text-foreground">{historyDoc.modelName}</strong> | ID:{" "}
          <span className="font-mono text-foreground">{historyDoc.docId}</span>
        </DialogDescription>
      </DialogHeader>

      <div className="py-3 space-y-4">
        {error && (
          <div className="flex items-center gap-2 p-3 rounded-lg border border-destructive/30 bg-destructive/10 text-destructive text-xs">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {loading ? (
          <div className="py-12 text-center text-muted-foreground text-xs">
            Reconstructing commit graph from MongoDB...
          </div>
        ) : commits.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground text-xs">
            No version commits recorded for this document.
          </div>
        ) : (
          <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
            <div className="text-xs text-muted-foreground">
              Showing <strong>{commits.length}</strong> sequential revision(s):
            </div>

            {commits.map((commit) => (
              <div
                key={commit._id || commit.version}
                className="p-3.5 rounded-lg border border-border bg-card space-y-2 text-xs transition-colors hover:border-border/80"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="get" className="text-xs px-2">
                      v{commit.version}
                    </Badge>
                    <Badge
                      variant={
                        commit.transactionType === "insert"
                          ? "success"
                          : commit.transactionType === "delete"
                          ? "destructive"
                          : commit.transactionType === "rollback"
                          ? "warning"
                          : "info"
                      }
                    >
                      {(commit.transactionType || "UPDATE").toUpperCase()}
                    </Badge>
                    <span className="font-semibold text-foreground">
                      {commit.summary || commit.transactionDetails || "Document mutation"}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => loadReconstructed(commit.version)}
                      disabled={loadingVersion}
                      className="h-7 text-[11px] gap-1"
                    >
                      <Eye className="h-3 w-3" />
                      <span>
                        {reconstructedVersion === commit.version ? "Hide State" : "Reconstruct State"}
                      </span>
                    </Button>

                    <Button
                      variant="warning"
                      size="sm"
                      onClick={() =>
                        onOpenRollback({
                          modelName: historyDoc.modelName,
                          docId: historyDoc.docId,
                          title: historyDoc.title || historyDoc.docId,
                          version: commit.version,
                          isDeleted: historyData?.currentStatus === "deleted",
                          maxVersion: historyData?.latestVersion || commits.length,
                        })
                      }
                      className="h-7 text-[11px] gap-1"
                    >
                      <RotateCcw className="h-3 w-3" />
                      <span>Rollback to v{commit.version}</span>
                    </Button>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1">
                  <span>Author: {commit.user?.email || "System"}</span>
                  <span>{new Date(commit.createdAt || commit.timestamp).toLocaleString()}</span>
                </div>

                {/* Diff tree if available */}
                {commit.diff?.changes?.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-border/60 font-mono text-[11px] space-y-1">
                    {commit.diff.changes.map((ch, idx) => (
                      <div key={idx} className="flex items-start gap-1.5 p-1 rounded bg-muted/40">
                        <span
                          className={`px-1 rounded font-bold text-[10px] ${
                            ch.type === "added"
                              ? "text-emerald-500"
                              : ch.type === "modified"
                              ? "text-amber-500"
                              : "text-rose-500"
                          }`}
                        >
                          {ch.type === "added" ? "+" : ch.type === "modified" ? "~" : "-"}
                        </span>
                        <span className="font-semibold text-foreground">{ch.field}: </span>
                        {ch.type === "modified" ? (
                          <span className="truncate">
                            <span className="text-rose-500 line-through">
                              {JSON.stringify(ch.oldValue)}
                            </span>
                            {" → "}
                            <span className="text-emerald-500">
                              {JSON.stringify(ch.newValue)}
                            </span>
                          </span>
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
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Reconstructed State Preview */}
        {reconstructedData && (
          <div className="pt-3 border-t border-border space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-semibold">
                Reconstructed Document State @ Version {reconstructedVersion}
              </h4>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setReconstructedData(null)}
                className="h-6 text-[10px]"
              >
                Hide Preview
              </Button>
            </div>
            <JsonViewer
              data={reconstructedData.state || reconstructedData}
              title={`Snapshot @ Version ${reconstructedVersion}`}
            />
          </div>
        )}
      </div>
    </Dialog>
  );
}
