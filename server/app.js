import "dotenv/config";
import express from "express";
import { randomUUID, randomBytes, createHash } from "node:crypto";
import { z } from "zod";
import * as store from "./store.js";
import { authenticated, session, equal, encrypt } from "./security.js";
import { workflowSchema, orderGraph } from "./graph.js";
import { runWorkflow } from "./engine.js";
export const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "2mb" }));
let ready;
app.use(async (req, res, next) => {
  try {
    ready ??= store.initialize().catch((e) => {
      ready = null;
      throw e;
    });
    await ready;
    next();
  } catch (e) {
    next(e);
  }
});
app.use((req, res, next) => {
  res.set("Cache-Control", "no-store");
  res.set("X-Content-Type-Options", "nosniff");
  if (
    !["GET", "HEAD", "OPTIONS"].includes(req.method) &&
    req.headers.origin &&
    new URL(req.headers.origin).host !== req.headers.host
  )
    return res.status(403).json({ error: "Origin mismatch" });
  next();
});
const configured = () =>
  Boolean(
    process.env.AUTH_SECRET?.length >= 32 &&
    process.env.ADMIN_PASSWORD?.length >= 12,
  );
app.get("/api/session", (req, res) =>
  res.json({
    authenticated: authenticated(req),
    configured: configured(),
    storage: process.env.DATABASE_URL ? "PostgreSQL" : "Local file",
  }),
);
const attempts = new Map();
app.post("/api/login", (req, res) => {
  if (!configured())
    return res
      .status(503)
      .json({
        error:
          "Set AUTH_SECRET (32+ characters) and ADMIN_PASSWORD (12+ characters) in .env",
      });
  const ip = req.socket.remoteAddress;
  const item = attempts.get(ip) || { count: 0, at: Date.now() };
  if (Date.now() - item.at > 60000) {
    item.count = 0;
    item.at = Date.now();
  }
  item.count++;
  attempts.set(ip, item);
  if (item.count > 10)
    return res
      .status(429)
      .json({ error: "Too many attempts. Try again in one minute." });
  if (!equal(req.body.password, process.env.ADMIN_PASSWORD))
    return res.status(401).json({ error: "Incorrect workspace password" });
  res.setHeader(
    "Set-Cookie",
    `ct_session=${session()}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800${process.env.VERCEL ? "; Secure" : ""}`,
  );
  res.json({ ok: true });
});
app.post("/api/logout", (req, res) => {
  res.setHeader(
    "Set-Cookie",
    "ct_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0",
  );
  res.json({ ok: true });
});
app.post("/api/webhooks/:id", async (req, res) => {
  const workflow = await store.get("workflows", req.params.id);
  if (
    !workflow?.active ||
    !equal(req.headers.authorization, `Bearer ${workflow.webhookToken}`)
  )
    return res
      .status(401)
      .json({ error: "Invalid webhook or inactive workflow" });
  const trigger = workflow.nodes.find((n) =>
    ["webhook", "event"].includes(n.data.kind),
  );
  if (!trigger) return res.status(400).json({ error: "No webhook trigger" });
  if (
    trigger.data.kind === "event" &&
    req.body.event !== trigger.data.parameters.event
  )
    return res.status(400).json({ error: "Event name does not match" });
  const key = req.headers["idempotency-key"];
  if (
    key &&
    !(await store.claim(
      `webhook:${workflow.id}:${createHash("sha256").update(key).digest("hex")}`,
    ))
  )
    return res.status(409).json({ error: "Event already received" });
  const run = await runWorkflow(workflow, {
    input: req.body,
    triggerId: trigger.id,
  });
  res
    .status(run.status === "ERROR" ? 422 : 200)
    .json({ id: run.id, status: run.status });
});
app.get("/api/cron", async (req, res) => {
  if (
    !process.env.CRON_SECRET ||
    !equal(req.headers.authorization, `Bearer ${process.env.CRON_SECRET}`)
  )
    return res.status(401).json({ error: "Unauthorized" });
  const runs = [];
  for (const workflow of await store.list("workflows")) {
    if (!workflow.active) continue;
    for (const node of workflow.nodes.filter(
      (n) => n.data.kind === "schedule",
    )) {
      const minutes = Math.max(1, Number(node.data.parameters.interval) || 60),
        slot = Math.floor(Date.now() / (minutes * 60000));
      if (await store.claim(`schedule:${workflow.id}:${node.id}:${slot}`))
        runs.push((await runWorkflow(workflow, { triggerId: node.id })).id);
      if (runs.length >= 1) return res.json({ runs });
    }
  }
  res.json({ runs });
});
app.use("/api", (req, res, next) =>
  authenticated(req)
    ? next()
    : res.status(401).json({ error: "Sign in to your workspace" }),
);
app.get("/api/workflows", async (req, res) =>
  res.json(await store.list("workflows")),
);
app.put("/api/workflows/:id", async (req, res) => {
  const workflow = workflowSchema.parse(req.body);
  if (workflow.id !== req.params.id)
    return res.status(400).json({ error: "Workflow ID mismatch" });
  orderGraph(workflow.nodes, workflow.edges);
  const old = await store.get("workflows", workflow.id);
  res.json(
    await store.put("workflows", {
      ...workflow,
      webhookToken: old?.webhookToken || randomBytes(24).toString("hex"),
      updatedAt: new Date().toISOString(),
    }),
  );
});
app.delete("/api/workflows/:id", async (req, res) => {
  await store.remove("workflows", req.params.id);
  res.json({ ok: true });
});
app.post("/api/workflows/:id/run", async (req, res) => {
  const workflow = await store.get("workflows", req.params.id);
  if (!workflow) return res.status(404).json({ error: "Workflow not found" });
  if (
    req.body.testNodeId &&
    !workflow.nodes.some((n) => n.id === req.body.testNodeId)
  )
    return res.status(400).json({ error: "Node not found" });
  res.json(
    await runWorkflow(workflow, {
      input: req.body.input || {},
      testNodeId: req.body.testNodeId,
    }),
  );
});
app.get("/api/executions", async (req, res) =>
  res.json(
    (await store.list("executions"))
      .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
      .slice(0, 100),
  ),
);
app.get("/api/credentials", async (req, res) =>
  res.json(
    (await store.list("credentials")).map(({ secret, ...record }) => record),
  ),
);
app.post("/api/credentials", async (req, res) => {
  const value = z
    .object({
      name: z.string().min(1).max(100),
      type: z.enum([
        "openai",
        "anthropic",
        "google",
        "ai",
        "whatsapp",
        "smtp",
        "bearer",
        "postgres",
      ]),
      values: z.record(z.string(), z.string()),
    })
    .parse(req.body);
  const record = {
    id: randomUUID(),
    name: value.name,
    type: value.type,
    createdAt: new Date().toISOString(),
    secret: encrypt(value.values),
  };
  await store.put("credentials", record);
  const { secret, ...publicValue } = record;
  res.status(201).json(publicValue);
});
app.delete("/api/credentials/:id", async (req, res) => {
  if (
    (await store.list("workflows")).some((w) =>
      w.nodes.some((n) => n.data.credentialId === req.params.id),
    )
  )
    return res
      .status(409)
      .json({
        error: "Remove this credential from workflows before deleting it",
      });
  await store.remove("credentials", req.params.id);
  res.json({ ok: true });
});
app.use("/api", (req, res) =>
  res.status(404).json({ error: "API route not found" }),
);
app.use((error, req, res, next) => {
  console.error(error.name, error.message);
  res
    .status(error instanceof z.ZodError ? 400 : 500)
    .json({
      error:
        error instanceof z.ZodError
          ? error.issues
              .map((i) => `${i.path.join(".")}: ${i.message}`)
              .join("; ")
          : error.message,
    });
});
