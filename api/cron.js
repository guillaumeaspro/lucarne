// Tâche quotidienne (planifiée par Vercel le matin) : notification « nouveau jeu »
// et, le lundi, récap de la semaine écoulée s'il n'a pas déjà été envoyé.
import { readPrivate, writePrivate, sendAll, readState, gameDay, weekOf, prevWeekDate, weekResults, recapText, SCHEDULE, SITE } from "./_lib.js";

export default async function handler(req, res) {
  try {
    const p = await readPrivate();
    const day = gameDay(), wk = weekOf(day), out = {};
    // le jeu du jour n'ouvre qu'à 7h : si la tâche passe avant, on n'envoie rien (gameDay = veille)
    if (!p.data.sent["day-" + day]) {
      const [, emo, name] = SCHEDULE[wk.dow];
      out.daily = await sendAll(p, { title: `${emo} Nouveau jeu dispo : ${name}`, body: "Le défi du jour est ouvert. À toi de jouer !", tag: "daily", url: SITE + "/" });
      p.data.sent["day-" + day] = Date.now(); p.dirty = true;
    }
    if (wk.dow === 0) {
      const last = weekOf(prevWeekDate(day));
      if (!p.data.sent["recap-" + last.key]) {
        const s = await readState();
        const rows = weekResults(s, last);
        out.recap = await sendAll(p, { title: `📊 Récap de la semaine ${last.num} dispo !`, body: recapText(rows, last), tag: "recap", url: SITE + "/#recap" });
        p.data.sent["recap-" + last.key] = Date.now(); p.dirty = true;
      }
    }
    // ménage : on ne garde que les 60 derniers envois
    const keys = Object.keys(p.data.sent).sort(); if (keys.length > 60) { keys.slice(0, keys.length - 60).forEach((k) => delete p.data.sent[k]); p.dirty = true; }
    if (p.dirty) await writePrivate(p);
    return res.status(200).json({ ok: true, day, ...out });
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
}
