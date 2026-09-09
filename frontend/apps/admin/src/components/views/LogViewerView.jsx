import React, { useState, useEffect, useRef } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import { Card, CardHeader, CardTitle, CardContent } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Badge } from "../ui/badge";
import {
  ArrowLeft,
  RefreshCw,
  Search,
  Copy,
  Check,
  Download,
  Terminal,
  AlertCircle,
  FileText,
  Calendar,
  Clock,
  ArrowDownCircle,
} from "lucide-react";
import { api } from "../../api/client";

export function LogViewerView() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const typeParam = searchParams.get("type");
  const targetParam = searchParams.get("target");

  const file = searchParams.get("file") || (typeParam === "file" ? targetParam : null);
  const date = searchParams.get("date") || (typeParam === "date" ? targetParam : null);
  const recent = searchParams.get("recent") || (typeParam === "recent" ? "true" : null);

  const [rawHtml, setRawHtml] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filterQuery, setFilterQuery] = useState("");
  const [copied, setCopied] = useState(false);
  const [autoScroll, setAutoScroll] = useState(false);

  const logContainerRef = useRef(null);

  const title = file
    ? file
    : date
    ? `logs-${date}.html`
    : "Today's Recent Log";

  const fetchLog = async () => {
    setLoading(true);
    setError("");
    try {
      let content = "";
      if (file) {
        content = await api.getRawLogFile(file);
      } else if (date) {
        content = await api.getRawLogsByDate(date);
      } else {
        content = await api.getRawRecentLogs();
      }
      setRawHtml(content || "");
    } catch (err) {
      setError(err.message || "Failed to load log file from server.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLog();
  }, [file, date, recent]);

  useEffect(() => {
    if (autoScroll && logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [rawHtml, autoScroll]);

  // Clean raw HTML to strip outer boilerplate tags if present
  const cleanedHtml = React.useMemo(() => {
    if (!rawHtml) return "";
    let clean = String(rawHtml)
      .replace(/<!DOCTYPE[^>]*>/gi, "")
      .replace(/<html[^>]*>/gi, "")
      .replace(/<\/html>/gi, "")
      .replace(/<head>[\s\S]*?<\/head>/gi, "")
      .replace(/<body[^>]*>/gi, "")
      .replace(/<\/body>/gi, "")
      .trim();

    // If filter query is applied, filter matching lines
    if (filterQuery.trim()) {
      const q = filterQuery.toLowerCase();
      // Split by common line breaks
      const lines = clean.split(/\r?\n/);
      const matched = lines.filter((line) => {
        // Strip tags to search plain text
        const text = line.replace(/<[^>]+>/g, "").toLowerCase();
        return text.includes(q);
      });
      return matched.join("\n");
    }

    return clean;
  }, [rawHtml, filterQuery]);

  const lineCount = React.useMemo(() => {
    if (!cleanedHtml) return 0;
    return cleanedHtml.split(/\r?\n/).length;
  }, [cleanedHtml]);

  const totalLines = React.useMemo(() => {
    if (!rawHtml) return 0;
    return rawHtml.split(/\r?\n/).length;
  }, [rawHtml]);

  const handleCopy = () => {
    const plainText = cleanedHtml.replace(/<[^>]+>/g, "");
    navigator.clipboard.writeText(plainText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const plainText = cleanedHtml.replace(/<[^>]+>/g, "");
    const blob = new Blob([plainText], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = (title.endsWith(".html") ? title.replace(".html", ".log") : `${title}.log`);
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      {/* Top Action & Navigation Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-card border border-border rounded-xl p-3.5 shadow-xs">
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate("/files")}
            className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Log Files</span>
          </Button>

          <div className="h-4 w-px bg-border/80 hidden sm:block" />

          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center h-7 w-7 rounded-lg bg-primary/10 text-primary border border-primary/20">
              <Terminal className="h-3.5 w-3.5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs sm:text-sm font-bold text-foreground">
                  {title}
                </span>
                <Badge variant="outline" className="text-[10px] font-mono py-0 h-4">
                  {lineCount} {filterQuery ? `of ${totalLines}` : ""} lines
                </Badge>
              </div>
              <span className="text-[11px] text-muted-foreground hidden sm:block">
                Raw server execution and request logs
              </span>
            </div>
          </div>
        </div>

        {/* Toolbar controls */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* In-page filter search */}
          <div className="relative flex-1 sm:w-56 min-w-[140px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              placeholder="Filter log lines..."
              className="pl-8 h-8 text-xs bg-background/50 font-mono"
            />
            {filterQuery && (
              <button
                onClick={() => setFilterQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground hover:text-foreground"
              >
                ✕
              </button>
            )}
          </div>

          {/* Auto Scroll Toggle */}
          <Button
            variant={autoScroll ? "secondary" : "outline"}
            size="sm"
            onClick={() => setAutoScroll(!autoScroll)}
            className="h-8 gap-1 text-xs"
            title="Auto-scroll to bottom"
          >
            <ArrowDownCircle className={`h-3.5 w-3.5 ${autoScroll ? "text-primary animate-bounce" : ""}`} />
            <span className="hidden sm:inline">Follow</span>
          </Button>

          {/* Copy Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopy}
            disabled={!cleanedHtml}
            className="h-8 gap-1 text-xs"
            title="Copy log to clipboard"
          >
            {copied ? (
              <>
                <Check className="h-3.5 w-3.5 text-emerald-500" />
                <span className="text-emerald-500">Copied</span>
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Copy</span>
              </>
            )}
          </Button>

          {/* Download Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownload}
            disabled={!cleanedHtml}
            className="h-8 gap-1 text-xs"
            title="Download log file"
          >
            <Download className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Download</span>
          </Button>

          {/* Refresh Button */}
          <Button
            variant="default"
            size="sm"
            onClick={fetchLog}
            disabled={loading}
            className="h-8 gap-1 text-xs"
            title="Refresh log"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="flex items-center gap-2 p-3.5 rounded-lg border border-destructive/30 bg-destructive/10 text-destructive text-xs">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span className="flex-1">{error}</span>
          <Button variant="outline" size="sm" onClick={fetchLog} className="h-7 text-xs">
            Retry
          </Button>
        </div>
      )}

      {/* Terminal View Container */}
      <Card className="border-border bg-card text-foreground dark:bg-[#090d16] dark:text-[#f8fafc] shadow-sm overflow-hidden rounded-xl">
        <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-muted/50 dark:bg-slate-900/60 dark:border-white/10 text-[11px] font-mono text-muted-foreground dark:text-slate-400">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-rose-500/80 inline-block" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber-500/80 inline-block" />
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/80 inline-block" />
            <span className="ml-2 text-foreground dark:text-slate-300 font-semibold">{title}</span>
          </div>
          <div>
            {loading ? (
              <span className="text-primary animate-pulse">Streaming logs...</span>
            ) : (
              <span>UTF-8 • {lineCount} Lines</span>
            )}
          </div>
        </div>

        <div
          ref={logContainerRef}
          className="p-4 sm:p-6 overflow-x-auto overflow-y-auto max-h-[72vh] text-xs font-mono leading-relaxed select-text"
          style={{ minHeight: "380px" }}
        >
          {loading && !cleanedHtml ? (
            <div className="flex flex-col items-center justify-center py-24 text-muted-foreground space-y-3">
              <RefreshCw className="h-6 w-6 animate-spin text-primary" />
              <p className="text-xs">Fetching log data from server...</p>
            </div>
          ) : !cleanedHtml ? (
            <div className="text-center py-20 text-muted-foreground space-y-2">
              <FileText className="h-8 w-8 mx-auto opacity-30" />
              <p className="text-sm font-semibold text-foreground">Log is currently empty</p>
              <p className="text-xs text-muted-foreground">
                {filterQuery
                  ? `No lines matched filter "${filterQuery}"`
                  : "No events recorded in this log file yet."}
              </p>
            </div>
          ) : (
            <div
              className="log-html-output space-y-0.5 whitespace-pre-wrap break-words"
              dangerouslySetInnerHTML={{ __html: cleanedHtml }}
            />
          )}
        </div>
      </Card>
    </div>
  );
}

export default LogViewerView;
