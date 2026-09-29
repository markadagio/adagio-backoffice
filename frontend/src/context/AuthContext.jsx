import { createContext, useContext, useEffect, useState } from "react";
import { api, clearAuth, loadAuth, saveAuth } from "../api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [auth, setAuth] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const stored = loadAuth();
    if (!stored?.token) {
      setReady(true);
      return;
    }
    api("GET", "/auth/me", undefined, stored.token)
      .then((user) => {
        const next = { token: stored.token, user };
        saveAuth(next);
        setAuth(next);
      })
      .catch(() => clearAuth())
      .finally(() => setReady(true));
  }, []);

  async function login(email, password) {
    const data = await api("POST", "/auth/login", { email, password });
    saveAuth(data);
    setAuth(data);
  }

  function logout() {
    clearAuth();
    setAuth(null);
  }

  const isAdmin = auth?.user?.role === "admin";

  return (
    <AuthContext.Provider value={{ auth, ready, isAdmin, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
