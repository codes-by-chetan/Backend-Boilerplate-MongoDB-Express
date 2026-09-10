import React, { useState, useEffect } from "react";
import { Card, CardHeader, CardContent } from "../ui/card";
import { AlertTriangle } from "lucide-react";
import { api } from "../../api/client";
import { UserStatsCards } from "../users/UserStatsCards";
import { UserFilters } from "../users/UserFilters";
import { UserTable } from "../users/UserTable";
import { UserSessionsModal } from "../modals/UserSessionsModal";
import { UserRoleModal } from "../modals/UserRoleModal";
import { UserConfirmModal } from "../modals/UserConfirmModal";

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

  const [confirmModal, setConfirmModal] = useState(null);
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
      if (data.stats) setStats(data.stats);
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
          alert(err.message || "Failed to toggle status");
        } finally {
          setActionLoading(false);
        }
      },
    });
  };

  const handleRevokeSessions = (user) => {
    setConfirmModal({
      title: "Revoke All Active Sessions",
      description: `Force logout ${user.fullNameString || user.email} from all devices? All active tokens will be invalidated immediately.`,
      actionText: "Revoke All Sessions",
      actionVariant: "destructive",
      onConfirm: async () => {
        setActionLoading(true);
        try {
          await api.revokeAllUserSessions(user.id);
          setConfirmModal(null);
          if (sessionsModalUser?.id === user.id) {
            setSessionsData(null);
            setSessionsModalUser(null);
          }
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
    setSessionsData(null);
    setSessionsLoading(true);
    setSessionsError("");
    try {
      const res = await api.getUserSessions(user.id);
      setSessionsData(res.data || res);
    } catch (err) {
      setSessionsError(err.message || "Failed to fetch active device sessions");
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

  return (
    <div className="space-y-5">
      {/* Top Stat Summary Cards */}
      <UserStatsCards stats={stats} />

      {/* Main Users Card */}
      <Card className="border-border/70 shadow-xs">
        <CardHeader className="pb-3 border-b border-border/60">
          <UserFilters
            search={search}
            setSearch={setSearch}
            roleFilter={roleFilter}
            setRoleFilter={setRoleFilter}
            statusFilter={statusFilter}
            setStatusFilter={setStatusFilter}
            onSearchSubmit={handleSearchSubmit}
            onRefresh={() => fetchUsers(pagination.page, pagination.limit)}
            loading={loading}
          />
        </CardHeader>

        <CardContent className="p-0">
          {error && (
            <div className="m-4 p-3 rounded-lg border border-destructive/30 bg-destructive/10 text-destructive text-xs flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <UserTable
            users={users}
            loading={loading}
            copiedId={copiedId}
            onCopy={handleCopy}
            onOpenRoleModal={handleOpenRoleModal}
            onToggleStatus={handleToggleStatus}
            onOpenSessions={handleOpenSessions}
            onRevokeSessions={handleRevokeSessions}
            pagination={pagination}
            onPageChange={(p) => fetchUsers(p, pagination.limit)}
          />
        </CardContent>
      </Card>

      {/* Role Change Modal */}
      <UserRoleModal
        user={roleModalUser}
        isOpen={!!roleModalUser}
        onClose={() => setRoleModalUser(null)}
        newRole={newRole}
        setNewRole={setNewRole}
        updating={roleUpdating}
        onConfirm={handleUpdateRole}
      />

      {/* Action Confirmation Modal */}
      <UserConfirmModal
        isOpen={!!confirmModal}
        onClose={() => setConfirmModal(null)}
        config={confirmModal}
        loading={actionLoading}
      />

      {/* User Sessions Inspection Modal */}
      <UserSessionsModal
        user={sessionsModalUser}
        isOpen={!!sessionsModalUser}
        onClose={() => {
          setSessionsModalUser(null);
          setSessionsData(null);
        }}
        sessionsData={sessionsData}
        loading={sessionsLoading}
        error={sessionsError}
        revokingTokenId={revokingTokenId}
        onRevokeSingleSession={handleRevokeSingleSession}
        onRevokeAllSessions={() => {
          setSessionsModalUser(null);
          handleRevokeSessions(sessionsModalUser);
        }}
      />
    </div>
  );
}

export default UsersView;
