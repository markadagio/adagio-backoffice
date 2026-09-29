const STORAGE_KEY = "adagio_auth";

export function loadAuth() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveAuth(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    /* storage unavailable — session just won't persist across reloads */
  }
}

export function clearAuth() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* nothing to clear */
  }
}

export async function api(method, path, body, token) {
  const opts = { method, headers: { "Content-Type": "application/json" } };
  const auth = token ?? loadAuth()?.token;
  if (auth) opts.headers.Authorization = `Bearer ${auth}`;
  if (body !== undefined) opts.body = JSON.stringify(body);
  const res = await fetch("/api" + path, opts);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
  return data;
}
