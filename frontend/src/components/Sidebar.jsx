import { NavLink } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useConfirm } from "./ConfirmModal";

const LINKS = [
  { to: "/", label: "Dashboard", end: true },
  { to: "/jobs", label: "Vacantes" },
  { to: "/companies", label: "Empresas" },
  { to: "/users", label: "Usuarios", adminOnly: true },
  { to: "/audit", label: "Auditoría", adminOnly: true },
];

function linkClasses({ isActive }) {
  return (
    "flex items-center gap-2.5 rounded-md px-3 py-2 text-[13.5px] font-medium transition-colors " +
    (isActive ? "bg-white/15 text-white" : "text-white/70 hover:bg-white/10 hover:text-white")
  );
}

export default function Sidebar() {
  const { auth, isAdmin, logout } = useAuth();
  const confirm = useConfirm();

  async function handleLogout() {
    if (await confirm("Cerrar sesión", "¿Deseas cerrar tu sesión?", false)) logout();
  }

  return (
    <aside className="flex w-[220px] max-md:w-14 flex-shrink-0 flex-col overflow-y-auto bg-navy-dark">
      <div className="flex items-center gap-2.5 border-b border-white/10 px-4 py-5 font-bold text-white max-md:justify-center">
        <svg viewBox="0 0 48 48" width="28" height="28"><circle cx="24" cy="24" r="24" fill="#c41230" /><path d="M14 32V16h6l4 10 4-10h6v16h-4V22l-4 8h-4l-4-8v10z" fill="white" /></svg>
        <span className="max-md:hidden">Adagio</span>
      </div>
      <nav className="flex-1 space-y-1 p-2">
        {LINKS.filter((l) => !l.adminOnly || isAdmin).map((l) => (
          <NavLink key={l.to} to={l.to} end={l.end} className={linkClasses}>
            <span className="max-md:hidden">{l.label}</span>
            <span className="hidden max-md:inline">{l.label.charAt(0)}</span>
          </NavLink>
        ))}
      </nav>
      <div className="flex items-center gap-2 border-t border-white/10 px-4 py-3">
        <div className="flex h-[30px] w-[30px] flex-shrink-0 items-center justify-center rounded-full bg-danger text-[13px] font-bold text-white">
          {auth?.user?.name?.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1 max-md:hidden">
          <div className="truncate text-xs font-semibold text-white">{auth?.user?.name}</div>
          <div className="text-[11px] text-white/50">{isAdmin ? "Administrador" : "Reclutador"}</div>
        </div>
        <button
          title="Cerrar sesión"
          onClick={handleLogout}
          className="rounded p-1 text-white/50 hover:bg-white/10 hover:text-white"
        >
          ⏻
        </button>
      </div>
    </aside>
  );
}
