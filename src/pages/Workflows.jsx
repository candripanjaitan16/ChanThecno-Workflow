import { useState } from "react";
import { Icon, Badge, Empty } from "../components/UI";
export default function Workflows({
  workflows,
  onOpen,
  onCreate,
  onDuplicate,
  onDelete,
}) {
  const [search, setSearch] = useState("");
  const filtered = workflows.filter((w) =>
    w.name.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <div className="p-8 lg:p-12 max-w-7xl mx-auto">
      <div className="panel-title mb-3">Your workspace</div>
      <div className="flex justify-between items-start mb-8">
        <div>
          <h1 className="text-3xl tracking-tight font-semibold">Workflows</h1>
          <p className="text-zinc-400 mt-2 text-sm">
            Less repetition. More possibility.
          </p>
        </div>
        <button className="btn-primary" onClick={onCreate}>
          <Icon name="Plus" size={15} />
          New workflow
        </button>
      </div>
      <div className="grid grid-cols-3 gap-4 mb-10">
        {[
          ["Total workflows", workflows.length, "Workflow"],
          [
            "Active automations",
            workflows.filter((w) => w.active).length,
            "Radio",
          ],
          [
            "Connected nodes",
            workflows.reduce((n, w) => n + w.nodes.length, 0),
            "Cable",
          ],
        ].map(([label, value, icon]) => (
          <div
            className="border border-zinc-200 rounded-lg bg-white p-5"
            key={label}
          >
            <div className="text-xs text-zinc-400 flex justify-between">
              {label}
              <Icon name={icon} />
            </div>
            <div className="text-3xl font-medium mt-4">
              {String(value).padStart(2, "0")}
            </div>
          </div>
        ))}
      </div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="font-semibold">
          All workflows{" "}
          <span className="ml-2 text-xs text-zinc-400">{workflows.length}</span>
        </h2>
        <div className="flex items-center gap-2 border border-zinc-200 bg-white rounded-md px-3">
          <Icon name="Search" size={14} />
          <input
            className="py-2 text-xs w-40"
            placeholder="Search workflows…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>
      <div className="border border-zinc-200 rounded-lg bg-white overflow-hidden">
        {filtered.length ? (
          <>
            <div className="grid grid-cols-[1fr_110px_120px_90px] px-6 py-3 bg-zinc-50 border-b border-zinc-200 panel-title">
              <span>Name</span>
              <span>Status</span>
              <span>Updated</span>
              <span />
            </div>
            {filtered.map((w) => (
              <div
                className="grid grid-cols-[1fr_110px_120px_90px] items-center px-6 py-5 border-b border-zinc-100 last:border-0 hover:bg-zinc-50/70"
                key={w.id}
              >
                <button
                  className="flex items-center gap-4 text-left"
                  onClick={() => onOpen(w)}
                >
                  <span className="p-3 rounded-lg border border-zinc-200 bg-white">
                    <Icon name="Workflow" size={18} />
                  </span>
                  <span>
                    <strong className="font-medium block">{w.name}</strong>
                    <span className="text-xs text-zinc-400 mt-1 block">
                      {w.nodes.length} nodes ·{" "}
                      {w.description || "A new connection awaits."}
                    </span>
                  </span>
                </button>
                <div>
                  <Badge status={w.active ? "Active" : "Draft"} />
                </div>
                <span className="text-xs text-zinc-400">
                  {w.updatedAt
                    ? new Date(w.updatedAt).toLocaleDateString()
                    : "Not saved"}
                </span>
                <div className="flex gap-3">
                  <button
                    aria-label={`Duplicate ${w.name}`}
                    onClick={() => onDuplicate(w)}
                  >
                    <Icon name="Copy" size={14} />
                  </button>
                  <button
                    aria-label={`Delete ${w.name}`}
                    onClick={() => onDelete(w)}
                  >
                    <Icon name="Trash2" size={14} />
                  </button>
                  <button
                    aria-label={`Open ${w.name}`}
                    onClick={() => onOpen(w)}
                  >
                    <Icon name="ArrowUpRight" size={15} />
                  </button>
                </div>
              </div>
            ))}
          </>
        ) : (
          <Empty title="No workflows yet">
            Create a workflow to connect your tools.
          </Empty>
        )}
      </div>
      <div className="mt-8 p-5 rounded-lg border border-dashed border-zinc-300 flex gap-4 items-center">
        <Icon name="Lightbulb" size={20} className="text-zinc-400" />
        <p className="text-xs text-zinc-500">
          <strong className="text-zinc-700">Start simple.</strong> Connect a
          JSON node to a Transform node and run your first automation without
          external credentials.
        </p>
      </div>
    </div>
  );
}
