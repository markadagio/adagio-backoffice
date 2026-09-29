import { useState } from "react";
import { api } from "../api";
import { useToast } from "../components/Toast";

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

export default function UserPanel({ user, onClose, onSaved }) {
  const toast = useToast();
  const [name, setName] = useState(user?.name || "");
  const [email, setEmail] = useState(user?.email || "");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState(user?.role || "recruiter");
  const [active, setActive] = useState(user ? user.active : true);
  const [saving, setSaving] = useState(false);

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    try {
      if (user) {
        const body = { name, email, role, active };
        if (password) body.password = password;
        await api("PUT", `/users/${user.id}`, body);
        toast("Usuario actualizado", "success");
      } else {
        await api("POST", "/users", { name, email, password, role });
        toast("Usuario creado", "success");
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
    <div className="absolute inset-y-0 right-0 z-[100] flex w-full max-w-[520px] flex-col border-l border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-shrink-0 items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-800">
        <div className="text-[17px] font-bold">{user ? "Editar usuario" : "Nuevo usuario"}</div>
        <button onClick={onClose} className="rounded p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">✕</button>
      </div>
      <div className="flex-1 overflow-y-auto p-6">
        <form id="user-form" onSubmit={handleSave}>
          <Field label="Nombre" required>
            <input required value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
          </Field>
          <Field label="Correo electrónico" required>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} />
          </Field>
          <Field label={`Contraseña ${user ? "(dejar en blanco para no cambiar)" : ""}`} required={!user}>
            <input type="password" required={!user} minLength={8} autoComplete="new-password"
              value={password} onChange={(e) => setPassword(e.target.value)} className={inputCls} />
          </Field>
          <Field label="Rol" required>
            <select required value={role} onChange={(e) => setRole(e.target.value)} className={inputCls}>
              <option value="recruiter">Reclutador</option>
              <option value="admin">Administrador</option>
            </select>
          </Field>
          {user && (
            <Field label="Estado">
              <select value={active ? "1" : "0"} onChange={(e) => setActive(e.target.value === "1")} className={inputCls}>
                <option value="1">Activo</option>
                <option value="0">Inactivo</option>
              </select>
            </Field>
          )}
        </form>
      </div>
      <div className="flex flex-shrink-0 justify-end gap-2.5 border-t border-slate-200 px-6 py-4 dark:border-slate-800">
        <button onClick={onClose} className="rounded-lg border border-slate-300 bg-slate-100 px-4 py-2 text-sm font-medium hover:bg-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700">
          Cancelar
        </button>
        <button form="user-form" type="submit" disabled={saving} className="rounded-lg bg-navy px-4 py-2 text-sm font-medium text-white hover:bg-navy-dark disabled:opacity-50">
          {saving ? "Guardando…" : user ? "Guardar" : "Crear usuario"}
        </button>
      </div>
    </div>
  );
}
