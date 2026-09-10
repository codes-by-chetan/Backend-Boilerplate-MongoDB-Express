import React from "react";
import { Dialog, DialogHeader, DialogTitle, DialogDescription } from "../ui/dialog";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { JsonViewer } from "../common/JsonViewer";
import { KeyRound, Loader2 } from "lucide-react";
import { getMethodVariant, getStatusVariant } from "../requests/DbRequestsTable";

export function RequestInspectModal({
  selectedRow,
  isOpen,
  onClose,
  hasEncryptedFields,
  onOpenReasonModal,
  decrypting = false,
}) {
  if (!selectedRow) return null;

  const method = selectedRow.requestMethod || selectedRow.method || "GET";
  const status = selectedRow.responseStatus || selectedRow.statusCode || 200;

  return (
    <Dialog open={isOpen} onClose={onClose} className="max-w-3xl">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Badge variant={getMethodVariant(method)}>
            {method}
          </Badge>
          <span className="font-mono text-sm">{selectedRow.requestUrl || selectedRow.url}</span>
          <Badge variant={getStatusVariant(status)}>
            {status}
          </Badge>
        </DialogTitle>
        <DialogDescription>
          Database record ID: {selectedRow._id} | Recorded at {new Date(selectedRow.createdAt || selectedRow.timestamp).toLocaleString()}
        </DialogDescription>
        {hasEncryptedFields && hasEncryptedFields(selectedRow) && (
          <div className="pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onOpenReasonModal}
              disabled={decrypting}
              className="h-7 text-[11px] gap-1.5 text-purple-600 dark:text-purple-400 border-purple-500/30 bg-purple-500/10 hover:bg-purple-500/20"
            >
              {decrypting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <KeyRound className="h-3.5 w-3.5" />
              )}
              <span>{decrypting ? "Decrypting Payload..." : "Decrypt Confidential Fields (Master Key)"}</span>
            </Button>
          </div>
        )}
      </DialogHeader>

      <div className="space-y-4 py-3">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
          <div className="p-2 rounded bg-muted/40 border border-border">
            <span className="text-muted-foreground block text-[10px] uppercase font-bold">Status</span>
            <span className="font-mono font-semibold">{selectedRow.requestStatus || "Completed"}</span>
          </div>
          <div className="p-2 rounded bg-muted/40 border border-border">
            <span className="text-muted-foreground block text-[10px] uppercase font-bold">Client IP</span>
            <span className="font-mono font-semibold">
              {typeof selectedRow.ipAddress === "object" ? selectedRow.ipAddress?.clientIp || "127.0.0.1" : selectedRow.ipAddress || "127.0.0.1"}
            </span>
          </div>
          <div className="p-2 rounded bg-muted/40 border border-border">
            <span className="text-muted-foreground block text-[10px] uppercase font-bold">User</span>
            <span className="font-mono font-semibold truncate block">
              {selectedRow.user?.email || "Guest"}
            </span>
          </div>
          <div className="p-2 rounded bg-muted/40 border border-border">
            <span className="text-muted-foreground block text-[10px] uppercase font-bold">Type</span>
            <span className="font-mono font-semibold">
              {selectedRow.requestType || "REST"}
            </span>
          </div>
        </div>

        {selectedRow.errors && (
          <div className="p-3 rounded-lg border border-destructive/30 bg-destructive/10 text-destructive text-xs font-mono">
            <strong>Error: </strong> {selectedRow.errors}
          </div>
        )}

        {selectedRow.requestBody && (
          <JsonViewer data={selectedRow.requestBody} title="Request Body Payload" />
        )}

        {selectedRow.responseBody && (
          <JsonViewer data={selectedRow.responseBody} title="Response Body Payload" />
        )}

        {selectedRow.requestHeaders && (
          <JsonViewer data={selectedRow.requestHeaders} title="Request Headers" />
        )}

        <JsonViewer data={selectedRow} title="Complete Document from MongoDB" />
      </div>
    </Dialog>
  );
}

export default RequestInspectModal;
