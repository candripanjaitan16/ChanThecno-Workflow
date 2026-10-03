import { useState } from "react";
import { Badge, Icon } from "./UI";
export default function ExecutionPanel({ run, onClose }) {
  const [selected, setSelected] = useState(null);
  const record = run?.nodes.find((n) => n.id === selected) || run?.nodes[0];
  return (
    <section className="h-64 border-t border-zinc-200 bg-white flex flex-col">
      <header className="flex items-center gap-3 border-b border-zinc-100 px-5 py-3">
        <Icon name="Terminal" />
        <strong className="text-xs">Execution log</strong>
        {run && <Badge status={run.status} />}
        <span className="text-[10px] text-zinc-400">
          {run?.durationMs != null ? `${run.durationMs} ms` : ""}
        </span>
        <button
          className="ml-auto"
          aria-label="Close execution panel"
          onClick={onClose}
        >
          <Icon name="X" size={14} />
        </button>
      </header>
      {!run ? (
        <div className="p-5 text-zinc-400 text-xs">
          Save and run your workflow to inspect each node’s input and output.
        </div>
      ) : (
        <div className="flex min-h-0 flex-1">
          <div className="w-56 border-r border-zinc-100 overflow-auto">
            {run.nodes.map((n) => (
              <button
                key={n.id}
                onClick={() => setSelected(n.id)}
                className={`w-full px-4 py-3 flex items-center justify-between text-xs ${record?.id === n.id ? "bg-zinc-50" : ""}`}
              >
                <span>{n.name}</span>
                <Badge status={n.status} />
              </button>
            ))}
          </div>
          {record && (
            <div className="flex-1 overflow-auto p-4 text-xs">
              <div className="flex justify-between mb-3">
                <span className="font-medium">{record.name}</span>
                <span className="text-zinc-400">
                  {record.durationMs ?? 0} ms
                </span>
              </div>
              {record.error && (
                <p className="p-2 mb-3 bg-red-50 text-red-700 rounded">
                  {record.error}
                </p>
              )}
              <div className="grid grid-cols-2 gap-5">
                {["input", "output"].map((key) => (
                  <div key={key}>
                    <h4 className="panel-title mb-2">{key}</h4>
                    <pre className="font-mono text-[11px] whitespace-pre-wrap break-all">
                      {JSON.stringify(record[key] ?? null, null, 2)}
                    </pre>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-zinc-400">{record.logs?.join(" · ")}</p>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
