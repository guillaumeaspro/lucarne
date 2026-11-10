// ═════════════════════════ RÉGLAGES ═════════════════════════
const TZ = "Europe/Paris", MAXPTS = 1500, OPEN_H = 7;
const SCHEDULE = ["parcours","imposteur","mystere","top","onze","plusmoins","quiz"]; // lundi → dimanche
const GAMES = {
  parcours:{n:"Parcours",e:"🧭",d:"Les clubs d'un joueur apparaissent un par un. Trouve-le avec le moins de clubs possible.",
    r:"5 joueurs : 3 classiques et 2 pour les aguerris. Tape le nom (une petite faute passe). Chaque mauvaise réponse ou indice dévoile le club suivant. 300 pts avec un seul club, 40 pts de moins par club dévoilé (minimum 100)."},
  imposteur:{n:"L'Imposteur",e:"🕵️",d:"Trois de ces joueurs sont passés par le club. Un seul n'y a jamais joué : démasque-le.",
    r:"5 manches, 20 secondes chacune. 200 pts par imposteur démasqué + jusqu'à 100 pts de bonus de rapidité."},
  mystere:{n:"Joueur mystère",e:"🔎",d:"Nationalité, poste et date de naissance : à toi de deviner qui se cache derrière, avec des indices de plus en plus parlants.",
    r:"Tu pars avec 3 indices. Tape un nom (une petite faute passe). Chaque mauvaise réponse ou indice demandé dévoile un indice de plus. 1500 pts sans indice supplémentaire, 200 de moins par indice (minimum 300)."},
  top:{n:"Top liste",e:"📋",d:"Complète la liste de mémoire. Trois erreurs et c'est fini.",
    r:"Tape les réponses une par une (l'orthographe approximative passe). 3 vies. Score proportionnel à la part de la liste trouvée, 1500 pts pour un sans-faute."},
  onze:{n:"Le Onze manquant",e:"🟩",d:"Retrouve la composition d'un match mythique.",
    r:"Tape les noms des titulaires (le nom de famille suffit). 3 vies. Score proportionnel au nombre de joueurs trouvés, 1500 pts si tu retrouves les 11."},
  plusmoins:{n:"Plus ou moins",e:"⚖️",d:"Deux choix, un seul a raison. Enchaîne le plus longtemps possible.",
    r:"15 duels maximum. 100 pts par bonne réponse. La première erreur arrête la série."},
  quiz:{n:"Quiz",e:"❓",d:"Le quiz classique : 10 questions, 20 secondes chacune.",
    r:"100 pts par bonne réponse + jusqu'à 50 pts de bonus de rapidité."}
};
const DAYN = ["Lun","Mar","Mer","Jeu","Ven","Sam","Dim"];
const DAYL = ["lundi","mardi","mercredi","jeudi","vendredi","samedi","dimanche"];
const MONTHS = ["janv.","févr.","mars","avr.","mai","juin","juil.","août","sept.","oct.","nov.","déc."];

// Bloque le zoom par pincement (Safari iPhone ignore « user-scalable=no ») et le double-tap
try{
  ["gesturestart","gesturechange","gestureend"].forEach(t=>document.addEventListener(t,e=>e.preventDefault(),{passive:false}));
  document.addEventListener("touchmove",e=>{ if(e.touches && e.touches.length>1) e.preventDefault(); },{passive:false});
}catch(_){}

