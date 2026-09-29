import { useEffect, useState } from "react";
import { api } from "../api";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../components/Toast";
import { useConfirm } from "../components/ConfirmModal";
import CompanyPanel from "./CompanyPanel";

export default function Companies() {
  const { isAdmin } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();

  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [panelId, setPanelId] = useState(undefined);

  async function reload() {
    setLoading(true);
    try {
      setCompanies(await api("GET", "/companies"));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { reload(); }, []);

  async function deleteCompany(c) {
    if (!(await confirm("Eliminar empresa", `¿Eliminar "${c.name}"? Solo es posible si no tiene vacantes publicadas.`))) return;
    try {
      await api("DELETE", `/companies/${c.id}`);
      toast("Empresa eliminada");
      await reload();
    } catch (e) { toast(e.message, "error"); }
  }

  return (
    <div className="h-full overflow-y-auto p-7">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="text-[22px] font-bold">Empresas</div>
        <button
          onClick={() => setPanelId(null)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-navy px-4 py-2 text-sm font-medium text-white hover:bg-navy-dark"
        >
          + Nueva empresa
        </button>
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-danger dark:border-red-900 dark:bg-red-950">{error}</div>}
      {loading && <div className="p-10 text-center text-sm text-slate-400">Cargando…</div>}

      {!loading && !error && (
        !companies.length ? (
          <div className="py-16 text-center text-slate-400">No hay empresas</div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:bg-slate-800/60">
                  <th className="px-3.5 py-2.5">Empresa</th>
                  <th className="px-3.5 py-2.5">Industria</th>
                  <th className="px-3.5 py-2.5">Vacantes</th>
                  <th className="px-3.5 py-2.5">Sitio web</th>
                  <th className="px-3.5 py-2.5"></th>
                </tr>
              </thead>
              <tbody>
                {companies.map((c) => (
                  <tr key={c.id} className="border-t border-slate-200 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/40">
                    <td className="px-3.5 py-3">
                      <div className="font-medium">{c.name}</div>
                      <div className="text-[11.5px] text-slate-400">{c.slug}</div>
                    </td>
                    <td className="px-3.5 py-3 text-slate-500">{c.industry || "–"}</td>
                    <td className="px-3.5 py-3 tabular-nums">{c.job_count || 0}</td>
                    <td className="px-3.5 py-3">
                      {c.website ? (
                        <a href={c.website} target="_blank" rel="noreferrer" className="text-navy hover:underline dark:text-brand-300">
                          {c.website.replace(/^https?:\/\//, "")}
                        </a>
                      ) : "–"}
                    </td>
                    <td className="px-3.5 py-3">
                      <div className="flex items-center gap-1.5">
                        <button title="Editar" onClick={() => setPanelId(c.id)}
                          className="rounded p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">✎</button>
                        {isAdmin && (
                          <button title="Eliminar" onClick={() => deleteCompany(c)}
                            className="rounded p-1.5 text-slate-500 hover:bg-slate-100 hover:text-danger dark:hover:bg-slate-800">🗑</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {panelId !== undefined && (
        <CompanyPanel companyId={panelId} onClose={() => setPanelId(undefined)} onSaved={reload} />
      )}
    </div>
  );
}
