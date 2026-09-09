import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Card, CardHeader, CardTitle, CardContent } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Select } from "../ui/select";
import { Pagination } from "../common/Pagination";
import {
  FileText,
  Search,
  RefreshCw,
  ExternalLink,
  Calendar,
  AlertTriangle,
  ArrowUpDown,
} from "lucide-react";
import { api } from "../../api/client";

export function FilesView() {
  const [files, setFiles] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, totalItems: 0, limit: 10 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("date");
  const [order, setOrder] = useState("desc");
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split("T")[0]);

  const fetchFiles = async (page = 1, limit = 10) => {
    setLoading(true);
    setError("");
    try {
      const params = {
        page,
        limit,
        sortBy,
        order,
        ...(search && { search }),
      };
      const res = await api.getFileLogs(params);
      const data = res.data || res;
      setFiles(data.logs || (Array.isArray(data) ? data : []));
      if (data.pagination) {
        setPagination({
          page: data.pagination.page,
          limit: data.pagination.limit,
          totalPages: data.pagination.totalPages || 1,
          totalItems: data.pagination.total || 0,
        });
      }
    } catch (err) {
      setError(err.message || "Failed to load log files from server");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFiles(1, pagination.limit);
  }, [sortBy, order]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchFiles(1, pagination.limit);
  };

  const navigate = useNavigate();

  const openLogViewer = (type, target) => {
    let path = "/log-viewer";
    if (type === "file") path += `?file=${encodeURIComponent(target)}`;
    else if (type === "date") path += `?date=${encodeURIComponent(target)}`;
    else path += "?recent=true";
    navigate(path);
  };


  const formatFileSize = (bytes) => {
    if (!bytes || bytes === 0) return "0 B";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  return (
    <div className="space-y-4">
      {/* Control bar */}
      <Card className="p-4">
        <form onSubmit={handleSearchSubmit} className="flex flex-col lg:flex-row items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
            <div className="relative flex-1 sm:w-56">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search file name..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 h-8 text-xs"
              />
            </div>

            <Select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="h-8 text-xs"
            >
              <option value="date">Sort: Date</option>
              <option value="size">Sort: File Size</option>
              <option value="updatedAt">Sort: Last Modified</option>
            </Select>

            <Select
              value={order}
              onChange={(e) => setOrder(e.target.value)}
              className="h-8 text-xs"
            >
              <option value="desc">Newest First</option>
              <option value="asc">Oldest First</option>
            </Select>

            <Button type="submit" size="sm" className="h-8 text-xs">
              Filter
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fetchFiles(pagination.page, pagination.limit)}
              disabled={loading}
              className="h-8 text-xs gap-1"
            >
              <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">Refresh</span>
            </Button>
          </div>

          {/* Quick Date Opener */}
          <div className="flex items-center gap-2 w-full lg:w-auto">
            <Input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="h-8 text-xs w-36"
            />
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => openLogViewer("date", selectedDate)}
              className="h-8 text-xs whitespace-nowrap"
            >
              Open Date
            </Button>
            <Button
              type="button"
              variant="default"
              size="sm"
              onClick={() => openLogViewer("recent", "true")}
              className="h-8 text-xs whitespace-nowrap gap-1"
            >
              <span>Recent Logs</span>
              <ExternalLink className="h-3 w-3" />
            </Button>
          </div>
        </form>
      </Card>

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg border border-destructive/30 bg-destructive/10 text-destructive text-xs">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Files List Table */}
      <Card>
        <CardHeader className="p-4 border-b border-border flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" />
            <CardTitle className="text-sm font-semibold">Server HTML Daily Log Files</CardTitle>
          </div>
          <span className="text-xs text-muted-foreground">
            {pagination.totalItems} file(s) recorded in logs/ directory
          </span>
        </CardHeader>

        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-muted/40 border-b border-border text-[11px] text-muted-foreground uppercase font-semibold">
                <tr>
                  <th className="py-2.5 px-4">File Name</th>
                  <th className="py-2.5 px-4">Size</th>
                  <th className="py-2.5 px-4">Last Modified</th>
                  <th className="py-2.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {loading ? (
                  <tr>
                    <td colSpan={4} className="py-12 text-center text-muted-foreground">
                      Scanning server log files...
                    </td>
                  </tr>
                ) : files.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-12 text-center text-muted-foreground">
                      No matching log files found on disk.
                    </td>
                  </tr>
                ) : (
                  files.map((file) => (
                    <tr key={file.fileName} className="hover:bg-muted/40 transition-colors">
                      <td className="py-2.5 px-4 font-semibold text-foreground">
                        {file.fileName}
                      </td>
                      <td className="py-2.5 px-4 text-muted-foreground">
                        {formatFileSize(file.size)}
                      </td>
                      <td className="py-2.5 px-4 text-muted-foreground text-[11px]">
                        {new Date(file.updatedAt).toLocaleString()}
                      </td>
                      <td className="py-2.5 px-4 text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openLogViewer("file", file.fileName)}
                          className="h-7 text-[11px] gap-1.5"
                        >
                          <span>Open Viewer</span>
                          <ExternalLink className="h-3 w-3 text-muted-foreground" />
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="p-4">
            <Pagination
              pagination={pagination}
              onPageChange={(p) => fetchFiles(p, pagination.limit)}
              onLimitChange={(l) => fetchFiles(1, l)}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
