import { createContext, useCallback, useContext, useState } from "react";

const ToastContext = createContext(null);

let nextId = 1;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const toast = useCallback((message, type = "default") => {
    const id = nextId++;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3000);
  }, []);

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={
              "max-w-xs rounded-lg px-4 py-2.5 text-sm font-medium shadow-lg animate-[fadeIn_.2s_ease] " +
              (t.type === "error"
                ? "bg-danger text-white"
                : t.type === "success"
                ? "bg-emerald-700 text-white"
                : "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900")
            }
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
