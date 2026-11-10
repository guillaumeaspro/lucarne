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

// ── Appli installable + notifications push ──
const isIOS=/iphone|ipad|ipod/i.test(navigator.userAgent);
const isStandalone=()=>{ try{ return matchMedia("(display-mode: standalone)").matches || navigator.standalone===true; }catch(_){ return false; } };
const pushOK=()=>"serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
let installEvt=null, swReg=null, pushState="?";
window.addEventListener("beforeinstallprompt",e=>{ e.preventDefault(); installEvt=e; if(S.view==="home") render(); });
const b64=s=>{ const p="=".repeat((4-s.length%4)%4), b=atob((s+p).replace(/-/g,"+").replace(/_/g,"/")); return Uint8Array.from([...b].map(c=>c.charCodeAt(0))); };
async function refreshPushState(){
  if(!pushOK()||!swReg){ pushState="na"; return; }
  if(Notification.permission==="denied"){ pushState="denied"; return; }
  const sub=await swReg.pushManager.getSubscription(); pushState=sub?"on":"off";
}
async function enablePush(){
  try{
    const perm=await Notification.requestPermission();
    if(perm!=="granted"){ pushState=perm==="denied"?"denied":"off"; render(); return; }
    const {publicKey}=await (await fetch("/api/push")).json();
    let sub=await swReg.pushManager.getSubscription();
    if(!sub) sub=await swReg.pushManager.subscribe({userVisibleOnly:true, applicationServerKey:b64(publicKey)});
    const r=await fetch("/api/push",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:S.uid,secret:ident.secret,sub:sub.toJSON()})});
    if(!r.ok) throw new Error(r.status);
    pushState="on";
  }catch(e){ S.err="Impossible d'activer les notifications pour le moment, réessaie."; }
  render();
}
async function disablePush(){
  try{ const sub=await swReg.pushManager.getSubscription(); if(sub){ await fetch("/api/push",{method:"DELETE",headers:{"Content-Type":"application/json"},body:JSON.stringify({endpoint:sub.endpoint})}); await sub.unsubscribe(); } }catch(_){}
  pushState="off"; render();
}
function appCard(full){
  if(S.test) return "";
  const inst=isStandalone();
  if(inst && pushState==="on") return `<div class="card appcard"><h2>L'appli</h2><p class="note">Appli installée, notifications activées. <a href="#" id="pushoff">Désactiver les notifications</a></p></div>`;
  let body="";
  if(!inst){
    if(isIOS) body+=`<p class="note"><b>Installer sur iPhone</b> (obligatoire pour les notifs) : dans Safari, touche <b>Partager</b> puis <b>« Sur l'écran d'accueil »</b>, et ouvre Lucarne depuis son icône.</p>`;
    else if(installEvt) body+=`<button class="btn" id="install">Installer l'appli sur mon téléphone</button>`;
    else body+=`<p class="note"><b>Installer l'appli</b> : menu du navigateur <span class="kbd">⋮</span> puis <b>« Installer l'application »</b> ou <b>« Ajouter à l'écran d'accueil »</b>.</p>`;
  } else body+=`<p class="note">Appli installée.</p>`;
  if(pushState==="off" && (!isIOS||inst)) body+=`<button class="btn${inst?"":" ghost"}" id="pushon" style="margin-top:8px">Activer les notifications</button><p class="note" style="margin-top:6px">Un rappel chaque matin quand le jeu ouvre, et le récap de la semaine.</p>`;
  if(pushState==="denied") body+=`<p class="note">Les notifications sont bloquées : autorise-les dans les réglages du téléphone (Notifications → Lucarne).</p>`;
  return `<div class="card appcard"><h2>L'appli et les notifs</h2>${body}</div>`;
}
// Bandeau d'une ligne sur l'onglet Jouer, seulement s'il manque quelque chose
function appBanner(){
  if(S.test) return "";
  const inst=isStandalone();
  if(inst && pushState!=="off") return "";
  if(!inst && (isIOS || !installEvt)) return `<button class="appbanner" data-goto="infos"><span>Installe l'appli pour recevoir les notifs</span><b>Comment ›</b></button>`;
  if(!inst && installEvt) return `<button class="appbanner" id="install"><span>Installe Lucarne sur ton téléphone</span><b>Installer</b></button>`;
  if(pushState==="off") return `<button class="appbanner" id="pushon2"><span>Active les notifs pour ne rater aucun jeu</span><b>Activer</b></button>`;
  return "";
}
function bindAppCard(){
  const i=document.getElementById("install"); if(i) i.onclick=async()=>{ installEvt.prompt(); try{ await installEvt.userChoice; }catch(_){} installEvt=null; render(); };
  const on=document.getElementById("pushon"); if(on) on.onclick=enablePush;
  const on2=document.getElementById("pushon2"); if(on2) on2.onclick=enablePush;
  const off=document.getElementById("pushoff"); if(off) off.onclick=e=>{ e.preventDefault(); disablePush(); };
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
    document.querySelectorAll(".cd").forEach(el=>{ el.textContent=(el.dataset.short?cdShort:cdText)(+el.dataset.t-Date.now()); });
    const t=todayStr(); if(t!==S.today){ S.today=t; if(!S.test){ S.week=weekOf(t); if(S.view==="home"||S.view==="result") render(); } }
  }, 1000);
  const slow=setTimeout(()=>{ S.slow=true; if(S.view==="loading") render(); },10000);
  if("serviceWorker" in navigator){ try{ swReg=await navigator.serviceWorker.register("/sw.js"); await navigator.serviceWorker.ready; }catch(_){} }
  try{ await refreshPushState(); }catch(_){ pushState="na"; }
  try{ await pull(); }catch(_){ S.err="Le classement n'est pas joignable pour le moment. Tu peux jouer quand même : ton score sera envoyé plus tard."; }
  clearTimeout(slow); afterLoad();
  // rafraîchit le classement toutes les minutes et au retour sur l'appli
  const refresh=async()=>{ try{ await pull(); if(S.err&&S.err.startsWith("Le classement")) S.err=""; if(S.view==="home") render(); }catch(_){} };
  setInterval(refresh, 60000);
  document.addEventListener("visibilitychange",()=>{ if(document.visibilityState==="visible") refresh(); });
}
init();
