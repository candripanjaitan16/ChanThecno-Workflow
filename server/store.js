import postgres from "postgres";
import { readFile, writeFile, mkdir, rename } from "node:fs/promises";
import { resolve } from "node:path";
let sql;
const directory = resolve(".data");
let serial = Promise.resolve();
const database = () =>
  (sql ??= postgres(process.env.DATABASE_URL, {
    max: 3,
    idle_timeout: 20,
    connect_timeout: 10,
  }));
export async function initialize() {
  if (process.env.DATABASE_URL) {
    await database()`CREATE TABLE IF NOT EXISTS ct_records (kind TEXT NOT NULL,id TEXT NOT NULL,data JSONB NOT NULL,PRIMARY KEY(kind,id))`;
    await database()`CREATE TABLE IF NOT EXISTS ct_claims (id TEXT PRIMARY KEY, created_at TIMESTAMPTZ DEFAULT NOW())`;
  } else {
    if (process.env.VERCEL) throw Error("DATABASE_URL is required on Vercel");
    await mkdir(directory, { recursive: true });
  }
}
async function local() {
  try {
    return JSON.parse(await readFile(resolve(directory, "store.json"), "utf8"));
  } catch (e) {
    if (e.code === "ENOENT") return {};
    throw e;
  }
}
export async function list(kind) {
  if (process.env.DATABASE_URL)
    return (
      await database()`SELECT data FROM ct_records WHERE kind=${kind}`
    ).map((r) => r.data);
  await serial;
  return Object.values((await local())[kind] || {});
}
export async function get(kind, id) {
  return (await list(kind)).find((v) => v.id === id);
}
export async function put(kind, value) {
  if (process.env.DATABASE_URL) {
    await database()`INSERT INTO ct_records(kind,id,data) VALUES(${kind},${value.id},${database().json(value)}) ON CONFLICT(kind,id) DO UPDATE SET data=EXCLUDED.data`;
    return value;
  }
  const task = serial.then(async () => {
    const data = await local();
    data[kind] ??= {};
    data[kind][value.id] = value;
    await writeFile(resolve(directory, "store.tmp"), JSON.stringify(data), {
      mode: 0o600,
    });
    await rename(
      resolve(directory, "store.tmp"),
      resolve(directory, "store.json"),
    );
  });
  serial = task.catch(() => {});
  await task;
  return value;
}
export async function remove(kind, id) {
  if (process.env.DATABASE_URL) {
    await database()`DELETE FROM ct_records WHERE kind=${kind} AND id=${id}`;
    return;
  }
  const task = serial.then(async () => {
    const data = await local();
    delete data[kind]?.[id];
    await writeFile(resolve(directory, "store.tmp"), JSON.stringify(data), {
      mode: 0o600,
    });
    await rename(
      resolve(directory, "store.tmp"),
      resolve(directory, "store.json"),
    );
  });
  serial = task.catch(() => {});
  await task;
}
export async function claim(id) {
  if (process.env.DATABASE_URL)
    return (
      (
        await database()`INSERT INTO ct_claims(id) VALUES(${id}) ON CONFLICT DO NOTHING RETURNING id`
      ).length > 0
    );
  let claimed = false;
  const task = serial.then(async () => {
    const data = await local();
    data.claims ??= {};
    if (!data.claims[id]) {
      claimed = true;
      data.claims[id] = true;
      await writeFile(resolve(directory, "store.tmp"), JSON.stringify(data), {
        mode: 0o600,
      });
      await rename(
        resolve(directory, "store.tmp"),
        resolve(directory, "store.json"),
      );
    }
  });
  serial = task.catch(() => {});
  await task;
  return claimed;
}
