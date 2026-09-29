const LABELS = { draft: "Borrador", published: "Publicada", paused: "Pausada", closed: "Cerrada", archived: "Archivada" };
const STYLES = {
  draft: "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400",
  published: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400",
  paused: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400",
  closed: "bg-red-100 text-danger dark:bg-red-900/40 dark:text-red-400",
  archived: "bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300",
};

export default function StatusBadge({ status }) {
  return (
    <span className={"inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold " + (STYLES[status] || STYLES.draft)}>
      <span className="text-[8px]">●</span>
      {LABELS[status] || status}
    </span>
  );
}
