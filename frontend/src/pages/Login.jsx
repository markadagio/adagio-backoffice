import { useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Login() {
  const { auth, ready, login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (ready && auth?.token) return <Navigate to="/" replace />;

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await login(email, password);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-navy-dark p-4">
      <div className="w-full max-w-sm rounded-xl bg-white p-10 shadow-2xl dark:bg-slate-900">
        <div className="mb-8 flex items-center gap-3">
          <svg viewBox="0 0 48 48" width="44" height="44"><circle cx="24" cy="24" r="24" fill="#1a2e6e" /><path d="M14 32V16h6l4 10 4-10h6v16h-4V22l-4 8h-4l-4-8v10z" fill="white" /></svg>
          <div>
            <div className="text-lg font-bold text-navy dark:text-brand-300">Adagio Talent</div>
            <div className="text-xs text-slate-500">Backoffice</div>
          </div>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-500">Correo electrónico</label>
            <input
              type="email" required autoComplete="username" value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-navy focus:outline-none focus:ring-4 focus:ring-navy/10 dark:border-slate-700 dark:bg-slate-800"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-500">Contraseña</label>
            <input
              type="password" required autoComplete="current-password" value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-navy focus:outline-none focus:ring-4 focus:ring-navy/10 dark:border-slate-700 dark:bg-slate-800"
            />
          </div>
          {error && <div className="text-sm text-danger">{error}</div>}
          <button
            type="submit" disabled={busy}
            className="w-full rounded-lg bg-navy py-2.5 text-sm font-semibold text-white transition-opacity hover:bg-navy-dark disabled:opacity-50"
          >
            {busy ? "Ingresando…" : "Iniciar sesión"}
          </button>
        </form>
      </div>
    </div>
  );
}
