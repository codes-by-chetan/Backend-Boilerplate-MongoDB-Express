import React, { useState, useEffect } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { Header } from "./components/common/Header";
import { QuickStats } from "./components/common/QuickStats";
import { NavigationTabs } from "./components/common/NavigationTabs";
import { AuthRequiredCard } from "./components/common/AuthRequiredCard";
import { LoginModal } from "./components/common/LoginModal";
import { StreamView } from "./components/views/StreamView";
import { SystemView } from "./components/views/SystemView";
import { FilesView } from "./components/views/FilesView";
import { DbRequestsView } from "./components/views/DbRequestsView";
import { DbAuditsView } from "./components/views/DbAuditsView";
import { VersionsView } from "./components/views/VersionsView";
import { LogViewerView } from "./components/views/LogViewerView";
import { UsersView } from "./components/views/UsersView";
import { useTheme } from "./hooks/useTheme";
import { useSocket } from "./hooks/useSocket";
import {
  getToken,
  setStoredTokens,
  clearStoredTokens,
  setOnUnauthorized,
  onTokenRefreshed,
  isUserAdmin,
  getCurrentUser,
  api,
} from "./api/client";

export function App() {
  const { theme, toggleTheme } = useTheme();
  const [token, setToken] = useState(() => getToken());
  const [currentUser, setCurrentUser] = useState(() => getCurrentUser());
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
      clearStoredTokens();
      setToken("");
      setCurrentUser(null);
      setAuthBanner(msg);
      setIsLoginOpen(true);
    });

    const unsubscribe = onTokenRefreshed((newToken) => {
      if (newToken && !isUserAdmin(newToken)) {
        clearStoredTokens();
        setToken("");
        setCurrentUser(null);
        setAuthBanner("Access Denied: The authenticated account does not have Admin privileges.");
        setIsLoginOpen(true);
        return;
      }
      setToken(newToken);
      setCurrentUser(getCurrentUser());
    });

    return unsubscribe;
  }, []);

  // Enforce Admin role on startup and token change
  useEffect(() => {
    if (token) {
      if (!isUserAdmin(token)) {
        clearStoredTokens();
        setToken("");
        setCurrentUser(null);
        setAuthBanner("Access Denied: Only accounts with the Admin role can access this portal.");
        setIsLoginOpen(true);
        return;
      }
      setCurrentUser(getCurrentUser());
    } else {
      setCurrentUser(null);
    }
  }, [token]);

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

  const handleLoginSuccess = (data) => {
    const accessToken = typeof data === "string" ? data : data.accessToken;
    const refreshToken = typeof data === "object" ? data.refreshToken : null;
    setStoredTokens({ accessToken, refreshToken });
    setToken(accessToken);
    setCurrentUser(getCurrentUser());
    setAuthBanner("");
  };

  const handleLogout = async () => {
    await api.logout().catch(() => {});
    clearStoredTokens();
    setToken("");
    setCurrentUser(null);
    setSystemStats(null);
    setAuthBanner("Logged out successfully.");
  };

  return (
    <div className="min-h-screen bg-background text-foreground transition-colors">
      <Header
        theme={theme}
        onToggleTheme={toggleTheme}
        token={token}
        currentUser={currentUser}
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
        <NavigationTabs
          token={token}
          liveStreamCount={liveStream.length}
        />

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
            <Route
              path="/users"
              element={
                !token ? (
                  <AuthRequiredCard onOpenLogin={() => setIsLoginOpen(true)} title="User Directory & Role Access" />
                ) : (
                  <UsersView />
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

export default App;
