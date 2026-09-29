import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import StatusBadge from "../components/StatusBadge";

function fmtDate(s) {
  if (!s) return "–";
  try { return new Date(s).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" }); }
  catch { return s; }
}

const CARDS = [
  { key: "total_jobs", label: "Total vacantes", color: "" },
  { key: "published", label: "Publicadas", color: "text-emerald-700 dark:text-emerald-400" },
  { key: "draft", label: "Borradores", color: "text-slate-500" },
  { key: "paused", label: "Pausadas", color: "text-amber-700 dark:text-amber-400" },
  { key: "companies", label: "Empresas", color: "" },
];

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api("GET", "/stats").then(setStats).catch((e) => setError(e.message));
  }, []);

  return (
    <div className="h-full overflow-y-auto p-7">
      <div className="mb-6">
        <div className="text-[22px] font-bold">Dashboard</div>
        <div className="text-sm text-slate-500">Resumen general</div>
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-danger dark:border-red-900 dark:bg-red-950">{error}</div>}
      {!stats && !error && <div className="p-10 text-center text-sm text-slate-400">Cargando…</div>}

      {stats && (
        <>
          <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {CARDS.map((c) => (
              <div key={c.key} className="rounded-lg border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
                <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{c.label}</div>
                <div className={"mt-1 text-3xl font-bold tabular-nums " + c.color}>{stats[c.key]}</div>
              </div>
            ))}
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-4 text-sm font-semibold">Actividad reciente</div>
            <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:bg-slate-800/60">
                    <th className="px-3.5 py-2.5">Vacante</th>
                    <th className="px-3.5 py-2.5">Empresa</th>
                    <th className="px-3.5 py-2.5">Estado</th>
                    <th className="px-3.5 py-2.5">Actualización</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.recent.map((j) => (
                    <tr key={j.id} className="border-t border-slate-200 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/40">
                      <td className="px-3.5 py-3">
                        <Link to="/jobs" className="font-medium text-navy hover:underline dark:text-brand-300">{j.title}</Link>
                      </td>
                      <td className="px-3.5 py-3 text-slate-500">{j.company_name}</td>
                      <td className="px-3.5 py-3"><StatusBadge status={j.status} /></td>
                      <td className="px-3.5 py-3 text-slate-500">{fmtDate(j.updated_at)}</td>
                    </tr>
                  ))}
                  {!stats.recent.length && (
                    <tr><td colSpan={4} className="px-3.5 py-8 text-center text-slate-400">Sin actividad</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
