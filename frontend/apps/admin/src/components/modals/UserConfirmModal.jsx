import React from "react";
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "../ui/dialog";
import { Button } from "../ui/button";
import { AlertTriangle } from "lucide-react";

export function UserConfirmModal({
  isOpen,
  onClose,
  config,
  loading = false,
}) {
  if (!config) return null;

  return (
    <Dialog open={isOpen} onClose={onClose} className="max-w-md">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-500" />
          <span>{config.title}</span>
        </DialogTitle>
        <DialogDescription>{config.description}</DialogDescription>
      </DialogHeader>

      <DialogFooter className="pt-3">
        <Button variant="outline" size="sm" onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        <Button
          variant={config.actionVariant || "default"}
          size="sm"
          onClick={config.onConfirm}
          disabled={loading}
        >
          {loading ? "Processing..." : config.actionText || "Confirm"}
        </Button>
      </DialogFooter>
    </Dialog>
  );
}

export default UserConfirmModal;
