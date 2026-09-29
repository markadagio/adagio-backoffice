import { useEffect, useState } from "react";
import { api } from "../api";
import { useToast } from "../components/Toast";
import { useConfirm } from "../components/ConfirmModal";
import StatusBadge from "../components/StatusBadge";
import ListBuilder from "../components/ListBuilder";
import RichTextEditor from "../components/RichTextEditor";

const ARRANGEMENTS = [["on-site", "Presencial"], ["remote", "Remoto"], ["hybrid", "Híbrido"]];
const TYPES = [["full-time", "Tiempo completo"], ["part-time", "Medio tiempo"], ["contract", "Por proyecto"]];
const LIST_FIELDS = [
  ["responsibilities", "Responsabilidades"],
  ["requirements", "Requisitos"],
  ["preferred_qualifications", "Calificaciones deseables"],
  ["benefits", "Beneficios"],
  ["tags", "Etiquetas"],
];
const TRANSITIONS = { draft: ["published"], published: ["paused", "closed"], paused: ["published", "closed"], closed: ["archived"], archived: [] };
const TRANSITION_LABELS = { published: "Publicar", paused: "Pausar", closed: "Cerrar", archived: "Archivar" };
const TRANSITION_STYLE = {
  published: "bg-navy text-white hover:bg-navy-dark",
  paused: "border border-slate-300 hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800",
  closed: "bg-danger text-white hover:bg-danger-dark",
  archived: "border border-slate-300 hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800",
};

const emptyForm = {
  title: "", company_id: "", department: "", location: "", country: "México",
  work_arrangement: "on-site", employment_type: "full-time", slug: "",
  short_description: "", description: "", application_url: "",
  responsibilities: [], requirements: [], preferred_qualifications: [], benefits: [], tags: [],
};

