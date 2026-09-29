import { useEffect, useState } from "react";
import { api } from "../api";

const ACTION_COLORS = {
  LOGIN: "text-sky-600 dark:text-sky-400",
  CREATE_JOB: "text-emerald-700 dark:text-emerald-400",
  UPDATE_JOB: "text-amber-700 dark:text-amber-400",
  DELETE_JOB: "text-danger",
  STATUS_PUBLISHED: "text-emerald-700 dark:text-emerald-400",
  STATUS_CLOSED: "text-danger",
  CREATE_COMPANY: "text-emerald-700 dark:text-emerald-400",
  DELETE_COMPANY: "text-danger",
  CREATE_USER: "text-emerald-700 dark:text-emerald-400",
  UPDATE_USER: "text-amber-700 dark:text-amber-400",
};

function fmtDateTime(s) {
  if (!s) return "–";
  try { return new Date(s).toLocaleString("es-MX", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }); }
  catch { return s; }
}

export default function Audit() {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api("GET", "/audit?limit=200").then(setRows).catch((e) => setError(e.message));
  }, []);

  return (
    <div className="h-full overflow-y-auto p-7">
      <div className="mb-6">
        <div className="text-[22px] font-bold">Auditoría</div>
        <div className="text-sm text-slate-500">Registro de actividad del sistema</div>
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-danger dark:border-red-900 dark:bg-red-950">{error}</div>}
      {!rows && !error && <div className="p-10 text-center text-sm text-slate-400">Cargando…</div>}
      {rows && !rows.length && <div className="py-16 text-center text-slate-400">Sin registros</div>}

      {rows && rows.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:bg-slate-800/60">
                <th className="px-3.5 py-2.5">Fecha</th>
                <th className="px-3.5 py-2.5">Usuario</th>
                <th className="px-3.5 py-2.5">Acción</th>
                <th className="px-3.5 py-2.5">Entidad</th>
                <th className="px-3.5 py-2.5">Detalle</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-slate-200 dark:border-slate-800">
                  <td className="whitespace-nowrap px-3.5 py-2.5 text-xs text-slate-500">{fmtDateTime(r.created_at)}</td>
                  <td className="px-3.5 py-2.5">{r.user_name || "–"}</td>
                  <td className={"px-3.5 py-2.5 text-[11.5px] font-semibold " + (ACTION_COLORS[r.action] || "text-slate-500")}>{r.action}</td>
                  <td className="px-3.5 py-2.5 text-slate-500">{r.entity_name || r.entity_id || "–"}</td>
                  <td className="px-3.5 py-2.5 text-xs text-slate-400">{r.details || ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
