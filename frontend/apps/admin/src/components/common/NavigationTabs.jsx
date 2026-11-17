import React from "react";
import { Link, useLocation } from "react-router-dom";
import {
  Radio,
  Cpu,
  FileText,
  Database,
  ShieldCheck,
  ShieldAlert,
  GitBranch,
  Users,
  Lock,
  Archive,
} from "lucide-react";

export function NavigationTabs({ token, liveStreamCount = 0 }) {
  const location = useLocation();
  const currentPath = location.pathname;
  const isStreamActive = currentPath === "/" || currentPath === "/stream" || currentPath === "";

  const tabs = [
    { id: "stream", label: "Real-Time Stream", path: "/stream", count: liveStreamCount, icon: Radio },
    { id: "system", label: "System Telemetry", path: "/system", icon: Cpu, requiresAuth: true },
    { id: "files", label: "Log Files", path: "/files", icon: FileText, requiresAuth: true },
    { id: "db-requests", label: "HTTP Requests", path: "/db-requests", icon: Database, requiresAuth: true },
    { id: "archive-explorer", label: "Archive & Query", path: "/archive-explorer", icon: Archive, requiresAuth: true },
    { id: "db-audits", label: "Audit Trails", path: "/db-audits", icon: ShieldCheck, requiresAuth: true },
    { id: "security", label: "Security & Lockouts", path: "/security", icon: ShieldAlert, requiresAuth: true },
    { id: "versions", label: "Time Machine", path: "/versions", icon: GitBranch, requiresAuth: true },
    { id: "users", label: "Users", path: "/users", icon: Users, requiresAuth: true },
  ];

  return (
      <div
        className="w-full max-w-full overflow-x-auto border-b border-border/80 pb-px scrollbar-none flex items-center gap-1 min-w-0 px-0.5"
        style={{ WebkitOverflowScrolling: "touch" }}
      >
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive =
            tab.id === "stream"
              ? isStreamActive
              : currentPath.startsWith(tab.path) ||
              (tab.id === "files" && currentPath.startsWith("/log-viewer"));
          return (
            <Link
              key={tab.id}
              to={tab.path}
                    ? "border-primary text-primary bg-card/60 shadow-xs"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/40"
                  }`}
          >
            <Icon className={`h - 3.5 w - 3.5 shrink - 0 ${ isActive ? "text-primary" : "text-muted-foreground" } `} />
            <span className="shrink-0">{tab.label}</span>
            {tab.count !== undefined && (
              <span
            className = {`text-[10px] px-1.5 py-0.2 rounded-full shrink-0 ${isActive ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"
              }`
          }
              >
            { tab.count }
              </span>
            )}
      {tab.requiresAuth && !token && (
              <Lock className="h-3 w-3 text-muted-foreground opacity-60 ml-0.5 shrink-0" />
      )}
    </Link>
  );
})}
    </div >
  );
}

export default NavigationTabs;
