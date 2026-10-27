// Serves a visitor's recording: GET /api/audio?id=pub-...
const { configured, redis, send } = require("./_lib");

module.exports = async (req, res) => {
  if (!configured()) return send(res, 503, { error: "storage_not_configured" });
  const id = String(req.query?.id || new URL(req.url, "http://x").searchParams.get("id") || "");
  if (!/^pub-[a-z0-9]+$/.test(id)) return send(res, 400, { error: "invalid" });
  try {
    const raw = await redis("GET", `nk:audio:${id}`);
    if (!raw) return send(res, 404, { error: "not_found" });
    const { type, b64 } = JSON.parse(raw);
    const buf = Buffer.from(b64, "base64");
    res.statusCode = 200;
    res.setHeader("Content-Type", type);
    res.setHeader("Content-Length", buf.length);
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.end(buf);
  } catch (err) {
    console.error(err);
    send(res, 500, { error: "server" });
  }
};
