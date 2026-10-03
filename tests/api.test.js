import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
process.env.AUTH_SECRET = "test-auth-secret-".repeat(4);
process.env.ADMIN_PASSWORD = "test-password-12345";
process.env.ENCRYPTION_KEY = "cd".repeat(32);
const { app } = await import("../server/app.js");
test("API requires authentication, hides secrets, and validates workflow graphs", async () => {
  const server = app.listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  const base = `http://127.0.0.1:${server.address().port}/api`;
  try {
    assert.equal((await fetch(`${base}/workflows`)).status, 401);
    const login = await fetch(`${base}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: process.env.ADMIN_PASSWORD }),
    });
    assert.equal(login.status, 200);
    assert.match(login.headers.get("set-cookie"), /HttpOnly/);
    const headers = {
      "Content-Type": "application/json",
      Cookie: login.headers.get("set-cookie").split(";")[0],
    };
    const cr = await fetch(`${base}/credentials`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        name: "Test only",
        type: "openai",
        values: { apiKey: "never-return-this" },
      }),
    });
    const credential = await cr.json();
    assert.equal(cr.status, 201);
    assert.ok(!JSON.stringify(credential).includes("never-return-this"));
    const list = await (await fetch(`${base}/credentials`, { headers })).text();
    assert.ok(!list.includes("never-return-this"));
    assert.ok(!list.includes("secret"));
    const id = randomUUID();
    const response = await fetch(`${base}/workflows/${id}`, {
      method: "PUT",
      headers,
      body: JSON.stringify({
        id,
        name: "Invalid",
        nodes: [],
        edges: [{ id: "bad", source: "missing", target: "missing" }],
      }),
    });
    assert.ok(response.status >= 400);
    await fetch(`${base}/credentials/${credential.id}`, {
      method: "DELETE",
      headers,
    });
  } finally {
    await new Promise((r) => server.close(r));
  }
});
