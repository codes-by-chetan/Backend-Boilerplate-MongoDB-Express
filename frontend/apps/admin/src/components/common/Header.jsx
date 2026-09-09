import React from "react";
import { Link } from "react-router-dom";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import {
  Sun,
  Moon,
  Activity,
  Radio,
  ExternalLink,
  LogOut,
  LogIn,
  Shield,
} from "lucide-react";

export function Header({
  theme,
  onToggleTheme,
  token,
  onOpenLogin,
  onLogout,
  socketConnected,
  inFlightRequests,
}) {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/70 bg-background/80 backdrop-blur-md transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
        {/* Logo / Title */}
        <Link to="/stream" className="flex items-center gap-3 hover:opacity-90 transition-opacity select-none">
          <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-primary/10 border border-primary/20 text-primary">
            <Shield className="h-4 w-4" />
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm tracking-tight">Express Sentinel</span>
              <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
                Observability
              </span>
            </div>
            <span className="text-[10px] text-muted-foreground hidden sm:inline">
              Real-Time Metrics, Audit Logs & Time-Machine
            </span>
          </div>
        </Link>

        {/* Live Status Indicators & Actions */}
        <div className="flex items-center gap-2.5">
          {/* Socket Connection Badge */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-border bg-card text-[11px] shadow-sm">
            <span
              className={`h-2 w-2 rounded-full ${
                socketConnected ? "bg-emerald-500 animate-pulse" : "bg-rose-500"
              }`}
            />
            <span className="font-medium text-muted-foreground">
              {socketConnected ? "Live Connected" : "Connecting..."}
            </span>
          </div>

          {/* In-Flight Requests Counter */}
          {inFlightRequests > 0 && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-primary/30 bg-primary/10 text-primary text-[11px] font-semibold animate-pulse">
              <Activity className="h-3 w-3" />
              <span>{inFlightRequests} in-flight</span>
            </div>
          )}

          {/* Log Viewer in-app route */}
          <Link
            to="/log-viewer?recent=true"
            className="hidden md:flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded hover:bg-muted/50"
            title="Open real-time raw logs viewer"
          >
            <span>Raw Logs</span>
            <ExternalLink className="h-3 w-3" />
          </Link>

          {/* Theme Toggle */}
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggleTheme}
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>

          {/* Auth Button */}
          {token ? (
            <Button
              variant="outline"
              size="sm"
              onClick={onLogout}
              className="h-8 gap-1.5 text-xs text-rose-600 dark:text-rose-400 hover:border-rose-500/50"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Logout</span>
            </Button>
          ) : (
            <Button
              variant="default"
              size="sm"
              onClick={onOpenLogin}
              className="h-8 gap-1.5 text-xs"
            >
              <LogIn className="h-3.5 w-3.5" />
              <span>Admin Sign In</span>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
