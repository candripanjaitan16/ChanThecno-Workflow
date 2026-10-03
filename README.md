# ChanThecno Workflow

A real, single-owner automation workspace: React + JSX + Tailwind, a visual graph editor, server-side execution, reusable encrypted credentials, execution history, and PostgreSQL storage for Vercel.

## Run locally

Requires Node.js 22+.

```sh
npm install
npm run setup
# Edit .env: set ADMIN_PASSWORD to at least 12 characters.
npm run dev
```

Open http://localhost:5173 and sign in with your workspace password. The API runs on port 3001. Development data is written to `.data/store.json` (gitignored). Keep the generated encryption key: changing it makes existing credentials unreadable.

For an immediate real execution without external services, open **Templates → Data transformation → Use template → Run workflow**. The initial CSV → AI → WhatsApp example requires actual provider credentials and will report an error until configured. It never simulates provider success.

```sh
npm run build
npm test
npx playwright install chromium
npm run test:ui
```

`npm run preview` previews only built frontend assets; use `npm run dev` for the full local API and UI. Browser tests create test workflow records in the local data store.

## Included

- Infinite canvas with zoom, pan, minimap, snapping, multi-select, ports and connections.
- Drag from the searchable node library, right-click menus, copy/paste, duplicate, delete, undo/redo and save.
- Workflow creation, naming, duplication, deletion, activation, templates and dashboard statistics.
- Configuration, connection selector, input/output inspector and single-node test.
- Server-side DAG validation and topological execution, multiple inputs, fan-out/fan-in, disabled-node passthrough, bounded outputs and stop-on-error behavior.
- Persisted per-node input/output, status, duration, timestamps and error logs; the UI polls execution progress during runs.
- JSON, CSV (quoted fields supported), Text, Transform, Map, Filter, Merge, Split and Set Variable.
- OpenAI, Anthropic, Google AI and OpenAI-compatible API adapters; configurable models.
- Official WhatsApp Business Cloud API text/template messages; SMTP email (including Gmail app passwords); HTTP/REST/custom APIs; parameterized PostgreSQL queries.
- Manual, webhook, event and interval schedule triggers.
- AES-256-GCM encrypted reusable credentials. The client can create secrets but never retrieve saved secret values.

## Variables and data semantics

Use `{{input}}`, `{{webhook.body}}`, `{{ai.output}}`, `{{customer.name}}` or `{{nodes.NODE-ID.output}}` in parameters. Exact expressions preserve the original value type; expressions embedded in text stringify values. A JSON node with `{"customer":{"name":"Candri"}}` makes `{{customer.name}}` available downstream. Node IDs are shown in exported execution records; incoming node references can be copied in the configuration panel.

Transform and Map apply a JSON template to each input record using `{{item.name}}`. Filter returns matching records. Split reads an array from the configured path. Merge waits for all upstream nodes and concatenates their outputs. Set Variable writes a named value into the run context. An AI node produces `{output, usage?}`; AI and communication nodes execute once per node, not automatically once per CSV row. Use provider-side batch APIs if needed; loop nodes are not included.

Cycles are rejected. A manual run executes the complete graph in dependency order; webhook/schedule runs execute only their trigger and descendants. A single-node test executes only that node with `{}` input, so expressions requiring upstream data should be tested with a full workflow run. Side-effect nodes send real requests when tested.

## Vercel

Import this GitHub repository into Vercel. Framework: Vite. Build: `npm run build`. Output: `dist`. The `api/index.js` function serves the Express API; `vercel.json` routes requests to it.

Set these **server-only** environment variables:

| Variable         | Required value                                          |
| ---------------- | ------------------------------------------------------- |
| `DATABASE_URL`   | PostgreSQL URL; required on Vercel                      |
| `ENCRYPTION_KEY` | 64 hexadecimal characters (`openssl rand -hex 32`)      |
| `AUTH_SECRET`    | Random secret, at least 32 characters                   |
| `ADMIN_PASSWORD` | Workspace password, at least 12 characters              |
| `CRON_SECRET`    | Random bearer token for the scheduler                   |
| `OUTBOUND_HOSTS` | Comma-separated exact hostnames the runtime may contact |

