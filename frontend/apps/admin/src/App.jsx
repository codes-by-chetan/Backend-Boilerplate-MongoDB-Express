import React, { useState, useEffect } from "react";
import { Routes, Route, Navigate, Link, useLocation } from "react-router-dom";
import { Header } from "./components/common/Header";
import { QuickStats } from "./components/common/QuickStats";
import { LoginModal } from "./components/common/LoginModal";
import { StreamView } from "./components/views/StreamView";
import { SystemView } from "./components/views/SystemView";
import { FilesView } from "./components/views/FilesView";
import { DbRequestsView } from "./components/views/DbRequestsView";
import { DbAuditsView } from "./components/views/DbAuditsView";
import { VersionsView } from "./components/views/VersionsView";
import { LogViewerView } from "./components/views/LogViewerView";
import { useTheme } from "./hooks/useTheme";
import { useSocket } from "./hooks/useSocket";
import {
  getToken,
  setStoredToken,
  setOnUnauthorized,
  api,
} from "./api/client";
import {
  Radio,
  Cpu,
  FileText,
  Database,
  ShieldCheck,
  GitBranch,
  Lock,
  LogIn,
} from "lucide-react";
import { Button } from "./components/ui/button";

export function App() {
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();
  const [token, setToken] = useState(() => getToken());
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [authBanner, setAuthBanner] = useState("");
  const [systemStats, setSystemStats] = useState(null);

  const {
    socketConnected,
    liveStream,
    streamPaused,
    liveMetrics,
    clearStream,
    togglePauseStream,
  } = useSocket(token);

  useEffect(() => {
    setOnUnauthorized((msg) => {
      setStoredToken("");
      setToken("");
      setAuthBanner(msg);
      setIsLoginOpen(true);
    });
  }, []);

  // Fetch initial system telemetry if token is available
  useEffect(() => {
    if (!token) return;
    const loadStats = async () => {
      try {
        const res = await api.getSystemStats();
        setSystemStats(res.data || res);
      } catch (err) {
        // Silently catch or wait for manual refresh
      }
    };
    loadStats();
  }, [token]);

  const handleLoginSuccess = (newToken) => {
    setStoredToken(newToken);
    setToken(newToken);
    setAuthBanner("");
  };

  const handleLogout = () => {
    setStoredToken("");
    setToken("");
    setSystemStats(null);
    setAuthBanner("Logged out successfully.");
  };

  const tabs = [
    { id: "stream", label: "Real-Time Stream", path: "/stream", count: liveStream.length, icon: Radio },
    { id: "system", label: "System Telemetry", path: "/system", icon: Cpu, requiresAuth: true },
    { id: "files", label: "Log Files", path: "/files", icon: FileText, requiresAuth: true },
    { id: "db-requests", label: "HTTP Requests", path: "/db-requests", icon: Database, requiresAuth: true },
    { id: "db-audits", label: "Audit Trails", path: "/db-audits", icon: ShieldCheck, requiresAuth: true },
    { id: "versions", label: "Time Machine", path: "/versions", icon: GitBranch, requiresAuth: true },
  ];

  const currentPath = location.pathname;
  const isStreamActive = currentPath === "/" || currentPath === "/stream" || currentPath === "";

  return (
    <div className="min-h-screen bg-background text-foreground transition-colors">
      <Header
        theme={theme}
        onToggleTheme={toggleTheme}
        token={token}
        onOpenLogin={() => setIsLoginOpen(true)}
        onLogout={handleLogout}
        socketConnected={socketConnected}
        inFlightRequests={liveMetrics?.inFlightRequests || 0}
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-5 space-y-5">
        {/* Auth notification banner if any */}
        {authBanner && (
          <div className="flex items-center justify-between p-3 rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400 text-xs">
            <span>{authBanner}</span>
            <button
              onClick={() => setAuthBanner("")}
              className="text-xs font-semibold underline hover:no-underline ml-4"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Real-time Quick Dash Metric Cards */}
        <QuickStats
          liveMetrics={liveMetrics}
          systemStats={systemStats}
        />

        {/* Tab Navigation Bar with Client-Side Routing */}
        <div className="flex items-center gap-1.5 overflow-x-auto border-b border-border/80 pb-px scrollbar-none">
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
                className={`flex items-center gap-2 px-3.5 py-2.5 rounded-t-lg text-xs font-semibold whitespace-nowrap transition-all border-b-2 select-none ${
                  isActive
                    ? "border-primary text-primary bg-card/60 shadow-xs"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/40"
                }`}
              >
                <Icon className={`h-3.5 w-3.5 ${isActive ? "text-primary" : "text-muted-foreground"}`} />
                <span>{tab.label}</span>
                {tab.count !== undefined && (
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                    isActive ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"
                  }`}>
                    {tab.count}
                  </span>
                )}
                {tab.requiresAuth && !token && (
                  <Lock className="h-3 w-3 text-muted-foreground opacity-60 ml-0.5" />
                )}
              </Link>
            );
          })}
        </div>

        {/* Tab View Contents via Route Matching */}
        <div className="pt-1">
          <Routes>
            <Route
              path="/"
              element={
                <StreamView
                  liveStream={liveStream}
                  streamPaused={streamPaused}
                  onTogglePause={togglePauseStream}
                  onClear={clearStream}
                  socketConnected={socketConnected}
                />
              }
            />
            <Route
              path="/stream"
              element={
                <StreamView
                  liveStream={liveStream}
                  streamPaused={streamPaused}
                  onTogglePause={togglePauseStream}
                  onClear={clearStream}
                  socketConnected={socketConnected}
                />
              }
            />
            <Route
              path="/system"
              element={
                !token ? (
                  <AuthRequiredCard onOpenLogin={() => setIsLoginOpen(true)} title="System Telemetry & V8 Metrics" />
                ) : (
                  <SystemView liveMetrics={liveMetrics} token={token} />
                )
              }
            />
            <Route
              path="/files"
              element={
                !token ? (
                  <AuthRequiredCard onOpenLogin={() => setIsLoginOpen(true)} title="Server HTML Log Files" />
                ) : (
                  <FilesView />
                )
              }
            />
            <Route
              path="/log-viewer"
              element={
                !token ? (
                  <AuthRequiredCard onOpenLogin={() => setIsLoginOpen(true)} title="Raw Server Log Viewer" />
                ) : (
                  <LogViewerView />
                )
              }
            />
            <Route
              path="/db-requests"
              element={
                !token ? (
                  <AuthRequiredCard onOpenLogin={() => setIsLoginOpen(true)} title="MongoDB HTTP Request Logs" />
                ) : (
                  <DbRequestsView />
                )
              }
            />
            <Route
              path="/db-audits"
              element={
                !token ? (
                  <AuthRequiredCard onOpenLogin={() => setIsLoginOpen(true)} title="MongoDB Mutation Audit Trail" />
                ) : (
                  <DbAuditsView />
                )
              }
            />
            <Route
              path="/versions"
              element={
                !token ? (
                  <AuthRequiredCard onOpenLogin={() => setIsLoginOpen(true)} title="Mongoose Version Time-Machine & Rollback" />
                ) : (
                  <VersionsView />
                )
              }
            />
            {/* Fallback route */}
            <Route path="*" element={<Navigate to="/stream" replace />} />
          </Routes>
        </div>
      </main>

      <LoginModal
        open={isLoginOpen}
        onClose={() => setIsLoginOpen(false)}
        onLoginSuccess={handleLoginSuccess}
      />
    </div>
  );
}

function AuthRequiredCard({ onOpenLogin, title }) {
  return (
    <div className="p-12 text-center rounded-xl border border-border bg-card space-y-3 shadow-sm max-w-lg mx-auto my-6">
      <div className="h-10 w-10 rounded-full bg-primary/10 border border-primary/20 text-primary flex items-center justify-center mx-auto">
        <Lock className="h-5 w-5" />
      </div>
      <h3 className="text-sm font-bold text-foreground">Admin Session Required</h3>
      <p className="text-xs text-muted-foreground">
        {title} requires an active administrator token to inspect.
      </p>
      <div className="pt-2">
        <Button onClick={onOpenLogin} size="sm" className="gap-1.5">
          <LogIn className="h-3.5 w-3.5" />
          <span>Sign In with Admin Credentials</span>
        </Button>
      </div>
    </div>
  );
}

export default App;
