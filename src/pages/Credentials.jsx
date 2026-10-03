import { useState } from "react";
import { credentialService } from "../services/api";
import { Icon, Modal, Empty } from "../components/UI";
const providers = {
  openai: "OpenAI",
  anthropic: "Anthropic",
  google: "Google AI",
  ai: "Custom AI",
  whatsapp: "WhatsApp Business",
  smtp: "SMTP / Gmail",
  bearer: "HTTP Bearer Token",
  postgres: "PostgreSQL",
};
export default function Credentials({ credentials, refresh, notify }) {
  const [open, setOpen] = useState(false),
    [name, setName] = useState(""),
    [type, setType] = useState("openai"),
    [values, setValues] = useState({}),
    [busy, setBusy] = useState(false);
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    try {
      await credentialService.create({ name, type, values });
      setValues({});
      setName("");
      setOpen(false);
      await refresh();
      notify("Credential encrypted and saved");
    } catch (e) {
      notify(e.message, true);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="p-8 lg:p-12 max-w-6xl mx-auto">
      <div className="panel-title mb-3">Connections</div>
      <div className="flex justify-between mb-8">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Credentials</h1>
          <p className="text-zinc-400 mt-2">
            Your tools. Your accounts. One connected workspace.
          </p>
        </div>
        <button
          className="btn-primary self-start"
          onClick={() => setOpen(true)}
        >
          <Icon name="Plus" size={15} />
          Add credential
        </button>
      </div>
      <div className="p-4 rounded-lg border border-zinc-200 bg-white flex gap-3 mb-6 text-xs text-zinc-500">
        <Icon name="ShieldCheck" size={18} />
        <p>
          Secrets are encrypted on the server with AES-256-GCM. Saved secret
          values are never returned to your browser.
        </p>
      </div>
      {credentials.length ? (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
          {credentials.map((c) => (
            <div
              key={c.id}
              className="p-5 border border-zinc-200 rounded-lg bg-white"
            >
              <div className="flex justify-between">
                <span className="p-3 bg-zinc-50 border border-zinc-200 rounded-lg">
                  <Icon name="KeyRound" />
                </span>
                <button
                  aria-label={`Delete ${c.name}`}
                  onClick={async () => {
                    if (!confirm(`Delete credential “${c.name}”?`)) return;
                    try {
                      await credentialService.remove(c.id);
                      await refresh();
                      notify("Credential deleted");
                    } catch (e) {
                      notify(e.message, true);
                    }
                  }}
                >
                  <Icon name="Trash2" size={14} />
                </button>
              </div>
              <h3 className="font-medium mt-4">{c.name}</h3>
              <p className="text-xs text-zinc-400 mt-1">{providers[c.type]}</p>
              <p className="text-[10px] text-zinc-400 mt-6 flex gap-1.5">
                <Icon name="LockKeyhole" size={12} />
                Encrypted · Added {new Date(c.createdAt).toLocaleDateString()}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <Empty icon="KeyRound" title="Connect your first service">
          Add a credential, then select it from a node’s settings.
        </Empty>
      )}
      {open && (
        <Modal
          title="New credential"
          onClose={() => {
            setOpen(false);
            setValues({});
          }}
        >
          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="label">Connection name</label>
              <input
                autoFocus
                required
                className="input"
                placeholder="e.g. OpenAI Production"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div>
              <label className="label">Provider</label>
              <select
                className="input"
                value={type}
                onChange={(e) => {
                  setType(e.target.value);
                  setValues({});
                }}
              >
                {Object.entries(providers).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            {(type === "smtp"
              ? ["host", "user", "password"]
              : type === "postgres"
                ? ["url"]
                : ["apiKey"]
            ).map((key) => (
              <div key={key}>
                <label className="label">
                  {
                    {
                      apiKey: "API key / access token",
                      url: "PostgreSQL connection URL",
                      host: "SMTP host (TLS port 465)",
                      user: "Username",
                      password: "Password / Gmail app password",
                    }[key]
                  }
                </label>
                <input
                  required
                  autoComplete="off"
                  type={
                    ["apiKey", "password", "url"].includes(key)
                      ? "password"
                      : "text"
                  }
                  className="input"
                  value={values[key] || ""}
                  onChange={(e) =>
                    setValues({ ...values, [key]: e.target.value })
                  }
                />
              </div>
            ))}
            <p className="text-xs text-zinc-400">
              Custom endpoints, SMTP and database hosts must be explicitly
              allowed in the server’s OUTBOUND_HOSTS setting.
            </p>
            <button className="btn-primary w-full" disabled={busy}>
              <Icon name="LockKeyhole" size={14} />
              {busy ? "Saving…" : "Encrypt & save"}
            </button>
          </form>
        </Modal>
      )}
    </div>
  );
}