// ═════════════════════════ OUTILS ═════════════════════════
function parisParts(d=new Date()){ const o={}; new Intl.DateTimeFormat("en-CA",{timeZone:TZ,year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",second:"2-digit",hourCycle:"h23"}).formatToParts(d).forEach(p=>o[p.type]=p.value); return o; }
function offsetMs(d){ const o=parisParts(d); return Date.UTC(+o.year,+o.month-1,+o.day,+o.hour%24,+o.minute,+o.second)-Math.floor(d.getTime()/1000)*1000; }
// Jour de jeu : un jeu s'ouvre à 7h (heure de Paris) et reste le « jeu du jour » jusqu'à 7h le lendemain
function todayStr(){ const o=parisParts(), d=`${o.year}-${o.month}-${o.day}`; return (+o.hour%24)<OPEN_H ? fmt(new Date(parse(d).getTime()-864e5)) : d; }
function openAt(date){ const wall=parse(date).getTime()+OPEN_H*3600e3; let t=wall-offsetMs(new Date(wall)); return wall-offsetMs(new Date(t)); }
const nextDate = d => fmt(new Date(parse(d).getTime()+864e5));
function cdText(ms){ if(ms<=0) return "C'est ouvert !"; const s=Math.floor(ms/1000), h=Math.floor(s/3600), m=Math.floor(s%3600/60), x=s%60;
  return `${h} h ${String(m).padStart(2,"0")} min ${String(x).padStart(2,"0")} s`; }
function cdShort(ms){ if(ms<=0) return "C'est ouvert !"; const s=Math.floor(ms/1000); return [Math.floor(s/3600),Math.floor(s%3600/60),s%60].map(n=>String(n).padStart(2,"0")).join(":"); }
function teaser(){
  const nd=nextDate(S.today), g=GAMES[gameFor(nd)], t=openAt(nd);
  return `<div class="card teaser"><div class="tlabel">Prochain match · ${DAYL[weekOf(nd).dow]} ${OPEN_H}h</div>
    <div class="tgame"><span class="temo">${g.e}</span><div><div class="display tname">${esc(g.n)}</div><p class="note">${esc(g.d)}</p></div></div>
    <div class="cdwrap">Coup d'envoi dans <div class="cd" data-t="${t}">${cdText(t-Date.now())}</div></div></div>`;
}
const parse = d => { const [y,m,x]=d.split("-").map(Number); return new Date(Date.UTC(y,m-1,x)); };
const fmt = dt => dt.toISOString().slice(0,10);
function weekOf(d){
  const dt=parse(d), dow=(dt.getUTCDay()+6)%7;
  const th=new Date(dt.getTime()+(3-dow)*864e5), y=th.getUTCFullYear();
  const j4=new Date(Date.UTC(y,0,4));
  const w=1+Math.round(((th-j4)/864e5-3+(j4.getUTCDay()+6)%7)/7);
  const mon=new Date(dt.getTime()-dow*864e5);
  return {key:`${y}-W${String(w).padStart(2,"0")}`, num:w, year:y, dow, idx:y*53+w, days:[...Array(7)].map((_,i)=>fmt(new Date(mon.getTime()+i*864e5)))};
}
const nice = d => { const x=parse(d); return `${x.getUTCDate()} ${MONTHS[x.getUTCMonth()]}`; };
function seedOf(s){ let h=1779033703^s.length; for(let i=0;i<s.length;i++){h=Math.imul(h^s.charCodeAt(i),3432918353);h=h<<13|h>>>19;} h=Math.imul(h^h>>>16,2246822507);h=Math.imul(h^h>>>13,3266489909);return (h^h>>>16)>>>0; }
function rng(s){ let a=seedOf(s); return ()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;}; }
function shuffle(arr,r){ const a=arr.slice(); for(let i=a.length-1;i>0;i--){const j=Math.floor(r()*(i+1));[a[i],a[j]]=[a[j],a[i]];} return a; }
// Tranche de la banque pour la semaine : la banque est mélangée une fois, puis on avance d'un cran par semaine
function weekSlice(bank, date, per, salt){
  const n=Math.floor(bank.length/per), order=shuffle(bank.map((_,i)=>i), rng("bank-"+salt));
  const k=((weekOf(date).idx % n)+n)%n;
  return order.slice(k*per,k*per+per).map(i=>bank[i]);
}
const esc = s => String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const norm = s => String(s).normalize("NFD").replace(/[̀-ͯ]/g,"").toLowerCase().replace(/œ/g,"oe").replace(/æ/g,"ae").replace(/[^a-z0-9]+/g," ").trim();
function lev(a,b){ if(Math.abs(a.length-b.length)>2) return 9; const d=[...Array(b.length+1)].map((_,i)=>i);
  for(let i=1;i<=a.length;i++){ let p=d[0]; d[0]=i; for(let j=1;j<=b.length;j++){ const t=d[j]; d[j]=Math.min(d[j]+1,d[j-1]+1,p+(a[i-1]===b[j-1]?0:1)); p=t; } } return d[b.length]; }
const aliases = a => a.split("|").map(norm);
const display = a => a.split("|")[0];
// Trouve l'élément qui correspond à une saisie libre : d'abord exact, puis à une faute près
function matchItem(input, list){
  const q=norm(input); if(!q) return -1;
  for(let i=0;i<list.length;i++) if(aliases(list[i]).includes(q)) return i;
  for(let i=0;i<list.length;i++) for(const a of aliases(list[i])){ const tol=a.length>=8?2:a.length>=5?1:0; if(tol && lev(q,a)<=tol) return i; }
  return -1;
}
const PL = {}; P.forEach(([n,nat,pos,born,clubs])=>PL[n]={n,nat,pos,born,clubs:clubs.split(";")});
const PNAMES = P.map(p=>p[0]);

// Écusson générique aux couleurs du club (pas le logo officiel)
function badge(club, size=64){
  const c = CLUBS[club] || (()=>{ const pal=["#3b5b8c","#8c3b3b","#3b8c5b","#8c7a3b","#5b3b8c","#3b7a8c"]; const h=seedOf(club); return [pal[h%6],"#ffffff",club.replace(/[^A-ZÀ-Ý]/g,"").slice(0,3)||club.slice(0,3).toUpperCase(),"p"]; })();
  const [c1,c2,sig,m]=c, id="b"+seedOf(club+size);
  const path="M50 4 L92 16 L92 52 C92 78 72 92 50 100 C28 92 8 78 8 52 L8 16 Z";
  let fill="";
  if(m==="v") fill=`<rect x="0" y="0" width="50" height="104" fill="${c1}"/><rect x="50" y="0" width="50" height="104" fill="${c2}"/>`;
  else if(m==="h") fill=`<rect x="0" y="0" width="100" height="52" fill="${c1}"/><rect x="0" y="52" width="100" height="52" fill="${c2}"/>`;
  else if(m==="s") fill=`<rect width="100" height="104" fill="${c1}"/>${[16,40,64,88].map(x=>`<rect x="${x-6}" y="0" width="12" height="104" fill="${c2}"/>`).join("")}`;
  else if(m==="d") fill=`<rect width="100" height="104" fill="${c2}"/><path d="M0 70 L100 10 L100 40 L0 100 Z" fill="${c1}"/>`;
  else fill=`<rect width="100" height="104" fill="${c1}"/><rect x="0" y="62" width="100" height="10" fill="${c2}"/>`;
  const fs = sig.length>3?20:sig.length>2?24:30;
  return `<svg width="${size}" height="${size*1.04}" viewBox="0 0 100 104" aria-label="${esc(club)}"><defs><clipPath id="${id}"><path d="${path}"/></clipPath></defs>
  <g clip-path="url(#${id})">${fill}</g><path d="${path}" fill="none" stroke="rgba(0,0,0,.35)" stroke-width="3"/>
  <text x="50" y="52" text-anchor="middle" dominant-baseline="middle" font-family="Anton,Impact,sans-serif" font-size="${fs}" fill="#fff" stroke="#0b1f14" stroke-width="3" paint-order="stroke">${esc(sig)}</text></svg>`;
}
const clubChip = (club,size=52) => `<div class="club">${badge(club,size)}<span>${esc(club)}</span></div>`;

// ═════════════════════════ ÉTAT & SAUVEGARDE ═════════════════════════
const S = { view:"loading", db:null, user:null, uid:null, solo:false, readOnly:false, players:{}, names:{}, slow:false, err:"",
  today:todayStr(), board:"week", tab:"jouer", play:null, recapKey:null, introDate:null, pseudoDraft:"" };
S.week = weekOf(S.today);
const local = { pseudo:"", days:{} };
let testBox = { pseudo:"Test", days:{} };   // mode test : bac à sable, rien n'est enregistré
const me = () => S.test ? testBox : S.solo ? local : (S.players[S.uid] || null);
const nameOf = uid => { const p=S.players[uid]; return (p&&p.pseudo) || S.names[uid] || "Joueur"; };
const gameFor = date => SCHEDULE[weekOf(date).dow];
const keyFor = date => date+"_"+gameFor(date);             // clé d'une partie du nouveau format
function entryFor(p,date){ const d=(p&&p.days)||{}; return d[keyFor(date)] || null; }
function legacyFor(p,date){ const e=((p&&p.days)||{})[date]; return e && !e.game ? e : null; } // ancien quiz (avant le programme)
// Les parties de l'ancienne version (sans jeu associé) ne bloquent plus le jeu du jour et ne comptent plus
function bestFor(p,date){ return entryFor(p,date); }

// persist() et init() : voir backend_claude.js (artifact) ou backend_web.js (site Vercel)
const save = () => { const z=S.play; persist({days:{[z.key]:z.e}}); };

// ═════════════════════════ CLASSEMENTS ═════════════════════════
const weekKeyBefore = key => { const d=weekDate(key); return d ? weekOf(fmt(new Date(parse(d).getTime()-7*864e5))).key : null; };
const WEEKDATE = {};
function weekDate(key){ if(WEEKDATE[key]) return WEEKDATE[key]; const [y,w]=key.split("-W").map(Number); const j4=new Date(Date.UTC(y,0,4)); const mon=new Date(j4.getTime()-((j4.getUTCDay()+6)%7)*864e5+(w-1)*7*864e5); return WEEKDATE[key]=fmt(mon); }
// Points par semaine d'un joueur : { "2026-W45": 4200, … } (une seule partie comptée par jour)
function playerWeeks(p){
  const out={}, seen={};
  for(const k of Object.keys((p&&p.days)||{})){
    const date=k.slice(0,10); if(seen[date]) continue; seen[date]=1;
    const b=bestFor(p,date); if(!b||!b.done) continue;
    const w=weekOf(date); WEEKDATE[w.key]=w.days[0];
    out[w.key]=(out[w.key]||0)+(b.score||0);
  }
  return out;
}
function weekTotal(p,wk){ const pw=playerWeeks(p); let n=0; for(const d of wk.days){ const e=bestFor(p,d); if(e&&e.done) n++; } return {s:pw[wk.key]||0,n}; }
// Calcule le classement général, les Ricard dus et les joueurs retirés pour inactivité
function league(){
  WEEKDATE[S.week.key]=S.week.days[0];
  const cur=S.week.key, prev=weekKeyBefore(cur);
  const P2={}; for(const [uid,p] of Object.entries(S.players)){ const w=playerWeeks(p); const keys=Object.keys(w).sort(); if(keys.length) P2[uid]={w,first:keys[0]}; }
  const allWeeks=[...new Set(Object.values(P2).flatMap(x=>Object.keys(x.w)).concat(cur))].sort();
  const ricard={}, lastWeeks={};
  for(const W of allWeeks){
    if(W>=cur) continue;                       // seules les semaines terminées comptent
    const Wb=weekKeyBefore(W);
    const parts=Object.entries(P2).filter(([u,x])=>x.first<=W && (x.w[W]!==undefined || (Wb && x.w[Wb]!==undefined)));
    if(parts.length<2) continue;
    const sc=parts.map(([u,x])=>[u,x.w[W]||0]), min=Math.min(...sc.map(s=>s[1])), losers=sc.filter(s=>s[1]===min);
    if(losers.length===parts.length) continue;  // égalité générale : personne ne paie
    losers.forEach(([u])=>{ ricard[u]=(ricard[u]||0)+(parts.length-losers.length); (lastWeeks[u]=lastWeeks[u]||[]).push(W); });
  }
  const rows=[], out=[];
  for(const [uid,x] of Object.entries(P2)){
    const active = x.w[cur]!==undefined || (prev && x.w[prev]!==undefined);
    const total=Object.values(x.w).reduce((s,v)=>s+v,0);
    const r={uid,total,weeks:x.w,ricard:ricard[uid]||0,last:lastWeeks[uid]||[]};
    (active?rows:out).push(r);
  }
  // un joueur inscrit cette semaine sans avoir encore joué n'apparaît pas encore
  rows.sort((a,b)=>b.total-a.total);
  return {rows,out,weeks:allWeeks.slice().reverse()};
}
function standings(mode){
  const rows=[];
  for(const [uid,p] of Object.entries(S.players)){
    if(mode==="week"){ const {s,n}=weekTotal(p,S.week); if(n) rows.push({uid,s,sub:`${n} jeu${n>1?"x":""} joué${n>1?"s":""}`}); }
    else { const e=bestFor(p,S.today); if(e&&e.done) rows.push({uid,s:e.score,sub:(GAMES[e.game||"quiz"]||GAMES.quiz).n}); }
  }
  return rows.sort((a,b)=>b.s-a.s);
}
function palmares(){
  const weeks={};
  for(const [uid,p] of Object.entries(S.players)) for(const [k,v] of Object.entries(playerWeeks(p))){ if(k>=S.week.key) continue; (weeks[k]=weeks[k]||{})[uid]=v; }
  return Object.keys(weeks).sort().reverse().slice(0,8).map(k=>{ const best=Object.entries(weeks[k]).sort((a,b)=>b[1]-a[1])[0]; return {k,uid:best[0],s:best[1]}; });
}
const wlabel = k => "S"+parseInt(k.split("W")[1],10);
// Récap de la dernière semaine terminée : classement, vainqueur, Ricard
function lastRecap(){
  const prevK=weekKeyBefore(S.week.key), prevPrev=weekKeyBefore(prevK);
  const rows=[];
  for(const [uid,p] of Object.entries(S.players)){
    if(!p||!p.pseudo) continue;
    const w=playerWeeks(p);
    if(w[prevK]!==undefined || w[prevPrev]!==undefined) rows.push({uid,s:w[prevK]||0});
  }
  if(!rows.length || !rows.some(r=>r.s>0)) return "";
  rows.sort((a,b)=>b.s-a.s);
  const min=rows[rows.length-1].s, losers=rows.filter(r=>r.s===min), stake=rows.length-losers.length, pay=rows.length>=2&&stake>0;
  const n=rows.length;
  if(n>8) return `<div class="card recapw" id="recap"><h2 class="recap-title">Classement final · semaine ${parseInt(prevK.split("W")[1],10)}</h2>
    ${rows.map((r,i)=>{ const lost=pay&&r.s===min; return `<div class="row ${r.uid===S.uid?"mine":""} ${lost?"lanterne":""}"><div class="rk">${i===0?"1":i+1}</div><div class="nm">${esc(nameOf(r.uid))}${lost?`<small>Doit ${stake} Ricard${stake>1?"s":""} à la bande</small>`:i===0?"<small>Vainqueur de la semaine</small>":""}</div><div class="sc">${r.s}</div></div>`; }).join("")}</div>`;
  // le plan de jeu : le premier en attaque, le dernier dans les cages
  const xs=[50,26,74,38,62,20,80];
  const mags=rows.map((r,i)=>{
    const lost=pay&&r.s===min, last=i===n-1&&lost;
    const y = last ? 86 : n===1 ? 20 : 12 + (i/(Math.max(1,n-1)))*62;
    const x = i===0||last ? 50 : xs[i%xs.length];
    const bg = i===0 ? "background:var(--yellow);color:var(--board)" : lost ? "background:var(--magnet);color:#fff" : r.uid===S.uid ? "background:#2F6FD0;color:#fff" : "background:var(--chalk);color:var(--board)";
    const label = (i===0?"1er":(i+1)+"e");
    return `<div class="mg" style="left:${x}%;top:${y}%">${last?`<span class="pay">dans les cages : ${stake} Ricard${stake>1?"s":""}</span>`:""}<span class="dot" style="${bg}">${label}</span><span class="who">${esc(r.uid===S.uid?"Toi":nameOf(r.uid))} · ${r.s}</span></div>`;
  }).join("");
  return `<div class="card recapw" id="recap"><h2 class="recap-title">Classement final · semaine ${parseInt(prevK.split("W")[1],10)}</h2>
    <div class="rpitch">
      <div class="ln" style="left:24%;right:24%;top:-2px;height:12%;border-top:0"></div>
      <div class="ln" style="left:24%;right:24%;bottom:-2px;height:12%;border-bottom:0"></div>
      <div class="ln" style="left:0;right:0;top:50%;height:0;border-width:2px 0 0"></div>
      <div class="ln" style="left:50%;top:50%;width:76px;height:76px;margin:-40px 0 0 -40px;border-radius:50%"></div>
      ${mags}
    </div></div>`;
}

// ═════════════════════════ CONTENU DU JOUR ═════════════════════════
function quizItems(date){ // dimanche : 10 questions de la banque, tournantes
  const order=weekSlice(Q.map((_,i)=>i),date,10,"quiz");
  return order.map(i=>{ const [cat,q,...o]=Q[i]; return {cat,q,opts:shuffle(o.map((t,k)=>({t,ok:k===0})), rng(date+"#"+i))}; });
}
function legacyQuizItems(date){ // ancien format (tirage par jour de semaine)
  const w=weekOf(date), order=shuffle(Q.map((_,i)=>i), rng("lucarne-"+w.key));
  return order.slice(w.dow*10,w.dow*10+10).map(i=>{ const [cat,q,...o]=Q[i]; return {cat,q,opts:shuffle(o.map((t,k)=>({t,ok:k===0})), rng(date+"#"+i))}; });
}
// Imposteur : on répartit les manches en semaines de 5 sans qu'aucun joueur n'apparaisse deux fois dans la même semaine
let IMP_WEEKS=null;
function imposteurWeeks(){
  if(IMP_WEEKS) return IMP_WEEKS;
  const names=r=>[r[1],...r[2]];
  for(let attempt=0; attempt<500; attempt++){
    const pool=shuffle(IMPOSTEUR.slice(), rng("imp-pack-"+attempt)), weeks=[];
    let ok=true;
    while(pool.length){
      const wk=[], used=new Set();
      for(let i=0;i<pool.length && wk.length<5;){
        const r=pool[i];
        if(names(r).some(n=>used.has(n))){ i++; continue; }
        names(r).forEach(n=>used.add(n)); wk.push(r); pool.splice(i,1);
      }
      if(wk.length<5){ ok=false; break; }
      weeks.push(wk);
    }
    if(ok) return IMP_WEEKS=weeks;
  }
  return IMP_WEEKS=[...Array(Math.floor(IMPOSTEUR.length/5))].map((_,k)=>IMPOSTEUR.slice(k*5,k*5+5));
}
function imposteurItems(date){
  const W=imposteurWeeks(), k=((weekOf(date).idx % W.length)+W.length)%W.length;
  return W[k].map((r,i)=>{ const [club,imp,ok]=r;
    return {club, cat:"Imposteur", q:`Lequel de ces joueurs n'a JAMAIS joué à ${club} ?`, opts:shuffle([{t:imp,ok:true},...ok.map(t=>({t,ok:false}))], rng(date+"imp"+i))}; });
}
// Parcours : 3 joueurs connus + 2 pour les aguerris → [{a:"nom|alias", nat, clubs[], expert}]
function parcoursItems(date){
  const stars=weekSlice(PARCOURS,date,3,"par").map(n=>{ const p=PL[n], last=norm(n).split(" ").slice(-1)[0]; return {a:n+"|"+last, nat:p.nat, clubs:p.clubs, expert:false}; });
  const exp=weekSlice(PARCOURS_EXPERT,date,2,"parx").map(([a,nat,c])=>({a,nat,clubs:c.split(";"),expert:true}));
  return stars.concat(exp);
}
// Joueur mystère : 15 fiches détaillées + une fiche générée pour chaque autre joueur de la base (~150 au total)
const PRESTIGE=["Real Madrid","Barcelone","Bayern","Juventus","Milan AC","Inter","Manchester United","Liverpool","Chelsea","Arsenal","Manchester City","PSG","OM","Atlético","Dortmund","Ajax","Lyon","Monaco","Naples","AS Roma","Tottenham","Benfica","Porto"];
function autoMystere(p){
  const r=rng("mys-"+p.n), uniq=[...new Set(p.clubs)], first=p.clubs[0];
  const top=PRESTIGE.find(c=>uniq.includes(c)&&c!==first) || (uniq.length>1?uniq[uniq.length-1]:first);
  const middle=shuffle(uniq.filter(c=>c!==first && c!==top), r);
  const words=p.n.split(" "), initials=words.map(w=>w[0].toUpperCase()).join(".")+".";
  const clues=[];
  if(uniq.length===1){
    clues.push("A fait toute sa carrière pro dans un seul club", `Ce club : ${first}`);
  } else {
    clues.push(`Nombre de clubs pros dans sa carrière : ${uniq.length}`);
    if(middle[0]) clues.push(`Passé par : ${middle[0]}`);
    if(middle[1]) clues.push(`Passé aussi par : ${middle[1]}`);
    clues.push(`Club de ses débuts pros : ${first}`);
    clues.push(`${PRESTIGE.includes(top)?"Son club le plus prestigieux":"Autre club"} : ${top}`);
  }
  if(clues.length<5){ const ln=norm(words.length>1?words.slice(1).join(""):p.n).replace(/ /g,"").length; clues.push(`Nombre de lettres de son nom : ${ln}`); }
  clues.push(`Ses initiales : ${initials}`);
  const al=[p.n]; if(words.length>1){ al.push(words.slice(1).join(" ")); al.push(words[words.length-1]); }
  return {a:[...new Set(al)].join("|"), nat:p.nat, pos:p.pos, born:`en ${p.born}`, clues:clues.slice(0,6), auto:true};
}
// Années 90 : uniquement les méga-stars (Ballon d'or) ; sinon années 2000 et joueurs actuels
const MYSTERE_EXCLUS = ["Laurent Blanc","Youri Djorkaeff","Éric Cantona","Christophe Dugarry","Marcel Desailly","Didier Deschamps","Emmanuel Petit",
  "Gabriel Batistuta","Michel Platini","Johan Cruyff","Diego Maradona","Pelé","Peter Schmeichel"].map(norm);
const MYSTERE_ALL = (()=>{ const ex=new Set(MYSTERE_EXCLUS), done=new Set(MYSTERE.map(m=>norm(display(m.a))));
  return MYSTERE.filter(m=>!ex.has(norm(display(m.a)))).concat(P.filter(p=>!done.has(norm(p[0]))&&!ex.has(norm(p[0]))).map(p=>autoMystere(PL[p[0]]))); })();
const mystereTarget = date => weekSlice(MYSTERE_ALL,date,1,"mys")[0];
const topItem = date => weekSlice(TOPS,date,1,"top")[0];
const onzeItem = date => weekSlice(ONZES,date,1,"onze")[0];
// Plus ou moins : 15 duels par jour, sans qu'un même joueur ou club revienne deux fois le même jour
const PM_CACHE={};
function pmRounds(date){
  if(PM_CACHE[date]) return PM_CACHE[date];
  const r=rng(date+"pm"), used=new Set(), out=[];
  for(let i=0;i<15;i++){
    let R=null;
    for(let guard=0; guard<200 && !R; guard++){
      const cat=PM[Math.floor(r()*PM.length)];
      const a=cat.items[Math.floor(r()*cat.items.length)], b=cat.items[Math.floor(r()*cat.items.length)];
      if(a[0]===b[0]||a[1]===b[1]||used.has(a[0])||used.has(b[0])) continue;
      R={q:cat.q, unit:cat.unit, pre:cat.pre||"", low:!!cat.low, a, b};
    }
    if(!R){ const cat=PM[0]; R={q:cat.q,unit:cat.unit,pre:"",low:false,a:cat.items[0],b:cat.items[1]}; }
    used.add(R.a[0]); used.add(R.b[0]); out.push(R);
  }
  return PM_CACHE[date]=out;
}
function pmRound(date,i){ return pmRounds(date)[i]; }

// ═════════════════════════ RENDU GÉNÉRAL ═════════════════════════
const app=document.getElementById("app");
function render(){
  if(S.test && S.view==="home") return renderTest();
  ({loading:renderLoading, pseudo:renderPseudo, home:renderHome, intro:renderIntro, play:renderPlay, result:renderResult})[S.view]();
}
function header(){
  return `<header class="top"><h1 class="logo">Lucarne</h1><span class="sub">Semaine ${S.week.num}</span></header>`;
}
function renderLoading(){
  app.innerHTML = header()+`<div class="card center"><div class="display" style="font-size:22px">Échauffement…</div>
  <p class="note" style="margin-top:8px">${S.slow?"Le classement met du temps à arriver. Il s'affichera dès que possible.":"On récupère les scores de la bande."}</p></div>`;
}
function renderPseudo(){
  app.innerHTML = header()+`<div class="card"><h2>Ton blase sur le classement</h2>
  <p class="note">Choisis le pseudo que tes potes verront. Tu pourras le changer plus tard.</p>
  <input class="txt" id="ps" maxlength="20" placeholder="Ex. : Le Mago" value="${esc(S.pseudoDraft || (me()&&me().pseudo) || S.names[S.uid] || "")}">
  <button class="btn" id="go">C'est parti</button>
  ${me()&&me().pseudo?`<div class="gap"></div><button class="btn ghost" id="cancel">Annuler</button>`:""}</div>`;
  const ps=document.getElementById("ps"); ps.focus();
  const go=()=>{ const v=ps.value.trim().slice(0,20); if(!v){ps.focus();return;} persist({pseudo:v}); S.view="home"; render(); };
  document.getElementById("go").onclick=go; ps.onkeydown=e=>{ if(e.key==="Enter") go(); }; ps.oninput=()=>S.pseudoDraft=ps.value;
  const c=document.getElementById("cancel"); if(c) c.onclick=()=>{S.view="home";render();};
}
// ── Icônes de la barre du bas (traits craie) ──
const ICON = {
  jouer:`<svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7l4 3-1.5 4.5h-5L8 10z"/></svg>`,
  classement:`<svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20V12h4v8M10 20V6h4v14M16 20v-6h4v6"/></svg>`,
  infos:`<svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/></svg>`
};
function navBar(){
  const t=S.tab||"jouer";
  const alert = typeof appBanner==="function" && !!appBanner();
  const b=(id,label)=>`<button class="navb ${t===id?"on":""}" data-tab="${id}" aria-current="${t===id?"page":"false"}">${ICON[id]}<span>${label}</span>${id==="infos"&&alert?`<i class="navdot" aria-label="à régler"></i>`:""}</button>`;
  return `<nav class="bottomnav">${b("jouer","Jouer")}${b("classement","Classement")}${b("infos","Infos")}</nav>`;
}

function renderHome(){
  const tab=S.tab||"jouer";
  let body = tab==="classement" ? homeClassement() : tab==="infos" ? homeInfos() : homeJouer();
  app.innerHTML = header()
    + (S.err?`<div class="warn">${esc(S.err)}</div>`:"")
    + (S.solo?`<div class="warn">Mode solo : tes scores ne seront pas enregistrés.</div>`:"")
    + body + navBar();
  app.querySelectorAll(".navb").forEach(b=>b.onclick=()=>{ S.tab=b.dataset.tab; render(); window.scrollTo(0,0); });
  app.querySelectorAll("[data-play]").forEach(b=>b.onclick=()=>{ if(!S.readOnly) openIntro(b.dataset.play); });
  app.querySelectorAll("[data-see]").forEach(b=>b.onclick=e=>{ e.preventDefault(); openResult(b.dataset.see); });
  app.querySelectorAll("[data-goto]").forEach(b=>b.onclick=e=>{ e.preventDefault(); S.tab=b.dataset.goto; render(); window.scrollTo(0,0); });
  app.querySelectorAll(".tab").forEach(b=>b.onclick=()=>{ S.board=b.dataset.b; render(); });
  const rn=document.getElementById("rename"); if(rn) rn.onclick=()=>{ S.pseudoDraft=""; S.view="pseudo"; render(); };
  const mc=document.getElementById("mycodeL"); if(mc) mc.onclick=()=>showCode();
  const tm=document.getElementById("testmode"); if(tm) tm.onclick=()=>{ S.test=true; testBox={pseudo:"Test",days:{}}; render(); window.scrollTo(0,0); };
  if(typeof bindAppCard==="function") bindAppCard();
  if(location.hash==="#recap"){ try{ history.replaceState(null,"",location.pathname); }catch(_){} if(tab!=="classement"){ S.tab="classement"; return render(); } const rc=document.getElementById("recap"); if(rc) setTimeout(()=>rc.scrollIntoView({behavior:"smooth"}),100); }
}

// ── Onglet Jouer : le jeu du jour, ta semaine, ta place ──
function homeJouer(){
  const m=me(), w=S.week;
  const tg=GAMES[gameFor(S.today)], te=bestFor(m,S.today), todayDone=te&&te.done;
  const missed=w.days.filter(d=>d<S.today && !(bestFor(m,d)&&bestFor(m,d).done));

  // 1. Le jeu du jour : la seule grosse chose de l'écran
  let main;
  if(!todayDone){
    main=`<div class="card today-card hero">
      <div class="tlabel">Aujourd'hui</div>
      <div class="tname display">${esc(tg.n)}</div>
      ${S.readOnly?`<button class="btn" disabled>Lecture seule</button>`:`<button class="btn big" data-play="${S.today}">Jouer</button>`}
    </div>`;
  } else {
    const nd=nextDate(S.today), ng=GAMES[gameFor(nd)];
    main=`<div class="card today-card hero">
      <div class="tlabel">Aujourd'hui · ${esc(tg.n)}</div>
      <div class="bigscore">${te.score}<small> pts</small></div>
      <a href="#" class="seelink" data-see="${S.today}">Revoir ma partie</a>
      <div class="nextline"><span>Prochain jeu : <b>${esc(ng.n)}</b></span><span class="cd" data-short="1" data-t="${openAt(nd)}">${cdShort(openAt(nd)-Date.now())}</span></div>
    </div>`;
  }

  // 2. Rattrapage : un simple lien, seulement s'il y a des jours manqués
  const catchup = missed.length && !S.readOnly
    ? `<button class="linkbtn" data-play="${missed[0]}">${missed.length} jeu${missed.length>1?"x":""} à rattraper ›</button>` : "";

  // 3. Ta semaine en une ligne : 7 pastilles + total + rang
  const ids=new Set(league().rows.map(r=>r.uid)); standings("week").forEach(r=>ids.add(r.uid));
  const list=[...ids].map(uid=>({uid,s:weekTotal(S.players[uid],w).s})).sort((a,b)=>b.s-a.s);
  const rank=list.findIndex(r=>r.uid===S.uid)+1;
  const dots=w.days.map((d,i)=>{
    const e=bestFor(m,d), future=d>S.today;
    const st = e&&e.done ? "done" : future ? "locked" : "open";
    const attr = st==="done" ? `data-see="${d}"` : st==="open" ? `data-play="${d}"` : "disabled";
    return `<button class="wdot ${st} ${d===S.today?"today":""}" ${attr} aria-label="${DAYL[i]} : ${esc(GAMES[gameFor(d)].n)}${st==="done"?" ("+e.score+" pts)":""}">${"LMMJVSD"[i]}</button>`;
  }).join("");
  const summary = `<div class="weekline">
      <div class="wdots">${dots}</div>
      <button class="wsum" data-goto="classement"><b>${weekTotal(m,w).s} pts</b><span>${list.length>=2&&rank?rank+(rank===1?"er":"e")+" sur "+list.length:"cette semaine"} ›</span></button>
    </div>`;

  return main + catchup + summary;
}

// ── Onglet Classement ──
function homeClassement(){
  const L=league();
  let board;
  if(S.board==="general"){
    board = L.rows.length ? L.rows.map((r,i)=>`<div class="row ${r.uid===S.uid?"mine":""}"><div class="rk">${i+1}</div><div class="nm">${esc(nameOf(r.uid))}${r.ricard?` <span class="ricard">🥃 ${r.ricard}</span>`:""}<small>${Object.keys(r.weeks).length} semaine${Object.keys(r.weeks).length>1?"s":""}</small></div><div class="sc">${r.total}</div></div>`).join("")
      : `<div class="empty">Le classement se remplit dès la première partie.</div>`;
    if(L.out.length) board+=`<p class="note" style="margin-top:8px">Retirés (2 semaines sans jouer) : ${L.out.map(r=>esc(nameOf(r.uid))).join(", ")}.</p>`;
  } else if(S.board==="today"){
    const list=standings("today");
    board = list.length ? list.map((r,i)=>`<div class="row ${r.uid===S.uid?"mine":""}"><div class="rk">${i+1}</div><div class="nm">${esc(nameOf(r.uid))}</div><div class="sc">${r.s}</div></div>`).join("")
      : `<div class="empty">Personne n'a encore joué aujourd'hui.</div>`;
  } else {
    const ids=new Set(L.rows.map(r=>r.uid)); standings("week").forEach(r=>ids.add(r.uid));
    const list=[...ids].map(uid=>{ const {s,n}=weekTotal(S.players[uid],S.week); return {uid,s,n}; }).sort((a,b)=>b.s-a.s);
    const min=list.length?Math.min(...list.map(r=>r.s)):0, losers=list.filter(r=>r.s===min), stake=list.length-losers.length, riskOn=list.length>=2&&stake>0;
    board = list.length ? list.map((r,i)=>{ const lost=riskOn&&r.s===min;
      return `<div class="row ${r.uid===S.uid?"mine":""} ${lost?"lanterne":""}"><div class="rk">${lost?"🥃":i+1}</div><div class="nm">${esc(nameOf(r.uid))}<small>${lost?`doit ${stake} Ricard${stake>1?"s":""} si ça reste comme ça`:`${r.n}/7 jeux`}</small></div><div class="sc">${r.s}</div></div>`; }).join("")
      : `<div class="empty">Personne n'a encore joué cette semaine.</div>`;
    if(list.length>=2) board+=`<p class="note" style="margin-top:8px">Dimanche soir, le dernier paie un Ricard à chacun des autres.</p>`;
  }
  const owed=L.rows.concat(L.out).filter(r=>r.ricard>0).sort((a,b)=>b.ricard-a.ricard);
  const palm=palmares();
  return `<div class="card"><div class="tabs"><button class="tab ${S.board==="week"?"on":""}" data-b="week">Semaine</button><button class="tab ${S.board==="general"?"on":""}" data-b="general">Général</button><button class="tab ${S.board==="today"?"on":""}" data-b="today">Aujourd'hui</button></div>${board}</div>`
    + lastRecap()
    + (owed.length?`<div class="card ardoise"><h2>L'ardoise des Ricard</h2>${owed.map(r=>`<div class="row"><div class="rk">🥃</div><div class="nm">${esc(nameOf(r.uid))}<small>dernier en ${r.last.map(wlabel).join(", ")}</small></div><div class="sc">${r.ricard}</div></div>`).join("")}</div>`:"")
    + (palm.length?`<div class="card palm"><h2>Palmarès</h2>${palm.map(p=>`<div class="row"><div class="rk">🏆</div><div class="nm">${esc(nameOf(p.uid))}<small>semaine ${parseInt(p.k.split("W")[1],10)}</small></div><div class="sc">${p.s}</div></div>`).join("")}</div>`:"");
}

// ── Onglet Infos : profil, appli, règles ──
function homeInfos(){
  const m=me();
  return `<div class="card"><h2>Mon profil</h2>
      <div class="inforow"><span>Pseudo</span><b>${esc((m&&m.pseudo)||"—")}</b></div>
      <div class="row2" style="margin-top:10px">${S.solo?"":`<button class="btn ghost" id="rename">Changer de pseudo</button>`}${typeof showCode==="function"?`<button class="btn ghost" id="mycodeL">Mon code joueur</button>`:""}</div>
      ${typeof showCode==="function"?`<p class="note">Le code joueur sert à retrouver tes points sur un autre téléphone.</p>`:""}
    </div>`
    + (typeof appCard==="function"?appCard(true):"")
    + `<div class="card"><h2>Le programme</h2>${SCHEDULE.map((g,i)=>`<div class="prog"><b>${DAYN[i]}</b><span>${esc(GAMES[g].n)}</span></div>`).join("")}</div>
    <div class="card"><h2>Les règles</h2>
      <p class="note">• Un nouveau jeu chaque matin à ${OPEN_H}h, le même pour tout le monde, jusqu'à ${MAXPTS} pts.</p>
      <p class="note">• Un seul essai par jeu. Les jours manqués se rattrapent jusqu'au dimanche soir.</p>
      <p class="note">• Le dernier de la semaine paie un Ricard à chacun des autres. Qui ne joue pas compte pour 0.</p>
      <p class="note">• Deux semaines sans jouer = retiré du classement (une partie suffit pour revenir).</p>
    </div>`
    + (S.isOwner||S.solo?`<button class="btn ghost" id="testmode">Mode test (organisateur)</button>`:"");
}

// Mode test : tous les jeux de la semaine, jours futurs compris, rejouables, sans enregistrement
function renderTest(){
  const w=S.week;
  app.innerHTML = header()+`<div class="warn" style="background:rgba(255,210,63,.12);border-color:rgba(255,210,63,.5);color:var(--chalk)">🧪 <b>Mode test</b> — rien n'est enregistré, le classement n'est pas touché. Tu peux tout rejouer autant que tu veux.</div>
    <div class="card"><h2>Tester un jeu</h2>${w.days.map((d,i)=>{ const g=GAMES[gameFor(d)], e=bestFor(testBox,d);
      return `<div class="trow"><div class="temo2">${g.e}</div><div class="nm"><b>${esc(g.n)}</b><small>${DAYL[i]} ${nice(d)}${e&&e.done?` · testé : ${e.score} pts`:""}</small></div>
        <button class="btn small" data-d="${d}">${e&&e.done?"Rejouer":"Jouer"}</button></div>`; }).join("")}
      <div class="gap"></div><p class="note">Pour voir d'autres contenus (semaine prochaine, etc.), change de semaine :</p>
      <div class="row2" style="margin-top:8px"><button class="btn ghost" id="wprev">‹ Semaine ${weekOf(fmt(new Date(parse(w.days[0]).getTime()-7*864e5))).num}</button><button class="btn ghost" id="wnext">Semaine ${weekOf(fmt(new Date(parse(w.days[0]).getTime()+7*864e5))).num} ›</button></div>
      <div class="gap"></div><p class="note">Aperçu du compte à rebours affiché après une partie :</p></div>${teaser()}
    <button class="btn ghost" id="pvw" style="margin-bottom:10px">Aperçu du pop-up « semaine complète »</button>
    <button class="btn" id="quit">Quitter le mode test</button>`;
  app.querySelectorAll(".trow .btn").forEach(b=>b.onclick=()=>{ const d=b.dataset.d; delete testBox.days[keyFor(d)]; openIntro(d); });
  const shift=n=>{ S.week=weekOf(fmt(new Date(parse(S.week.days[0]).getTime()+n*7*864e5))); render(); };
  document.getElementById("wprev").onclick=()=>shift(-1);
  document.getElementById("wnext").onclick=()=>shift(1);
  document.getElementById("pvw").onclick=()=>showFullWeek(S.week);
  document.getElementById("quit").onclick=()=>{ S.test=false; S.week=weekOf(S.today); S.view="home"; render(); window.scrollTo(0,0); };
}
function openResult(date){ if(S.view==="home") pushScreen(); S.recapKey=date; S.view="result"; render(); window.scrollTo(0,0); }
function openIntro(date){
  if(date>S.today && !S.test) return;
  if(S.view==="home") pushScreen();
  const e=bestFor(me(),date); if(e&&e.done) return openResult(date);
  if(entryFor(me(),date)) return startGame(date); // partie en cours : on reprend directement
  S.introDate=date; S.view="intro"; render(); window.scrollTo(0,0);
}
function renderIntro(){
  const d=S.introDate, g=GAMES[gameFor(d)];
  app.innerHTML = backBar()+`<div class="card center"><div style="font-size:56px">${g.e}</div><div class="display" style="font-size:34px">${esc(g.n)}</div>
  <div class="sub" style="margin:4px 0 14px">${d===S.today?"Défi du jour":"Défi de "+DAYL[weekOf(d).dow]+" "+nice(d)}</div>
  <p style="font-size:16px;line-height:1.45;margin-bottom:10px">${esc(g.d)}</p><p class="note" style="margin-bottom:18px">${esc(g.r)}</p>
  <button class="btn" id="go">Coup d'envoi</button><div class="gap"></div><button class="btn ghost" data-back="1">Retour</button></div>`;
  document.getElementById("go").onclick=()=>startGame(d);

}

// ═════════════════════════ MOTEUR DE PARTIE ═════════════════════════
function startGame(date){
  const game=gameFor(date), key=keyFor(date), prev=entryFor(me(),date);
  const e = prev ? JSON.parse(JSON.stringify(prev)) : {week:weekOf(date).key, game, score:0, done:false, st:G[game].init(date)};
  S.play={date, game, key, e, data:G[game].data(date)};
  S.view="play";
  if(!prev) save();
  G[game].resume && G[game].resume();
  render(); window.scrollTo(0,0);
}
function finishGame(){ const z=S.play; z.e.done=true; z.e.finishedAt=Date.now(); save(); S.play=null; openResult(z.date); checkFullWeek(z.date); }
// Semaine complète (7 jeux sur 7) : pop-up de félicitations, une fois par semaine
function checkFullWeek(date){
  const m=me(), wk=weekOf(date);
  const n=wk.days.filter(d=>{ const e=bestFor(m,d); return e&&e.done; }).length;
  if(n<7) return;
  if(!S.test){ if(m&&m.fullWeeks&&m.fullWeeks[wk.key]) return; persist({fullWeeks:{[wk.key]:true}}); }
  setTimeout(()=>showFullWeek(wk), 500);
}
function showFullWeek(wk){
  const m=me(), name=(m&&m.pseudo)||"champion";
  const tot=weekTotal(m,wk).s;
  const conf=[...Array(36)].map((_,i)=>`<i style="left:${(i*37)%100}%;animation-delay:${(i%9)*.18}s;background:${i%2?"#E2001A":"#1C2A54"}"></i>`).join("");
  const ov=document.createElement("div"); ov.className="modal";
  ov.innerHTML=`<div class="confetti">${conf}</div><div class="mbox">
    <div class="mbadge">7/7</div>
    <div class="display" style="font-size:34px;line-height:1">Semaine complète !</div>
    <p class="mtxt">Bravo <b>${esc(name)}</b> : tu as joué aux 7 jeux de la semaine ${wk.num}, sans en lâcher un seul. <b>${tot} pts</b> au compteur.</p>
    <div class="losc"><div class="lbar"></div><p>Et comme chaque semaine, petit rappel amical à toute la bande :</p>
      <div class="display lbig">Cette semaine encore, le LOSC est le plus grand club de France.</div></div>
    <button class="btn" id="mclose">Allez le LOSC !</button></div>`;
  document.body.appendChild(ov);
  ov.querySelector("#mclose").onclick=()=>ov.remove();
}
function renderPlay(){ G[S.play.game].render(); }
// Retour à l'accueil depuis n'importe quel écran (bouton en haut + bouton retour du téléphone)
const backBar = (label="Retour") => `<button class="backbtn" data-back="1" aria-label="Retour à l'accueil"><svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>${label}</button>`;
function goHome(){
  if(S.view==="home") return;
  if(S.view==="play" && S.play) save();
  S.play=null; S.view="home"; render(); window.scrollTo(0,0);
}
const canHistory = /vercel\.app$/.test(location.hostname);
function pushScreen(){ if(canHistory){ try{ history.pushState({lucarne:1},"",location.pathname); }catch(_){} } }
if(canHistory) window.addEventListener("popstate",()=>{ if(S.view!=="home"&&S.view!=="loading"&&S.view!=="pseudo") goHome(); });
document.addEventListener("click",e=>{ const b=e.target.closest&&e.target.closest("[data-back]"); if(b){ e.preventDefault(); if(canHistory && history.state && history.state.lucarne) history.back(); else goHome(); } });

function playHead(extra=""){
  const z=S.play, g=GAMES[z.game];
  return backBar("Accueil")+`<div class="qhead"><span>${g.e} ${esc(g.n)}${extra?" · "+extra:""}</span><span class="score">${z.e.score||0}</span></div>`;
}
function renderResult(){
  const date=S.recapKey, m=me(), e=bestFor(m,date);
  if(!e){ S.view="home"; return render(); }
  const game=e.game||"quiz", g=GAMES[game];
  const dayRows=[]; for(const [uid,p] of Object.entries(S.players)){ const x=bestFor(p,date); if(x&&x.done) dayRows.push({uid,s:x.score}); }
  dayRows.sort((a,b)=>b.s-a.s); const r=dayRows.findIndex(x=>x.uid===S.uid)+1;
  const ratio=e.score/MAXPTS;
  const comment = ratio>=.85?"Ballon d'or !":ratio>=.65?"Titulaire indiscutable.":ratio>=.45?"Correct, mais le coach attend mieux.":ratio>=.2?"Retour au centre de formation…":"Carton rouge.";
  const body = e.game ? G[game].recap(date,e) : G.quiz.recap(date,{st:{answers:e.answers}},true);
  app.innerHTML = backBar()+`<div class="card center">
    <div class="sub">${g.e} ${esc(g.n)} · ${date===S.today?"aujourd'hui":DAYL[weekOf(date).dow]+" "+nice(date)}</div>
    <div class="big">${e.score}</div><div class="display" style="font-size:22px;margin-top:6px">${comment}</div>
    ${!S.solo&&r?`<p class="note" style="margin-top:8px">${r}${r===1?"er":"e"} sur ${dayRows.length} joueur${dayRows.length>1?"s":""} ce jour-là</p>`:""}
    <div class="gap"></div><button class="btn" data-back="1">Retour à l'accueil</button></div>
    ${teaser()}
    <div class="card recap"><h2>Correction</h2>${body}</div>`;
  if(S.test){ const bb=app.querySelector(".btn[data-back]"); if(bb) bb.textContent="Retour au mode test"; }
}

// Champ texte avec suggestions
function acField(ph){ return `<div class="ac"><input class="txt" id="ac" placeholder="${esc(ph)}" autocomplete="off" autocapitalize="off" spellcheck="false"><div class="sugg" id="sugg"></div></div>`; }
function bindAc(pool, onSubmit, opts={}){
  const inp=document.getElementById("ac"), box=document.getElementById("sugg"); if(!inp) return;
  let items=[], sel=-1;
  const draw=()=>{ box.innerHTML=items.map((n,i)=>`<div class="sg ${i===sel?"on":""}" data-i="${i}">${opts.label?opts.label(n):esc(n)}</div>`).join(""); box.style.display=items.length?"block":"none";
    box.querySelectorAll(".sg").forEach(el=>el.onmousedown=ev=>{ ev.preventDefault(); pick(items[+el.dataset.i]); }); };
  const pick=n=>{ inp.value=""; items=[]; draw(); onSubmit(n,true); };
  inp.oninput=()=>{ const q=norm(inp.value); sel=-1;
    items = q.length<2||!pool.length ? [] : pool.filter(n=>{ const nn=norm(n); return nn.startsWith(q)||nn.includes(" "+q)||(q.length>=3&&nn.includes(q)); }).slice(0,6);
    draw(); };
  inp.onkeydown=ev=>{
    if(ev.key==="ArrowDown"){ sel=Math.min(items.length-1,sel+1); draw(); ev.preventDefault(); }
    else if(ev.key==="ArrowUp"){ sel=Math.max(-1,sel-1); draw(); ev.preventDefault(); }
    else if(ev.key==="Enter"){ ev.preventDefault();
      if(sel>=0) return pick(items[sel]);
      if(opts.strict){ if(items.length===1) return pick(items[0]); const ex=pool.find(n=>norm(n)===norm(inp.value)); if(ex) return pick(ex); flash("Choisis un joueur dans la liste","bad"); return; }
      const v=inp.value.trim(); if(v){ inp.value=""; items=[]; draw(); onSubmit(v,false); } }
  };
  if(!opts.noFocus) setTimeout(()=>inp.focus(),30);
}
function flash(msg,kind){ const f=document.getElementById("flash"); if(f){ f.innerHTML=`<span class="${kind||""}">${esc(msg)}</span>`; clearTimeout(flash._t); flash._t=setTimeout(()=>{ if(f.isConnected) f.innerHTML=""; },2200);} }
const hearts = n => "❤️".repeat(Math.max(0,n))+"🖤".repeat(Math.max(0,3-n));

// ═════════════════════════ LES JEUX ═════════════════════════
const G = {};

// ── Questions chronométrées (quiz + imposteur) ──
function mcqGame(builder, base, bonus, n, opts={}){
  const T=20000; let raf=null, qStart=0, locked=false;
  const g = {
    init:()=>({shown:0, answers:[]}),
    data:builder,
    resume(){ const st=S.play.e.st; while(st.answers.length<st.shown && st.answers.length<n) st.answers.push({c:false,p:0,k:-1}); },
    render(){
      const z=S.play, st=z.e.st, idx=st.answers.length;
      if(idx>=n) return finishGame();
      if(st.shown<idx+1){ st.shown=idx+1; save(); }
      const q=z.data[idx];
      const dots=[...Array(n)].map((_,i)=>{ const a=st.answers[i]; return `<i class="${a?(a.c?"ok":"ko"):(i===idx?"cur":"")}"></i>`; }).join("");
      app.innerHTML = playHead(`${idx+1}/${n}`)+`<div class="dots">${dots}</div><div class="timer"><div id="tbar"></div></div>
        <div class="card">${q.club?`<div class="center" style="margin-bottom:10px">${clubChip(q.club,60)}</div>`:`<span class="cat">${esc(q.cat)}</span>`}
        <div class="q">${esc(q.q)}</div>
        <div class="opts">${q.opts.map((o,i)=>`<button class="opt" data-i="${i}">${esc(o.t)}</button>`).join("")}</div><div class="flash" id="flash"></div></div>`;
      app.querySelectorAll(".opt").forEach(b=>b.onclick=()=>answer(+b.dataset.i));
      locked=false; qStart=performance.now(); cancelAnimationFrame(raf); tick();
    },
    recap(date,e,legacy){
      const qs = legacy ? legacyQuizItems(date) : builder(date);
      return qs.slice(0,n).map((q,i)=>{ const a=(e.st.answers||[])[i]||{k:-1,c:false}; const right=q.opts.find(o=>o.ok).t;
        return `<div class="it"><b>${i+1}. ${esc(q.q)}</b>${a.c?`<span class="good">✓ ${esc(right)}</span> · +${a.p}`:`<span class="bad">✗ ${a.k>=0?esc(q.opts[a.k].t):"pas de réponse"}</span> — ${opts.okLabel||"bonne réponse"} : <span class="good">${esc(right)}</span>`}</div>`; }).join("");
    }
  };
  function tick(){
    const bar=document.getElementById("tbar"); if(!bar) return;
    const left=Math.max(0,T-(performance.now()-qStart));
    bar.style.transform=`scaleX(${left/T})`; bar.style.background=left<5000?"var(--red)":"var(--yellow)";
    if(left<=0) return answer(-1);
    raf=requestAnimationFrame(tick);
  }
  function answer(k){
    if(locked) return; locked=true; cancelAnimationFrame(raf);
    const z=S.play, st=z.e.st, q=z.data[st.answers.length];
    const left=Math.max(0,T-(performance.now()-qStart)), ok=k>=0&&q.opts[k].ok, p=ok?base+Math.round(bonus*left/T):0;
    st.answers.push({c:ok,p,k}); z.e.score=(z.e.score||0)+p; save();
    app.querySelectorAll(".opt").forEach((b,i)=>{ b.disabled=true; if(q.opts[i].ok) b.classList.add("ok"); else if(i===k) b.classList.add("ko"); });
    document.getElementById("flash").innerHTML = ok?`<span class="good">But ! +${p}</span>`:`<span class="bad">${k<0?"Temps écoulé":"Raté"}</span>`;
    app.querySelector(".score").textContent=z.e.score;
    setTimeout(()=>{ if(S.view==="play") g.render(); }, ok?1100:1700);
  }
  return g;
}
G.quiz = mcqGame(quizItems,100,50,10);
G.imposteur = mcqGame(imposteurItems,200,100,5,{okLabel:"l'imposteur était"});

// ── Parcours (saisie libre, petite marge d'erreur) ──
G.parcours = {
  init:()=>({i:0, r:1, wrong:[], res:[]}),
  data:parcoursItems,
  render(){
    const z=S.play, st=z.e.st;
    if(st.res.length>=5 && !st.show) return finishGame();
    const it=z.data[st.i], name=display(it.a), clubs=it.clubs;
    const dots=[...Array(5)].map((_,i)=>{ const r=st.res[i]; return `<i class="${r?(r.ok?"ok":"ko"):(i===st.i?"cur":"")}"></i>`; }).join("");
    const shown = st.show ? clubs.length : st.r;
    const path = clubs.map((c,i)=> i<shown ? clubChip(c) : `<div class="club hidden"><div class="qmark">?</div><span>&nbsp;</span></div>`).join(`<div class="arrow">›</div>`);
    const pts=Math.max(100,300-40*(st.r-1));
    let bottom;
    if(st.show){ const r=st.res[st.res.length-1];
      bottom=`<div class="reveal ${r.ok?"ok":"ko"}"><div class="display" style="font-size:26px">${r.ok?"Trouvé ! +"+r.p:"Raté…"}</div><div>C'était <b>${esc(name)}</b> ${NAT[it.nat][1]}</div></div>
        <button class="btn" id="next">${st.res.length>=5?"Voir mon score":"Joueur suivant"}</button>`; }
    else bottom = `<input class="txt" id="pin" placeholder="Tape le nom du joueur puis Entrée" autocomplete="off" autocapitalize="off" spellcheck="false" style="margin:0 0 10px">
        <button class="btn" id="ok" style="margin-bottom:8px">Valider</button>
        <div class="row2"><button class="btn ghost" id="hint" ${st.r>=clubs.length?"disabled":""}>Club suivant</button><button class="btn ghost" id="skip">Je passe</button></div>
        ${st.wrong.length?`<div class="wrong">${st.wrong.map(w=>`<span>✗ ${esc(w)}</span>`).join("")}</div>`:""}<div class="flash" id="flash"></div>`;
    app.innerHTML = playHead(`joueur ${Math.min(st.i+1,5)}/5`)+`<div class="dots">${dots}</div>
      <div class="card">${it.expert?`<span class="lvl">Pour les aguerris</span>`:`<span class="lvl easy">Classique</span>`}
      <div class="note" style="margin:8px 0 10px">${clubs.length} clubs dans sa carrière${st.show?"":` · cette réponse vaut <b style="color:var(--yellow)">${pts} pts</b>`}</div>
      <div class="path">${path}</div></div><div class="card">${bottom}</div>`;
    if(st.show){ document.getElementById("next").onclick=()=>{ st.show=false; st.i++; st.r=1; st.wrong=[]; save(); G.parcours.render(); }; return; }
    const inp=document.getElementById("pin"); setTimeout(()=>inp.focus(),30);
    const submit=()=>{ const v=inp.value.trim(); if(!v) return; inp.value="";
      if(matchItem(v,[it.a])===0) return end(true);
      st.wrong.push(v);
      if(st.r<clubs.length){ st.r++; save(); G.parcours.render(); flash("Non ! Club suivant dévoilé","bad"); }
      else end(false); };
    inp.onkeydown=ev=>{ if(ev.key==="Enter"){ ev.preventDefault(); submit(); } };
    document.getElementById("ok").onclick=submit;
    document.getElementById("hint").onclick=()=>{ if(st.r<clubs.length){ st.r++; save(); G.parcours.render(); } };
    document.getElementById("skip").onclick=()=>end(false);
    function end(ok){ const p=ok?pts:0; st.res.push({ok,p,r:st.r}); z.e.score+=p; st.show=true; save(); G.parcours.render(); }
  },
  recap(date,e){
    return parcoursItems(date).map((it,i)=>{ const r=(e.st.res||[])[i]||{ok:false,p:0,r:0};
      return `<div class="it"><b>${r.ok?`<span class="good">✓</span>`:`<span class="bad">✗</span>`} ${esc(display(it.a))} ${NAT[it.nat][1]} ${it.expert?`<small class="note">(aguerris)</small>`:""} ${r.ok?`· +${r.p} (${r.r} club${r.r>1?"s":""})`:""}</b><span class="note">${it.clubs.map(esc).join(" › ")}</span></div>`; }).join("");
  }
};

// ── Joueur mystère (3 indices de départ + indices progressifs, saisie libre) ──
G.mystere = {
  init:()=>({shown:0, guesses:[], won:false}),
  data:mystereTarget,
  render(){
    const z=S.play, st=z.e.st, t=z.data, N=t.clues.length;
    const over = st.won || st.lost || st.gaveUp;
    const pts = Math.max(300, MAXPTS-200*st.shown);
    const base=`<div class="mbase"><div><span>Nationalité</span><b>${NAT[t.nat][1]} ${esc(NAT[t.nat][0])}</b></div><div><span>Poste</span><b>${esc(POS[t.pos])}</b></div><div><span>Né ${t.auto?"":"le"}</span><b>${esc(t.auto?t.born.replace("en ",""):t.born)}</b></div></div>`;
    const clues=t.clues.map((c,i)=> i<st.shown||over ? `<div class="clue ${i<st.shown?"":"late"}"><span>${i+1}</span>${esc(c)}</div>` : `<div class="clue locked"><span>${i+1}</span>Indice verrouillé</div>`).join("");
    let bottom;
    if(over) bottom=`<div class="reveal ${st.won?"ok":"ko"}"><div class="display" style="font-size:26px">${st.won?"Trouvé ! +"+z.e.score:"Raté !"}</div><div>Le joueur mystère : <b>${esc(display(t.a))}</b></div></div><button class="btn" id="fin">Voir mon score</button>`;
    else bottom=`<input class="txt" id="pin" placeholder="Qui est-ce ? Tape un nom puis Entrée" autocomplete="off" autocapitalize="off" spellcheck="false" style="margin:0 0 10px">
      <button class="btn" id="ok" style="margin-bottom:8px">Valider</button>
      <div class="row2"><button class="btn ghost" id="hint" ${st.shown>=N?"disabled":""}>Indice suivant (−200)</button><button class="btn ghost small" id="give">Abandonner</button></div>
      <p class="note">Ta réponse vaut <b style="color:var(--yellow)">${pts} pts</b>. Une mauvaise réponse dévoile l'indice suivant${st.shown>=N?" — dernière chance !":"."}</p>
      ${st.guesses.length?`<div class="wrong">${st.guesses.map(w=>`<span>✗ ${esc(w)}</span>`).join("")}</div>`:""}<div class="flash" id="flash"></div>`;
    app.innerHTML = playHead(`${st.shown}/${N} indices`)+`<div class="card">${base}<div class="clues">${clues}</div></div><div class="card">${bottom}</div>`;
    if(over){ document.getElementById("fin").onclick=finishGame; return; }
    const inp=document.getElementById("pin"); setTimeout(()=>inp.focus(),30);
    const submit=()=>{ const v=inp.value.trim(); if(!v) return; inp.value="";
      if(matchItem(v,[t.a])===0){ st.won=true; z.e.score=pts; save(); return G.mystere.render(); }
      st.guesses.push(v);
      if(st.shown<N){ st.shown++; save(); G.mystere.render(); flash("Non ! Nouvel indice dévoilé","bad"); }
      else { st.lost=true; save(); G.mystere.render(); } };
    inp.onkeydown=ev=>{ if(ev.key==="Enter"){ ev.preventDefault(); submit(); } };
    document.getElementById("ok").onclick=submit;
    document.getElementById("hint").onclick=()=>{ if(st.shown<N){ st.shown++; save(); G.mystere.render(); } };
    document.getElementById("give").onclick=()=>{ st.gaveUp=true; save(); G.mystere.render(); };
  },
  recap(date,e){ const t=mystereTarget(date);
    return `<div class="it"><b>Le joueur mystère : ${esc(display(t.a))} ${NAT[t.nat][1]}</b><span class="note">${esc(POS[t.pos])} · né ${t.auto?"":"le "}${esc(t.born)}</span></div>`
      + t.clues.map((c,i)=>`<div class="it note">${i<(e.st.shown||0)?"🔓":"🔒"} ${esc(c)}</div>`).join("")
      + `<div class="it"><b>Tes essais ratés</b>${(e.st.guesses||[]).map(esc).join(", ")||"aucun"}</div>`; }
};

// ── Liste à compléter (Top liste + Onze manquant) ──
function listGame(getItem, kind){
  const answersOf = it => kind==="onze" ? it.slots.map(s=>s[3]) : it.items.map(x=>x.a);
  const g = {
    init:()=>({found:[], wrong:[], lives:3}),
    data:getItem,
    render(){
      const z=S.play, st=z.e.st, it=z.data, ans=answersOf(it), N=ans.length;
      const over = st.found.length>=N || st.lives<=0 || st.gaveUp;
      let board;
      if(kind==="onze"){
        board=`<div class="pitch"><div class="pl c"></div><div class="pl b1"></div><div class="pl b2"></div>${it.slots.map((s,i)=>{ const f=st.found.includes(i);
          const surname=display(s[3]).split(" ").slice(-1)[0];
          return `<div class="slot ${f?"f":over?"miss":""}" style="left:${s[1]}%;top:${s[2]}%"><div class="shirt">${s[0]}</div><span>${f||over?esc(surname):"?"}</span></div>`; }).join("")}</div>`;
      } else {
        board=`<div class="tlist">${it.items.map((x,i)=>{ const f=st.found.includes(i);
          return `<div class="titem ${f?"f":over?"miss":""}"><span class="tl">${esc(x.l)}</span><span>${f||over?esc(display(x.a)):"—"}</span></div>`; }).join("")}</div>`;
      }
      const ph = kind==="onze" ? "Tape un titulaire…" : kind==="top"&&it.kind==="pays" ? "Tape un pays…" : it.kind==="clubs" ? "Tape un club…" : "Tape un joueur…";
      const bottom = over
        ? `<div class="reveal ${st.found.length>=N?"ok":"ko"}"><div class="display" style="font-size:24px">${st.found.length}/${N} trouvés · +${z.e.score}</div></div><button class="btn" id="fin">Voir mon score</button>`
        : acField(ph)+`<div class="row2"><span>${hearts(st.lives)}</span><button class="btn ghost small" id="give">J'arrête là</button></div>
          ${st.wrong.length?`<div class="wrong">${st.wrong.map(w=>`<span>✗ ${esc(w)}</span>`).join("")}</div>`:""}<div class="flash" id="flash"></div>`;
      app.innerHTML = playHead(`${st.found.length}/${N}`)+`<div class="card"><div class="display" style="font-size:22px;line-height:1.15">${esc(it.t)}</div>
        ${it.s?`<div class="note" style="margin-top:4px">${esc(it.s)} · compo de ${esc(it.team)}</div>`:""}</div>
        <div class="card">${bottom}</div><div class="card">${board}</div>`;
      if(over){ document.getElementById("fin").onclick=finishGame; return; }
      const pool = it.kind==="joueurs" ? PNAMES : [];
      bindAc(pool, v=>{
        const rest = ans.map((a,i)=>st.found.includes(i)?null:a);
        const i = matchItem(v, rest.map(a=>a||"\u0000"));
        if(i>=0 && rest[i]){ st.found.push(i); z.e.score=Math.round(MAXPTS*st.found.length/N); save(); g.render(); flash("✓ "+display(ans[i]),"good"); return; }
        if(matchItem(v, ans)>=0){ flash("Déjà trouvé !",""); return; }
        st.wrong.push(v); st.lives--; save(); g.render(); flash(st.lives>0?"Non ! Il te reste "+st.lives+" vie"+(st.lives>1?"s":""):"Plus de vies…","bad");
      }, {});
      document.getElementById("give").onclick=()=>{ st.gaveUp=true; save(); g.render(); };
    },
    recap(date,e){
      const it=getItem(date), ans=answersOf(it), f=e.st.found||[];
      const head=`<div class="it"><b>${esc(it.t)}</b>${it.s?`<span class="note">${esc(it.s)}</span>`:""}</div>`;
      return head+ans.map((a,i)=>`<div class="it">${f.includes(i)?`<span class="good">✓</span>`:`<span class="bad">✗</span>`} ${kind==="onze"?`<span class="note">${it.slots[i][0]}</span> `:`<span class="note">${esc(it.items[i].l)}</span> · `}${esc(display(a))}</div>`).join("")
        +((e.st.wrong||[]).length?`<div class="it note">Erreurs : ${e.st.wrong.map(esc).join(", ")}</div>`:"");
    }
  };
  return g;
}
G.top = listGame(topItem,"top");
G.onze = listGame(onzeItem,"onze");

// ── Plus ou moins ──
G.plusmoins = {
  init:()=>({rounds:[], over:false}),
  data:()=>null,
  render(){
    const z=S.play, st=z.e.st, i=st.rounds.length;
    if(!st.over && i>=15) st.over=true;
    if(st.over && !st.reveal){
      app.innerHTML = playHead(`série de ${st.rounds.filter(r=>r.ok).length}`)+`<div class="card center"><div class="display" style="font-size:28px">${st.rounds.every(r=>r.ok)?"Sans-faute !":"Fin de la série"}</div>
        <p class="note" style="margin:8px 0 16px">${st.rounds.filter(r=>r.ok).length} bonne${st.rounds.filter(r=>r.ok).length>1?"s":""} réponse${st.rounds.filter(r=>r.ok).length>1?"s":""} d'affilée</p><button class="btn" id="fin">Voir mon score</button></div>`;
      document.getElementById("fin").onclick=finishGame; return;
    }
    const idx = st.reveal ? i-1 : i;
    const R=pmRound(z.date,idx), last=st.reveal?st.rounds[idx]:null;
    const card=(x,side)=>{ const win = R.low ? x[1]<(side==="a"?R.b:R.a)[1] : x[1]>(side==="a"?R.b:R.a)[1];
      const cls = last ? (win?"win":"lose")+(last.pick===side?" picked":"") : "";
      const isClub=R.unit==="fondé en";
      return `<button class="pmcard ${cls}" data-s="${side}" ${last?"disabled":""}>${isClub?badge(x[0],56):""}<div class="pmname">${esc(x[0])}</div>
        <div class="pmval">${last?`${R.pre?esc(R.pre):""}<b>${x[1]}</b>${R.pre?"":" "+esc(R.unit)}`:"?"}</div></button>`; };
    const dots=[...Array(15)].map((_,k)=>{ const r=st.rounds[k]; return `<i class="${r?(r.ok?"ok":"ko"):(k===idx?"cur":"")}"></i>`; }).join("");
    app.innerHTML = playHead(`duel ${idx+1}/15`)+`<div class="dots">${dots}</div><div class="card"><div class="q center">${esc(R.q)}</div>
      <div class="pm">${card(R.a,"a")}<div class="vs">VS</div>${card(R.b,"b")}</div><div class="flash" id="flash"></div>
      ${last?`<button class="btn" id="nx">${last.ok?(idx+1>=15?"Terminer":"Duel suivant"):"Voir la fin"}</button>`:""}</div>`;
    if(last){ document.getElementById("flash").innerHTML=last.ok?`<span class="good">Bien vu ! +100</span>`:`<span class="bad">Perdu !</span>`;
      document.getElementById("nx").onclick=()=>{ st.reveal=false; if(!last.ok||idx+1>=15) st.over=true; save(); G.plusmoins.render(); }; return; }
    app.querySelectorAll(".pmcard").forEach(b=>b.onclick=()=>{
      const s=b.dataset.s, x=s==="a"?R.a:R.b, y=s==="a"?R.b:R.a, ok=R.low?x[1]<y[1]:x[1]>y[1];
      st.rounds.push({pick:s,ok}); if(ok) z.e.score+=100; st.reveal=true; save(); G.plusmoins.render();
    });
  },
  recap(date,e){ return (e.st.rounds||[]).map((r,i)=>{ const R=pmRound(date,i);
    return `<div class="it">${r.ok?`<span class="good">✓</span>`:`<span class="bad">✗</span>`} <b style="display:inline">${esc(R.a[0])}</b> (${R.a[1]}) vs <b style="display:inline">${esc(R.b[0])}</b> (${R.b[1]}) <span class="note">· ${esc(R.unit)}</span></div>`; }).join("")||`<div class="empty">Aucun duel joué.</div>`; }
};

// ═════════════════════════ DÉMARRAGE ═════════════════════════
