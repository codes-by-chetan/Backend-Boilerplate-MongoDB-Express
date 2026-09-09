import React, { useState, useMemo } from "react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Badge } from "../ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "../ui/card";
import { Dialog, DialogHeader, DialogTitle, DialogDescription } from "../ui/dialog";
import { JsonViewer } from "../common/JsonViewer";
import {
  Play,
  Pause,
  Trash2,
  Search,
  Radio,
  Clock,
  ArrowUpDown,
  Filter,
} from "lucide-react";

export function StreamView({
  liveStream,
  streamPaused,
  onTogglePause,
  onClear,
  socketConnected,
}) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedRequest, setSelectedRequest] = useState(null);

  const filteredStream = useMemo(() => {
    return liveStream.filter((item) => {
      const matchesSearch =
        !search ||
        item.path?.toLowerCase().includes(search.toLowerCase()) ||
        item.method?.toLowerCase().includes(search.toLowerCase()) ||
        item.ip?.includes(search) ||
        String(item.statusCode).includes(search);

      const status = Number(item.statusCode);
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "2xx" && status >= 200 && status < 300) ||
        (statusFilter === "3xx" && status >= 300 && status < 400) ||
        (statusFilter === "4xx" && status >= 400 && status < 500) ||
        (statusFilter === "5xx" && status >= 500);

      return matchesSearch && matchesStatus;
    });
  }, [liveStream, search, statusFilter]);

  const getMethodVariant = (method = "GET") => {
    const m = method.toLowerCase();
    if (["get", "post", "put", "patch", "delete"].includes(m)) return m;
    return "default";
  };

  const getStatusVariant = (status) => {
    const s = Number(status);
    if (s >= 200 && s < 300) return "success";
    if (s >= 300 && s < 400) return "info";
    if (s >= 400 && s < 500) return "warning";
    if (s >= 500) return "destructive";
    return "secondary";
  };

  return (
    <div className="space-y-4">
      {/* Control Toolbar */}
      <Card className="p-4">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Button
              variant={streamPaused ? "default" : "outline"}
              size="sm"
              onClick={onTogglePause}
              className="gap-1.5 text-xs"
            >
              {streamPaused ? (
                <>
                  <Play className="h-3.5 w-3.5 text-emerald-500" />
                  <span>Resume Stream</span>
                </>
              ) : (
                <>
                  <Pause className="h-3.5 w-3.5 text-amber-500" />
                  <span>Pause Stream</span>
                </>
              )}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onClear}
              className="gap-1.5 text-xs text-muted-foreground hover:text-foreground"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>Clear</span>
            </Button>

            <span className="text-xs text-muted-foreground ml-2 hidden sm:inline">
              Buffer: <strong className="text-foreground">{liveStream.length}</strong> items
            </span>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-64">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Filter path, method, IP..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 h-8 text-xs"
              />
            </div>

            <div className="flex items-center gap-1 border border-border rounded-md p-0.5 bg-muted/30">
              {["all", "2xx", "4xx", "5xx"].map((s) => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`px-2 py-1 rounded text-[11px] font-medium transition-colors ${
                    statusFilter === s
                      ? "bg-background text-foreground shadow-sm font-semibold"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {s.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
        </div>
      </Card>

      {/* Stream List / Table */}
      <Card>
        <CardHeader className="p-4 border-b border-border flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <Radio className={`h-4 w-4 ${socketConnected ? "text-emerald-500 animate-pulse" : "text-muted-foreground"}`} />
            <CardTitle className="text-sm font-semibold">Real-Time Ingestion Pipe</CardTitle>
          </div>
          <span className="text-xs text-muted-foreground font-mono">
            WebSocket /socket.io
          </span>
        </CardHeader>
        <CardContent className="p-0">
          {filteredStream.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">
              <Radio className="h-8 w-8 mx-auto mb-2 opacity-30 animate-pulse" />
              <p className="text-sm font-medium">Awaiting incoming telemetry events...</p>
              <p className="text-xs mt-1">Trigger any API request to see it streamed live here.</p>
            </div>
          ) : (
            <div className="divide-y divide-border/60 max-h-[600px] overflow-y-auto">
              {filteredStream.map((item, idx) => (
                <div
                  key={item._id || item.requestId || idx}
                  onClick={() => setSelectedRequest(item)}
                  className="flex items-center justify-between p-3 px-4 hover:bg-muted/40 cursor-pointer transition-colors text-xs font-mono group"
                >
                  <div className="flex items-center gap-3 overflow-hidden">
                    <Badge variant={getMethodVariant(item.method)}>
                      {item.method || "GET"}
                    </Badge>
                    <Badge variant={getStatusVariant(item.statusCode)}>
                      {item.statusCode || 200}
                    </Badge>
                    <span className="font-semibold text-foreground truncate max-w-md">
                      {item.path || item.url || "/"}
                    </span>
                  </div>

                  <div className="flex items-center gap-4 text-muted-foreground shrink-0 text-[11px]">
                    <span className="hidden md:inline font-mono">{item.ip || "127.0.0.1"}</span>
                    <span className="flex items-center gap-1 font-semibold text-foreground">
                      <Clock className="h-3 w-3 text-muted-foreground" />
                      {item.responseTime ? `${Math.round(item.responseTime)}ms` : item.duration ? `${item.duration}ms` : "< 1ms"}
                    </span>
                    <span className="text-[10px]">
                      {new Date(item.timestamp || Date.now()).toLocaleTimeString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detail Inspector Modal */}
      {selectedRequest && (
        <Dialog open={!!selectedRequest} onClose={() => setSelectedRequest(null)} className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Badge variant={getMethodVariant(selectedRequest.method)}>
                {selectedRequest.method}
              </Badge>
              <span className="font-mono text-sm">{selectedRequest.path || selectedRequest.url}</span>
              <Badge variant={getStatusVariant(selectedRequest.statusCode)}>
                {selectedRequest.statusCode}
              </Badge>
            </DialogTitle>
            <DialogDescription>
              Telemetry captured at {new Date(selectedRequest.timestamp || Date.now()).toLocaleString()}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-3">
            {/* Quick stats grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <div className="p-2 rounded bg-muted/40 border border-border">
                <span className="text-muted-foreground block text-[10px] uppercase font-bold">Duration</span>
                <span className="font-mono font-semibold">{selectedRequest.responseTime || selectedRequest.duration || 0} ms</span>
              </div>
              <div className="p-2 rounded bg-muted/40 border border-border">
                <span className="text-muted-foreground block text-[10px] uppercase font-bold">Client IP</span>
                <span className="font-mono font-semibold">{selectedRequest.ip || "127.0.0.1"}</span>
              </div>
              <div className="p-2 rounded bg-muted/40 border border-border">
                <span className="text-muted-foreground block text-[10px] uppercase font-bold">Status Code</span>
                <span className="font-mono font-semibold">{selectedRequest.statusCode}</span>
              </div>
              <div className="p-2 rounded bg-muted/40 border border-border">
                <span className="text-muted-foreground block text-[10px] uppercase font-bold">User Agent</span>
                <span className="font-mono text-[11px] truncate block" title={selectedRequest.userAgent}>
                  {selectedRequest.userAgent || "Unknown"}
                </span>
              </div>
            </div>

            {/* Request Payload */}
            {selectedRequest.requestBody && (
              <JsonViewer data={selectedRequest.requestBody} title="Request Body Payload" />
            )}

            {/* Response Payload */}
            {selectedRequest.responseBody && (
              <JsonViewer data={selectedRequest.responseBody} title="Response Body Payload" />
            )}

            {/* Full raw telemetry object */}
            <JsonViewer data={selectedRequest} title="Complete Telemetry Object" />
          </div>
        </Dialog>
      )}
    </div>
  );
}
