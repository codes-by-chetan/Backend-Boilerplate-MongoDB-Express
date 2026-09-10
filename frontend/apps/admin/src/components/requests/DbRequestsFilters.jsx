import React from "react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Select } from "../ui/select";
import { Search, ShieldCheck, RefreshCw } from "lucide-react";

export function DbRequestsFilters({
  search,
  setSearch,
  methodFilter,
  setMethodFilter,
  statusFilter,
  setStatusFilter,
  statusCodeFilter,
  setStatusCodeFilter,
  onSearchSubmit,
  onOpenAuditModal,
  onRefresh,
  loading = false,
}) {
  return (
    <form onSubmit={onSearchSubmit} className="flex flex-wrap items-center justify-between gap-3">
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

      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onOpenAuditModal}
          className="h-8 text-xs gap-1.5 text-purple-600 dark:text-purple-400 border-purple-500/30 hover:bg-purple-500/10 hover:border-purple-500/60"
          title="View immutable security decryption audit trail"
        >
          <ShieldCheck className="h-3.5 w-3.5" />
          <span>Decryption Audits</span>
        </Button>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onRefresh}
          disabled={loading}
          className="h-8 text-xs gap-1.5"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          <span>Refresh</span>
        </Button>
      </div>
    </form>
  );
}

export default DbRequestsFilters;
