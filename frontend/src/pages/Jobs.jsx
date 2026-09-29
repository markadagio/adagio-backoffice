import { useEffect, useMemo, useState } from "react";
import { api } from "../api";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../components/Toast";
import { useConfirm } from "../components/ConfirmModal";
import StatusBadge from "../components/StatusBadge";
import JobPanel from "./JobPanel";

const ARRANGEMENT_LABELS = { remote: "Remoto", hybrid: "Híbrido", "on-site": "Presencial" };
const STATUS_OPTIONS = [
  ["", "Todos los estados"], ["draft", "Borrador"], ["published", "Publicada"],
  ["paused", "Pausada"], ["closed", "Cerrada"], ["archived", "Archivada"],
];

function fmtDate(s) {
  if (!s) return "–";
  try { return new Date(s).toLocaleDateString("es-MX", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }); }
  catch { return s; }
}

export default function Jobs() {
  const { isAdmin } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();

  const [jobs, setJobs] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [companyId, setCompanyId] = useState("");
  const [panelJobId, setPanelJobId] = useState(undefined); // undefined = closed, null = new, id = edit

  async function reload() {
    setLoading(true);
    try {
      const [j, c] = await Promise.all([api("GET", "/jobs"), api("GET", "/companies")]);
      setJobs(j);
      setCompanies(c);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { reload(); }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return jobs.filter((j) => {
      if (q && !j.title.toLowerCase().includes(q) && !(j.department || "").toLowerCase().includes(q)) return false;
      if (status && j.status !== status) return false;
      if (companyId && j.company_id !== companyId) return false;
      return true;
    });
  }, [jobs, search, status, companyId]);

  async function duplicateJob(job) {
    if (!(await confirm("Duplicar vacante", `Se creará una copia de "${job.title}" como borrador.`, false))) return;
    try {
      const r = await api("POST", `/jobs/${job.id}/duplicate`);
      toast("Vacante duplicada", "success");
      await reload();
      setPanelJobId(r.id);
    } catch (e) { toast(e.message, "error"); }
  }

  async function deleteJob(job) {
    if (!(await confirm("Eliminar vacante", `¿Eliminar "${job.title}"? Esta acción no se puede deshacer.`))) return;
    try {
      await api("DELETE", `/jobs/${job.id}`);
      toast("Vacante eliminada");
      await reload();
    } catch (e) { toast(e.message, "error"); }
  }

  return (
    <div className="h-full overflow-y-auto p-7">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="text-[22px] font-bold">Vacantes</div>
        <button
          onClick={() => setPanelJobId(null)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-navy px-4 py-2 text-sm font-medium text-white hover:bg-navy-dark"
        >
          + Nueva vacante
        </button>
      </div>

      <div className="mb-4 flex flex-wrap gap-2.5">
        <input
          type="search" placeholder="Buscar vacante…" value={search} onChange={(e) => setSearch(e.target.value)}
          className="w-56 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-navy focus:outline-none dark:border-slate-700 dark:bg-slate-900"
        />
        <select value={status} onChange={(e) => setStatus(e.target.value)}
          className="rounded-lg border border-slate-300 px-2.5 py-2 text-sm dark:border-slate-700 dark:bg-slate-900">
          {STATUS_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <select value={companyId} onChange={(e) => setCompanyId(e.target.value)}
          className="rounded-lg border border-slate-300 px-2.5 py-2 text-sm dark:border-slate-700 dark:bg-slate-900">
          <option value="">Todas las empresas</option>
          {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-danger dark:border-red-900 dark:bg-red-950">{error}</div>}
      {loading && <div className="p-10 text-center text-sm text-slate-400">Cargando…</div>}

      {!loading && !error && (
        !filtered.length ? (
          <div className="py-16 text-center text-slate-400">No hay vacantes</div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:bg-slate-800/60">
                  <th className="px-3.5 py-2.5">Título</th>
                  <th className="px-3.5 py-2.5">Empresa</th>
                  <th className="px-3.5 py-2.5">Estado</th>
                  <th className="px-3.5 py-2.5">Modalidad</th>
                  <th className="px-3.5 py-2.5">Actualización</th>
                  <th className="px-3.5 py-2.5"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((j) => (
                  <tr key={j.id} className="border-t border-slate-200 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/40">
                    <td className="px-3.5 py-3">
                      <div className="font-medium">{j.title}</div>
                      {j.department && <div className="text-xs text-slate-500">{j.department}</div>}
                    </td>
                    <td className="px-3.5 py-3 text-slate-500">{j.company_name}</td>
                    <td className="px-3.5 py-3"><StatusBadge status={j.status} /></td>
                    <td className="px-3.5 py-3 text-slate-500">{ARRANGEMENT_LABELS[j.work_arrangement] || j.work_arrangement}</td>
                    <td className="px-3.5 py-3 text-xs text-slate-500">{fmtDate(j.updated_at)}</td>
                    <td className="px-3.5 py-3">
                      <div className="flex items-center gap-1.5">
                        <button title="Editar" onClick={() => setPanelJobId(j.id)}
                          className="rounded p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">✎</button>
                        <button title="Duplicar" onClick={() => duplicateJob(j)}
                          className="rounded p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">⧉</button>
                        {isAdmin && (
                          <button title="Eliminar" onClick={() => deleteJob(j)}
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

      {panelJobId !== undefined && (
        <JobPanel
          jobId={panelJobId}
          companies={companies}
          onClose={() => setPanelJobId(undefined)}
          onSaved={reload}
        />
      )}
    </div>
  );
}
