// API des scores de Lucarne : GET = toutes les fiches joueurs, POST = enregistrer sa propre fiche.
// Stockage : un seul fichier JSON dans Vercel Blob (lucarne/state.json).
import { put } from "@vercel/blob";
import crypto from "node:crypto";

const PATH = "lucarne/state.json";
const MAX_BYTES = 150_000;            // taille max d'une fiche joueur
const ID_RE = /^[a-z0-9]{8,40}$/, SECRET_RE = /^[a-z0-9]{16,64}$/;

function blobUrl() {
  const t = process.env.BLOB_READ_WRITE_TOKEN || "";
  const storeId = t.split("_")[3];
  if (!storeId) throw new Error("Stockage non configuré");
  return `https://${storeId.toLowerCase()}.public.blob.vercel-storage.com/${PATH}`;
}
async function readState() {
  const r = await fetch(blobUrl() + "?v=" + Date.now(), { cache: "no-store" });
  if (r.status === 404 || r.status === 403) return { players: {} };
  if (!r.ok) throw new Error("Lecture impossible " + r.status);
  const s = await r.json();
  return s && s.players ? s : { players: {} };
}
const hash = (s) => crypto.createHash("sha256").update("lucarne:" + s).digest("hex");
function clean(doc) {
  const out = { pseudo: String(doc.pseudo || "").slice(0, 20), days: {}, fullWeeks: {} };
  for (const [k, e] of Object.entries(doc.days || {})) {
    if (!/^\d{4}-\d{2}-\d{2}_[a-z]+$/.test(k) || !e || typeof e !== "object") continue;
    const score = Math.max(0, Math.min(1500, Math.round(Number(e.score) || 0)));
    out.days[k] = { ...e, score, done: !!e.done };
  }
  for (const k of Object.keys(doc.fullWeeks || {})) if (/^\d{4}-W\d{2}$/.test(k)) out.fullWeeks[k] = true;
  return out;
}

export default async function handler(req, res) {
  try {
    if (req.method === "GET") {
      const s = await readState();
      const players = {};
      for (const [id, p] of Object.entries(s.players)) { const { h, ...pub } = p; players[id] = pub; }
      res.setHeader("Cache-Control", "s-maxage=10, stale-while-revalidate=30");
      return res.status(200).json({ players });
    }
    if (req.method === "POST") {
      const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
      const { id, secret, doc, check } = body;
      if (!ID_RE.test(id || "") || !SECRET_RE.test(secret || "")) return res.status(400).json({ error: "identifiant invalide" });
      const s = await readState();
      const existing = s.players[id];
      if (existing && existing.h && existing.h !== hash(secret)) return res.status(403).json({ error: "code incorrect" });
      if (check) return existing ? res.status(200).json({ ok: true }) : res.status(404).json({ error: "inconnu" });
      if (!doc || JSON.stringify(doc).length > MAX_BYTES) return res.status(400).json({ error: "fiche invalide" });
      s.players[id] = { ...clean(doc), h: hash(secret), u: Date.now() };
      await put(PATH, JSON.stringify(s), {
        access: "public", addRandomSuffix: false, allowOverwrite: true,
        contentType: "application/json", cacheControlMaxAge: 60,
      });
      res.setHeader("Cache-Control", "no-store");
      return res.status(200).json({ ok: true });
    }
    res.setHeader("Allow", "GET, POST");
    return res.status(405).end();
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
}