export default function JobPanel({ jobId, companies, onClose, onSaved }) {
  const toast = useToast();
  const confirm = useConfirm();
  const [form, setForm] = useState(emptyForm);
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(!!jobId);
  const [saving, setSaving] = useState(false);
  const [currentId, setCurrentId] = useState(jobId || null);

  useEffect(() => {
    let cancelled = false;
    if (!jobId) { setForm(emptyForm); setStatus(null); setCurrentId(null); return; }
    setLoading(true);
    api("GET", `/jobs/${jobId}`)
      .then((job) => {
        if (cancelled) return;
        setForm({
          title: job.title, company_id: job.company_id, department: job.department || "",
          location: job.location || "", country: job.country || "México",
          work_arrangement: job.work_arrangement, employment_type: job.employment_type,
          slug: job.slug, short_description: job.short_description || "",
          description: job.description || "", application_url: job.application_url || "",
          responsibilities: job.responsibilities, requirements: job.requirements,
          preferred_qualifications: job.preferred_qualifications, benefits: job.benefits, tags: job.tags,
        });
        setStatus(job.status);
        setCurrentId(job.id);
      })
      .catch((e) => { toast(e.message, "error"); onClose(); })
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [jobId]);

  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    try {
      if (currentId) {
        await api("PUT", `/jobs/${currentId}`, form);
        toast("Vacante actualizada", "success");
      } else {
        const r = await api("POST", "/jobs", form);
        toast("Vacante creada", "success");
        setCurrentId(r.id);
      }
      await onSaved();
      onClose();
    } catch (err) {
      toast(err.message, "error");
    } finally {
      setSaving(false);
    }
  }

  async function changeStatus(next) {
    const msgs = {
      published: `¿Publicar la vacante "${form.title}"? Será visible en el sitio público.`,
      paused: `¿Pausar "${form.title}"?`,
      closed: `¿Cerrar "${form.title}"? Ya no aparecerá en el sitio.`,
      archived: `¿Archivar "${form.title}"? Esta acción es final.`,
    };
    if (!(await confirm("Cambiar estado", msgs[next] || "¿Confirmar cambio de estado?", next === "archived" || next === "closed"))) return;
    try {
      await api("POST", `/jobs/${currentId}/status`, { status: next });
      toast("Estado actualizado", "success");
      setStatus(next);
      await onSaved();
    } catch (e) { toast(e.message, "error"); }
  }

  const archived = status === "archived";

  return (
    <div className="absolute inset-y-0 right-0 z-[100] flex w-full max-w-[680px] flex-col border-l border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-shrink-0 items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-800">
        <div className="text-[17px] font-bold">{currentId ? "Editar vacante" : "Nueva vacante"}</div>
        <div className="flex items-center gap-2">
          {status && <StatusBadge status={status} />}
          <button onClick={onClose} className="rounded p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">✕</button>
        </div>
      </div>

      {loading ? (
        <div className="p-10 text-center text-sm text-slate-400">Cargando…</div>
      ) : (
        <>
          <div className="flex-1 overflow-y-auto p-6">
            {currentId && (
              <div className="mb-5">
                <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-400">Acciones de estado</div>
                <div className="flex flex-wrap gap-2">
                  {(TRANSITIONS[status] || []).length ? (
                    TRANSITIONS[status].map((s) => (
                      <button key={s} onClick={() => changeStatus(s)}
                        className={"rounded-md px-3 py-1.5 text-xs font-semibold " + TRANSITION_STYLE[s]}>
                        {TRANSITION_LABELS[s]}
                      </button>
                    ))
                  ) : (
                    <span className="text-xs text-slate-400">Sin acciones de estado disponibles</span>
                  )}
                </div>
                <hr className="my-5 border-slate-200 dark:border-slate-800" />
              </div>
            )}

            <form id="job-form" onSubmit={handleSave}>
              <Field label="Título del puesto" required>
                <input required disabled={archived} value={form.title} onChange={(e) => set("title", e.target.value)} className={inputCls} />
              </Field>
              <div className="grid grid-cols-2 gap-3.5">
                <Field label="Empresa" required>
                  <select required disabled={archived} value={form.company_id} onChange={(e) => set("company_id", e.target.value)} className={inputCls}>
                    <option value="">Seleccionar…</option>
                    {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </Field>
                <Field label="Departamento / Área">
                  <input disabled={archived} value={form.department} onChange={(e) => set("department", e.target.value)} className={inputCls} />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3.5">
                <Field label="Ubicación">
                  <input disabled={archived} value={form.location} onChange={(e) => set("location", e.target.value)} className={inputCls} />
                </Field>
                <Field label="País">
                  <input disabled={archived} value={form.country} onChange={(e) => set("country", e.target.value)} className={inputCls} />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3.5">
                <Field label="Modalidad">
                  <select disabled={archived} value={form.work_arrangement} onChange={(e) => set("work_arrangement", e.target.value)} className={inputCls}>
                    {ARRANGEMENTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </Field>
                <Field label="Tipo de contrato">
                  <select disabled={archived} value={form.employment_type} onChange={(e) => set("employment_type", e.target.value)} className={inputCls}>
                    {TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </Field>
              </div>
              <Field label="Slug (URL)" hint="Solo letras minúsculas, números y guiones.">
                <input disabled={archived} value={form.slug} onChange={(e) => set("slug", e.target.value)} placeholder="se genera automáticamente" className={inputCls} />
              </Field>
              <Field label="Descripción corta">
                <textarea disabled={archived} rows={2} value={form.short_description} onChange={(e) => set("short_description", e.target.value)} className={inputCls} />
              </Field>
              <Field label="Descripción completa">
                <RichTextEditor
                  readOnly={archived}
                  value={form.description}
                  onChange={(html) => set("description", html)}
                  placeholder="Describe la vacante…"
                />
              </Field>

              {LIST_FIELDS.map(([field, label]) => (
                <ListBuilder key={field} label={label} items={form[field]} onChange={(items) => set(field, items)} />
              ))}

              <Field label="URL de postulación">
                <input type="url" disabled={archived} value={form.application_url} onChange={(e) => set("application_url", e.target.value)} placeholder="https://…" className={inputCls} />
              </Field>
            </form>
          </div>
          <div className="flex flex-shrink-0 justify-end gap-2.5 border-t border-slate-200 px-6 py-4 dark:border-slate-800">
            <button onClick={onClose} className="rounded-lg border border-slate-300 bg-slate-100 px-4 py-2 text-sm font-medium hover:bg-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700">
              Cancelar
            </button>
            {!archived && (
              <button form="job-form" type="submit" disabled={saving} className="rounded-lg bg-navy px-4 py-2 text-sm font-medium text-white hover:bg-navy-dark disabled:opacity-50">
                {saving ? "Guardando…" : currentId ? "Guardar cambios" : "Crear vacante"}
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

const inputCls = "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-navy focus:outline-none focus:ring-4 focus:ring-navy/10 disabled:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:disabled:bg-slate-800/50";

function Field({ label, required, hint, children }) {
  return (
    <div className="mb-4">
      <label className="mb-1.5 block text-xs font-semibold text-slate-500 dark:text-slate-400">
        {label}{required && <span className="text-danger"> *</span>}
      </label>
      {children}
      {hint && <div className="mt-1 text-[11.5px] text-slate-400">{hint}</div>}
    </div>
  );
}
