import React from "react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Select } from "../ui/select";
import { Search, RefreshCw } from "lucide-react";

export function DbAuditsFilters({
  search,
  setSearch,
  collectionFilter,
  setCollectionFilter,
  availableCollections = [],
  typeFilter,
  setTypeFilter,
  statusFilter,
  setStatusFilter,
  onSearchSubmit,
  onRefresh,
  loading = false,
}) {
  return (
    <form onSubmit={onSearchSubmit} className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-48 sm:w-64">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search collection, details, ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-8 text-xs"
          />
        </div>

        <Select
          value={collectionFilter}
          onChange={(e) => setCollectionFilter(e.target.value)}
          className="h-8 text-xs"
        >
          <option value="">All Collections</option>
          {availableCollections.map((col) => (
            <option key={col} value={col}>
              {col}
            </option>
          ))}
        </Select>

        <Select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="h-8 text-xs"
        >
          <option value="">All Mutation Types</option>
          <option value="insert">INSERT</option>
          <option value="update">UPDATE</option>
          <option value="delete">DELETE</option>
          <option value="rollback">ROLLBACK</option>
          <option value="restore">RESTORE</option>
        </Select>

        <Select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="h-8 text-xs"
        >
          <option value="">All Statuses</option>
          <option value="success">Success</option>
          <option value="failed">Failed</option>
        </Select>

        <Button type="submit" size="sm" className="h-8 text-xs">
          Filter
        </Button>
      </div>

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
    </form>
  );
}

export default DbAuditsFilters;