Default provider hosts: `api.openai.com,api.anthropic.com,generativelanguage.googleapis.com,graph.facebook.com`. Add SMTP, database and custom API hosts explicitly. Do not use `VITE_` prefixes for secrets. The app creates `ct_records` and `ct_claims` tables on first request; the database role must have table creation permissions initially. Use a pooled PostgreSQL URL appropriate for serverless deployments.

The configured Vercel function budget is 60 seconds. The runtime stops before starting another node after 40 seconds; provider requests time out after 12 seconds. This is a bounded synchronous runtime, not a durable queue. Long-running jobs require a worker/queue deployment before use.

## Webhooks and events

1. Add a Webhook or Event Trigger, save and activate the workflow.
2. In node settings, copy the endpoint and secret token.
3. Send `POST /api/webhooks/<workflow-id>` with `Authorization: Bearer <token>` and a JSON body.
4. Optionally send `Idempotency-Key` to prevent duplicate event processing. Event Trigger also requires a matching `event` property.

Responses contain the execution ID and final status. Tokens are visible only in the authenticated owner's workflow settings. Treat them as secrets. Production callers must use HTTPS.

## Scheduling

Add a Schedule node and set the interval in minutes, then activate the workflow. Configure an external scheduler to call `GET /api/cron` with `Authorization: Bearer <CRON_SECRET>`. Alternatively add a Vercel `crons` entry for `/api/cron` with a cadence supported by your plan; Vercel supplies the bearer secret automatically.

The scheduler endpoint claims one due workflow per invocation using an atomic database key for each interval slot. It does not run unless a scheduler calls it. Intervals align to UTC epoch slots, not the activation time. Missed slots are not replayed. If multiple workflows are due, invoke frequently enough to drain them. Claims provide at-most-once dispatch, not guaranteed delivery: a crash after claiming requires manual recovery. There is no automatic retry of external side effects.

## Security and operating scope

This release is a **single-owner private workspace foundation**, not a multi-tenant SaaS. All authenticated sessions have owner access. Use separate deployments/databases for separate trust boundaries. Before a public commercial launch, add account lifecycle, workspace authorization, distributed login throttling, durable background jobs, audit policy and backups.

Credentials use authenticated encryption. Session cookies are HttpOnly/SameSite=Strict, with Secure enabled on Vercel. Cross-origin browser writes are rejected. HTTPS API endpoints must be explicitly allowlisted; private/special DNS addresses and redirects are blocked. Only allow trusted hosts you control: DNS preflight is not a substitute for a network egress firewall against DNS rebinding. SMTP uses TLS port 465; database adapters require TLS. SQL uses separately bound parameter values, but the owner controls queries: grant least privilege to the connected database account.

Do not put API keys into workflow parameters, headers or URLs; use Credentials. Workflow data and execution input/output can contain personal or confidential information and are visible to the owner. Credentials themselves are encrypted; execution data is not field-encrypted. Set retention and database encryption/backups to match your needs. Histories are currently retained until an operator deletes records; the UI shows the latest 100. `ct_claims` also needs an operator-managed retention policy. Stale RUNNING records after process termination require manual investigation. Login throttling is in-process; put rate limiting at the deployment edge for public exposure.

External provider adapters require your own enabled accounts, current model IDs, API access and host allowlist. Provider-specific permissions, WhatsApp messaging windows/template approval and SMTP delivery rules apply. Gmail OAuth is not implemented; use an app password with SMTP where your account supports it. External provider calls have not been live-tested using production credentials.

## Architecture

```text
src/components/    Reusable canvas nodes, library, configuration and execution UI
src/pages/         Workflow editor, management, credentials and execution history
src/state/         Workflow state and undo/redo history
src/data/          Shared declarative node registry and initial demo
src/services/      Frontend API boundary
server/graph.js    Schema validation, topological ordering and variable resolution
server/engine.js   Node adapters and execution lifecycle
server/security.js Encryption, session signing and outbound policy
server/store.js    PostgreSQL storage and local development file adapter
server/app.js      Authenticated API, triggers and scheduling
api/index.js       Vercel entry point
```

The graph editor uses React Flow (MIT). The product name, layout and implementation are ChanThecno's own; no n8n code or branding is used.

Reference documentation: [React Flow](https://reactflow.dev/learn/concepts/adding-interactivity), [Vercel Cron](https://vercel.com/docs/cron-jobs/manage-cron-jobs).
