export const STORAGE_KEY_TOKEN = "adminAccessToken";
export const STORAGE_KEY_REFRESH_TOKEN = "adminRefreshToken";
export const STORAGE_KEY_THEME = "adminTheme";

export function parseJwt(token) {
  try {
    if (!token) return null;
    const base64Url = token.split(".")[1];
    if (!base64Url) return null;
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
    return JSON.parse(jsonPayload);
  } catch {
    return null;
  }
}

export function isUserAdmin(token = null) {
  const activeToken = token || (typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY_TOKEN) : null);
  if (!activeToken) return false;
  const payload = parseJwt(activeToken);
  return payload?.role === "admin";
}

export function getCurrentUser() {
  const token = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY_TOKEN) : null;
  return parseJwt(token);
}

export function getToken() {
  const token = localStorage.getItem(STORAGE_KEY_TOKEN) || "";
  if (token) {
    const payload = parseJwt(token);
    if (payload && payload.role && payload.role !== "admin") {
      clearStoredTokens();
      return "";
    }
  }
  return token;
}

export function getRefreshToken() {
  return localStorage.getItem(STORAGE_KEY_REFRESH_TOKEN) || "";
}

const tokenRefreshedListeners = new Set();

export function onTokenRefreshed(callback) {
  tokenRefreshedListeners.add(callback);
  return () => tokenRefreshedListeners.delete(callback);
}

function notifyTokenRefreshed(newToken) {
  tokenRefreshedListeners.forEach((cb) => {
    try {
      cb(newToken);
    } catch (_) {}
  });
}

export function setStoredToken(token) {
  if (token) {
    const payload = parseJwt(token);
    if (payload && payload.role !== "admin") {
      clearStoredTokens();
      throw new Error("Access denied: Only accounts with Admin role can access this portal.");
    }
    localStorage.setItem(STORAGE_KEY_TOKEN, token);
    notifyTokenRefreshed(token);
  } else {
    localStorage.removeItem(STORAGE_KEY_TOKEN);
    notifyTokenRefreshed("");
  }
}

export function setStoredTokens({ accessToken, refreshToken }) {
  if (accessToken) {
    const payload = parseJwt(accessToken);
    if (payload && payload.role !== "admin") {
      clearStoredTokens();
      throw new Error("Access denied: Only accounts with Admin role can access this portal.");
    }
    localStorage.setItem(STORAGE_KEY_TOKEN, accessToken);
    notifyTokenRefreshed(accessToken);
  } else {
    localStorage.removeItem(STORAGE_KEY_TOKEN);
    notifyTokenRefreshed("");
  }

  if (refreshToken) {
    localStorage.setItem(STORAGE_KEY_REFRESH_TOKEN, refreshToken);
  } else if (refreshToken === null) {
    localStorage.removeItem(STORAGE_KEY_REFRESH_TOKEN);
  }
}

export function clearStoredTokens() {
  localStorage.removeItem(STORAGE_KEY_TOKEN);
  localStorage.removeItem(STORAGE_KEY_REFRESH_TOKEN);
  notifyTokenRefreshed("");
}

let onUnauthorizedCallback = null;
export function setOnUnauthorized(cb) {
  onUnauthorizedCallback = cb;
}

// In-flight refresh promise to prevent multiple simultaneous refresh calls
let refreshPromise = null;

async function executeTokenRefresh() {
  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = (async () => {
    const refreshToken = getRefreshToken();
    const res = await fetch("/api/auth/refresh-tokens", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ refreshToken: refreshToken || undefined }),
    });

    if (!res.ok) {
      clearStoredTokens();
      throw new Error("Session expired. Please sign in again.");
    }

    const data = await res.json();
    const newAccessToken = data?.data?.accessToken;
    const newRefreshToken = data?.data?.refreshToken;

    if (!newAccessToken) {
      clearStoredTokens();
      throw new Error("Invalid token refresh response from server");
    }

    setStoredTokens({ accessToken: newAccessToken, refreshToken: newRefreshToken });
    return newAccessToken;
  })().finally(() => {
    refreshPromise = null;
  });

  return refreshPromise;
}

export async function apiFetch(endpoint, options = {}, isRetry = false) {
  const token = getToken();
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(endpoint, {
    credentials: "include",
    ...options,
    headers,
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));

    // Auto-refresh access token if expired (401) and not already retrying
    if (
      response.status === 401 &&
      !isRetry &&
      endpoint !== "/api/auth/refresh-tokens" &&
      endpoint !== "/api/auth/login"
    ) {
      try {
        await executeTokenRefresh();
        // Retry original request with newly refreshed credentials
        return await apiFetch(endpoint, options, true);
      } catch (refreshErr) {
        if (onUnauthorizedCallback) {
          onUnauthorizedCallback("Your session has expired. Please sign in again.");
        }
        throw refreshErr;
      }
    }

    if (
      response.status === 401 ||
      (response.status === 404 && body?.message?.includes("User not found"))
    ) {
      if (onUnauthorizedCallback) {
        onUnauthorizedCallback(
          "Your session has expired or the database was changed. Please sign in again."
        );
      }
    }
    throw new Error(body?.message || `HTTP ${response.status}`);
  }

  return response.json();
}

