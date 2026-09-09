import React from "react";
import { Button } from "../ui/button";
import { Select } from "../ui/select";
import { ChevronLeft, ChevronRight } from "lucide-react";

export function Pagination({ pagination, onPageChange, onLimitChange }) {
  if (!pagination) return null;
  const { page = 1, totalPages = 1, totalItems = 0, limit = 25 } = pagination;

  const getPageNumbers = () => {
    const pages = [];
    const maxVisible = 5;
    let start = Math.max(1, page - Math.floor(maxVisible / 2));
    let end = Math.min(totalPages, start + maxVisible - 1);
    if (end - start + 1 < maxVisible) {
      start = Math.max(1, end - maxVisible + 1);
    }
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    return pages;
  };

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-border text-xs text-muted-foreground">
      <div className="flex items-center gap-2">
        <span>
          Showing page <strong className="text-foreground">{page}</strong> of{" "}
          <strong className="text-foreground">{totalPages || 1}</strong> ({totalItems} total)
        </span>
        <div className="flex items-center gap-1.5 ml-2">
          <span>Rows:</span>
          <Select
            value={limit}
            onChange={(e) => onLimitChange?.(Number(e.target.value))}
            className="h-7 py-0 px-2 text-xs"
          >
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </Select>
        </div>
      </div>

      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="sm"
          disabled={page <= 1}
          onClick={() => onPageChange?.(page - 1)}
          className="h-7 w-7 p-0"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </Button>

        {getPageNumbers().map((p) => (
          <Button
            key={p}
            variant={p === page ? "default" : "outline"}
            size="sm"
            onClick={() => onPageChange?.(p)}
            className="h-7 w-7 p-0 text-xs"
          >
            {p}
          </Button>
        ))}

        <Button
          variant="outline"
          size="sm"
          disabled={page >= totalPages}
          onClick={() => onPageChange?.(page + 1)}
          className="h-7 w-7 p-0"
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
