import { useEffect, useRef, useState } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
  useReactFlow,
} from "@xyflow/react";
import WorkflowNode from "../components/WorkflowNode";
import NodeLibrary from "../components/NodeLibrary";
import NodeSettings from "../components/NodeSettings";
import ExecutionPanel from "../components/ExecutionPanel";
import { Icon, Badge } from "../components/UI";
import { makeNode } from "../data/nodes";
import { workflowService, executionService } from "../services/api";
import useWorkflow from "../state/useWorkflow";
const nodeTypes = { workflow: WorkflowNode };
function fingerprint(w) {
  return JSON.stringify({
    name: w.name,
    active: w.active,
    nodes: w.nodes.map(({ id, position, data }) => ({ id, position, data })),
    edges: w.edges.map(({ id, source, target }) => ({ id, source, target })),
  });
}
function Editor({ initial, credentials, onSaved, onDirty, notify }) {
  const {
    workflow,
    change,
    checkpoint,
    undo,
    redo,
    canUndo,
    canRedo,
    revision,
  } = useWorkflow(initial);
  const [library, setLibrary] = useState(false),
    [selected, setSelected] = useState(null),
    [context, setContext] = useState(null),
    [run, setRun] = useState(null),
    [showLog, setShowLog] = useState(false),
    [busy, setBusy] = useState(false),
    [saving, setSaving] = useState(false),
    [savedRevision, setSavedRevision] = useState(0);
  const clipboard = useRef(null),
    flow = useReactFlow(),
    lastRevision = useRef(revision);
  lastRevision.current = revision;
  const [savedFingerprint, setSavedFingerprint] = useState(
    initial.updatedAt ? fingerprint(initial) : "",
  );
  const dirty = fingerprint(workflow) !== savedFingerprint;
  useEffect(() => {
    onDirty(dirty);
  }, [dirty, onDirty]);
  const node = workflow.nodes.find((n) => n.id === selected);
  useEffect(() => {
    const handler = (e) => {
      if (dirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);
  const addNode = (kind, position) => {
    const newNode = makeNode(
      kind,
      position ||
        flow.screenToFlowPosition({
          x: window.innerWidth / 2,
          y: window.innerHeight / 2,
        }),
    );
    change((w) => ({ ...w, nodes: [...w.nodes, newNode] }));
    setSelected(newNode.id);
    setLibrary(false);
    setContext(null);
  };
  function copy() {
    const nodes = workflow.nodes.filter((n) => n.selected || n.id === selected);
    clipboard.current = {
      nodes,
      edges: workflow.edges.filter(
        (e) =>
          nodes.some((n) => n.id === e.source) &&
          nodes.some((n) => n.id === e.target),
      ),
    };
  }
  function paste(source = clipboard.current) {
    if (!source?.nodes.length) return;
    const ids = Object.fromEntries(
      source.nodes.map((n) => [n.id, crypto.randomUUID()]),
    );
    change((w) => ({
      ...w,
      nodes: [
        ...w.nodes.map((n) => ({ ...n, selected: false })),
        ...source.nodes.map((n) => ({
          ...structuredClone(n),
          id: ids[n.id],
          selected: true,
          position: { x: n.position.x + 40, y: n.position.y + 40 },
        })),
      ],
      edges: [
        ...w.edges,
        ...source.edges.map((e) => ({
          ...e,
          id: crypto.randomUUID(),
          source: ids[e.source],
          target: ids[e.target],
        })),
      ],
    }));
  }
  function duplicate(n) {
    paste({ nodes: [n], edges: [] });
    setContext(null);
  }
  function remove(id) {
    change((w) => ({
      ...w,
      nodes: w.nodes.filter((n) => n.id !== id),
      edges: w.edges.filter((e) => e.source !== id && e.target !== id),
    }));
    setSelected(null);
    setContext(null);
  }
  async function save() {
    setSaving(true);
    const r = lastRevision.current;
    try {
      const result = await workflowService.save(workflow);
      onSaved(result);
      setSavedFingerprint(fingerprint(result));
      change((w) => ({ ...w, webhookToken: result.webhookToken }), false);
      setSavedRevision(r + 1);
      notify("Workflow saved");
      return result;
    } catch (e) {
      notify(e.message, true);
      return null;
    } finally {
      setSaving(false);
    }
  }
  async function execute(testNodeId) {
    setBusy(true);
    setShowLog(true);
    setRun(null);
    let timer;
    try {
      const saved = await save();
      if (!saved) return;
      timer = setInterval(async () => {
        try {
          const runs = await executionService.list();
          const latest = runs.find((r) => r.workflowId === workflow.id);
          if (latest) setRun(latest);
        } catch {}
      }, 800);
      const result = await workflowService.run(workflow.id, { testNodeId });
      setRun(result);
      notify(
        result.status === "SUCCESS"
          ? "Execution completed"
          : "Execution failed. Inspect the log.",
        result.status === "ERROR",
      );
    } catch (e) {
      notify(e.message, true);
    } finally {
      clearInterval(timer);
      setBusy(false);
    }
  }
  useEffect(() => {
    const handler = (e) => {
      if (e.target.closest('input,textarea,select,[contenteditable="true"]'))
        return;
      if (e.key === "Escape") {
        setContext(null);
        setLibrary(false);
        setSelected(null);
      }
      if (e.ctrlKey || e.metaKey) {
        const key = e.key.toLowerCase();
        if (["z", "c", "v", "d", "s"].includes(key)) e.preventDefault();
        if (key === "z") e.shiftKey ? redo() : undo();
        if (key === "c") copy();
        if (key === "v") paste();
        if (key === "d") {
          copy();
          paste();
        }
        if (key === "s") save();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  });
  const validConnection = (connection) => {
    if (connection.source === connection.target) return false;
    const seen = new Set();
    function reaches(id) {
      if (id === connection.source) return true;
      if (seen.has(id)) return false;
      seen.add(id);
      return workflow.edges
        .filter((e) => e.source === id)
        .some((e) => reaches(e.target));
    }
    return !reaches(connection.target);
  };
  return (
    <div className="flex flex-col h-full min-h-0">
      <header className="h-[76px] px-6 border-b border-zinc-200 bg-white flex items-center gap-4 shrink-0">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-[10px] text-zinc-400 mb-1">
            <span>Workspace</span>
            <Icon name="ChevronRight" size={10} />
            <span>Workflows</span>
          </div>
          <div className="flex items-center gap-3">
            <input
              aria-label="Workflow name"
              className="font-semibold text-base bg-transparent min-w-0 w-52 outline-none"
              value={workflow.name}
              onChange={(e) => change((w) => ({ ...w, name: e.target.value }))}
            />
            <Badge status={workflow.active ? "Active" : "Draft"} />
            <span className="hidden xl:inline text-[10px] text-zinc-400">
              {!dirty ? "All changes saved" : "Unsaved changes"}
            </span>
          </div>
        </div>
        <button
          className="btn hidden sm:flex"
          disabled={saving || busy}
          onClick={save}
        >
          <Icon name="Save" size={14} />
          {saving ? "Saving…" : "Save"}
        </button>
        <button
          className="btn-primary"
          disabled={busy || saving || !workflow.nodes.length}
          onClick={() => execute()}
        >
          <Icon
            name={busy ? "LoaderCircle" : "Play"}
            size={14}
            className={busy ? "animate-spin" : ""}
          />
          {busy ? "Running…" : "Run workflow"}
        </button>
        <div className="h-7 w-px bg-zinc-200 hidden md:block" />
        <button
          disabled={busy}
          className="hidden md:flex items-center gap-2 text-xs"
          onClick={async () => {
            try {
              const next = { ...workflow, active: !workflow.active };
              const result = await workflowService.save(next);
              change(result);
              onSaved(result);
              setSavedFingerprint(fingerprint(result));
              notify(
                next.active ? "Workflow activated" : "Workflow deactivated",
              );
            } catch (e) {
              notify(e.message, true);
            }
          }}
        >
          <span
            className={`w-7 h-4 rounded-full p-0.5 ${workflow.active ? "bg-zinc-900" : "bg-zinc-200"}`}
          >
            <span
              className={`block bg-white w-3 h-3 rounded-full ${workflow.active ? "translate-x-3" : ""}`}
            />
          </span>
          Active
        </button>
      </header>
      <div className="flex-1 min-h-0 flex relative">
        <div
          className="flex-1 relative min-w-0"
          onContextMenu={(e) => e.preventDefault()}
        >
          <ReactFlow
            nodes={workflow.nodes.map((n) => ({
              ...n,
              data: {
                ...n.data,
                status: run?.nodes.find((r) => r.id === n.id)?.status,
              },
            }))}
            edges={workflow.edges}
            nodeTypes={nodeTypes}
            onNodesChange={(changes) =>
              change(
                (w) => ({ ...w, nodes: applyNodeChanges(changes, w.nodes) }),
                changes.some((c) => c.type === "remove"),
              )
            }
            onEdgesChange={(changes) =>
              change(
                (w) => ({ ...w, edges: applyEdgeChanges(changes, w.edges) }),
                changes.some((c) => c.type === "remove"),
              )
            }
            onNodeDragStart={checkpoint}
            onConnect={(c) =>
              change((w) => ({
                ...w,
                edges: addEdge({ ...c, id: crypto.randomUUID() }, w.edges),
              }))
            }
            isValidConnection={validConnection}
            onNodeClick={(_, n) => {
              setSelected(n.id);
              setContext(null);
            }}
            onPaneClick={() => {
              setSelected(null);
              setContext(null);
            }}
            onNodeContextMenu={(e, n) => {
              e.preventDefault();
              setContext({ x: e.clientX, y: e.clientY, node: n });
            }}
            onPaneContextMenu={(e) => {
              e.preventDefault();
              setContext({ x: e.clientX, y: e.clientY });
            }}
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
            }}
            onDrop={(e) => {
              e.preventDefault();
              const kind = e.dataTransfer.getData("application/chanthecno");
              if (kind)
                addNode(
                  kind,
                  flow.screenToFlowPosition({ x: e.clientX, y: e.clientY }),
                );
            }}
            fitView
            fitViewOptions={{ padding: 0.35, maxZoom: 1 }}
            minZoom={0.2}
            maxZoom={2}
            snapToGrid
            snapGrid={[16, 16]}
            deleteKeyCode={["Backspace", "Delete"]}
            multiSelectionKeyCode={["Meta", "Control"]}
            selectionOnDrag
            panOnDrag={[1, 2]}
            panActivationKeyCode="Space"
            connectOnClick
          >
            <Background color="#d4d4d8" gap={20} size={1} />
            <Controls showInteractive={false} />
            <MiniMap
              nodeColor="#d4d4d8"
              maskColor="rgba(250,250,250,.8)"
              className="!h-24 !w-36 !border !border-zinc-200 !rounded-md"
              pannable
              zoomable
            />
          </ReactFlow>
          <div className="absolute top-5 left-5 flex gap-2">
            <button
              className="btn shadow-xs"
              onClick={() => setLibrary(!library)}
            >
              <Icon name="Plus" size={15} />
              Add node<span className="ml-3 text-zinc-400 text-[10px]">⌘</span>
            </button>
            <div className="flex bg-white border border-zinc-200 rounded-md">
              <button
                aria-label="Undo"
                className="p-2"
                disabled={!canUndo}
                onClick={undo}
              >
                <Icon name="Undo2" size={14} />
              </button>
              <button
                aria-label="Redo"
                className="p-2"
                disabled={!canRedo}
                onClick={redo}
              >
                <Icon name="Redo2" size={14} />
              </button>
            </div>
          </div>
          {!workflow.nodes.length && (
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none">
              <Icon
                name="Workflow"
                size={36}
                className="mx-auto mb-4 text-zinc-300"
              />
              <h2 className="font-semibold text-xl">
                Every connection starts here.
              </h2>
              <p className="text-zinc-400 text-xs mt-2">
                Add your first node to build a workflow.
              </p>
            </div>
          )}
          <div className="absolute bottom-6 left-16 hidden xl:block text-[10px] text-zinc-400">
            Drag to select · Space to pan · Scroll to zoom
          </div>
          {library && (
            <NodeLibrary onAdd={addNode} onClose={() => setLibrary(false)} />
          )}
        </div>
        {node && (
          <NodeSettings
            key={node.id}
            node={node}
            workflow={workflow}
            credentials={credentials}
            onChange={(n) =>
              change((w) => ({
                ...w,
                nodes: w.nodes.map((old) => (old.id === n.id ? n : old)),
              }))
            }
            onClose={() => setSelected(null)}
            onTest={() => execute(node.id)}
            run={run}
            busy={busy}
          />
        )}
      </div>
      {showLog && (
        <ExecutionPanel run={run} onClose={() => setShowLog(false)} />
      )}
      <footer className="h-8 border-t border-zinc-200 bg-white flex items-center px-5 text-[10px] text-zinc-400 gap-4">
        <span className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 bg-zinc-400 rounded-full" />
          Workspace connected
        </span>
        <span>{workflow.nodes.length} nodes</span>
        <span>{workflow.edges.length} connections</span>
        <button
          className="ml-auto flex items-center gap-2 hover:text-zinc-800"
          onClick={() => setShowLog(!showLog)}
        >
          <Icon name="Terminal" size={12} />
          Execution log
          <Icon name={showLog ? "ChevronDown" : "ChevronUp"} size={12} />
        </button>
      </footer>
      {context && (
        <div
          className="fixed z-40 bg-white shadow-xl border border-zinc-200 rounded-lg p-1.5 w-44"
          style={{
            left: Math.min(context.x, window.innerWidth - 190),
            top: Math.min(context.y, window.innerHeight - 280),
          }}
        >
          {context.node ? (
            <>
              {[
                [
                  "Settings2",
                  "Configure",
                  () => {
                    setSelected(context.node.id);
                    setContext(null);
                  },
                ],
                [
                  "Pencil",
                  "Rename",
                  () => {
                    setSelected(context.node.id);
                    setContext(null);
                  },
                ],
                ["Copy", "Duplicate", () => duplicate(context.node)],
                [
                  "Cable",
                  "Add connection",
                  () => {
                    notify("Click the output port, then a target input port.");
                    setContext(null);
                  },
                ],
                [
                  "Pause",
                  context.node.data.disabled ? "Enable" : "Disable",
                  () => {
                    change((w) => ({
                      ...w,
                      nodes: w.nodes.map((n) =>
                        n.id === context.node.id
                          ? {
                              ...n,
                              data: { ...n.data, disabled: !n.data.disabled },
                            }
                          : n,
                      ),
                    }));
                    setContext(null);
                  },
                ],
                ["Trash2", "Delete", () => remove(context.node.id)],
              ].map(([icon, label, action]) => (
                <button
                  key={label}
                  className="flex items-center gap-3 p-2 w-full text-left text-xs rounded hover:bg-zinc-50"
                  onClick={action}
                >
                  <Icon name={icon} size={13} />
                  {label}
                </button>
              ))}
            </>
          ) : (
            <button
              className="btn w-full"
              onClick={() => {
                setLibrary(true);
                setContext(null);
              }}
            >
              <Icon name="Plus" />
              Browse node library
            </button>
          )}
        </div>
      )}
    </div>
  );
}
export default function WorkflowEditor(props) {
  return (
    <ReactFlowProvider>
      <Editor {...props} />
    </ReactFlowProvider>
  );
}
