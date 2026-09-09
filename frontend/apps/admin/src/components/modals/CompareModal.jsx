import React, { useState, useEffect } from "react";
import { Dialog, DialogHeader, DialogTitle, DialogDescription } from "../ui/dialog";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Select } from "../ui/select";
import { JsonViewer } from "../common/JsonViewer";
import { GitCompare, ArrowRightLeft, Layers, Code, AlertCircle } from "lucide-react";
import { api } from "../../api/client";

export function CompareModal({ compareDoc, onClose }) {
  const [v1, setV1] = useState(1);
  const [v2, setV2] = useState(1);
  const [viewTab, setViewTab] = useState("diff"); // 'diff' | 'json'
  const [compareData, setCompareData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const maxVersion = Math.max(1, compareDoc?.maxVersion || 1);

  useEffect(() => {
    if (!compareDoc) return;
    const initialV1 = Math.max(1, (compareDoc.maxVersion || 2) - 1);
    const initialV2 = compareDoc.maxVersion || 1;
    setV1(initialV1);
    setV2(initialV2);
    executeCompare(initialV1, initialV2);
  }, [compareDoc]);

  const executeCompare = async (base, target) => {
    if (!compareDoc) return;
    setLoading(true);
    setError("");
    try {
      const res = await api.compareDocumentVersions(compareDoc.modelName, compareDoc.docId, base, target);
      setCompareData(res.data || res);
    } catch (err) {
      setError(err.message || "Failed to compute version diff");
    } finally {
      setLoading(false);
    }
  };

  if (!compareDoc) return null;

  return (
    <Dialog open={!!compareDoc} onClose={onClose} className="max-w-4xl">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <GitCompare className="h-4 w-4 text-primary" />
          <span>Git-Like Version Comparator</span>
        </DialogTitle>
        <DialogDescription>
          Comparing revisions for <strong className="text-foreground">{compareDoc.title || compareDoc.docId}</strong> ({compareDoc.modelName})
        </DialogDescription>
      </DialogHeader>

      <div className="py-3 space-y-4">
        {/* Version Selector Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-lg border border-border bg-muted/20">
          <div className="flex items-center gap-2 text-xs">
            <span className="font-semibold">Base:</span>
            <Select
              value={v1}
              onChange={(e) => {
                const val = Number(e.target.value);
                setV1(val);
                executeCompare(val, v2);
              }}
              className="h-8 text-xs font-semibold"
            >
              {Array.from({ length: maxVersion }, (_, i) => i + 1).map((v) => (
                <option key={v} value={v}>
                  Version {v}
                </option>
              ))}
            </Select>

            <ArrowRightLeft className="h-4 w-4 text-muted-foreground mx-1" />

            <span className="font-semibold">Target:</span>
            <Select
              value={v2}
              onChange={(e) => {
                const val = Number(e.target.value);
                setV2(val);
                executeCompare(v1, val);
              }}
              className="h-8 text-xs font-semibold"
            >
              {Array.from({ length: maxVersion }, (_, i) => i + 1).map((v) => (
                <option key={v} value={v}>
                  Version {v}
                </option>
              ))}
            </Select>

            <Button
              size="sm"
              onClick={() => executeCompare(v1, v2)}
              disabled={loading}
              className="h-8 text-xs ml-2"
            >
              {loading ? "Diffing..." : "Compare"}
            </Button>
          </div>

          <div className="flex items-center gap-1 border border-border rounded-md p-0.5 bg-background">
            <button
              onClick={() => setViewTab("diff")}
              className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                viewTab === "diff"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Layers className="h-3 w-3" />
              <span>Git Diff Tree</span>
            </button>
            <button
              onClick={() => setViewTab("json")}
              className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                viewTab === "json"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Code className="h-3 w-3" />
              <span>Side-by-Side JSON</span>
            </button>
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3 rounded-lg border border-destructive/30 bg-destructive/10 text-destructive text-xs">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {loading ? (
          <div className="py-12 text-center text-muted-foreground text-xs">
            Computing deep structural diff...
          </div>
        ) : !compareData ? (
          <div className="py-12 text-center text-muted-foreground text-xs">
            Select versions above to compute diff.
          </div>
        ) : (
          <div className="space-y-3">
            {/* Stats summary banner */}
            <div className="flex items-center gap-3 text-xs">
              <Badge variant="success">+{compareData.diff?.addedCount || 0} Added</Badge>
              <Badge variant="warning">~{compareData.diff?.modifiedCount || 0} Modified</Badge>
              <Badge variant="destructive">-{compareData.diff?.deletedCount || 0} Deleted</Badge>
              <span className="text-muted-foreground text-[11px] ml-1">
                {compareData.diff?.summary || `${compareData.diff?.totalChanges || 0} total change(s)`}
              </span>
            </div>

            {viewTab === "diff" ? (
              <div className="rounded-lg border border-border bg-card p-3 max-h-[450px] overflow-y-auto space-y-2 font-mono text-xs">
                {(!compareData.diff?.changes || compareData.diff.changes.length === 0) ? (
                  <div className="py-8 text-center text-emerald-500 font-sans font-medium">
                    ✓ Version {v1} and Version {v2} are structurally identical!
                  </div>
                ) : (
                  compareData.diff.changes.map((ch, idx) => (
                    <div
                      key={idx}
                      className="flex items-start gap-2 p-2 rounded bg-muted/40 border border-border/60"
                    >
                      <span
                        className={`px-1.5 py-0.5 rounded font-bold text-[10px] ${
                          ch.type === "added"
                            ? "bg-emerald-500/20 text-emerald-500"
                            : ch.type === "modified"
                            ? "bg-amber-500/20 text-amber-500"
                            : "bg-rose-500/20 text-rose-500"
                        }`}
                      >
                        {ch.type === "added" ? "+ Added" : ch.type === "modified" ? "~ Modified" : "- Deleted"}
                      </span>
                      <div className="flex-1 overflow-hidden">
                        <span className="font-semibold text-foreground">{ch.field}: </span>
                        {ch.type === "modified" ? (
                          <div className="mt-1 space-y-0.5">
                            <div className="text-rose-500 line-through truncate">
                              - {JSON.stringify(ch.oldValue)}
                            </div>
                            <div className="text-emerald-500 truncate">
                              + {JSON.stringify(ch.newValue)}
                            </div>
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
                  ))
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <JsonViewer data={compareData.v1?.state} title={`Version ${v1} Snapshot`} />
                <JsonViewer data={compareData.v2?.state} title={`Version ${v2} Snapshot`} />
              </div>
            )}
          </div>
        )}
      </div>
    </Dialog>
  );
}
