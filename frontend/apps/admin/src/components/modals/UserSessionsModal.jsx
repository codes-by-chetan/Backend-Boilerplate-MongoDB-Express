import React from "react";
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "../ui/dialog";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import {
  Laptop,
  Smartphone,
  RefreshCw,
  AlertTriangle,
  Trash2,
  Clock,
} from "lucide-react";

export function UserSessionsModal({
  user,
  isOpen,
  onClose,
  sessionsData,
  loading = false,
  error = "",
  revokingTokenId = null,
  onRevokeSingleSession,
  onRevokeAllSessions,
}) {
  return (
    <Dialog
      open={isOpen}
      onClose={onClose}
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
            {user?.fullNameString || user?.email}
          </span>{" "}
          ({user?.email})
        </DialogDescription>
      </DialogHeader>

      <div className="py-3 space-y-3">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-10 text-muted-foreground gap-2">
            <RefreshCw className="h-6 w-6 animate-spin text-primary" />
            <span className="text-xs">Loading active device sessions...</span>
          </div>
        ) : error ? (
          <div className="p-3 rounded-lg border border-destructive/30 bg-destructive/10 text-destructive text-xs flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
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
                            onClick={() => onRevokeSingleSession && onRevokeSingleSession(s.tokenId)}
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
              onClick={onRevokeAllSessions}
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
          onClick={onClose}
          className="h-8 text-xs"
        >
          Close
        </Button>
      </DialogFooter>
    </Dialog>
  );
}

export default UserSessionsModal;
