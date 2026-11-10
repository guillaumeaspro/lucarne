// ═════ Stockage : base de données de l'artifact claude.ai ═════
let wq = Promise.resolve();
function persist(patch){
  if(S.test){ if(patch.days) Object.assign(testBox.days, JSON.parse(JSON.stringify(patch.days))); return wq; }
  if(patch.fullWeeks && S.solo){ local.fullWeeks=Object.assign(local.fullWeeks||{},patch.fullWeeks); return wq; }
  const cur = S.solo ? local : (S.players[S.uid] ? JSON.parse(JSON.stringify(S.players[S.uid])) : {days:{}});
  if(patch.pseudo!==undefined) cur.pseudo=patch.pseudo;
  if(patch.days){ cur.days=cur.days||{}; Object.assign(cur.days, JSON.parse(JSON.stringify(patch.days))); }
  if(patch.fullWeeks){ cur.fullWeeks=Object.assign(cur.fullWeeks||{}, patch.fullWeeks); }
  if(S.solo) return wq;
  const existed=!!S.players[S.uid]; S.players[S.uid]=cur;
  const ref=S.db.doc("players/"+S.uid);
  wq = wq.then(async()=>{
    try{ if(!existed && !S._created){ await ref.set(cur); S._created=true; } else await ref.update(patch); }
    catch(e){
      if(e && e.code==="unavailable"){ await new Promise(r=>setTimeout(r,800+Math.random()*800)); try{ await ref.update(patch); return; }catch(_){} }
      if(e && e.code==="invalid_argument"){ S.readOnly=true; S.err="Ton accès est en lecture seule : demande à l'organisateur de t'inviter pour pouvoir jouer."; }
      else S.err="Impossible d'enregistrer pour le moment. Vérifie ta connexion.";
      if(S.view!=="play") render();
    }
  });
  return wq;
}

function afterLoad(){
  if(S.view!=="loading") return;
  const m=me(); S.view=(!S.readOnly && !(m&&m.pseudo)) ? "pseudo" : "home"; render();
}
async function init(){
  render();
  setInterval(()=>{
    document.querySelectorAll(".cd").forEach(el=>{ el.textContent=(el.dataset.short?cdShort:cdText)(+el.dataset.t-Date.now()); });
    const t=todayStr(); if(t!==S.today){ S.today=t; if(!S.test){ S.week=weekOf(t); if(S.view==="home"||S.view==="result") render(); } }
  }, 1000);
  const C=window.claude;
  if(!C||!C.use){ S.solo=true; return afterLoad(); }
  let db=null,user=null;
  try{ [db,user]=await Promise.all([C.use("db"),C.use("user")]); }catch(_){}
  if(!db||!user){ S.solo=true; return afterLoad(); }
  S.db=db; S.user=user;
  try{ S.uid=await user.id(); }catch(_){}
  try{ S.isOwner=!!(await user.isOwner()); }catch(_){}
  if(!S.uid){ S.solo=true; return afterLoad(); }
  const slow=setTimeout(()=>{ S.slow=true; if(S.view==="loading") render(); },10000);
  db.collection("players").onSnapshot(async snap=>{
    const fresh={}; snap.docs.forEach(d=>{ if(d.exists) fresh[d.id]=d.data(); });
    if(S.players[S.uid] && snap.metadata.hasPendingWrites) fresh[S.uid]=S.players[S.uid];
    S.players=fresh;
    if(!snap.metadata.fromCache){ clearTimeout(slow); S.slow=false; }
    if(S.players[S.uid]) S._created=true;
    try{ const ids=Object.keys(fresh).concat(S.uid); const ps=await user.profiles(ids); for(const id of ids){ const n=ps&&ps[id]&&ps[id].name; if(n) S.names[id]=n; } }catch(_){}
    if(S.view==="loading") afterLoad(); else if(S.view==="home") render();
  }, ()=>{ clearTimeout(slow); S.err="Le classement n'est pas joignable pour le moment."; if(S.view==="loading") afterLoad(); else if(S.view==="home") render(); });
}
init();
