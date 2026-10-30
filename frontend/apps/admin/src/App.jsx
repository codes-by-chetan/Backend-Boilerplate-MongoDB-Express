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
import { SecurityView } from "./components/views/SecurityView";
import { UsersView } from "./components/views/UsersView";
import { VersionsView } from "./components/views/VersionsView";
import { LogViewerView } from "./components/views/LogViewerView";
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
  const [modalConfig, setModalConfig] = useState({ view: "login" });
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

  // Handle URL parameters for Account Unlock & Password Reset redirects (e.g. from security emails)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const isUnlocked = params.get("unlocked");
    const unlockTokenParam = params.get("unlockToken") || (!window.location.pathname.includes("reset-password") ? params.get("token") : null);
    const resetTokenParam = params.get("resetToken") || (window.location.pathname.includes("reset-password") ? params.get("token") : null);
    const errorParam = params.get("error");

    if (isUnlocked === "true") {
      setAuthBanner("Account unlocked successfully! You can now sign in with your credentials.");
      setModalConfig({ view: "login" });
      setIsLoginOpen(true);
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (isUnlocked === "false" || errorParam) {
      setAuthBanner(`Account action failed: ${errorParam || "The link has expired or is invalid."}`);
      setModalConfig({ view: "login" });
      setIsLoginOpen(true);
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (resetTokenParam) {
      setAuthBanner("Password reset token detected. Please set your new password below.");
      setModalConfig({ view: "reset" });
      setIsLoginOpen(true);
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (unlockTokenParam) {
      api.unlockAccount(unlockTokenParam)
        .then(() => {
          setAuthBanner("Account unlocked successfully via token! Please sign in.");
          setModalConfig({ view: "login" });
          setIsLoginOpen(true);
        })
        .catch((err) => {
          setAuthBanner(`Unlock failed: ${err.message || "Invalid or expired token"}`);
          setModalConfig({ view: "unlock" });
          setIsLoginOpen(true);
        })
        .finally(() => {
          window.history.replaceState({}, document.title, window.location.pathname);
        });
    }
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
                  <AuthRequiredCard onOpenLogin={() => setIsLoginOpen(true)} title="Host Server Telemetry" />
                ) : (
                  <SystemView stats={systemStats} onRefresh={async () => {
                    const res = await api.getSystemStats();
                    setSystemStats(res.data || res);
                  }} />
                )
              }
            />
            <Route
              path="/files"
              element={
                !token ? (
                  <AuthRequiredCard onOpenLogin={() => setIsLoginOpen(true)} title="Raw Server Log Files" />
                ) : (
                  <FilesView />
                )
              }
            />
            <Route
              path="/log-viewer"
              element={
                !token ? (
                  <AuthRequiredCard onOpenLogin={() => setIsLoginOpen(true)} title="Interactive Log File Viewer" />
                ) : (
                  <LogViewerView />
                )
              }
            />
            <Route
              path="/db-requests"
              element={
                !token ? (
                  <AuthRequiredCard onOpenLogin={() => setIsLoginOpen(true)} title="HTTP Requests Database Collection" />
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
              path="/security"
              element={
                !token ? (
                  <AuthRequiredCard onOpenLogin={() => setIsLoginOpen(true)} title="Security & Threat Management" />
                ) : (
                  <SecurityView />
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
            <Route
              path="/unlock-account"
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
              path="/reset-password"
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
            {/* Fallback route - Preserves query parameters */}
            <Route path="*" element={<Navigate to={`/stream${window.location.search || ""}`} replace />} />
          </Routes>
        </div>
      </main>

      <LoginModal
        open={isLoginOpen}
        onClose={() => setIsLoginOpen(false)}
        onLoginSuccess={handleLoginSuccess}
        initialView={modalConfig.view}
      />
    </div>
  );
}

export default App;
