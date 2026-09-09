import React, { useState } from "react";
import { ChevronRight, ChevronDown, Copy, Check } from "lucide-react";
import { Button } from "../ui/button";

function JsonNode({ name, value, isLast, depth = 0, isExpandedGlobal }) {
  const [expanded, setExpanded] = useState(depth < 2);

  React.useEffect(() => {
    if (isExpandedGlobal !== null) {
      setExpanded(isExpandedGlobal);
    }
  }, [isExpandedGlobal]);

  const isObject = value !== null && typeof value === "object";
  const isArray = Array.isArray(value);

  if (!isObject) {
    let formattedVal = JSON.stringify(value);
    let colorClass = "text-amber-500 dark:text-amber-400"; // number / default
    if (typeof value === "string") {
      colorClass = "text-emerald-600 dark:text-emerald-400";
    } else if (typeof value === "boolean") {
      colorClass = "text-purple-600 dark:text-purple-400 font-semibold";
    } else if (value === null) {
      colorClass = "text-muted-foreground italic";
      formattedVal = "null";
    }

    return (
      <div className="pl-4 py-0.5 font-mono text-[11px] leading-relaxed">
        {name && <span className="text-sky-600 dark:text-sky-400 font-medium">"{name}": </span>}
        <span className={colorClass}>{formattedVal}</span>
        {!isLast && <span className="text-muted-foreground">,</span>}
      </div>
    );
  }

  const entries = isArray
    ? value.map((val, idx) => [idx, val])
    : Object.entries(value);
  const openBracket = isArray ? "[" : "{";
  const closeBracket = isArray ? "]" : "}";

  return (
    <div className="pl-3 py-0.5 font-mono text-[11px] leading-relaxed">
      <div
        className="flex items-center gap-1 cursor-pointer select-none hover:bg-muted/40 rounded px-1 -ml-1 inline-flex"
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? (
          <ChevronDown className="h-3 w-3 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-3 w-3 text-muted-foreground" />
        )}
        {name && <span className="text-sky-600 dark:text-sky-400 font-medium">"{name}": </span>}
        <span className="text-muted-foreground font-semibold">
          {openBracket} {!expanded && <span className="text-[10px] text-muted-foreground/80">...{entries.length} items</span>}{" "}
          {!expanded && closeBracket}
        </span>
      </div>

      {expanded && (
        <div className="border-l border-border/50 ml-2">
          {entries.map(([key, val], idx) => (
            <JsonNode
              key={key}
              name={isArray ? null : key}
              value={val}
              isLast={idx === entries.length - 1}
              depth={depth + 1}
              isExpandedGlobal={isExpandedGlobal}
            />
          ))}
          <div className="pl-4 text-muted-foreground font-semibold">
            {closeBracket}
            {!isLast && ","}
          </div>
        </div>
      )}
    </div>
  );
}

export function JsonViewer({ data, title }) {
  const [copied, setCopied] = useState(false);
  const [expandAll, setExpandAll] = useState(null);

  const handleCopy = () => {
    navigator.clipboard.writeText(JSON.stringify(data, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (data === undefined || data === null) {
    return <div className="text-xs text-muted-foreground italic p-3">No data to display</div>;
  }

  return (
    <div className="rounded-lg border border-border bg-muted/20 overflow-hidden text-xs">
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-border bg-muted/40">
        <span className="font-mono text-[11px] font-semibold text-muted-foreground">
          {title || "JSON Data"}
        </span>
        <div className="flex items-center gap-1.5">
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-[10px]"
            onClick={() => setExpandAll(true)}
          >
            Expand All
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-[10px]"
            onClick={() => setExpandAll(false)}
          >
            Collapse All
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-6 px-2 text-[10px] gap-1"
            onClick={handleCopy}
          >
            {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
            {copied ? "Copied" : "Copy"}
          </Button>
        </div>
      </div>
      <div className="p-3 max-h-96 overflow-auto">
        <JsonNode value={data} isLast={true} depth={0} isExpandedGlobal={expandAll} />
      </div>
    </div>
  );
}
