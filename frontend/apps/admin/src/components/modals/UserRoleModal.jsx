import React from "react";
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "../ui/dialog";
import { Button } from "../ui/button";
import { Select } from "../ui/select";
import { KeyRound } from "lucide-react";

export function UserRoleModal({
  user,
  isOpen,
  onClose,
  newRole,
  setNewRole,
  updating = false,
  onConfirm,
}) {
  return (
    <Dialog open={isOpen} onClose={onClose} className="max-w-md">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <KeyRound className="h-4 w-4 text-purple-500" />
          <span>Update User Role</span>
        </DialogTitle>
        <DialogDescription>
          Change the assigned role for {user?.fullNameString || user?.email}.
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-3 py-3">
        <div className="p-2.5 rounded-lg border border-border bg-muted/30 text-xs space-y-1">
          <div className="font-semibold text-foreground">{user?.fullNameString}</div>
          <div className="text-muted-foreground font-mono">{user?.email}</div>
          <div className="text-[11px] pt-1 text-muted-foreground">
            Current Role: <span className="font-bold text-foreground uppercase">{user?.role}</span>
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-foreground">Select New Role</label>
          <Select
            value={newRole}
            onChange={(e) => setNewRole && setNewRole(e.target.value)}
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
        <Button variant="outline" size="sm" onClick={onClose} disabled={updating}>
          Cancel
        </Button>
        <Button size="sm" onClick={onConfirm} disabled={updating}>
          {updating ? "Updating..." : "Confirm Role Change"}
        </Button>
      </DialogFooter>
    </Dialog>
  );
}

export default UserRoleModal;
