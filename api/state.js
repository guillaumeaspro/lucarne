// API des scores : GET = toutes les fiches joueurs, POST = enregistrer sa propre fiche.
import { EPOCH, readState, writeState, hash, readPrivate, writePrivate, sendAll, gameDay, weekOf, weekResults, recapText, SITE } from "./_lib.js";

const MAX_BYTES = 150_000;
const ID_RE = /^[a-z0-9]{8,40}$/, SECRET_RE = /^[a-z0-9]{16,64}$/;

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

// Si tous les joueurs actifs ont fini les 7 jeux de la semaine, on envoie le récap tout de suite (une seule fois)
async function maybeEarlyRecap(state) {
  const wk = weekOf(gameDay());
  const rows = weekResults(state, wk);
  if (rows.length < 2 || !rows.every((r) => r.n === 7)) return;
  const p = await readPrivate();
  if (p.data.sent["recap-" + wk.key]) return;
  p.data.sent["recap-" + wk.key] = Date.now(); p.dirty = true;
  await sendAll(p, { title: `📊 Récap de la semaine ${wk.num} dispo !`, body: "Tout le monde a joué : " + recapText(rows, wk), tag: "recap", url: SITE + "/#recap" });
  await writePrivate(p);
}

export default async function handler(req, res) {
  try {
    if (req.method === "GET") {
      const s = await readState();
      const players = {};
      for (const [id, p] of Object.entries(s.players)) { const { h, ...pub } = p; players[id] = pub; }
      res.setHeader("Cache-Control", "s-maxage=10, stale-while-revalidate=30");
      return res.status(200).json({ epoch: EPOCH, players });
    }
    if (req.method === "POST") {
      const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
      const { id, secret, doc, check, epoch } = body;
      // un téléphone resté sur l'ancienne saison ne doit pas faire revenir ses vieux scores
      if (!check && epoch !== EPOCH) return res.status(409).json({ error: "saison terminée", epoch: EPOCH });
      if (!ID_RE.test(id || "") || !SECRET_RE.test(secret || "")) return res.status(400).json({ error: "identifiant invalide" });
      const s = await readState();
      const existing = s.players[id];
      if (existing && existing.h && existing.h !== hash(secret)) return res.status(403).json({ error: "code incorrect" });
      if (check) return existing ? res.status(200).json({ ok: true }) : res.status(404).json({ error: "inconnu" });
      if (!doc || JSON.stringify(doc).length > MAX_BYTES) return res.status(400).json({ error: "fiche invalide" });
      s.players[id] = { ...clean(doc), h: hash(secret), u: Date.now() };
      await writeState(s);
      try { await maybeEarlyRecap(s); } catch (_) {}
      res.setHeader("Cache-Control", "no-store");
      return res.status(200).json({ ok: true });
    }
    res.setHeader("Allow", "GET, POST");
    return res.status(405).end();
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
}
