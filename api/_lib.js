// Outils partagés par les fonctions de Lucarne (les fichiers commençant par « _ » ne sont pas des routes).
import { put, list, del } from "@vercel/blob";
import crypto from "node:crypto";
import webpush from "web-push";

export const STATE_PATH = "lucarne/state.json";
const PRIVATE_PREFIX = "lucarne/private/";
export const SITE = "https://lucarne-three.vercel.app";

// ── Fichier public des scores ──
export function blobUrl() {
  const fromEnv = (process.env.BLOB_STORE_ID || "").replace(/^store_/, "");
  const fromToken = (process.env.BLOB_READ_WRITE_TOKEN || "").split("_")[3];
  const storeId = fromEnv || fromToken;
  if (!storeId) throw new Error("Stockage non configuré");
  return `https://${storeId.toLowerCase()}.public.blob.vercel-storage.com/${STATE_PATH}`;
}
export async function readState() {
  const r = await fetch(blobUrl() + "?v=" + Date.now(), { cache: "no-store" });
  if (r.status === 404 || r.status === 403) return { players: {} };
  if (!r.ok) throw new Error("Lecture impossible " + r.status);
  const s = await r.json();
  return s && s.players ? s : { players: {} };
}
export async function writeState(s) {
  await put(STATE_PATH, JSON.stringify(s), {
    access: "public", addRandomSuffix: false, allowOverwrite: true,
    contentType: "application/json", cacheControlMaxAge: 60,
  });
}
export const hash = (s) => crypto.createHash("sha256").update("lucarne:" + s).digest("hex");

// ── Fichier privé (clés des notifications, abonnements, envois déjà faits) ──
// Stocké sous une adresse aléatoire que seul le serveur peut retrouver (liste protégée par le jeton du stockage).
export async function readPrivate() {
  const { blobs } = await list({ prefix: PRIVATE_PREFIX });
  if (!blobs.length) return { data: { subs: {}, sent: {} }, old: [] };
  blobs.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));
  const r = await fetch(blobs[0].url + "?v=" + Date.now(), { cache: "no-store" });
  const data = r.ok ? await r.json() : { subs: {}, sent: {} };
  data.subs = data.subs || {}; data.sent = data.sent || {};
  return { data, old: blobs.map((b) => b.url) };
}
export async function writePrivate(p) {
  await put(PRIVATE_PREFIX + "data.json", JSON.stringify(p.data), {
    access: "public", addRandomSuffix: true, contentType: "application/json", cacheControlMaxAge: 60,
  });
  if (p.old && p.old.length) { try { await del(p.old); } catch (_) {} }
}
export async function getVapid(p) {
  if (!p.data.vapid) { p.data.vapid = webpush.generateVAPIDKeys(); p.dirty = true; }
  return p.data.vapid;
}

// ── Envoi des notifications ──
export async function sendAll(p, payload) {
  const v = await getVapid(p);
  webpush.setVapidDetails(SITE, v.publicKey, v.privateKey);
  let ok = 0, gone = 0;
  await Promise.all(Object.entries(p.data.subs).map(async ([ep, s]) => {
    try { await webpush.sendNotification(s.sub, JSON.stringify(payload), { TTL: 6 * 3600 }); ok++; }
    catch (e) { if (e.statusCode === 404 || e.statusCode === 410) { delete p.data.subs[ep]; gone++; p.dirty = true; } }
  }));
  return { ok, gone };
}

// ── Calendrier (heure de Paris, ouverture à 7h) ──
export const SCHEDULE = [
  ["parcours", "🧭", "Parcours"], ["imposteur", "🕵️", "L'Imposteur"], ["mystere", "🔎", "Joueur mystère"],
  ["top", "📋", "Top liste"], ["onze", "🟩", "Le Onze manquant"], ["plusmoins", "⚖️", "Plus ou moins"], ["quiz", "❓", "Quiz"],
];
export function parisParts(d = new Date()) {
  const o = {}; new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23" })
    .formatToParts(d).forEach((x) => (o[x.type] = x.value));
  return o;
}
const fmt = (dt) => dt.toISOString().slice(0, 10);
const parse = (s) => { const [y, m, d] = s.split("-").map(Number); return new Date(Date.UTC(y, m - 1, d)); };
export function gameDay(d = new Date()) {
  const o = parisParts(d), day = `${o.year}-${o.month}-${o.day}`;
  return +o.hour % 24 < 7 ? fmt(new Date(parse(day).getTime() - 864e5)) : day;
}
export function weekOf(date) {
  const dt = parse(date), dow = (dt.getUTCDay() + 6) % 7;
  const th = new Date(dt.getTime() + (3 - dow) * 864e5), y = th.getUTCFullYear(), j4 = new Date(Date.UTC(y, 0, 4));
  const w = 1 + Math.round(((th - j4) / 864e5 - 3 + ((j4.getUTCDay() + 6) % 7)) / 7);
  const mon = new Date(dt.getTime() - dow * 864e5);
  return { key: `${y}-W${String(w).padStart(2, "0")}`, num: w, dow, days: [...Array(7)].map((_, i) => fmt(new Date(mon.getTime() + i * 864e5))) };
}
export const prevWeekDate = (date) => fmt(new Date(parse(date).getTime() - 7 * 864e5));

// Points de chaque joueur pour une semaine donnée + participants (joué cette semaine ou la précédente)
export function weekResults(state, wk) {
  const prev = weekOf(prevWeekDate(wk.days[0]));
  const rows = [];
  for (const [id, p] of Object.entries(state.players || {})) {
    if (!p.pseudo) continue;
    const scoreOf = (w) => w.days.reduce((s, d) => { const e = (p.days || {})[`${d}_${SCHEDULE[weekOf(d).dow][0]}`]; return s + (e && e.done ? e.score || 0 : 0); }, 0);
    const played = (w) => w.days.some((d) => { const e = (p.days || {})[`${d}_${SCHEDULE[weekOf(d).dow][0]}`]; return e && e.done; });
    const n = wk.days.filter((d) => { const e = (p.days || {})[`${d}_${SCHEDULE[weekOf(d).dow][0]}`]; return e && e.done; }).length;
    if (played(wk) || played(prev)) rows.push({ id, pseudo: p.pseudo, score: scoreOf(wk), n });
  }
  rows.sort((a, b) => b.score - a.score);
  return rows;
}
export function recapText(rows, wk) {
  if (rows.length < 2) return `La semaine ${wk.num} est terminée : viens voir ton récap !`;
  const min = rows[rows.length - 1].score, losers = rows.filter((r) => r.score === min);
  const win = rows[0];
  if (losers.length === rows.length) return `Semaine ${wk.num} : égalité parfaite, personne ne paie sa tournée !`;
  const stake = rows.length - losers.length;
  return `🏆 ${win.pseudo} gagne la semaine ${wk.num} avec ${win.score} pts. 🥃 ${losers.map((l) => l.pseudo).join(" et ")} doi${losers.length > 1 ? "vent" : "t"} ${stake} Ricard${stake > 1 ? "s" : ""}.`;
}
