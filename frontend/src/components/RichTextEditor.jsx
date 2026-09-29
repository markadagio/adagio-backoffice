import { useEffect, useRef } from "react";

const BUTTONS = [
  ["bold", "B", "font-bold"],
  ["italic", "I", "italic"],
  ["underline", "U", "underline"],
  ["insertUnorderedList", "•", ""],
  ["insertOrderedList", "1.", ""],
];

/** A small contentEditable-based rich text field — enough for a job
 * description (bold/italic/lists/links) without pulling in a WYSIWYG
 * dependency. */
export default function RichTextEditor({ value, onChange, readOnly, placeholder }) {
  const ref = useRef(null);

  // Only sync from props when the value changed elsewhere (e.g. loading an
  // existing job) — otherwise every keystroke would reset the cursor.
  useEffect(() => {
    if (ref.current && ref.current.innerHTML !== (value || "")) {
      ref.current.innerHTML = value || "";
    }
  }, [value]);

  function exec(command) {
    ref.current?.focus();
    document.execCommand(command);
    onChange(ref.current.innerHTML);
  }

  function addLink() {
    const url = window.prompt("URL del enlace:");
    if (!url) return;
    ref.current?.focus();
    document.execCommand("createLink", false, url);
    onChange(ref.current.innerHTML);
  }

  return (
    <div className="overflow-hidden rounded-lg border border-slate-300 dark:border-slate-700">
      {!readOnly && (
        <div className="flex gap-1 border-b border-slate-300 bg-slate-50 p-1.5 dark:border-slate-700 dark:bg-slate-800">
          {BUTTONS.map(([command, label, cls]) => (
            <button
              key={command} type="button" onClick={() => exec(command)}
              className={"rounded px-2.5 py-1 text-sm hover:bg-slate-200 dark:hover:bg-slate-700 " + cls}
            >
              {label}
            </button>
          ))}
          <button type="button" onClick={addLink} className="rounded px-2.5 py-1 text-sm hover:bg-slate-200 dark:hover:bg-slate-700">
            🔗
          </button>
        </div>
      )}
      <div
        ref={ref}
        contentEditable={!readOnly}
        onInput={() => onChange(ref.current.innerHTML)}
        data-placeholder={placeholder}
        className="min-h-[160px] bg-white px-3 py-2.5 text-sm leading-relaxed focus:outline-none empty:before:text-slate-400 empty:before:content-[attr(data-placeholder)] dark:bg-slate-900 dark:text-slate-100 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_a]:text-navy [&_a]:underline dark:[&_a]:text-brand-300"
      />
    </div>
  );
}
