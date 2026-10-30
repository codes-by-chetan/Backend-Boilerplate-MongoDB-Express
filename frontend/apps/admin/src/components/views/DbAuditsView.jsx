import React, { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "../ui/card";
import { ShieldCheck, AlertTriangle } from "lucide-react";
import { api } from "../../api/client";
import { DbAuditsFilters } from "../audits/DbAuditsFilters";
import { DbAuditsTable } from "../audits/DbAuditsTable";
import { AuditDiffModal } from "../modals/AuditDiffModal";

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

  return (
    <div className="space-y-4">
      {/* Filter toolbar */}
      <Card className="p-4">
        <DbAuditsFilters
          search={search}
          setSearch={setSearch}
          collectionFilter={collectionFilter}
          setCollectionFilter={setCollectionFilter}
          availableCollections={availableCollections}
          typeFilter={typeFilter}
          setTypeFilter={setTypeFilter}
          statusFilter={statusFilter}
          setStatusFilter={setStatusFilter}
          onSearchSubmit={handleSearchSubmit}
          onRefresh={() => fetchAudits(pagination.page, pagination.limit)}
          loading={loading}
        />
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
          <DbAuditsTable
            audits={audits}
            loading={loading}
            pagination={pagination}
            onSelectAudit={(row) => setSelectedAudit(row)}
            onPageChange={(p) => fetchAudits(p, pagination.limit)}
            onLimitChange={(l) => fetchAudits(1, l)}
          />
        </CardContent>
      </Card>

      {/* Audit Diff Modal */}
      <AuditDiffModal
        selectedAudit={selectedAudit}
        isOpen={!!selectedAudit}
        onClose={() => setSelectedAudit(null)}
      />
    </div>
  );
}

export default DbAuditsView;
