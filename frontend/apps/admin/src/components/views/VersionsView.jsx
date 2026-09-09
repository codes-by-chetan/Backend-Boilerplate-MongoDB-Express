import React, { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Badge } from "../ui/badge";
import { Select } from "../ui/select";
import { Pagination } from "../common/Pagination";
import { HistoryModal } from "../modals/HistoryModal";
import { CompareModal } from "../modals/CompareModal";
import { RollbackModal } from "../modals/RollbackModal";
import {
  GitBranch,
  History,
  GitCompare,
  RotateCcw,
  Search,
  RefreshCw,
  Clock,
  Layers,
  Sparkles,
  AlertTriangle,
} from "lucide-react";
import { api } from "../../api/client";

export function VersionsView() {
  const [models, setModels] = useState([]);
  const [selectedModel, setSelectedModel] = useState("");
  const [docs, setDocs] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, totalItems: 0, limit: 15 });
  const [loading, setLoading] = useState(false);
  const [loadingModels, setLoadingModels] = useState(false);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");

  // Modals state
  const [historyDoc, setHistoryDoc] = useState(null);
  const [compareDoc, setCompareDoc] = useState(null);
  const [rollbackTarget, setRollbackTarget] = useState(null);

  // Load models on mount
  useEffect(() => {
    const fetchModels = async () => {
      setLoadingModels(true);
      setError("");
      try {
        const res = await api.getModels();
        const list = res.data?.models || res.models || (Array.isArray(res.data) ? res.data : []);
        setModels(list);
        if (list.length > 0) {
          const first = typeof list[0] === "string" ? list[0] : list[0].name;
          setSelectedModel(first);
        }
      } catch (err) {
        setError(err.message || "Failed to load audit models from MongoDB");
      } finally {
        setLoadingModels(false);
      }
    };
    fetchModels();
  }, []);

  const fetchDocs = async (model, page = 1, limit = 15) => {
    if (!model) return;
    setLoading(true);
    setError("");
    try {
      const params = {
        page,
        limit,
        ...(statusFilter !== "all" && { status: statusFilter }),
        ...(search && { search }),
      };
      const res = await api.getModelDocs(model, params);
      const data = res.data || res;
      setDocs(data.documents || data.docs || (Array.isArray(data) ? data : []));
      if (data.pagination) {
        setPagination({
          page: data.pagination.page,
          limit: data.pagination.limit,
          totalPages: data.pagination.totalPages || 1,
          totalItems: data.pagination.total || 0,
        });
      }
    } catch (err) {
      setError(err.message || `Failed to load documents for model ${model}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedModel) {
      fetchDocs(selectedModel, 1, pagination.limit);
    }
  }, [selectedModel, statusFilter]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchDocs(selectedModel, 1, pagination.limit);
  };

  return (
    <div className="space-y-4">
      {/* Model Selector & Filter Controls */}
      <Card className="p-4">
        <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            <div className="flex items-center gap-1.5">
              <Layers className="h-4 w-4 text-primary" />
              <span className="text-xs font-semibold">Model:</span>
              <Select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                disabled={loadingModels || models.length === 0}
                className="h-8 text-xs font-semibold min-w-[130px]"
              >
                {models.map((m) => {
                  const name = typeof m === "string" ? m : m.name;
                  return (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  );
                })}
              </Select>
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fetchDocs(selectedModel, pagination.page, pagination.limit)}
              disabled={loading}
              className="gap-1.5 text-xs h-8"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              <span>Refresh</span>
            </Button>

            <div className="flex items-center gap-1 border border-border rounded-md p-0.5 bg-muted/30">
              {["all", "active", "deleted"].map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setStatusFilter(st)}
                  className={`px-2 py-1 rounded text-[11px] font-medium transition-colors ${
                    statusFilter === st
                      ? "bg-background text-foreground shadow-sm font-semibold"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {st.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-64">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search document title, ID..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 h-8 text-xs"
              />
            </div>
            <Button type="submit" size="sm" className="h-8 text-xs">
              Search
            </Button>
          </div>
        </form>
      </Card>

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg border border-destructive/30 bg-destructive/10 text-destructive text-xs">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Document History Cards */}
      <Card>
        <CardHeader className="p-4 border-b border-border flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <GitBranch className="h-4 w-4 text-primary" />
            <CardTitle className="text-sm font-semibold">
              Tracked Documents in {selectedModel || "Collection"}
            </CardTitle>
          </div>
          <span className="text-xs text-muted-foreground">
            {pagination.totalItems} versioned items
          </span>
        </CardHeader>

        <CardContent className="p-0">
          {loading ? (
            <div className="py-12 text-center text-muted-foreground text-xs">
              Loading model documents...
            </div>
          ) : docs.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground text-xs">
              No versioned records found for {selectedModel || "selected model"}.
            </div>
          ) : (
            <div className="divide-y divide-border/60">
              {docs.map((doc, idx) => {
                const docId = doc._id || doc.id;
                const title = doc.displayTitle || doc.title || doc.email || docId;
                const version = doc.currentVersion || doc.version || 1;
                const isDeleted = doc.status === "deleted";

                return (
                  <div
                    key={docId || idx}
                    className="flex flex-col sm:flex-row sm:items-center justify-between p-4 hover:bg-muted/40 transition-colors gap-3"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-foreground">{title}</span>
                        <Badge variant={isDeleted ? "destructive" : "success"} className="text-[10px]">
                          {isDeleted ? "DELETED" : "ACTIVE"}
                        </Badge>
                        <Badge variant="get" className="text-[10px]">
                          v{version}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 text-[11px] text-muted-foreground font-mono">
                        <span>ID: {docId}</span>
                        {doc.updatedAt && (
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {new Date(doc.updatedAt).toLocaleString()}
                          </span>
                        )}
                        {doc.summary && (
                          <span className="text-muted-foreground/80 italic">
                            ({doc.summary})
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-auto">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setHistoryDoc({
                            modelName: selectedModel,
                            docId,
                            title,
                          })
                        }
                        className="h-7 text-xs gap-1"
                      >
                        <History className="h-3 w-3" />
                        <span>Revisions</span>
                      </Button>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setCompareDoc({
                            modelName: selectedModel,
                            docId,
                            title,
                            maxVersion: version,
                          })
                        }
                        disabled={version <= 1}
                        className="h-7 text-xs gap-1"
                      >
                        <GitCompare className="h-3 w-3" />
                        <span>Compare</span>
                      </Button>

                      <Button
                        variant={isDeleted ? "success" : "warning"}
                        size="sm"
                        onClick={() =>
                          setRollbackTarget({
                            modelName: selectedModel,
                            docId,
                            title,
                            version,
                            isDeleted,
                            maxVersion: version,
                          })
                        }
                        className="h-7 text-xs gap-1"
                      >
                        {isDeleted ? (
                          <>
                            <Sparkles className="h-3 w-3" />
                            <span>Resurrect</span>
                          </>
                        ) : (
                          <>
                            <RotateCcw className="h-3 w-3" />
                            <span>Rollback</span>
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="p-4">
            <Pagination
              pagination={pagination}
              onPageChange={(p) => fetchDocs(selectedModel, p, pagination.limit)}
              onLimitChange={(l) => fetchDocs(selectedModel, 1, l)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Revisions History Timeline Modal */}
      {historyDoc && (
        <HistoryModal
          historyDoc={historyDoc}
          onClose={() => setHistoryDoc(null)}
          onOpenRollback={(target) => {
            setHistoryDoc(null);
            setRollbackTarget(target);
          }}
        />
      )}

      {/* Version Comparator Modal */}
      {compareDoc && (
        <CompareModal
          compareDoc={compareDoc}
          onClose={() => setCompareDoc(null)}
        />
      )}

      {/* Rollback & Resurrect Modal */}
      {rollbackTarget && (
        <RollbackModal
          rollbackTarget={rollbackTarget}
          onClose={() => setRollbackTarget(null)}
          onSuccess={() => fetchDocs(selectedModel, pagination.page, pagination.limit)}
        />
      )}
    </div>
  );
}
