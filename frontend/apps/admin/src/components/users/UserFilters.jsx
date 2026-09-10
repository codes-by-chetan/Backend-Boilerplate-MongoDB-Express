import React from "react";
import { CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Select } from "../ui/select";
import { Users, Search, RefreshCw } from "lucide-react";

export function UserFilters({
  search,
  setSearch,
  roleFilter,
  setRoleFilter,
  statusFilter,
  setStatusFilter,
  onSearchSubmit,
  onRefresh,
  loading,
}) {
  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="h-7 w-7 rounded-md bg-primary/10 text-primary flex items-center justify-center">
            <Users className="h-4 w-4" />
          </div>
          <div>
            <CardTitle className="text-base font-bold">User Directory & Role Access</CardTitle>
            <p className="text-xs text-muted-foreground">
              Manage accounts, elevate or revoke user privileges, and terminate remote sessions.
            </p>
          </div>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={onRefresh}
          disabled={loading}
          className="h-8 gap-1.5 text-xs shrink-0 self-start sm:self-auto"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          <span>Refresh</span>
        </Button>
      </div>

      {/* Search & Filters Toolbar */}
      <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
        <form onSubmit={onSearchSubmit} className="sm:col-span-6 flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search by name, email, or username..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-8 text-xs bg-background/80"
            />
          </div>
          <Button type="submit" variant="secondary" size="sm" className="h-8 text-xs px-3">
            Search
          </Button>
        </form>

        <div className="sm:col-span-3">
          <Select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="h-8 text-xs w-full bg-background/80"
          >
            <option value="">All Roles</option>
            <option value="admin">Admin</option>
            <option value="manager">Manager</option>
            <option value="supervisor">Supervisor</option>
            <option value="employee">Employee</option>
            <option value="user">User</option>
          </Select>
        </div>

        <div className="sm:col-span-3">
          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-8 text-xs w-full bg-background/80"
          >
            <option value="">All Statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
            <option value="INVITED">Invited</option>
          </Select>
        </div>
      </div>
    </div>
  );
}

export default UserFilters;
