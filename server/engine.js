import { randomUUID } from "node:crypto";
import Papa from "papaparse";
import nodemailer from "nodemailer";
import postgres from "postgres";
import { orderGraph, interpolate, pathValue } from "./graph.js";
import { decrypt, request, allowedURL } from "./security.js";
import * as store from "./store.js";
const json = (value) => (typeof value === "string" ? JSON.parse(value) : value);
const asText = (value) =>
  typeof value === "string" ? value : JSON.stringify(value);
const rows = (value) => (Array.isArray(value) ? value : [value]);
export async function executeNode(node, input, context) {
  const raw = node.data.parameters,
    p = interpolate(
      Object.fromEntries(
        Object.entries(raw).filter(
          ([key]) =>
            ![
              "mapping",
              "body",
              ...(["json", "variable"].includes(node.data.kind)
                ? ["value"]
                : []),
            ].includes(key),
        ),
      ),
      context,
    ),
    kind = node.data.kind;
  let credential = {};
  if (node.data.credentialId) {
    const record = await store.get("credentials", node.data.credentialId);
    if (!record) throw Error("Credential no longer exists");
    credential = decrypt(record.secret);
  }
  const requireKey = () => {
    if (!credential.apiKey)
      throw Error("Connect a credential before running this node");
    return credential.apiKey;
  };
  switch (kind) {
    case "manual":
    case "schedule":
    case "webhook":
    case "event":
      return input;
    case "note":
      return input;
    case "json":
      return interpolate(json(raw.value), context);
    case "text":
      return p.text;
    case "csv": {
      const result = Papa.parse(p.csv, { header: true, skipEmptyLines: true });
      if (result.errors.length) throw Error(result.errors[0].message);
      return result.data;
    }
    case "transform":
    case "map":
      return rows(input).map((item) =>
        interpolate(json(raw.mapping), { ...context, item }),
      );
    case "filter":
      return rows(input).filter((item) => {
        const v = pathValue(item, p.path);
        switch (p.operator) {
          case "equals":
            return String(v) === String(p.value);
          case "contains":
            return String(v ?? "").includes(p.value);
          case "greater":
            return Number(v) > Number(p.value);
          default:
            return v !== undefined && v !== null;
        }
      });
    case "merge":
      return context.inputs.flat();
    case "split": {
      const value = pathValue(input, p.path);
      if (!Array.isArray(value))
        throw Error("Split field must contain an array");
      return value;
    }
    case "variable": {
      if (
        !/^[a-zA-Z][\w]*$/.test(p.key) ||
        [
          "constructor",
          "prototype",
          "__proto__",
          "nodes",
          "input",
          "inputs",
        ].includes(p.key)
      )
        throw Error("Invalid variable name");
      const value = interpolate(json(raw.value), context);
      context.variables[p.key] = value;
      return value;
    }
    case "http":
    case "rest":
    case "custom": {
      const url = new URL(p.url);
      for (const [k, v] of Object.entries(json(p.query || "{}")))
        url.searchParams.set(k, asText(v));
      return request(url.toString(), {
        method: p.method,
        headers: {
          "Content-Type": "application/json",
          ...json(p.headers || "{}"),
          ...(credential.apiKey
            ? { Authorization: `Bearer ${credential.apiKey}` }
            : {}),
        },
        ...(p.method !== "GET"
          ? {
              body: JSON.stringify(
                interpolate(json(raw.body || "{}"), context),
              ),
            }
          : {}),
      });
    }
    case "openai":
    case "ai": {
      const response = await request(
        kind === "ai" ? p.url : "https://api.openai.com/v1/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${requireKey()}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: p.model,
            messages: [
              { role: "system", content: asText(p.system) },
              { role: "user", content: asText(p.prompt) },
            ],
            temperature: Number(p.temperature),
            max_tokens: Number(p.maxTokens),
          }),
        },
      );
      return {
        output: response.choices?.[0]?.message?.content,
        usage: response.usage,
      };
    }
    case "anthropic": {
      const response = await request("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": requireKey(),
          "anthropic-version": "2023-06-01",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: p.model,
          system: asText(p.system),
          messages: [{ role: "user", content: asText(p.prompt) }],
          temperature: Number(p.temperature),
          max_tokens: Number(p.maxTokens),
        }),
      });
      return {
        output: response.content
          ?.filter((v) => v.type === "text")
          .map((v) => v.text)
          .join("\n"),
        usage: response.usage,
      };
    }
    case "google": {
      const response = await request(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(p.model)}:generateContent`,
        {
          method: "POST",
          headers: {
            "x-goog-api-key": requireKey(),
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: asText(p.system) }] },
            contents: [{ parts: [{ text: asText(p.prompt) }] }],
            generationConfig: {
              temperature: Number(p.temperature),
              maxOutputTokens: Number(p.maxTokens),
            },
          }),
        },
      );
      return {
        output: response.candidates?.[0]?.content?.parts
          ?.map((v) => v.text)
          .join("\n"),
      };
    }
    case "whatsapp":
      return request(
        `https://graph.facebook.com/v23.0/${encodeURIComponent(p.phoneId)}/messages`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${requireKey()}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            messaging_product: "whatsapp",
            to: p.recipient,
            ...(p.template
              ? {
                  type: "template",
                  template: {
                    name: p.template,
                    language: { code: p.language },
                    components: json(p.components || "[]"),
                  },
                }
              : { type: "text", text: { body: asText(p.message) } }),
          }),
        },
      );
    case "email": {
      if (!credential.host || !credential.user || !credential.password)
        throw Error("Connect an SMTP credential first");
      await allowedURL(`https://${credential.host}`);
      const transport = nodemailer.createTransport({
        host: credential.host,
        port: 465,
        secure: true,
        auth: { user: credential.user, pass: credential.password },
        connectionTimeout: 10000,
        socketTimeout: 12000,
      });
      try {
        const result = await transport.sendMail({
          from: p.from,
          to: p.to,
          subject: p.subject,
          text: asText(p.text),
          disableFileAccess: true,
          disableUrlAccess: true,
        });
        return { messageId: result.messageId, accepted: result.accepted };
      } finally {
        transport.close();
      }
    }
    case "database": {
      if (!credential.url) throw Error("Connect a PostgreSQL credential first");
      const url = new URL(credential.url);
      await allowedURL(`https://${url.hostname}`);
      const client = postgres(credential.url, {
        max: 1,
        connect_timeout: 8,
        connection: { statement_timeout: 10000 },
        ssl: "require",
      });
      try {
        return [...(await client.unsafe(p.query, json(p.values || "[]")))];
      } finally {
        await client.end({ timeout: 1 });
      }
    }
    default:
      throw Error(`Unsupported node: ${kind}`);
  }
}
export async function runWorkflow(
  workflow,
  { input = {}, triggerId, testNodeId } = {},
) {
  const ordered = orderGraph(workflow.nodes, workflow.edges);
  let allowed = new Set(ordered.map((n) => n.id));
  if (triggerId) {
    allowed = new Set([triggerId]);
    let changed = true;
    while (changed) {
      changed = false;
      for (const edge of workflow.edges)
        if (allowed.has(edge.source) && !allowed.has(edge.target)) {
          allowed.add(edge.target);
          changed = true;
        }
    }
  }
  if (testNodeId) allowed = new Set([testNodeId]);
  const run = {
    id: randomUUID(),
    workflowId: workflow.id,
    workflowName: workflow.name,
    status: "RUNNING",
    startedAt: new Date().toISOString(),
    nodes: ordered
      .filter((n) => allowed.has(n.id))
      .map((n) => ({
        id: n.id,
        name: n.data.label,
        status: "WAITING",
        logs: [],
      })),
  };
  const context = {
    nodes: {},
    variables: {},
    webhook: { body: input },
    input,
    inputs: [input],
  };
  await store.put("executions", run);
  const start = Date.now();
  for (const node of ordered.filter((n) => allowed.has(n.id))) {
    const record = run.nodes.find((n) => n.id === node.id),
      time = Date.now();
    try {
      if (Date.now() - start > 40000)
        throw Error("Workflow exceeded the 40 second execution budget");
      const incoming = workflow.edges.filter(
        (e) => e.target === node.id && allowed.has(e.source),
      );
      context.inputs = incoming.length
        ? incoming.map((e) => context.nodes[e.source]?.output)
        : [input];
      context.input =
        context.inputs.length === 1 ? context.inputs[0] : context.inputs;
      record.input = context.input;
      record.status = "RUNNING";
      record.startedAt = new Date().toISOString();
      await store.put("executions", run);
      const output = node.data.disabled
        ? context.input
        : await executeNode(node, context.input, {
            ...context,
            ...context.variables,
          });
      if (Buffer.byteLength(JSON.stringify(output ?? null)) > 1024 * 1024)
        throw Error("Node output exceeds 1 MB");
      context.nodes[node.id] = { output };
      if (["openai", "ai", "anthropic", "google"].includes(node.data.kind))
        context.ai = output;
      else if (["json", "csv"].includes(node.data.kind)) {
        context.data = { row: output };
        if (output && !Array.isArray(output) && typeof output === "object")
          for (const [k, v] of Object.entries(output))
            if (
              ![
                "nodes",
                "variables",
                "input",
                "inputs",
                "__proto__",
                "constructor",
                "prototype",
              ].includes(k)
            )
              context[k] = v;
      }
      record.output = output;
      record.status = "SUCCESS";
      record.logs.push(
        node.data.disabled
          ? "Node disabled; input passed through."
          : "Completed successfully.",
      );
    } catch (error) {
      record.status = "ERROR";
      record.error = error.message;
      record.logs.push("Execution stopped. Downstream nodes were not run.");
      run.status = "ERROR";
    }
    record.durationMs = Date.now() - time;
    await store.put("executions", run);
    if (run.status === "ERROR") break;
  }
  run.status = run.status === "ERROR" ? "ERROR" : "SUCCESS";
  run.durationMs = Date.now() - start;
  run.finishedAt = new Date().toISOString();
  await store.put("executions", run);
  return run;
}
