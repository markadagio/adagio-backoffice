import { useEffect, useState } from "react";
import { api } from "../api";
import UserPanel from "./UserPanel";

export default function Users() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [panelUser, setPanelUser] = useState(undefined); // undefined = closed, null = new, obj = edit

  async function reload() {
    setLoading(true);
    try {
      setUsers(await api("GET", "/users"));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { reload(); }, []);

  return (
    <div className="h-full overflow-y-auto p-7">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="text-[22px] font-bold">Usuarios</div>
        <button
          onClick={() => setPanelUser(null)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-navy px-4 py-2 text-sm font-medium text-white hover:bg-navy-dark"
        >
          + Nuevo usuario
        </button>
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-danger dark:border-red-900 dark:bg-red-950">{error}</div>}
      {loading && <div className="p-10 text-center text-sm text-slate-400">Cargando…</div>}

      {!loading && !error && (
        <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:bg-slate-800/60">
                <th className="px-3.5 py-2.5">Nombre</th>
                <th className="px-3.5 py-2.5">Correo</th>
                <th className="px-3.5 py-2.5">Rol</th>
                <th className="px-3.5 py-2.5">Estado</th>
                <th className="px-3.5 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-t border-slate-200 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/40">
                  <td className="px-3.5 py-3">
                    <div className="flex items-center gap-2">
                      <div className={"flex h-[26px] w-[26px] items-center justify-center rounded-full text-[11px] font-bold text-white " + (u.role === "admin" ? "bg-navy" : "bg-slate-500")}>
                        {u.name.charAt(0)}
                      </div>
                      <span className="font-medium">{u.name}</span>
                    </div>
                  </td>
                  <td className="px-3.5 py-3 text-slate-500">{u.email}</td>
                  <td className="px-3.5 py-3">
                    <span className={"rounded-full px-2.5 py-0.5 text-xs font-semibold " + (u.role === "admin" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400" : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400")}>
                      {u.role === "admin" ? "Administrador" : "Reclutador"}
                    </span>
                  </td>
                  <td className="px-3.5 py-3">
                    <span className={"rounded-full px-2.5 py-0.5 text-xs font-semibold " + (u.active ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400" : "bg-red-100 text-danger dark:bg-red-900/40 dark:text-red-400")}>
                      {u.active ? "Activo" : "Inactivo"}
                    </span>
                  </td>
                  <td className="px-3.5 py-3">
                    <button title="Editar" onClick={() => setPanelUser(u)}
                      className="rounded p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">✎</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {panelUser !== undefined && (
        <UserPanel user={panelUser} onClose={() => setPanelUser(undefined)} onSaved={reload} />
      )}
    </div>
  );
}
