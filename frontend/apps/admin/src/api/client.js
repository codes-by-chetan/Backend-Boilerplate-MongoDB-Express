export const STORAGE_KEY_TOKEN = "adminAccessToken";
export const STORAGE_KEY_THEME = "adminTheme";

export function getToken() {
  return localStorage.getItem(STORAGE_KEY_TOKEN) || "";
}

export function setStoredToken(token) {
  if (token) {
    localStorage.setItem(STORAGE_KEY_TOKEN, token);
  } else {
    localStorage.removeItem(STORAGE_KEY_TOKEN);
  }
}

let onUnauthorizedCallback = null;
export function setOnUnauthorized(cb) {
  onUnauthorizedCallback = cb;
}

export function getBrowserClientInfo() {
  if (typeof window === "undefined") return { clientOrigin: "", clientUrl: "" };
  const origin = window.location.origin;
  return {
    clientOrigin: origin,
    clientUrl: `${origin}/admin`,
  };
}

export async function apiFetch(endpoint, options = {}) {
  const token = getToken();
  const clientInfo = getBrowserClientInfo();
  const headers = {
    "Content-Type": "application/json",
    ...(clientInfo.clientOrigin ? { "X-Client-Origin": clientInfo.clientOrigin } : {}),
    ...(clientInfo.clientUrl ? { "X-Client-Url": clientInfo.clientUrl } : {}),
    ...(options.headers || {}),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(endpoint, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
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

export async function apiFetchText(endpoint, options = {}) {
  const token = getToken();
  const headers = {
    ...(options.headers || {}),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(endpoint, {
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
    const clientInfo = getBrowserClientInfo();
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Client-Origin": clientInfo.clientOrigin,
        "X-Client-Url": clientInfo.clientUrl,
      },
      body: JSON.stringify({ email, password, ...clientInfo }),
    });
    const data = await res.json();
    if (!res.ok) {
      const error = new Error(data?.message || "Login failed");
      error.status = res.status;
      error.data = data?.data;
      throw error;
    }
    return data;
  },

  requestUnlock: async (email) => {
    const clientInfo = getBrowserClientInfo();
    const res = await fetch("/api/auth/request-unlock", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Client-Origin": clientInfo.clientOrigin,
        "X-Client-Url": clientInfo.clientUrl,
      },
      body: JSON.stringify({ email, ...clientInfo }),
    });
    const data = await res.json();
    if (!res.ok) {
      const error = new Error(data?.message || "Failed to request unlock link");
      error.status = res.status;
      error.data = data?.data;
      throw error;
    }
    return data;
  },

  unlockAccount: async (token) => {
    const clientInfo = getBrowserClientInfo();
    const res = await fetch("/api/auth/unlock-account", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Client-Origin": clientInfo.clientOrigin,
        "X-Client-Url": clientInfo.clientUrl,
      },
      body: JSON.stringify({ token, ...clientInfo }),
    });
    const data = await res.json();
    if (!res.ok) {
      const error = new Error(data?.message || "Invalid or expired unlock token");
      error.status = res.status;
      error.data = data?.data;
      throw error;
    }
    return data;
  },

  forgotPassword: async (email) => {
    const clientInfo = getBrowserClientInfo();
    const res = await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Client-Origin": clientInfo.clientOrigin,
        "X-Client-Url": clientInfo.clientUrl,
      },
      body: JSON.stringify({ email, ...clientInfo }),
    });
    const data = await res.json();
    if (!res.ok) {
      const error = new Error(data?.message || "Failed to dispatch password reset link");
      error.status = res.status;
      error.data = data?.data;
      throw error;
    }
    return data;
  },

  resetPassword: async (token, newPassword) => {
    const clientInfo = getBrowserClientInfo();
    const res = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Client-Origin": clientInfo.clientOrigin,
        "X-Client-Url": clientInfo.clientUrl,
      },
      body: JSON.stringify({ token, newPassword, ...clientInfo }),
    });
    const data = await res.json();
    if (!res.ok) {
      const error = new Error(data?.message || "Failed to reset password");
      error.status = res.status;
      error.data = data?.data;
      throw error;
    }
    return data;
  },

  getLockedUsers: () => apiFetch("/api/user/admin/locked-users"),
  adminUnlockUser: (identifier) =>
    apiFetch("/api/user/admin/unlock", {
      method: "POST",
      body: JSON.stringify({ identifier }),
    }),

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

  // Admin Security & Threat Operations
  getLockedUsers: () => apiFetch("/api/user/admin/locked-users"),

  adminUnlockUser: (userId) =>
    apiFetch(`/api/user/admin/unlock/${userId}`, {
      method: "POST",
    }),
};
