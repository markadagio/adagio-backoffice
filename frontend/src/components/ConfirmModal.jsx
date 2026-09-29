import { createContext, useCallback, useContext, useState } from "react";

const ConfirmContext = createContext(null);

export function ConfirmProvider({ children }) {
  const [state, setState] = useState(null); // { title, body, danger, resolve }

  const confirm = useCallback((title, body, danger = true) => {
    return new Promise((resolve) => setState({ title, body, danger, resolve }));
  }, []);

  function close(result) {
    state?.resolve(result);
    setState(null);
  }

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {state && (
        <div className="fixed inset-0 z-[9000] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-7 shadow-2xl dark:bg-slate-900">
            <div className="mb-2.5 text-lg font-bold">{state.title}</div>
            <div className="mb-6 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
              {state.body}
            </div>
            <div className="flex justify-end gap-2.5">
              <button
                className="rounded-lg border border-slate-300 bg-slate-100 px-4 py-2 text-sm font-medium hover:bg-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700"
                onClick={() => close(false)}
              >
                Cancelar
              </button>
              <button
                className={
                  "rounded-lg px-4 py-2 text-sm font-medium text-white " +
                  (state.danger ? "bg-danger hover:bg-danger-dark" : "bg-navy hover:bg-navy-dark")
                }
                onClick={() => close(true)}
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  return useContext(ConfirmContext);
}
