import { useEffect, useState } from "react";
import { api } from "../api";
import { useToast } from "../components/Toast";

const emptyForm = {
  name: "", industry: "", website: "", logo_url: "", description: "",
  contact_person: "", contact_email: "", contact_phone: "", notes: "",
};

const inputCls = "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-navy focus:outline-none focus:ring-4 focus:ring-navy/10 dark:border-slate-700 dark:bg-slate-800";

function Field({ label, required, children }) {
  return (
    <div className="mb-4">
      <label className="mb-1.5 block text-xs font-semibold text-slate-500 dark:text-slate-400">
        {label}{required && <span className="text-danger"> *</span>}
      </label>
      {children}
    </div>
  );
}

export default function CompanyPanel({ companyId, onClose, onSaved }) {
  const toast = useToast();
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(!!companyId);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!companyId) { setForm(emptyForm); return; }
    setLoading(true);
    api("GET", `/companies/${companyId}`)
      .then((c) => !cancelled && setForm({
        name: c.name, industry: c.industry || "", website: c.website || "",
        logo_url: c.logo_url || "", description: c.description || "",
        contact_person: c.contact_person || "", contact_email: c.contact_email || "",
        contact_phone: c.contact_phone || "", notes: c.notes || "",
      }))
      .catch((e) => { toast(e.message, "error"); onClose(); })
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [companyId]);

  function set(field, value) { setForm((f) => ({ ...f, [field]: value })); }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    try {
      if (companyId) {
        await api("PUT", `/companies/${companyId}`, form);
        toast("Empresa actualizada", "success");
      } else {
        await api("POST", "/companies", form);
        toast("Empresa creada", "success");
      }
      await onSaved();
      onClose();
    } catch (err) {
      toast(err.message, "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="absolute inset-y-0 right-0 z-[100] flex w-full max-w-[680px] flex-col border-l border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-shrink-0 items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-800">
        <div className="text-[17px] font-bold">{companyId ? "Editar empresa" : "Nueva empresa"}</div>
        <button onClick={onClose} className="rounded p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">✕</button>
      </div>

      {loading ? (
        <div className="p-10 text-center text-sm text-slate-400">Cargando…</div>
      ) : (
        <>
          <div className="flex-1 overflow-y-auto p-6">
            <form id="company-form" onSubmit={handleSave}>
              <Field label="Nombre" required>
                <input required value={form.name} onChange={(e) => set("name", e.target.value)} className={inputCls} />
              </Field>
              <div className="grid grid-cols-2 gap-3.5">
                <Field label="Industria / Sector">
                  <input value={form.industry} onChange={(e) => set("industry", e.target.value)} className={inputCls} />
                </Field>
                <Field label="Sitio web">
                  <input type="url" value={form.website} onChange={(e) => set("website", e.target.value)} placeholder="https://…" className={inputCls} />
                </Field>
              </div>
              <Field label="URL del logotipo">
                <input type="url" value={form.logo_url} onChange={(e) => set("logo_url", e.target.value)} placeholder="https://…" className={inputCls} />
              </Field>
              <Field label="Descripción pública">
                <textarea rows={3} value={form.description} onChange={(e) => set("description", e.target.value)} className={inputCls} />
              </Field>
              <hr className="my-5 border-slate-200 dark:border-slate-800" />
              <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Información de contacto (interna)</div>
              <div className="grid grid-cols-2 gap-3.5">
                <Field label="Persona de contacto">
                  <input value={form.contact_person} onChange={(e) => set("contact_person", e.target.value)} className={inputCls} />
                </Field>
                <Field label="Correo de contacto">
                  <input type="email" value={form.contact_email} onChange={(e) => set("contact_email", e.target.value)} className={inputCls} />
                </Field>
              </div>
              <Field label="Teléfono de contacto">
                <input value={form.contact_phone} onChange={(e) => set("contact_phone", e.target.value)} className={inputCls} />
              </Field>
              <Field label="Notas internas">
                <textarea rows={3} value={form.notes} onChange={(e) => set("notes", e.target.value)} className={inputCls} />
              </Field>
            </form>
          </div>
          <div className="flex flex-shrink-0 justify-end gap-2.5 border-t border-slate-200 px-6 py-4 dark:border-slate-800">
            <button onClick={onClose} className="rounded-lg border border-slate-300 bg-slate-100 px-4 py-2 text-sm font-medium hover:bg-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700">
              Cancelar
            </button>
            <button form="company-form" type="submit" disabled={saving} className="rounded-lg bg-navy px-4 py-2 text-sm font-medium text-white hover:bg-navy-dark disabled:opacity-50">
              {saving ? "Guardando…" : companyId ? "Guardar cambios" : "Crear empresa"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
