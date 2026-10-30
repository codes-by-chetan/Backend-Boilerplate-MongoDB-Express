import React from "react";
import { Link } from "react-router-dom";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Pagination } from "../common/Pagination";
import {
  Users,
  RefreshCw,
  Copy,
  Check,
  Smartphone,
  KeyRound,
  UserCheck,
  UserX,
  Clock,
  History,
  Trash2,
} from "lucide-react";

export function getRoleBadgeVariant(role) {
  switch (role?.toLowerCase()) {
    case "admin":
      return "border-purple-500/40 bg-purple-500/10 text-purple-600 dark:text-purple-400 font-semibold";
    case "manager":
      return "border-blue-500/40 bg-blue-500/10 text-blue-600 dark:text-blue-400 font-medium";
    case "supervisor":
      return "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400 font-medium";
    case "employee":
      return "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-medium";
    default:
      return "border-slate-500/30 bg-slate-500/10 text-slate-600 dark:text-slate-400";
  }
}

export function UserTable({
  users = [],
  loading = false,
  copiedId = null,
  onCopy,
  onOpenRoleModal,
  onToggleStatus,
  onOpenSessions,
  onRevokeSessions,
  onDeleteUser,
  pagination = {},
  onPageChange,
}) {
  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-border/80 bg-muted/40 font-medium text-muted-foreground select-none">
              <th className="py-2.5 px-4">User</th>
              <th className="py-2.5 px-3">Email</th>
              <th className="py-2.5 px-3">Role</th>
              <th className="py-2.5 px-3">Status</th>
              <th className="py-2.5 px-3">Sessions</th>
              <th className="py-2.5 px-3">Joined</th>
              <th className="py-2.5 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {loading && users.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-12 text-muted-foreground">
                  <div className="flex flex-col items-center gap-2">
                    <RefreshCw className="h-5 w-5 animate-spin text-primary" />
                    <span>Loading user directory...</span>
                  </div>
                </td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-12 text-muted-foreground">
                  <Users className="h-8 w-8 mx-auto opacity-30 mb-2" />
                  <p className="font-medium">No users found</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Try adjusting your search query or filters.
                  </p>
                </td>
              </tr>
            ) : (
              users.map((u) => {
                const initials = (u.fullName?.firstName?.[0] || u.userName?.[0] || "U").toUpperCase();
                return (
                  <tr key={u.id} className="hover:bg-muted/30 transition-colors">
                    {/* User Profile Info */}
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2.5">
                        <div className="h-7 w-7 rounded-full bg-primary/10 border border-primary/20 text-primary font-bold flex items-center justify-center text-[11px] shrink-0 select-none">
                          {initials}
                        </div>
                        <div className="min-w-0">
                          <div className="font-semibold text-foreground truncate max-w-[160px]">
                            {u.fullNameString || u.userName || "Unnamed"}
                          </div>
                          <div className="text-[10px] text-muted-foreground font-mono truncate max-w-[160px]">
                            @{u.userName || "user"}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Email with copy */}
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-1.5 font-mono text-[11px] text-muted-foreground">
                        <span className="truncate max-w-[180px]">{u.email}</span>
                        <button
                          onClick={() => onCopy && onCopy(u.email, u.id)}
                          className="text-muted-foreground hover:text-foreground transition-colors p-0.5"
                          title="Copy email"
                        >
                          {copiedId === u.id ? (
                            <Check className="h-3 w-3 text-emerald-500" />
                          ) : (
                            <Copy className="h-3 w-3" />
                          )}
                        </button>
                      </div>
                    </td>

                    {/* Role Badge */}
                    <td className="py-3 px-3">
                      <Badge variant="outline" className={`text-[10px] uppercase font-mono px-2 py-0.5 ${getRoleBadgeVariant(u.role)}`}>
                        {u.role}
                      </Badge>
                    </td>

                    {/* Status Badge */}
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`h-2 w-2 rounded-full ${
                            u.status?.toUpperCase() === "ACTIVE" ? "bg-emerald-500 animate-pulse" : "bg-rose-500"
                          }`}
                        />
                        <span className={`text-[11px] font-medium ${u.status?.toUpperCase() === "ACTIVE" ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                          {u.status}
                        </span>
                      </div>
                    </td>

                    {/* Active Sessions Counter */}
                    <td className="py-3 px-3">
                      <button
                        type="button"
                        onClick={() => onOpenSessions && onOpenSessions(u)}
                        className="inline-flex items-center gap-1.5 text-[11px] font-mono px-2 py-1 rounded-md border border-border/60 bg-muted/30 hover:bg-primary/10 hover:border-primary/40 text-foreground transition-all cursor-pointer group"
                        title="Click to view and manage active sessions"
                      >
                        <Smartphone className="h-3 w-3 text-primary group-hover:scale-110 transition-transform" />
                        <span>{u.activeSessionsCount || 0} active</span>
                      </button>
                    </td>

                    {/* Joined Date */}
                    <td className="py-3 px-3 text-[11px] text-muted-foreground whitespace-nowrap">
                      {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : "—"}
                    </td>

                    {/* Action Buttons */}
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* View Sessions Button */}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onOpenSessions && onOpenSessions(u)}
                          className="h-7 text-[11px] px-2 gap-1 text-sky-600 dark:text-sky-400 hover:border-sky-500/40"
                          title="Inspect user device sessions"
                        >
                          <Smartphone className="h-3 w-3" />
                          <span className="hidden xl:inline">Sessions</span>
                        </Button>

                        {/* Change Role Button */}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onOpenRoleModal && onOpenRoleModal(u)}
                          className="h-7 text-[11px] px-2 gap-1 text-purple-600 dark:text-purple-400 hover:border-purple-500/40"
                          title="Change user access role"
                        >
                          <KeyRound className="h-3 w-3" />
                          <span className="hidden xl:inline">Role</span>
                        </Button>

                        {/* Toggle Status Button */}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onToggleStatus && onToggleStatus(u)}
                          className="h-7 text-[11px] px-2 gap-1 hover:border-border/80"
                          title={u.status?.toUpperCase() === "ACTIVE" ? "Suspend user" : "Activate user"}
                        >
                          {u.status?.toUpperCase() === "ACTIVE" ? (
                            <UserX className="h-3 w-3 text-rose-500" />
                          ) : (
                            <UserCheck className="h-3 w-3 text-emerald-500" />
                          )}
                        </Button>

                        {/* Revoke Sessions Button */}
                        {u.activeSessionsCount > 0 && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onRevokeSessions && onRevokeSessions(u)}
                            className="h-7 text-[11px] px-2 text-amber-600 dark:text-amber-400 hover:border-amber-500/40"
                            title="Force logout all sessions"
                          >
                            <Clock className="h-3 w-3" />
                          </Button>
                        )}

                        {/* Link to Time-Machine History */}
                        <Link
                          to={`/versions?model=User&docId=${u.id}`}
                          className="inline-flex items-center justify-center h-7 w-7 rounded border border-border hover:bg-muted/60 transition-colors text-muted-foreground hover:text-foreground"
                          title="View Document Time-Machine History"
                        >
                          <History className="h-3.5 w-3.5" />
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      {pagination.totalPages > 1 && (
        <div className="p-3 border-t border-border/80 flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            Showing {users.length} of {pagination.total} users
          </span>
          <Pagination
            page={pagination.page}
            totalPages={pagination.totalPages}
            onPageChange={onPageChange}
          />
        </div>
      )}
    </>
  );
}

export default UserTable;
