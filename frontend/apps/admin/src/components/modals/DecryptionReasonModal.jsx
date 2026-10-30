import React from "react";
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "../ui/dialog";
import { Button } from "../ui/button";
import { Lock, Shield, AlertTriangle, KeyRound, Loader2 } from "lucide-react";

export function DecryptionReasonModal({
  isOpen,
  onClose,
  selectedRow,
  decryptionReason,
  setDecryptionReason,
  reasonError,
  setReasonError,
  decrypting = false,
  onConfirmDecryption,
}) {
  return (
    <Dialog
      open={isOpen}
      onClose={() => !decrypting && onClose()}
      className="max-w-md"
    >
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Lock className="h-5 w-5 text-purple-500" />
          <span>Confidential Data Decryption Justification</span>
        </DialogTitle>
        <DialogDescription>
          Target: <span className="font-mono text-xs font-semibold text-foreground">{selectedRow?.requestMethod} {selectedRow?.requestUrl}</span>
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-3 py-3 text-xs">
        <div className="p-3 rounded-lg border border-purple-500/30 bg-purple-500/10 text-purple-700 dark:text-purple-300 space-y-1">
          <div className="flex items-center gap-1.5 font-semibold">
            <Shield className="h-4 w-4 shrink-0" />
            <span>Security Compliance & Audit Policy</span>
          </div>
          <p className="text-[11px] leading-relaxed opacity-90">
            Decryption of confidential fields (raw credentials, tokens, session cookies) is an auditable operation. Your Administrator account, client IP address, and stated justification will be permanently saved to the security audit trail.
          </p>
        </div>

        <div className="space-y-1.5">
          <label className="font-semibold text-foreground flex items-center justify-between">
            <span>Reason / Justification for Decryption *</span>
            <span className="text-[10px] text-muted-foreground font-mono">
              {decryptionReason.trim().length}/5 min characters
            </span>
          </label>
          <textarea
            rows={3}
            value={decryptionReason}
            onChange={(e) => {
              setDecryptionReason(e.target.value);
              if (reasonError && setReasonError) setReasonError("");
            }}
            placeholder="e.g., Investigating user authentication failure incident #402, authorized security review..."
            className="w-full p-2.5 text-xs rounded-md border border-input bg-background focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
            disabled={decrypting}
          />
          {reasonError && (
            <p className="text-[11px] text-destructive flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" />
              <span>{reasonError}</span>
            </p>
          )}
        </div>
      </div>

      <DialogFooter className="pt-2">
        <Button
          variant="outline"
          size="sm"
          onClick={onClose}
          disabled={decrypting}
        >
          Cancel
        </Button>
        <Button
          size="sm"
          onClick={onConfirmDecryption}
          disabled={decrypting || decryptionReason.trim().length < 5}
          className="bg-purple-600 hover:bg-purple-700 text-white gap-1.5"
        >
          {decrypting ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <KeyRound className="h-3.5 w-3.5" />
          )}
          <span>{decrypting ? "Authorizing & Decrypting..." : "Authorize & Decrypt"}</span>
        </Button>
      </DialogFooter>
    </Dialog>
  );
}

export default DecryptionReasonModal;
