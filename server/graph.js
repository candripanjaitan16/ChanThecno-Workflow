import { z } from "zod";
import { byType } from "../src/data/nodes.js";
const nodeSchema = z.object({
  id: z.string().min(1).max(100),
  type: z.literal("workflow"),
  position: z.object({ x: z.number(), y: z.number() }),
  data: z.object({
    kind: z.string().refine((v) => !!byType[v]),
    label: z.string().max(200),
    parameters: z.record(z.string(), z.unknown()).default({}),
    credentialId: z.string().default(""),
    disabled: z.boolean().default(false),
  }),
});
export const workflowSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(120),
  description: z.string().max(500).default(""),
  active: z.boolean().default(false),
  nodes: z.array(nodeSchema).max(100),
  edges: z
    .array(z.object({ id: z.string(), source: z.string(), target: z.string() }))
    .max(500),
});
export function orderGraph(nodes, edges) {
  const ids = new Set(nodes.map((n) => n.id));
  if (ids.size !== nodes.length) throw Error("Duplicate node IDs");
  const degree = new Map(nodes.map((n) => [n.id, 0]));
  const adjacent = new Map(nodes.map((n) => [n.id, []]));
  for (const e of edges) {
    if (!ids.has(e.source) || !ids.has(e.target))
      throw Error("Connection references a missing node");
    adjacent.get(e.source).push(e.target);
    degree.set(e.target, degree.get(e.target) + 1);
  }
  const queue = nodes.filter((n) => degree.get(n.id) === 0).map((n) => n.id),
    order = [];
  while (queue.length) {
    const id = queue.shift();
    order.push(nodes.find((n) => n.id === id));
    for (const next of adjacent.get(id)) {
      degree.set(next, degree.get(next) - 1);
      if (!degree.get(next)) queue.push(next);
    }
  }
  if (order.length !== nodes.length)
    throw Error("Cycles are not supported. Remove the circular connection.");
  return order;
}
export function pathValue(object, path) {
  return path
    .split(".")
    .reduce(
      (v, k) =>
        ["__proto__", "constructor", "prototype"].includes(k)
          ? undefined
          : v?.[k],
      object,
    );
}
export function interpolate(value, context) {
  if (typeof value === "string") {
    const exact = value.match(/^\{\{\s*([\w.\-]+)\s*\}\}$/);
    if (exact) {
      const out = pathValue(context, exact[1]);
      if (out === undefined) throw Error(`Missing variable: ${exact[1]}`);
      return out;
    }
    return value.replace(/\{\{\s*([\w.\-]+)\s*\}\}/g, (_, p) => {
      const v = pathValue(context, p);
      if (v === undefined) throw Error(`Missing variable: ${p}`);
      return typeof v === "object" ? JSON.stringify(v) : String(v);
    });
  }
  if (Array.isArray(value)) return value.map((v) => interpolate(v, context));
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, interpolate(v, context)]),
    );
  return value;
}
