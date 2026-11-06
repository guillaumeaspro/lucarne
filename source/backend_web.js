// ═════ Stockage : site autonome (Vercel) — API /api/state + copie locale ═════
// Chaque joueur a un identifiant et un code secret gardés dans son navigateur.
// Sa propre fiche fait foi en local ; le serveur rassemble les fiches de tout le monde pour le classement.
const LS_ME="lucarne-me", LS_ID="lucarne-id";
function lsGet(k){ try{ return JSON.parse(localStorage.getItem(k)); }catch(_){ return null; } }
function lsSet(k,v){ try{ localStorage.setItem(k,JSON.stringify(v)); }catch(_){} }
function newToken(n){ const a=new Uint8Array(n); crypto.getRandomValues(a); return [...a].map(b=>b.toString(36).padStart(2,"0")).join("").slice(0,n*2); }

let ident = lsGet(LS_ID);
let wq = Promise.resolve(), syncTimer=null;

function myDoc(){ return S.players[S.uid] || {days:{}}; }
function persist(patch){
  if(S.test){ if(patch.days) Object.assign(testBox.days, JSON.parse(JSON.stringify(patch.days))); return wq; }
  const cur = JSON.parse(JSON.stringify(myDoc()));
  if(patch.pseudo!==undefined) cur.pseudo=patch.pseudo;
  if(patch.days){ cur.days=cur.days||{}; Object.assign(cur.days, JSON.parse(JSON.stringify(patch.days))); }
  if(patch.fullWeeks){ cur.fullWeeks=Object.assign(cur.fullWeeks||{}, patch.fullWeeks); }
  cur.u=Date.now();
  S.players[S.uid]=cur; lsSet(LS_ME,cur);
  // on n'envoie au serveur que ce qui compte pour le classement (pseudo, partie terminée) ;
  // l'avancement d'une partie en cours reste sur le téléphone
  const important = patch.pseudo!==undefined || patch.fullWeeks || (patch.days && Object.values(patch.days).some(e=>e&&e.done));
  if(important) queueSync(0);
  return wq;
}
function publicDoc(d){ // on n'envoie que les parties terminées
  const days={}; for(const [k,e] of Object.entries(d.days||{})) if(e&&e.done) days[k]=e;
  return {pseudo:d.pseudo||"", days, fullWeeks:d.fullWeeks||{}};
}
function queueSync(delay){ clearTimeout(syncTimer); syncTimer=setTimeout(()=>{ wq=wq.then(pushMe); }, delay); }
async function pushMe(){
  const d=myDoc(); if(!d.pseudo) return;
  for(let attempt=0; attempt<3; attempt++){
    try{
      const r=await fetch("/api/state",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:S.uid,secret:ident.secret,doc:publicDoc(d)})});
      if(r.status===403){ S.err="Ce code joueur est déjà utilisé par quelqu'un d'autre."; break; }
      if(!r.ok) throw new Error(r.status);
      if(S.err&&S.err.startsWith("Impossible")){ S.err=""; if(S.view==="home") render(); }
      return;
    }catch(_){ await new Promise(res=>setTimeout(res,1500*(attempt+1))); }
  }
  S.err="Impossible d'enregistrer ton score pour le moment : il sera envoyé automatiquement à ta prochaine connexion.";
  if(S.view==="home") render();
}
async function pull(){
  const r=await fetch("/api/state?t="+Math.floor(Date.now()/10000),{cache:"no-store"});
  if(!r.ok) throw new Error(r.status);
  const data=await r.json(), players=data.players||{};
  const mine=myDoc(), server=players[S.uid];
  // ma fiche locale fait foi ; si le serveur est en retard (ou m'a perdu), on renvoie
  players[S.uid]=mine;
  S.players=players;
  if(mine.pseudo){
    const doneLocal=Object.values(mine.days||{}).filter(e=>e&&e.done).length;
    const doneServer=server?Object.keys(server.days||{}).length:-1;
    if(!server || doneServer<doneLocal || server.pseudo!==mine.pseudo) queueSync(500);
  }
}