export async function apiFetchText(endpoint, options = {}, isRetry = false) {
  const token = getToken();
  const headers = {
    ...(options.headers || {}),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(endpoint, {
    credentials: "include",
    ...options,
    headers,
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    let msg = `HTTP ${response.status}`;
    try {
      const parsed = JSON.parse(text);
      if (parsed?.message) msg = parsed.message;
    } catch (_) {}

    // Auto-refresh access token if expired (401) and not already retrying
    if (
      response.status === 401 &&
      !isRetry &&
      endpoint !== "/api/auth/refresh-tokens" &&
      endpoint !== "/api/auth/login"
    ) {
      try {
        await executeTokenRefresh();
        // Retry original request with newly refreshed credentials
        return await apiFetchText(endpoint, options, true);
      } catch (refreshErr) {
        if (onUnauthorizedCallback) {
          onUnauthorizedCallback("Your session has expired. Please sign in again.");
        }
        throw refreshErr;
      }
    }

    if (
      response.status === 401 ||
      (response.status === 404 && msg?.includes("User not found"))
    ) {
      if (onUnauthorizedCallback) {
        onUnauthorizedCallback(
          "Your session has expired or the database was changed. Please sign in again."
        );
      }
    }
    throw new Error(msg);
  }

  return response.text();
}

// API Endpoints
export const api = {
  getRawLogFile: (fileName) => apiFetchText(`/api/logs/file/${encodeURIComponent(fileName)}`),
  getRawLogsByDate: (date) => apiFetchText(`/api/logs/by-date/${encodeURIComponent(date)}`),
  getRawRecentLogs: () => apiFetchText("/api/logs/recents"),

  login: async (email, password) => {
    const res = await fetch("/api/auth/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.message || "Login failed");
    if (data?.data?.user?.role !== "admin") {
      throw new Error("Access denied. Only users with the Admin role can access this portal.");
    }
    return data;
  },

  refreshTokens: async (refreshToken) => {
    const res = await fetch("/api/auth/refresh-tokens", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ refreshToken: refreshToken || getRefreshToken() || undefined }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.message || "Refresh failed");
    return data;
  },

  logout: async () => {
    try {
      await apiFetch("/api/auth/logout", { method: "POST" });
    } finally {
      clearStoredTokens();
    }
  },

  getSystemStats: () => apiFetch("/api/logs/system-stats"),

  getFileLogs: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return apiFetch(`/api/logs${qs ? `?${qs}` : ""}`);
  },

  getDbRequestLogs: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return apiFetch(`/api/logs/db-request-logs${qs ? `?${qs}` : ""}`);
  },

  getDbAuditLogs: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return apiFetch(`/api/logs/db-audit-logs${qs ? `?${qs}` : ""}`);
  },

  getModels: () => apiFetch("/api/logs/models"),

  getModelDocs: (model, params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return apiFetch(`/api/logs/model-docs/${model}${qs ? `?${qs}` : ""}`);
  },

  getDocumentHistory: (modelName, docId) =>
    apiFetch(`/api/logs/document-history/${modelName}/${docId}`),

  getDocumentVersion: (modelName, docId, version) =>
    apiFetch(`/api/logs/document-version/${modelName}/${docId}/${version}`),

  compareDocumentVersions: (modelName, docId, v1, v2) =>
    apiFetch(`/api/logs/document-compare/${modelName}/${docId}?v1=${v1}&v2=${v2}`),

  rollbackDocument: (modelName, docId, version) =>
    apiFetch(`/api/logs/document-rollback/${modelName}/${docId}`, {
      method: "POST",
      body: JSON.stringify({ targetVersion: Number(version), version: Number(version) }),
    }),

  // User Management Endpoints (Admin Only)
  getUsersAdmin: (params = {}) => {
    const qs = new URLSearchParams(
      Object.entries(params).filter(([_, v]) => v !== undefined && v !== null && v !== "")
    ).toString();
    return apiFetch(`/api/user/admin/all${qs ? `?${qs}` : ""}`);
  },

  getUserSessions: (userId) =>
    apiFetch(`/api/user/${encodeURIComponent(userId)}/sessions`),

  revokeSingleSession: (userId, tokenId) =>
    apiFetch(`/api/user/${encodeURIComponent(userId)}/sessions/${encodeURIComponent(tokenId)}`, {
      method: "DELETE",
    }),

  updateUserRole: (userId, role) =>
    apiFetch(`/api/user/${encodeURIComponent(userId)}/role`, {
      method: "PATCH",
      body: JSON.stringify({ role }),
    }),

  updateUserStatus: (userId, status) =>
    apiFetch(`/api/user/${encodeURIComponent(userId)}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }),

  revokeUserSessions: (userId) =>
    apiFetch(`/api/user/${encodeURIComponent(userId)}/revoke-sessions`, {
      method: "POST",
    }),

  decryptLogField: (cipherText, reason, logId, fieldName) =>
    apiFetch("/api/logs/decrypt-field", {
      method: "POST",
      body: JSON.stringify({ cipherText, reason, logId, fieldName }),
    }),

  decryptLogFields: ({ items, cipherTexts, fields, cipherText, reason, logId, fieldName }) =>
    apiFetch("/api/logs/decrypt-field", {
      method: "POST",
      body: JSON.stringify({ items, cipherTexts, fields, cipherText, reason, logId, fieldName }),
    }),

  getDecryptionAudits: (params = {}) => {
    const qs = new URLSearchParams(
      Object.entries(params).filter(([_, v]) => v !== undefined && v !== null && v !== "")
    ).toString();
    return apiFetch(`/api/logs/decryption-audits${qs ? `?${qs}` : ""}`);
  },
};
