// Visitor words: GET lists them, POST adds one (shown to everyone straight away, marked
// "added by a visitor, not yet checked"), DELETE removes one (needs the ADMIN_KEY header).
const { configured, redis, send, ipKey, isAdmin } = require("./_lib");

const WORDS = "nk:words"; // hash: id -> entry JSON
const audioKey = (id) => `nk:audio:${id}`;
const MAX_AUDIO_BYTES = 400 * 1024; // about 8 seconds of speech is far smaller
const AUDIO_TYPES = ["audio/webm", "audio/mp4", "audio/ogg"];
const PER_HOUR = 30; // per visitor; an Ajji session can send up to 18 at once
const PER_DAY_ALL = 2000;

const KANNADA = /[ಀ-೿]/;
const LINK = /(https?:|www\.|\.(com|in|net|org|xyz|link|ly)\b|@[a-z0-9_]{3,})/i;
// A short list of abusive words, to stop the worst on the way in. Anything else is removed by hand.
const BLOCK = [
  "fuck", "shit", "bitch", "bastard", "asshole", "cunt", "dick", "pussy", "slut", "whore", "rape",
  "ಸೂಳೆ", "ಬೋಳಿ", "ತುಣ್ಣೆ", "ತುಲ್ಲು", "ಕೇಯ್", "ಸೂಳೇಮಗ", "ನಿಮ್ಮಮ್ಮನ್", "ನಿನ್ನಮ್ಮನ್", "ಹಡಬೆ", "ಬೇವರ್ಸಿ",
];

const clean = (v, max) => String(v ?? "").replace(/[\u0000-\u001f\u007f<>]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);

function validate(b) {
  const e = {
    place: /^[a-z]{2,24}$/.test(b.place || "") ? b.place : null,
    town: clean(b.town, 60),
    kn: clean(b.kn, 80),
    tr: clean(b.tr, 80),
    english: clean(b.english, 120),
    std: clean(b.std, 80),
    note: clean(b.note, 500),
    name: clean(b.name, 60),
    age: clean(b.age, 12),
    origin: b.origin === "ajji" ? "ajji" : "add",
  };
  if (!e.place && !e.town) return [null, "place"];
  if (!e.kn || !KANNADA.test(e.kn)) return [null, "kn"];
  if (e.origin === "add" && !e.tr) return [null, "tr"];
  if (!e.english) return [null, "english"];
  if (b.consent !== true) return [null, "consent"];
  const all = Object.values(e).join(" ").toLowerCase();
  if (LINK.test(all)) return [null, "links"];
  if (BLOCK.some((w) => (/^[a-z]+$/.test(w) ? new RegExp(`\\b${w}(s|es|ed|ing|er|ers)?\\b`).test(all) : all.includes(w)))) return [null, "blocked"];
  return [e, null];
}

module.exports = async (req, res) => {
  if (!configured()) return send(res, 503, { error: "storage_not_configured" });
  try {
    if (req.method === "GET") {
      const flat = (await redis("HGETALL", WORDS)) || [];
      const words = [];
      for (let i = 1; i < flat.length; i += 2) { try { words.push(JSON.parse(flat[i])); } catch { /* skip */ } }
      words.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
      return send(res, 200, { words: words.slice(0, 2000) }, { "Cache-Control": "public, s-maxage=15, stale-while-revalidate=60" });
    }

    if (req.method === "POST") {
      const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
      const [v, bad] = validate(body);
      if (bad) return send(res, 400, { error: "invalid", field: bad });

      let audio = null;
      if (body.audio && body.audioType) {
        const type = String(body.audioType).split(";")[0];
        const b64 = String(body.audio);
        if (!AUDIO_TYPES.includes(type) || !/^[A-Za-z0-9+/=]+$/.test(b64)) return send(res, 400, { error: "invalid", field: "audio" });
        if (b64.length * 0.75 > MAX_AUDIO_BYTES) return send(res, 413, { error: "audio_too_long" });
        audio = { type, b64 };
      }

      const rl = `nk:rl:${ipKey(req)}`;
      const n = await redis("INCR", rl);
      if (n === 1) await redis("EXPIRE", rl, 3600);
      if (n > PER_HOUR) return send(res, 429, { error: "too_many" });
      const day = `nk:day:${new Date().toISOString().slice(0, 10)}`;
      const total = await redis("INCR", day);
      if (total === 1) await redis("EXPIRE", day, 172800);
      if (total > PER_DAY_ALL) return send(res, 429, { error: "too_many" });

      const id = `pub-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
      const entry = {
        id, place: v.place, town: v.place ? undefined : v.town,
        type: v.kn.includes(" ") ? "phrase" : "word",
        english: v.english,
        standard: v.std ? { kn: v.std, tr: "" } : null,
        dialect: { kn: v.kn, tr: v.tr },
        note: v.note || undefined,
        contributor: v.name || undefined,
        speaker_age: v.age || undefined,
        origin: v.origin,
        audio: audio ? `/api/audio?id=${id}` : undefined,
        source: null, confidence: "contributed", verified: false, contributed: true, public: true,
        createdAt: new Date().toISOString(),
      };
      if (audio) await redis("SET", audioKey(id), JSON.stringify(audio));
      await redis("HSET", WORDS, id, JSON.stringify(entry));
      return send(res, 201, { entry });
    }

    if (req.method === "DELETE") {
      if (!isAdmin(req)) return send(res, 401, { error: "not_allowed" });
      const id = String(req.query?.id || new URL(req.url, "http://x").searchParams.get("id") || "");
      if (!/^pub-[a-z0-9]+$/.test(id)) return send(res, 400, { error: "invalid" });
      await redis("HDEL", WORDS, id);
      await redis("DEL", audioKey(id));
      return send(res, 200, { deleted: id });
    }

    res.setHeader("Allow", "GET, POST, DELETE");
    return send(res, 405, { error: "method" });
  } catch (err) {
    console.error(err);
    return send(res, 500, { error: "server" });
  }
};
