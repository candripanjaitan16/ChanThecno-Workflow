import { useState } from "react";
import { byType } from "../data/nodes";
import { Icon } from "./UI";
export default function NodeSettings({
  node,
  workflow,
  credentials,
  onChange,
  onClose,
  onTest,
  run,
  busy,
}) {
  const [tab, setTab] = useState("Parameters");
  const def = byType[node.data.kind],
    record = run?.nodes.find((n) => n.id === node.id);
  const update = (key, value) =>
    onChange({ ...node, data: { ...node.data, [key]: value } });
  return (
    <aside className="w-80 max-w-[85vw] shrink-0 border-l border-zinc-200 bg-white flex flex-col absolute right-0 top-0 bottom-0 z-20 lg:static">
      <header className="p-5 border-b border-zinc-100">
        <div className="flex items-center gap-3">
          <span className="p-2.5 rounded-lg border border-zinc-200">
            <Icon name={def.icon} size={20} />
          </span>
          <div className="flex-1">
            <h3 className="font-semibold text-sm">{node.data.label}</h3>
            <p className="text-[10px] text-zinc-400 mt-1">
              {def.category} / {def.name}
            </p>
          </div>
          <button aria-label="Close node settings" onClick={onClose}>
            <Icon name="X" size={16} />
          </button>
        </div>
        <div className="flex gap-4 mt-5 -mb-5">
          {["Parameters", "Input", "Output"].map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`py-3 text-xs border-b-2 ${tab === t ? "border-zinc-900 font-medium" : "border-transparent text-zinc-400"}`}
            >
              {t}
            </button>
          ))}
        </div>
      </header>
      <div className="p-5 overflow-y-auto flex-1">
        {tab !== "Parameters" ? (
          <pre className="text-xs whitespace-pre-wrap break-all font-mono">
            {record
              ? JSON.stringify(record[tab.toLowerCase()] ?? null, null, 2)
              : "Run this node to inspect data."}
          </pre>
        ) : (
          <>
            <p className="text-xs text-zinc-400 leading-relaxed mb-5">
              {def.description}
            </p>
            <label className="label">Node name</label>
            <input
              className="input mb-5"
              value={node.data.label}
              onChange={(e) => update("label", e.target.value)}
            />
            {def.credential && (
              <div className="mb-5">
                <label className="label">Connection</label>
                <select
                  className="input"
                  value={node.data.credentialId}
                  onChange={(e) => update("credentialId", e.target.value)}
                >
                  <option value="">Select credential…</option>
                  {credentials
                    .filter((c) => c.type === def.credential)
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                </select>
                <p className="text-[10px] text-zinc-400 mt-2">
                  Manage encrypted connections in Credentials.
                </p>
              </div>
            )}
            {def.fields.map((field) => (
              <div key={field.key} className="mb-5">
                <label className="label" htmlFor={field.key}>
                  {field.label}
                </label>
                {field.type.startsWith("select:") ? (
                  <select
                    id={field.key}
                    className="input"
                    value={node.data.parameters[field.key] ?? ""}
                    onChange={(e) =>
                      update("parameters", {
                        ...node.data.parameters,
                        [field.key]: e.target.value,
                      })
                    }
                  >
                    {field.type
                      .slice(7)
                      .split(",")
                      .map((v) => (
                        <option key={v}>{v}</option>
                      ))}
                  </select>
                ) : ["textarea", "json"].includes(field.type) ? (
                  <textarea
                    id={field.key}
                    rows={5}
                    className="input font-mono text-xs resize-y"
                    value={node.data.parameters[field.key] ?? ""}
                    onChange={(e) =>
                      update("parameters", {
                        ...node.data.parameters,
                        [field.key]: e.target.value,
                      })
                    }
                  />
                ) : (
                  <input
                    id={field.key}
                    type={field.type}
                    className="input"
                    value={node.data.parameters[field.key] ?? ""}
                    onChange={(e) =>
                      update("parameters", {
                        ...node.data.parameters,
                        [field.key]: e.target.value,
                      })
                    }
                  />
                )}
              </div>
            ))}
            {["webhook", "event"].includes(node.data.kind) && (
              <div className="mb-5">
                <label className="label">Webhook endpoint</label>
                <code className="text-[10px] break-all">
                  {location.origin}/api/webhooks/{workflow.id}
                </code>
                <p className="text-[10px] text-zinc-400 mt-2">
                  Activate the workflow. Bearer token:
                </p>
                <input
                  readOnly
                  type="password"
                  className="input mt-2"
                  value={workflow.webhookToken || ""}
                />
                <button
                  className="btn mt-2"
                  onClick={() =>
                    navigator.clipboard.writeText(workflow.webhookToken || "")
                  }
                >
                  Copy token
                </button>
              </div>
            )}
            <details className="border-t border-zinc-100 pt-4">
              <summary className="text-xs font-medium cursor-pointer">
                Variables & advanced
              </summary>
              <p className="text-[10px] text-zinc-400 my-3">
                Copy a reference into any parameter.
              </p>
              {[
                "{{input}}",
                "{{webhook.body}}",
                "{{ai.output}}",
                ...workflow.edges
                  .filter((e) => e.target === node.id)
                  .map((e) => `{{nodes.${e.source}.output}}`),
              ].map((v) => (
                <button
                  key={v}
                  onClick={() => navigator.clipboard.writeText(v)}
                  className="block font-mono text-[10px] bg-zinc-50 p-2 mb-1 w-full text-left break-all"
                >
                  {v}
                </button>
              ))}
              <label className="flex gap-2 text-xs mt-4">
                <input
                  type="checkbox"
                  checked={node.data.disabled}
                  onChange={(e) => update("disabled", e.target.checked)}
                />
                Disable node (pass input through)
              </label>
            </details>
          </>
        )}
      </div>
      <footer className="p-4 border-t border-zinc-100">
        <button disabled={busy} onClick={onTest} className="btn w-full">
          <Icon name="FlaskConical" size={14} />
          Test node
        </button>
        <p className="text-[9px] text-zinc-400 text-center mt-2">
          Runs this node only, with an empty input.
        </p>
      </footer>
    </aside>
  );
}
