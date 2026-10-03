import { useEffect, useState } from "react";
import { api, workflowService, credentialService } from "./services/api";
import { demoWorkflow, makeNode } from "./data/nodes";
import { Brand, Icon } from "./components/UI";
import Workflows from "./pages/Workflows";
import WorkflowEditor from "./pages/WorkflowEditor";
import Credentials from "./pages/Credentials";
import Executions from "./pages/Executions";
export default function App() {
  const [session, setSession] = useState(null),
    [page, rawSetPage] = useState("Editor"),
    [workflows, setWorkflows] = useState([]),
    [credentials, setCredentials] = useState([]),
    [current, setCurrent] = useState(null),
    [toast, setToast] = useState(null),
    [password, setPassword] = useState(""),
    [loading, setLoading] = useState(false);
  const [dirty, setDirty] = useState(false);
  function setPage(next) {
    if (
      page === "Editor" &&
      next !== "Editor" &&
      dirty &&
      !confirm("Leave without saving your workflow changes?")
    )
      return;
    setDirty(false);
    rawSetPage(next);
  }
  const notify = (message, error = false) =>
    setToast({ message, error, id: Date.now() });
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 5500);
      return () => clearTimeout(timer);
    }
  }, [toast]);
  async function load() {
    try {
      const s = await api("/session");
      setSession(s);
      if (s.authenticated) {
        const [ws, cs] = await Promise.all([
          workflowService.list(),
          credentialService.list(),
        ]);
        setWorkflows(ws);
        setCredentials(cs);
        setCurrent(ws[0] || demoWorkflow());
      }
    } catch (e) {
      notify(e.message, true);
      setSession({ configured: false, offline: true });
    }
  }
  useEffect(() => {
    load();
  }, []);
  async function refreshCredentials() {
    setCredentials(await credentialService.list());
  }
  function saved(w) {
    setWorkflows((all) => [w, ...all.filter((old) => old.id !== w.id)]);
  }
  function open(w) {
    if (
      page === "Editor" &&
      dirty &&
      current?.id !== w.id &&
      !confirm("Open another workflow without saving changes?")
    )
      return;
    setDirty(false);
    setCurrent(w);
    setPage("Editor");
  }
  async function create(template) {
    const workflow = template || {
      id: crypto.randomUUID(),
      name: "Untitled workflow",
      description: "",
      active: false,
      nodes: [],
      edges: [],
    };
    try {
      const result = await workflowService.save(workflow);
      saved(result);
      open(result);
    } catch (e) {
      notify(e.message, true);
    }
  }
  const navigation = [
    ["Workflow", "Workflows"],
    ["Activity", "Executions"],
    ["KeyRound", "Credentials"],
    ["LayoutTemplate", "Templates"],
  ];
  return (
    <>
      {!session ? (
        <div className="min-h-screen grid place-items-center">
          <Brand />
        </div>
      ) : !session.authenticated ? (
        <div className="min-h-screen grid place-items-center p-5 bg-zinc-50">
          <div className="w-full max-w-sm">
            <Brand />
            <h1 className="text-3xl font-semibold tracking-tight mt-12 mb-3">
              Make work flow.
            </h1>
            <p className="text-zinc-500 text-sm mb-8">
              Sign in to your ChanThecno workspace.
            </p>
            {session.configured ? (
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  setLoading(true);
                  try {
                    await api("/login", { method: "POST", body: { password } });
                    setPassword("");
                    await load();
                  } catch (e) {
                    notify(e.message, true);
                  } finally {
                    setLoading(false);
                  }
                }}
              >
                <label className="label">Workspace password</label>
                <input
                  className="input mb-4"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button className="btn-primary w-full" disabled={loading}>
                  {loading ? "Signing in…" : "Open workspace"}
                  <Icon name="ArrowRight" size={14} />
                </button>
              </form>
            ) : (
              <div className="border border-zinc-200 rounded-lg p-5 bg-white text-xs leading-relaxed">
                <h2 className="font-semibold mb-2">
                  {session.offline
                    ? "API unavailable"
                    : "Set up your workspace"}
                </h2>
                <p className="text-zinc-500">
                  {session.offline
                    ? "Run npm run dev to start both the frontend and API."
                    : "Run npm run setup to generate local secrets, then set ADMIN_PASSWORD in .env and restart the server. For Vercel, configure the environment variables listed in README.md."}
                </p>
                <button className="btn mt-4" onClick={load}>
                  <Icon name="RefreshCw" size={13} />
                  Check connection
                </button>
              </div>
            )}
            <div className="flex items-center gap-2 text-[10px] text-zinc-400 mt-8">
              <Icon name="LockKeyhole" size={12} />
              Private workspace · Server-side credentials
            </div>
          </div>
        </div>
      ) : (
        <div className="flex h-screen overflow-hidden">
          <aside className="w-16 lg:w-[216px] border-r border-zinc-200 bg-white flex flex-col shrink-0">
            <div className="h-[76px] px-5 flex items-center border-b border-zinc-100">
              <div className="hidden lg:block">
                <Brand />
              </div>
              <Icon name="Workflow" className="lg:hidden" size={23} />
            </div>
            <div className="px-3 py-6">
              <div className="hidden lg:flex items-center gap-2 px-2 mb-7">
                <span className="bg-zinc-100 border border-zinc-200 rounded p-1.5">
                  <Icon name="Layers2" size={13} />
                </span>
                <span className="text-xs font-medium">Personal workspace</span>
                <Icon
                  name="ChevronsUpDown"
                  size={12}
                  className="ml-auto text-zinc-400"
                />
              </div>
              <div className="panel-title px-3 mb-3 hidden lg:block">
                Workspace
              </div>
              {navigation.map(([icon, label]) => (
                <button
                  key={label}
                  title={label}
                  onClick={() => setPage(label)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 mb-1 rounded-md text-xs ${page === label || (label === "Workflows" && page === "Editor") ? "bg-zinc-100 text-zinc-900 font-medium" : "text-zinc-500 hover:bg-zinc-50"}`}
                >
                  <Icon name={icon} size={17} />
                  <span className="hidden lg:block">{label}</span>
                  {label === "Workflows" && (
                    <span className="ml-auto hidden lg:block text-[10px] text-zinc-400">
                      {workflows.length}
                    </span>
                  )}
                </button>
              ))}
            </div>
            <div className="hidden lg:block px-6">
              <div className="panel-title mb-3 flex justify-between">
                Recent workflows
                <Icon name="Plus" size={12} />
              </div>
              {workflows.slice(0, 4).map((w) => (
                <button
                  className="flex gap-2 w-full py-2 text-[11px] text-zinc-500 truncate text-left"
                  key={w.id}
                  onClick={() => open(w)}
                >
                  <Icon name="GitBranch" size={13} />
                  <span className="truncate">{w.name}</span>
                </button>
              ))}
              {!workflows.length && (
                <p className="text-[11px] text-zinc-400">
                  Your first workflow is waiting.
                </p>
              )}
            </div>
            <div className="mt-auto p-3">
              <div className="hidden lg:block bg-zinc-50 border border-zinc-200 rounded-lg p-3 mb-4">
                <span className="text-[10px] font-semibold">
                  Built for your flow.
                </span>
                <p className="text-[10px] text-zinc-400 leading-relaxed mt-1">
                  Connect ideas, tools, and the work that matters.
                </p>
                <Icon name="ArrowUpRight" size={13} className="mt-3" />
              </div>
              <button
                className="flex items-center gap-3 px-3 py-3 text-xs text-zinc-500 w-full"
                onClick={() => setPage("Settings")}
              >
                <Icon name="Settings2" size={17} />
                <span className="hidden lg:block">Settings</span>
              </button>
              <div className="border-t border-zinc-100 mt-2 pt-4 flex items-center gap-3 px-1">
                <div className="w-8 h-8 rounded-full bg-zinc-900 text-white grid place-items-center text-[11px] shrink-0">
                  CP
                </div>
                <div className="hidden lg:block">
                  <div className="text-xs font-medium">Workspace owner</div>
                  <div className="text-[10px] text-zinc-400">ChanThecno</div>
                </div>
                <button
                  className="ml-auto hidden lg:block"
                  title="Sign out"
                  onClick={async () => {
                    await api("/logout", { method: "POST" });
                    setSession({ ...session, authenticated: false });
                  }}
                >
                  <Icon name="LogOut" size={14} />
                </button>
              </div>
            </div>
          </aside>
          <main className="flex-1 min-w-0 overflow-auto">
            {page === "Editor" && current ? (
              <WorkflowEditor
                key={current.id}
                initial={current}
                credentials={credentials}
                onSaved={saved}
                onDirty={setDirty}
                notify={notify}
              />
            ) : page === "Workflows" ? (
              <Workflows
                workflows={workflows}
                onOpen={open}
                onCreate={() => create()}
                onDuplicate={(w) =>
                  create({
                    ...structuredClone(w),
                    id: crypto.randomUUID(),
                    name: `${w.name} (copy)`,
                    active: false,
                  })
                }
                onDelete={async (w) => {
                  if (!confirm(`Delete “${w.name}”?`)) return;
                  try {
                    await workflowService.remove(w.id);
                    setWorkflows((all) => all.filter((v) => v.id !== w.id));
                    notify("Workflow deleted");
                  } catch (e) {
                    notify(e.message, true);
                  }
                }}
              />
            ) : page === "Credentials" ? (
              <Credentials
                credentials={credentials}
                refresh={refreshCredentials}
                notify={notify}
              />
            ) : page === "Executions" ? (
              <Executions notify={notify} />
            ) : page === "Templates" ? (
              <div className="p-12">
                <div className="panel-title mb-3">A head start</div>
                <h1 className="text-3xl font-semibold tracking-tight">
                  Templates
                </h1>
                <p className="text-zinc-400 mt-2 mb-8">
                  A starting point for your next automation.
                </p>
                <div className="grid md:grid-cols-2 gap-5 max-w-4xl">
                  {[
                    [
                      "Customer outreach",
                      "CSV → AI → WhatsApp",
                      "Bring your AI and WhatsApp Business credentials.",
                      () => demoWorkflow(),
                    ],
                    [
                      "Data transformation",
                      "JSON → Transform",
                      "Run immediately. No external account required.",
                      () => {
                        const a = makeNode("json", { x: 150, y: 200 }),
                          b = makeNode("transform", { x: 470, y: 200 });
                        a.data.parameters.value =
                          '[{"name":"Candri","role":"Engineer"},{"name":"Ruth","role":"Designer"}]';
                        b.data.parameters.mapping =
                          '{"greeting":"Hello {{item.name}}","team":"{{item.role}}"}';
                        return {
                          id: crypto.randomUUID(),
                          name: "Data transformation",
                          description: "Turn raw data into useful records.",
                          active: false,
                          nodes: [a, b],
                          edges: [
                            {
                              id: crypto.randomUUID(),
                              source: a.id,
                              target: b.id,
                            },
                          ],
                        };
                      },
                    ],
                  ].map(([name, flow, desc, factory]) => (
                    <div
                      key={name}
                      className="bg-white border border-zinc-200 rounded-lg p-6"
                    >
                      <Icon name="Workflow" size={25} />
                      <h2 className="font-semibold mt-6">{name}</h2>
                      <p className="font-mono text-xs text-zinc-500 mt-2">
                        {flow}
                      </p>
                      <p className="text-xs text-zinc-400 mt-4 mb-6">{desc}</p>
                      <button className="btn" onClick={() => create(factory())}>
                        Use template
                        <Icon name="ArrowRight" size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ) : page === "Settings" ? (
              <div className="p-12 max-w-3xl">
                <div className="panel-title mb-3">Preferences</div>
                <h1 className="text-3xl font-semibold mb-8">
                  Workspace settings
                </h1>
                <div className="bg-white border border-zinc-200 rounded-lg divide-y divide-zinc-100">
                  {[
                    ["Workspace", "ChanThecno / Personal"],
                    ["Storage", session.storage],
                    [
                      "Authentication",
                      "Single-owner workspace · 8-hour HttpOnly session",
                    ],
                    ["Credentials", "AES-256-GCM encryption"],
                    ["Runtime", "Server-side · 40-second workflow budget"],
                    [
                      "Scheduling",
                      "Authenticated /api/cron endpoint — connect a scheduler",
                    ],
                    [
                      "Shortcuts",
                      "⌘/Ctrl Z undo · Shift Z redo · C/V copy/paste · D duplicate",
                    ],
                  ].map(([label, value]) => (
                    <div className="px-5 py-4" key={label}>
                      <div className="text-xs font-medium">{label}</div>
                      <div className="text-xs text-zinc-400 mt-1">{value}</div>
                    </div>
                  ))}
                </div>
                <button
                  className="btn mt-6"
                  onClick={async () => {
                    await api("/logout", { method: "POST" });
                    setSession({ ...session, authenticated: false });
                  }}
                >
                  Sign out
                </button>
              </div>
            ) : null}
          </main>
        </div>
      )}
      {toast && (
        <div
          role="status"
          className={`fixed bottom-12 left-1/2 -translate-x-1/2 z-50 max-w-lg rounded-lg shadow-xl px-5 py-3 text-xs flex items-center gap-3 ${toast.error ? "bg-red-950 text-white" : "bg-zinc-900 text-white"}`}
        >
          <Icon name={toast.error ? "CircleAlert" : "CheckCircle2"} size={16} />
          {toast.message}
          <button
            aria-label="Dismiss notification"
            onClick={() => setToast(null)}
          >
            <Icon name="X" size={13} />
          </button>
        </div>
      )}
    </>
  );
}
