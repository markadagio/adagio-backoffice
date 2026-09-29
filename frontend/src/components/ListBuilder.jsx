import { useState } from "react";

/** Editor for the responsibilities/requirements/benefits/tags array fields. */
export default function ListBuilder({ label, items, onChange }) {
  const [draft, setDraft] = useState("");

  function add() {
    const value = draft.trim();
    if (!value) return;
    onChange([...items, value]);
    setDraft("");
  }

  function remove(idx) {
    onChange(items.filter((_, i) => i !== idx));
  }

  return (
    <div className="mb-4">
      <label className="mb-1.5 block text-xs font-semibold text-slate-500 dark:text-slate-400">{label}</label>
      <div className="overflow-hidden rounded-lg border border-slate-300 dark:border-slate-700">
        {items.map((item, i) => (
          <div key={i} className="flex items-center gap-2 border-b border-slate-200 px-2.5 py-2 last:border-0 dark:border-slate-800">
            <span className="flex-1 text-sm">{item}</span>
            <button
              type="button"
              title="Eliminar"
              onClick={() => remove(i)}
              className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-danger dark:hover:bg-slate-800"
            >
              ✕
            </button>
          </div>
        ))}
        <div className="flex gap-1.5 bg-slate-50 p-2 dark:bg-slate-800/50">
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
            placeholder="Agregar elemento…"
            className="flex-1 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm focus:border-navy focus:outline-none dark:border-slate-700 dark:bg-slate-900"
          />
          <button
            type="button"
            onClick={add}
            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800"
          >
            + Agregar
          </button>
        </div>
      </div>
    </div>
  );
}
