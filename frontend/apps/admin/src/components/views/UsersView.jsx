import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Card, CardHeader, CardTitle, CardContent } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Badge } from "../ui/badge";
import { Select } from "../ui/select";
import { Pagination } from "../common/Pagination";
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "../ui/dialog";
import {
  Users,
  Search,
  RefreshCw,
  Shield,
  UserCheck,
  UserX,
  Clock,
  Smartphone,
  Copy,
  Check,
  KeyRound,
  History,
  AlertTriangle,
  UserCog,
  Laptop,
  Globe,
  Trash2,
  LogOut,
  ShieldCheck,
} from "lucide-react";
import { api } from "../../api/client";

export function UsersView() {
  const [users, setUsers] = useState([]);
  const [stats, setStats] = useState({
    totalUsers: 0,
    activeUsers: 0,
    inactiveUsers: 0,
    adminCount: 0,
    managerCount: 0,
    userCount: 0,
  });
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0, limit: 20 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [copiedId, setCopiedId] = useState(null);

  // Modals state
  const [roleModalUser, setRoleModalUser] = useState(null);
  const [newRole, setNewRole] = useState("user");
  const [roleUpdating, setRoleUpdating] = useState(false);

  // User Sessions Modal state
  const [sessionsModalUser, setSessionsModalUser] = useState(null);
  const [sessionsData, setSessionsData] = useState(null);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [sessionsError, setSessionsError] = useState("");
  const [revokingTokenId, setRevokingTokenId] = useState(null);

  const [confirmModal, setConfirmModal] = useState(null); // { type, user, actionText, onConfirm }
  const [actionLoading, setActionLoading] = useState(false);

  const fetchUsers = async (page = 1, limit = 20) => {
    setLoading(true);
    setError("");
    try {
      const params = {
        page,
        limit,
        ...(search && { search }),
        ...(roleFilter && { role: roleFilter }),
        ...(statusFilter && { status: statusFilter }),
      };
      const res = await api.getUsersAdmin(params);
      const data = res.data || res;
      setUsers(data.users || []);
      if (data.stats) {
        setStats(data.stats);
      }
      if (data.pagination) {
        setPagination({
          page: data.pagination.page,
          limit: data.pagination.limit,
          totalPages: data.pagination.totalPages || 1,
          total: data.pagination.total || 0,
        });
      }
    } catch (err) {
      setError(err.message || "Failed to fetch users from system.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers(1, pagination.limit);
  }, [roleFilter, statusFilter]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchUsers(1, pagination.limit);
  };

  const handleCopy = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const handleOpenRoleModal = (user) => {
    setRoleModalUser(user);
    setNewRole(user.role || "user");
  };

  const handleUpdateRole = async () => {
    if (!roleModalUser) return;
    setRoleUpdating(true);
    try {
      await api.updateUserRole(roleModalUser.id, newRole);
      setRoleModalUser(null);
      fetchUsers(pagination.page, pagination.limit);
    } catch (err) {
      alert(err.message || "Failed to update role");
    } finally {
      setRoleUpdating(false);
    }
  };

  const handleToggleStatus = (user) => {
    const isCurrentlyActive = user.status?.toUpperCase() === "ACTIVE";
    const nextStatus = isCurrentlyActive ? "INACTIVE" : "ACTIVE";
    const nextLabel = isCurrentlyActive ? "Deactivate" : "Activate";

    setConfirmModal({
      title: `${nextLabel} User Account`,
      description: `Are you sure you want to change ${user.fullNameString || user.email}'s status to ${nextStatus}? ${
        nextStatus === "INACTIVE" ? "This will immediately revoke all active sessions across all devices." : ""
      }`,
      actionText: nextLabel,
      actionVariant: isCurrentlyActive ? "destructive" : "default",
      onConfirm: async () => {
        setActionLoading(true);
        try {
          await api.updateUserStatus(user.id, nextStatus);
          setConfirmModal(null);
          fetchUsers(pagination.page, pagination.limit);
        } catch (err) {
          alert(err.message || "Failed to update status");
        } finally {
          setActionLoading(false);
        }
      },
    });
  };

  const handleRevokeSessions = (user) => {
    setConfirmModal({
      title: "Revoke Active User Sessions",
      description: `Are you sure you want to force logout ${user.fullNameString || user.email}? This will invalidate all refresh tokens and sessions on all devices.`,
      actionText: "Force Logout",
      actionVariant: "destructive",
      onConfirm: async () => {
        setActionLoading(true);
        try {
          await api.revokeUserSessions(user.id);
          setConfirmModal(null);
          fetchUsers(pagination.page, pagination.limit);
        } catch (err) {
          alert(err.message || "Failed to revoke sessions");
        } finally {
          setActionLoading(false);
        }
      },
    });
  };

  const handleOpenSessions = async (user) => {
    setSessionsModalUser(user);
    setSessionsLoading(true);
    setSessionsError("");
    try {
      const res = await api.getUserSessions(user.id);
      setSessionsData(res.data || res);
    } catch (err) {
      setSessionsError(err.message || "Failed to load active sessions");
    } finally {
      setSessionsLoading(false);
    }
  };

  const handleRevokeSingleSession = async (tokenId) => {
    if (!sessionsModalUser) return;
    if (
      !window.confirm(
        "Are you sure you want to terminate this specific device session? The user will be logged out on that device."
      )
    ) {
      return;
    }
    setRevokingTokenId(tokenId);
    try {
      await api.revokeSingleSession(sessionsModalUser.id, tokenId);
      const res = await api.getUserSessions(sessionsModalUser.id);
      setSessionsData(res.data || res);
      fetchUsers(pagination.page, pagination.limit);
    } catch (err) {
      alert(err.message || "Failed to revoke session");
    } finally {
      setRevokingTokenId(null);
    }
  };

  const getRoleBadgeVariant = (role) => {
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
  };

  return (
    <div className="space-y-5">
      {/* Top Stat Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        <Card className="p-3.5 border-border/70 bg-card/60 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
              <Users className="h-4 w-4" />
            </div>
            <div>
              <div className="text-xl font-bold font-mono leading-tight">{stats.totalUsers || 0}</div>
              <div className="text-[11px] text-muted-foreground font-medium">Total Registered</div>
            </div>
          </div>
        </Card>

        <Card className="p-3.5 border-border/70 bg-card/60 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500 shrink-0">
              <UserCheck className="h-4 w-4" />
            </div>
            <div>
              <div className="text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400 leading-tight">
                {stats.activeUsers || 0}
              </div>
              <div className="text-[11px] text-muted-foreground font-medium">Active Accounts</div>
            </div>
          </div>
        </Card>

        <Card className="p-3.5 border-border/70 bg-card/60 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-500 shrink-0">
              <UserX className="h-4 w-4" />
            </div>
            <div>
              <div className="text-xl font-bold font-mono text-rose-600 dark:text-rose-400 leading-tight">
                {stats.inactiveUsers || 0}
              </div>
              <div className="text-[11px] text-muted-foreground font-medium">Inactive Accounts</div>
            </div>
          </div>
        </Card>

        <Card className="p-3.5 border-border/70 bg-card/60 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-500 shrink-0">
              <Shield className="h-4 w-4" />
            </div>
            <div>
              <div className="text-xl font-bold font-mono text-purple-600 dark:text-purple-400 leading-tight">
                {stats.adminCount || 0}
              </div>
              <div className="text-[11px] text-muted-foreground font-medium">Administrators</div>
            </div>
          </div>
        </Card>

        <Card className="p-3.5 border-border/70 bg-card/60 shadow-xs col-span-2 sm:col-span-1">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-500 shrink-0">
              <UserCog className="h-4 w-4" />
            </div>
            <div>
              <div className="text-xl font-bold font-mono text-blue-600 dark:text-blue-400 leading-tight">
                {stats.managerCount || 0}
              </div>
              <div className="text-[11px] text-muted-foreground font-medium">Managers</div>
            </div>
          </div>
        </Card>
      </div>

      {/* Main Users Card */}
      <Card className="border-border/70 shadow-xs">
        <CardHeader className="pb-3 border-b border-border/60">
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
              onClick={() => fetchUsers(pagination.page, pagination.limit)}
              disabled={loading}
              className="h-8 gap-1.5 text-xs shrink-0 self-start sm:self-auto"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              <span>Refresh</span>
            </Button>
          </div>

          {/* Search & Filters Toolbar */}
          <div className="pt-3 grid grid-cols-1 sm:grid-cols-12 gap-2.5">
            <form onSubmit={handleSearchSubmit} className="sm:col-span-6 flex items-center gap-2">
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
        </CardHeader>

        <CardContent className="p-0">
          {error && (
            <div className="m-4 p-3 rounded-lg border border-destructive/30 bg-destructive/10 text-destructive text-xs flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Users Table */}
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
                              <div className="font-semibold text-foreground truncate">
                                {u.fullNameString || "Unnamed User"}
                              </div>
                              <div className="text-[11px] text-muted-foreground font-mono truncate">
                                @{u.userName || "nousername"}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Email with copy */}
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-1.5 font-mono text-[11px] text-muted-foreground">
                            <span className="truncate max-w-[180px]">{u.email}</span>
                            <button
                              onClick={() => handleCopy(u.email, u.id)}
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
                            onClick={() => handleOpenSessions(u)}
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
                              onClick={() => handleOpenSessions(u)}
                              className="h-7 text-[11px] px-2 gap-1 text-sky-600 dark:text-sky-400 hover:border-sky-500/40"
                              title="Inspect user device sessions"
                            >
                              <Laptop className="h-3 w-3" />
                              <span>Sessions</span>
                            </Button>

                            {/* Change Role Button */}
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleOpenRoleModal(u)}
                              className="h-7 text-[11px] px-2 gap-1"
                              title="Change user role"
                            >
                              <KeyRound className="h-3 w-3 text-purple-500" />
                              <span>Role</span>
                            </Button>

                            {/* Toggle Status Button */}
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleToggleStatus(u)}
                              className={`h-7 text-[11px] px-2 ${
                                u.status?.toUpperCase() === "ACTIVE"
                                  ? "hover:text-rose-500 hover:border-rose-500/40"
                                  : "hover:text-emerald-500 hover:border-emerald-500/40"
                              }`}
                              title={u.status?.toUpperCase() === "ACTIVE" ? "Deactivate account" : "Activate account"}
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
                                onClick={() => handleRevokeSessions(u)}
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
                onPageChange={(p) => fetchUsers(p, pagination.limit)}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Role Change Modal */}
      <Dialog open={!!roleModalUser} onClose={() => setRoleModalUser(null)} className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-purple-500" />
            <span>Update User Role</span>
          </DialogTitle>
          <DialogDescription>
            Change the assigned role for {roleModalUser?.fullNameString || roleModalUser?.email}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-3">
          <div className="p-2.5 rounded-lg border border-border bg-muted/30 text-xs space-y-1">
            <div className="font-semibold text-foreground">{roleModalUser?.fullNameString}</div>
            <div className="text-muted-foreground font-mono">{roleModalUser?.email}</div>
            <div className="text-[11px] pt-1 text-muted-foreground">
              Current Role: <span className="font-bold text-foreground uppercase">{roleModalUser?.role}</span>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">Select New Role</label>
            <Select
              value={newRole}
              onChange={(e) => setNewRole(e.target.value)}
              className="w-full text-xs h-9 bg-background"
            >
              <option value="admin">Admin (Full System Privileges)</option>
              <option value="manager">Manager</option>
              <option value="supervisor">Supervisor</option>
              <option value="employee">Employee</option>
              <option value="user">User (Standard Consumer)</option>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => setRoleModalUser(null)} disabled={roleUpdating}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleUpdateRole} disabled={roleUpdating}>
            {roleUpdating ? "Updating..." : "Confirm Role Change"}
          </Button>
        </DialogFooter>
      </Dialog>

      {/* Action Confirmation Modal (Status toggle / Revoke sessions) */}
      <Dialog open={!!confirmModal} onClose={() => setConfirmModal(null)} className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            <span>{confirmModal?.title}</span>
          </DialogTitle>
          <DialogDescription>{confirmModal?.description}</DialogDescription>
        </DialogHeader>

        <DialogFooter className="pt-3">
          <Button variant="outline" size="sm" onClick={() => setConfirmModal(null)} disabled={actionLoading}>
            Cancel
          </Button>
          <Button
            variant={confirmModal?.actionVariant || "default"}
            size="sm"
            onClick={confirmModal?.onConfirm}
            disabled={actionLoading}
          >
            {actionLoading ? "Processing..." : confirmModal?.actionText || "Confirm"}
          </Button>
        </DialogFooter>
      </Dialog>

      {/* User Sessions Inspection Modal */}
      <Dialog
        open={!!sessionsModalUser}
        onClose={() => {
          setSessionsModalUser(null);
          setSessionsData(null);
        }}
        className="max-w-2xl"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Laptop className="h-5 w-5 text-sky-500" />
            <span>Active Device Sessions</span>
          </DialogTitle>
          <DialogDescription>
            Active tokens and connected devices for{" "}
            <span className="font-semibold text-foreground">
              {sessionsModalUser?.fullNameString || sessionsModalUser?.email}
            </span>{" "}
            ({sessionsModalUser?.email})
          </DialogDescription>
        </DialogHeader>

        <div className="py-3 space-y-3">
          {sessionsLoading ? (
            <div className="flex flex-col items-center justify-center py-10 text-muted-foreground gap-2">
              <RefreshCw className="h-6 w-6 animate-spin text-primary" />
              <span className="text-xs">Loading active device sessions...</span>
            </div>
          ) : sessionsError ? (
            <div className="p-3 rounded-lg border border-destructive/30 bg-destructive/10 text-destructive text-xs flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>{sessionsError}</span>
            </div>
          ) : !sessionsData?.sessions || sessionsData.sessions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-xs">
              <Smartphone className="h-8 w-8 mx-auto mb-2 opacity-30" />
              No active sessions currently registered for this user.
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between text-xs text-muted-foreground px-1 pb-1 border-b border-border/40">
                <span>
                  Showing <strong className="text-foreground">{sessionsData.sessions.length}</strong> recorded session(s)
                </span>
                <span className="text-emerald-500 font-medium">
                  {sessionsData.activeSessionsCount} active
                </span>
              </div>

              <div className="max-h-[50vh] overflow-y-auto space-y-2.5 pr-1">
                {sessionsData.sessions.map((s, idx) => {
                  const isMobile = s.deviceInfo?.device === "mobile";
                  return (
                    <div
                      key={s.tokenId || idx}
                      className={`p-3 rounded-lg border transition-all ${
                        s.isCurrentSession
                          ? "border-purple-500/40 bg-purple-500/5 shadow-sm"
                          : "border-border bg-card/60 hover:bg-card"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3">
                          <div
                            className={`p-2 rounded-md ${
                              s.isCurrentSession
                                ? "bg-purple-500/10 text-purple-500"
                                : "bg-muted text-muted-foreground"
                            }`}
                          >
                            {isMobile ? (
                              <Smartphone className="h-4 w-4" />
                            ) : (
                              <Laptop className="h-4 w-4" />
                            )}
                          </div>

                          <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-semibold text-foreground">
                                {s.deviceInfo?.browser || "Web Browser"} on{" "}
                                {s.deviceInfo?.os || "Unknown OS"}
                              </span>
                              {s.isCurrentSession && (
                                <Badge
                                  variant="outline"
                                  className="text-[10px] px-1.5 py-0 border-purple-500/50 bg-purple-500/10 text-purple-500"
                                >
                                  Current Session
                                </Badge>
                              )}
                              <span
                                className={`text-[10px] font-medium flex items-center gap-1 ${
                                  s.isActive
                                    ? "text-emerald-500"
                                    : "text-muted-foreground"
                                }`}
                              >
                                <span
                                  className={`h-1.5 w-1.5 rounded-full ${
                                    s.isActive
                                      ? "bg-emerald-500 animate-pulse"
                                      : "bg-muted-foreground/50"
                                  }`}
                                />
                                {s.isActive ? "Active" : "Expired"}
                              </span>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-0.5 text-[11px] text-muted-foreground font-mono">
                              <div>IP: {s.ipAddress || "127.0.0.1"}</div>
                              <div>
                                Logged in:{" "}
                                {s.loginAt
                                  ? new Date(s.loginAt).toLocaleString()
                                  : "—"}
                              </div>
                              <div className="sm:col-span-2 text-muted-foreground/70 text-[10px]">
                                Expires:{" "}
                                {s.expiresAt
                                  ? new Date(s.expiresAt).toLocaleString()
                                  : "—"}
                              </div>
                            </div>
                          </div>
                        </div>

                        <div>
                          {s.isCurrentSession ? (
                            <span className="text-[10px] text-muted-foreground italic px-2 py-1">
                              Current Device
                            </span>
                          ) : (
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => handleRevokeSingleSession(s.tokenId)}
                              disabled={revokingTokenId === s.tokenId}
                              className="h-7 text-[11px] px-2.5 gap-1 shadow-sm"
                              title="Terminate this device session"
                            >
                              <Trash2 className="h-3 w-3" />
                              <span>
                                {revokingTokenId === s.tokenId
                                  ? "Terminating..."
                                  : "Terminate"}
                              </span>
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        <DialogFooter className="pt-2 flex items-center justify-between sm:justify-between w-full">
          <div>
            {sessionsData?.activeSessionsCount > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSessionsModalUser(null);
                  handleRevokeSessions(sessionsModalUser);
                }}
                className="h-8 text-xs text-amber-600 dark:text-amber-400 hover:border-amber-500/50 gap-1.5"
              >
                <Clock className="h-3.5 w-3.5" />
                <span>Terminate All Sessions</span>
              </Button>
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setSessionsModalUser(null);
              setSessionsData(null);
            }}
            className="h-8 text-xs"
          >
            Close
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}
export default UsersView;
