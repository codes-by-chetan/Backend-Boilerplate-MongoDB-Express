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

export async function apiFetch(endpoint, options = {}) {
  const token = getToken();
  const headers = {
    "Content-Type": "application/json",
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
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.message || "Login failed");
    return data;
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
};
