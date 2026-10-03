import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  timingSafeEqual,
  createHmac,
} from "node:crypto";
import { lookup } from "node:dns/promises";
import ipaddr from "ipaddr.js";
export function equal(a = "", b = "") {
  const x = Buffer.from(a),
    y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
function key() {
  const k = process.env.ENCRYPTION_KEY;
  if (!/^[a-f\d]{64}$/i.test(k || ""))
    throw Error("ENCRYPTION_KEY must be 64 hexadecimal characters");
  return Buffer.from(k, "hex");
}
export function encrypt(value) {
  const iv = randomBytes(12),
    cipher = createCipheriv("aes-256-gcm", key(), iv);
  const data = Buffer.concat([
    cipher.update(JSON.stringify(value)),
    cipher.final(),
  ]);
  return [iv, cipher.getAuthTag(), data]
    .map((b) => b.toString("base64"))
    .join(".");
}
export function decrypt(value) {
  const [iv, tag, data] = value.split(".").map((v) => Buffer.from(v, "base64"));
  const cipher = createDecipheriv("aes-256-gcm", key(), iv);
  cipher.setAuthTag(tag);
  return JSON.parse(
    Buffer.concat([cipher.update(data), cipher.final()]).toString(),
  );
}
export function session() {
  const expires = String(Date.now() + 8 * 3600e3);
  return `${expires}.${createHmac("sha256", process.env.AUTH_SECRET).update(expires).digest("hex")}`;
}
export function authenticated(req) {
  if (!process.env.AUTH_SECRET) return false;
  const token =
    (req.headers.cookie || "")
      .split("; ")
      .find((v) => v.startsWith("ct_session="))
      ?.slice(11) || "";
  const [expires, signature] = token.split(".");
  return (
    Number(expires) > Date.now() &&
    equal(
      signature,
      createHmac("sha256", process.env.AUTH_SECRET)
        .update(expires || "")
        .digest("hex"),
    )
  );
}
export async function allowedURL(input) {
  const url = new URL(input);
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    (url.port && url.port !== "443")
  )
    throw Error("Only HTTPS endpoints on port 443 are allowed");
  const hosts = (process.env.OUTBOUND_HOSTS || "")
    .split(",")
    .map((v) => v.trim());
  if (!hosts.includes(url.hostname))
    throw Error(`Endpoint host is not in OUTBOUND_HOSTS: ${url.hostname}`);
  const addresses = await lookup(url.hostname, { all: true });
  if (
    !addresses.length ||
    addresses.some((a) => ipaddr.process(a.address).range() !== "unicast")
  )
    throw Error("Private and special network addresses are blocked");
  return url;
}
export async function request(url, options = {}) {
  await allowedURL(url);
  const response = await fetch(url, {
    ...options,
    redirect: "error",
    signal: AbortSignal.timeout(12000),
  });
  if (!response.ok) throw Error(`Provider returned HTTP ${response.status}`);
  let bytes = 0;
  const chunks = [];
  for await (const chunk of response.body) {
    bytes += chunk.length;
    if (bytes > 1024 * 1024) {
      await response.body.cancel().catch(() => {});
      throw Error("Response exceeds 1 MB");
    }
    chunks.push(chunk);
  }
  const text = Buffer.concat(chunks).toString();
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
