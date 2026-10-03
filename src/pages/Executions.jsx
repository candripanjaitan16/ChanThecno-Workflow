import { useEffect, useState } from "react";
import { executionService } from "../services/api";
import { Badge, Icon, Empty } from "../components/UI";
import ExecutionPanel from "../components/ExecutionPanel";
export default function Executions({ notify }) {
  const [runs, setRuns] = useState([]),
    [selected, setSelected] = useState(null),
    [filter, setFilter] = useState("All");
  async function refresh() {
    try {
      setRuns(await executionService.list());
    } catch (e) {
      notify(e.message, true);
    }
  }
  useEffect(() => {
    refresh();
  }, []);
  return (
    <div className="h-full flex flex-col">
      <div className="p-8 lg:p-12 flex-1 overflow-auto">
        <div className="panel-title mb-3">Observability</div>
        <div className="flex justify-between mb-8">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">
              Executions
            </h1>
            <p className="text-zinc-400 mt-2">
              Every run tells a story. Follow the data.
            </p>
          </div>
          <button className="btn self-start" onClick={refresh}>
            <Icon name="RefreshCw" size={14} />
            Refresh
          </button>
        </div>
        <div className="flex gap-4 mb-5">
          {["All", "SUCCESS", "ERROR", "RUNNING"].map((v) => (
            <button
              key={v}
              className={`text-xs px-3 py-2 rounded-md ${filter === v ? "bg-zinc-900 text-white" : "text-zinc-400"}`}
              onClick={() => setFilter(v)}
            >
              {v}
            </button>
          ))}
        </div>
        <div className="bg-white border border-zinc-200 rounded-lg overflow-hidden">
          {runs.filter((r) => filter === "All" || r.status === filter)
            .length ? (
            runs
              .filter((r) => filter === "All" || r.status === filter)
              .map((r) => (
                <button
                  onClick={() => setSelected(r)}
                  key={r.id}
                  className="flex gap-4 items-center text-left w-full px-5 py-4 border-b border-zinc-100 hover:bg-zinc-50"
                >
                  <Icon name="Terminal" />
                  <span className="flex-1">
                    <strong className="block text-sm font-medium">
                      {r.workflowName}
                    </strong>
                    <span className="text-[10px] text-zinc-400 font-mono">
                      {r.id.slice(0, 8)} ·{" "}
                      {new Date(r.startedAt).toLocaleString()}
                    </span>
                  </span>
                  <span className="text-xs text-zinc-400">
                    {r.durationMs ?? "—"} ms
                  </span>
                  <Badge status={r.status} />
                  <Icon name="ChevronRight" size={14} />
                </button>
              ))
          ) : (
            <Empty icon="Terminal" title="No executions here">
              Run a workflow to see its history.
            </Empty>
          )}
        </div>
      </div>
      {selected && (
        <ExecutionPanel run={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}
