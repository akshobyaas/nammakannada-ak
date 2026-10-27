// Shared helpers for the visitor-words API. Files that start with "_" are not exposed as routes.
// Storage is Upstash Redis over its REST API (add "Upstash for Redis" to the project in Vercel;
// it sets KV_REST_API_URL and KV_REST_API_TOKEN). No SDK, no dependencies.
const crypto = require("crypto");

const URL_ = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || "";
const TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || "";

const configured = () => Boolean(URL_ && TOKEN);

async function redis(...cmd) {
  const res = await fetch(URL_, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(cmd),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.error) throw new Error(`storage error: ${json.error || res.status}`);
  return json.result;
}

function send(res, status, body, headers = {}) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);
  res.end(JSON.stringify(body));
}

function clientIp(req) {
  const xf = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  return xf || req.socket?.remoteAddress || "unknown";
}

// IPs are never stored: only a salted hash, kept for an hour, for rate limiting.
function ipKey(req) {
  const salt = process.env.ADMIN_KEY || "nk";
  return crypto.createHash("sha256").update(salt + clientIp(req)).digest("hex").slice(0, 24);
}

function isAdmin(req) {
  const key = process.env.ADMIN_KEY || "";
  const given = String(req.headers["x-admin-key"] || "");
  if (key.length < 12 || given.length !== key.length) return false;
  return crypto.timingSafeEqual(Buffer.from(given), Buffer.from(key));
}

module.exports = { configured, redis, send, ipKey, isAdmin };
