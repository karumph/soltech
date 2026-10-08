// Soltech account session for the hosted site. Talks to the /api/auth and /api/account routes.
// The session is kept in localStorage when "Keep me signed in" is on, otherwise in sessionStorage.
// Access tokens last an hour; they are refreshed with the refresh token before they expire.

const KEY = "soltech.auth";
const SYNC_KEY = "soltech.account-sync";
export const ACCOUNT_DATA_KEYS = ["soltech.profile.v1", "soltech.scanner.v1", "soltech.workspace.v1", "soltech.signals.v1"];
const WATCHLIST_KEY = "soltech.watchlist.v1";

export class AccountError extends Error {
  constructor(message, code, status) { super(message); this.code = code || "unknown"; this.status = status || 0; }
}

function stores() {
  const out = [];
  try { out.push(localStorage); } catch { /* storage blocked */ }
  try { out.push(sessionStorage); } catch { /* storage blocked */ }
  return out;
}

export function createAccount({ fetchImpl = (...args) => fetch(...args) } = {}) {
  const listeners = new Set();
  let refreshing = null;
  const read = () => {
    for (const store of stores()) {
      try { const value = JSON.parse(store.getItem(KEY) || "null"); if (value?.accessToken) return value; } catch { /* ignore */ }
    }
    return null;
  };
  const write = (value, remember = read()?.remember ?? true) => {
    for (const store of stores()) { try { store.removeItem(KEY); } catch { /* ignore */ } }
    if (!value) return;
    const target = remember ? stores()[0] : stores()[1] || stores()[0];
    try { target?.setItem(KEY, JSON.stringify({ ...value, remember })); } catch { /* ignore */ }
  };
  const emit = () => { for (const listener of listeners) { try { listener(read()); } catch { /* ignore */ } } };

  async function request(path, { method = "GET", body, auth = false } = {}) {
    const headers = { accept: "application/json" };
    if (body !== undefined) headers["content-type"] = "application/json";
    if (auth) {
      const token = await validToken();
      if (!token) throw new AccountError("Sign in to continue.", "session", 401);
      headers.authorization = `Bearer ${token}`;
    }
    let response;
    try {
      response = await fetchImpl(`${window.SOLTECH_API || ""}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    } catch {
      throw new AccountError("Soltech can't be reached. Check your connection and try again.", "network");
    }
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new AccountError(data.error || "Request failed. Try again.", data.code, response.status);
    return data;
  }

  async function refresh() {
    const session = read();
    if (!session?.refreshToken) return null;
    if (!refreshing) {
      refreshing = request("/auth/refresh", { method: "POST", body: { refreshToken: session.refreshToken } })
        .then((data) => {
          const next = { ...read(), accessToken: data.accessToken, refreshToken: data.refreshToken || session.refreshToken, expiresAt: Date.now() + (Number(data.expiresIn) || 3600) * 1000 };
          write(next, session.remember);
          return next.accessToken;
        })
        .catch((error) => {
          // Only a rejected refresh token ends the session. A network blip keeps it for the next try.
          if (error.status === 401 || error.code === "session" || error.code === "credentials") { write(null); emit(); }
          return null;
        })
        .finally(() => { refreshing = null; });
    }
    return refreshing;
  }

  async function validToken() {
    const session = read();
    if (!session) return null;
    if (session.expiresAt && Date.now() > session.expiresAt - 120000) return refresh();
    return session.accessToken;
  }

  // Authenticated call with one retry after a refresh, for tokens revoked or expired early.
  async function authed(path, options = {}) {
    try {
      return await request(path, { ...options, auth: true });
    } catch (error) {
      if (error.status !== 401 || !read()) throw error;
      const token = await refresh();
      if (!token) throw new AccountError("Your session ended. Sign in again.", "session", 401);
      return request(path, { ...options, auth: true });
    }
  }

  const clearDeviceData = () => {
    for (const key of [...ACCOUNT_DATA_KEYS, WATCHLIST_KEY, SYNC_KEY]) { try { localStorage.removeItem(key); } catch { /* ignore */ } }
  };

  return {
    email: () => read()?.email || "",
    signedIn: () => !!read(),
    token: () => read()?.accessToken || "",
    onChange(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    lastSync() { try { return localStorage.getItem(SYNC_KEY) || ""; } catch { return ""; } },
    markSynced(at = new Date().toISOString()) { try { localStorage.setItem(SYNC_KEY, at); } catch { /* ignore */ } },
    signup: (email, password) => request("/auth/signup", { method: "POST", body: { email, password } }),
    confirm: (email, code) => request("/auth/confirm", { method: "POST", body: { email, code } }),
    resend: (email) => request("/auth/resend", { method: "POST", body: { email } }),
    forgot: (email) => request("/auth/forgot", { method: "POST", body: { email } }),
    reset: (email, code, password) => request("/auth/reset", { method: "POST", body: { email, code, password } }),
    async login(email, password, { remember = true } = {}) {
      const data = await request("/auth/login", { method: "POST", body: { email, password } });
      write({ accessToken: data.accessToken, refreshToken: data.refreshToken, email: data.email || email, expiresAt: Date.now() + (Number(data.expiresIn) || 3600) * 1000 }, remember);
      emit();
      return data;
    },
    changePassword: (currentPassword, newPassword) => authed("/auth/password", { method: "POST", body: { currentPassword, newPassword } }),
    // Signs out every device, then removes this account's data from this browser.
    async logout({ everywhere = true } = {}) {
      const token = read()?.accessToken;
      if (everywhere && token) {
        await fetchImpl(`${window.SOLTECH_API || ""}/auth/logout`, { method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, body: "{}" }).catch(() => {});
      }
      write(null);
      clearDeviceData();
      emit();
    },
    async deleteAccount() {
      await authed("/account/delete", { method: "POST", body: {} });
      write(null);
      clearDeviceData();
      emit();
    },
    load: () => authed("/account"),
    save: (body) => authed("/account", { method: "PUT", body }),
    loadWatchlist: () => authed("/watchlist"),
    saveWatchlist: (coins) => authed("/watchlist", { method: "PUT", body: { coins } }),
  };
}