// ── Récupérer son profil sur un autre appareil ──
function myCode(){ return S.uid+"-"+ident.secret; }
function showCode(){
  const ov=document.createElement("div"); ov.className="modal";
  ov.innerHTML=`<div class="mbox" style="text-align:left"><div class="display" style="font-size:26px;margin-bottom:8px">Mon code joueur</div>
    <p class="note" style="margin-bottom:10px">Garde ce code précieusement : il te permet de retrouver ton profil et tes points sur un autre téléphone ou navigateur. Ne le donne à personne.</p>
    <input class="txt" id="mycode" readonly value="${esc(myCode())}" style="font-size:14px">
    <button class="btn" id="cpy" style="margin-bottom:14px">Copier mon code</button>
    <div class="display" style="font-size:20px;margin:6px 0">Changer d'appareil ?</div>
    <p class="note" style="margin-bottom:8px">Colle ici le code de ton ancien appareil pour récupérer ton profil.</p>
    <input class="txt" id="incode" placeholder="Colle ton code joueur">
    <button class="btn ghost" id="use" style="margin-bottom:8px">Récupérer ce profil</button>
    <button class="btn ghost" id="close">Fermer</button><div class="flash" id="cflash"></div></div>`;
  document.body.appendChild(ov);
  const f=ov.querySelector("#cflash");
  ov.querySelector("#cpy").onclick=async()=>{ try{ await navigator.clipboard.writeText(myCode()); f.textContent="Copié !"; }catch(_){ ov.querySelector("#mycode").select(); f.textContent="Sélectionné : copie-le avec ton téléphone."; } };
  ov.querySelector("#close").onclick=()=>ov.remove();
  ov.querySelector("#use").onclick=async()=>{
    const v=ov.querySelector("#incode").value.trim(), m=v.match(/^([a-z0-9]{8,40})-([a-z0-9]{16,64})$/);
    if(!m){ f.textContent="Ce code n'a pas le bon format."; return; }
    try{
      const r=await fetch("/api/state?t="+Date.now(),{cache:"no-store"}); const data=await r.json(); const p=(data.players||{})[m[1]];
      if(!p){ f.textContent="Aucun joueur trouvé avec ce code."; return; }
      const chk=await fetch("/api/state",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:m[1],secret:m[2],check:true})});
      if(!chk.ok){ f.textContent="Code incorrect."; return; }
      ident={id:m[1],secret:m[2]}; lsSet(LS_ID,ident); S.uid=ident.id;
      const doc={pseudo:p.pseudo,days:p.days||{},fullWeeks:p.fullWeeks||{},u:Date.now()}; lsSet(LS_ME,doc); S.players[S.uid]=doc;
      ov.remove(); S.view="home"; render();
    }catch(_){ f.textContent="Connexion impossible, réessaie."; }
  };
}

// ═════════════════════════ DÉMARRAGE ═════════════════════════
function afterLoad(){
  if(S.view!=="loading") return;
  const m=me(); S.view=!(m&&m.pseudo) ? "pseudo" : "home"; render();
}
async function init(){
  // espace organisateur : ouvrir une fois le lien avec #orga sur son téléphone
  try{ if(location.hash==="#orga"){ localStorage.setItem("lucarne-orga","1"); history.replaceState(null,"",location.pathname); } S.isOwner=localStorage.getItem("lucarne-orga")==="1"; }catch(_){}
  if(!ident||!ident.id||!ident.secret){ ident={id:"p"+newToken(8), secret:newToken(16)}; lsSet(LS_ID,ident); }
  S.uid=ident.id;
  const saved=lsGet(LS_ME); if(saved) S.players[S.uid]=saved;
  render();
  setInterval(()=>{
    document.querySelectorAll(".cd").forEach(el=>{ el.textContent=cdText(+el.dataset.t-Date.now()); });
    const t=todayStr(); if(t!==S.today){ S.today=t; if(!S.test){ S.week=weekOf(t); if(S.view==="home"||S.view==="result") render(); } }
  }, 1000);
  const slow=setTimeout(()=>{ S.slow=true; if(S.view==="loading") render(); },10000);
  try{ await pull(); }catch(_){ S.err="Le classement n'est pas joignable pour le moment. Tu peux jouer quand même : ton score sera envoyé plus tard."; }
  clearTimeout(slow); afterLoad();
  // rafraîchit le classement toutes les minutes et au retour sur l'appli
  const refresh=async()=>{ try{ await pull(); if(S.err&&S.err.startsWith("Le classement")) S.err=""; if(S.view==="home") render(); }catch(_){} };
  setInterval(refresh, 60000);
  document.addEventListener("visibilitychange",()=>{ if(document.visibilityState==="visible") refresh(); });
}
init();
