// Notifications : GET = clé publique ; POST = s'abonner ; DELETE = se désabonner.
import { readPrivate, writePrivate, getVapid, readState, hash } from "./_lib.js";

export default async function handler(req, res) {
  try {
    const p = await readPrivate();
    if (req.method === "GET") {
      const v = await getVapid(p);
      if (p.dirty) await writePrivate(p);
      res.setHeader("Cache-Control", "no-store");
      return res.status(200).json({ publicKey: v.publicKey });
    }
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
    if (req.method === "POST") {
      const { id, secret, sub } = body;
      if (!sub || !sub.endpoint || !/^https:\/\//.test(sub.endpoint) || !sub.keys) return res.status(400).json({ error: "abonnement invalide" });
      const s = await readState(); const pl = s.players[id];
      if (pl && pl.h && pl.h !== hash(String(secret || ""))) return res.status(403).json({ error: "code incorrect" });
      // un seul abonnement par appareil ; on limite le nombre total
      if (Object.keys(p.data.subs).length > 200 && !p.data.subs[sub.endpoint]) return res.status(429).json({ error: "trop d'abonnements" });
      p.data.subs[sub.endpoint] = { sub: { endpoint: sub.endpoint, keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth } }, id: String(id || ""), at: Date.now() };
      await writePrivate(p);
      return res.status(200).json({ ok: true });
    }
    if (req.method === "DELETE") {
      if (body.endpoint && p.data.subs[body.endpoint]) { delete p.data.subs[body.endpoint]; await writePrivate(p); }
      return res.status(200).json({ ok: true });
    }
    res.setHeader("Allow", "GET, POST, DELETE");
    return res.status(405).end();
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
}
