import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { orderGraph, interpolate, workflowSchema } from "../server/graph.js";
import { executeNode, runWorkflow } from "../server/engine.js";
import { encrypt, decrypt, allowedURL } from "../server/security.js";
import * as store from "../server/store.js";
const node = (kind, parameters = {}, id = randomUUID()) => ({
  id,
  type: "workflow",
  position: { x: 0, y: 0 },
  data: { kind, label: kind, parameters, credentialId: "", disabled: false },
});
test("sorts branches and joins, rejects cycles and broken edges", () => {
  const nodes = [
    node("json", {}, "a"),
    node("merge", {}, "b"),
    node("text", {}, "c"),
  ];
  assert.deepEqual(
    orderGraph(nodes, [
      { source: "a", target: "b" },
      { source: "c", target: "b" },
    ]).map((n) => n.id),
    ["a", "c", "b"],
  );
  assert.throws(
    () =>
      orderGraph(nodes, [
        { source: "a", target: "b" },
        { source: "b", target: "a" },
      ]),
    /Cycles/,
  );
  assert.throws(
    () => orderGraph(nodes, [{ source: "missing", target: "a" }]),
    /missing/,
  );
});
test("variable interpolation preserves types and UUID paths", () => {
  assert.deepEqual(
    interpolate("{{nodes.a-b.output}}", {
      nodes: { "a-b": { output: [1, 2] } },
    }),
    [1, 2],
  );
  assert.equal(
    interpolate("Hello {{customer.name}}", { customer: { name: "Candri" } }),
    "Hello Candri",
  );
  assert.throws(() => interpolate("{{constructor.name}}", {}), /Missing/);
  assert.throws(() => interpolate("{{missing}}", {}), /Missing/);
});
test("maps items and parses quoted CSV", async () => {
  const context = { input: [], variables: {} };
  assert.deepEqual(
    await executeNode(
      node("map", { mapping: '{"hello":"Hi {{item.name}}"}' }),
      [{ name: "Candri" }, { name: "Ruth" }],
      context,
    ),
    [{ hello: "Hi Candri" }, { hello: "Hi Ruth" }],
  );
  assert.deepEqual(
    await executeNode(
      node("csv", { csv: 'name,note\nCandri,"hello, world"' }),
      {},
      context,
    ),
    [{ name: "Candri", note: "hello, world" }],
  );
});
test("credentials encrypt and detect tampering", () => {
  process.env.ENCRYPTION_KEY = "ab".repeat(32);
  const encrypted = encrypt({ apiKey: "secret-value" });
  assert.ok(!encrypted.includes("secret-value"));
  assert.deepEqual(decrypt(encrypted), { apiKey: "secret-value" });
  const parts = encrypted.split(".");
  parts[1] = Buffer.alloc(16).toString("base64");
  assert.throws(() => decrypt(parts.join(".")));
});
test("outbound requests deny unlisted hosts and non-HTTPS URLs", async () => {
  process.env.OUTBOUND_HOSTS = "api.openai.com";
  await assert.rejects(allowedURL("https://example.com"), /OUTBOUND_HOSTS/);
  await assert.rejects(allowedURL("http://api.openai.com"), /HTTPS/);
  await assert.rejects(allowedURL("https://api.openai.com:8443"), /443/);
});
test("runs data workflow and persists execution history", async () => {
  await store.initialize();
  const a = node("json", { value: '[{"name":"Candri"}]' }),
    b = node("transform", { mapping: '{"message":"Hello {{item.name}}"}' });
  const workflow = workflowSchema.parse({
    id: randomUUID(),
    name: "Test",
    nodes: [a, b],
    edges: [{ id: "edge", source: a.id, target: b.id }],
  });
  const run = await runWorkflow(workflow);
  assert.equal(run.status, "SUCCESS");
  assert.deepEqual(run.nodes[1].output, [{ message: "Hello Candri" }]);
  assert.equal((await store.get("executions", run.id)).status, "SUCCESS");
  await store.remove("executions", run.id);
});
test("missing external credentials fail honestly and block downstream", async () => {
  await store.initialize();
  const a = node("openai", {
      model: "test",
      prompt: "Hi",
      system: "",
      maxTokens: 20,
      temperature: 0,
    }),
    b = node("text", { text: "Should not run" });
  const run = await runWorkflow({
    id: randomUUID(),
    name: "Failure",
    nodes: [a, b],
    edges: [{ source: a.id, target: b.id }],
  });
  assert.equal(run.status, "ERROR");
  assert.match(run.nodes[0].error, /credential/);
  assert.equal(run.nodes[1].status, "WAITING");
  await store.remove("executions", run.id);
});
test("trigger execution excludes unrelated roots", async () => {
  await store.initialize();
  const a = node("webhook"),
    b = node("text", { text: "{{webhook.body.name}}" }),
    c = node("text", { text: "Unrelated" });
  const run = await runWorkflow(
    {
      id: randomUUID(),
      name: "Triggered",
      nodes: [a, b, c],
      edges: [{ source: a.id, target: b.id }],
    },
    { triggerId: a.id, input: { name: "Candri" } },
  );
  assert.equal(run.nodes.length, 2);
  assert.equal(run.nodes[1].output, "Candri");
  await store.remove("executions", run.id);
});

test("filters configured values and passes named variables downstream", async () => {
  assert.deepEqual(
    await executeNode(
      node("filter", { path: "score", operator: "greater", value: "5" }),
      [{ score: 2 }, { score: 8 }],
      { variables: {} },
    ),
    [{ score: 8 }],
  );
  await store.initialize();
  const a = node("variable", { key: "customer", value: '{"name":"Candri"}' }),
    b = node("text", { text: "Hello {{customer.name}}" });
  const run = await runWorkflow({
    id: randomUUID(),
    name: "Variables",
    nodes: [a, b],
    edges: [{ source: a.id, target: b.id }],
  });
  assert.equal(run.status, "SUCCESS");
  assert.equal(run.nodes[1].output, "Hello Candri");
  await store.remove("executions", run.id);
});
