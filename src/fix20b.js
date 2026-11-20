/* ===== fix20b: taking opponents' cards — the rest (helper Q, 7 Nov) =====
   1. Auras / Equipment keep their attachment when someone gains control of them (CR 301.5c, 303.4): the 'give' carries
      what the permanent is attached to, and so does the trip back to its owner.
   2. A spell or ability whose target changes controller still sees it (same object, CR 110.2): stack targets follow the
      permanent to its new (player, id) on every client.
   3. Overlapping control effects in timestamp order (CR 613.7):
      - a permanent I control for good (or for as long as …) that is handed to its OWNER until end of turn (Reins of
        Power, Assault Suit-style) comes back to me when their effect ends;
      - a later control effect with no duration on a permanent I control only until end of turn (Act of Treason, then
        Agent of Treachery) replaces the earlier one;
      - "for as long as ~ remains on the battlefield" (Sower of Temptation) doesn't end when ~ merely changes controller.
      Reins of Power hands over borrowed creatures too.
   4. Dack Fayden's emblem: "Whenever you cast a spell that targets one or more permanents, gain control of those
      permanents" — only spells that target permanents, and it takes exactly those.
   5. Coveted Jewel: the attacking player gains control of it untapped ("Untap it" is the Jewel, not a creature).
   6. Assault Suit: "has haste, can't attack you or planeswalkers you control, and can't be sacrificed" — haste is
      granted, only the Suit's controller is protected from attacks, and the creature can't be sacrificed.
   7. Expropriate: for each money vote, the caster chooses a permanent owned by that voter and gains control of it.
   8. Public state shows a borrowed permanent's owner (r20own) so other players can find "permanents owned by …". */

const Q20 = {};
// ---------- 8. owner of a borrowed permanent in public state ----------
{ const cpe = cardPublicExtra; cardPublicExtra = function(c){ const o = cpe(c); try { if (c && c.own && c.own.pid) o.r20own = String(c.own.pid).slice(0, 40); } catch {} return o; }; }
function r20Owner(pid, c){ if (!c) return pid; if (pid === MYPID) return c.own ? c.own.pid : MYPID; return c.r20own || pid; }

// ---------- 1. attachments travel with a control change ----------
RQ_OPS.push('r20att', 'r20rev');
{
  const cf = cleanFlags;
  cleanFlags = function(f){ const o = cf(f); try { if (f && typeof f.r20att === 'string' && /^[A-Za-z0-9_-]{1,40}\|\d{1,9}$/.test(f.r20att)) o.r20att = f.r20att; if (f && typeof f.r20rv === 'string') o.r20rv = f.r20rv.slice(0, 12); if (f && typeof f.r20bk === 'string') o.r20bk = f.r20bk.slice(0, 12); } catch {} return o; };
  const ga = giveAway;
  giveAway = function(c, to, f = {}){ try { if (c && c.att && c.att.id != null && S.bf.includes(c)) f = {...(f || {}), r20att:String(c.att.pid) + '|' + c.att.id}; } catch {} return ga(c, to, f); };
  const tk = takeCard;
  takeCard = function(r, from){
    const before = new Set(S.bf.map(b => b.id)); const out = tk(r, from);
    try { if (r && r.f && r.f.r20att && r.c){ const nc = S.bf.find(b => !before.has(b.id) && b.k === r.c.k); const [pid, id] = r.f.r20att.split('|');
      if (nc && pid && (pid === MYPID ? S.bf.some(b => b.id === +id) : OPP.has(pid))){ nc.att = {pid, id:+id}; log(`${cname(nc)} stays attached (control changed, not what it's attached to)`); } } } catch (e){ console.warn('r20 att', e); }
    return out;
  };
  // back to the owner: tell them what it is attached to now
  const sb = sendBack;
  sendBack = function(c, to){ const att = c && to === 'bf' && c.own ? (c.att && c.att.id != null ? String(c.att.pid) + '|' + c.att.id : '') : null; const own = c && c.own ? {...c.own} : null;
    const r = sb(c, to); try { if (att !== null && own) sendRq(own.pid, 'r20att', 0, '', {ref:own.ref, d:att}); } catch {} return r; };
  const tb = takeBack;
  takeBack = function(r){ let card = null; try { const l = S.lent.find(x => x.ref === r.ref); if (l && r.d === 'bf') card = l.card; } catch {}
    const out = tb(r); try { if (card && S.bf.includes(card)){ (Q20.back ||= new Map()).set(r.ref, card); if (Q20.back.size > 60) Q20.back.delete(Q20.back.keys().next().value); r20AfterBack(card, r.ref); setTimeout(r20Resume, 0); } } catch (e){ console.warn('r20 back', e); } return out; };
  const ao = applyOp;
  applyOp = function(r, from){
    if (r && r.op === 'r20att'){ try { const c = Q20.back && Q20.back.get(r.ref); if (c && S.bf.includes(c)){ const d = String(r.d || ''); if (!d) delete c.att; else { const [pid, id] = d.split('|'); const p = pid === from ? from : pid; c.att = {pid:p, id:+id}; } commit(); } } catch (e){ console.warn('r20att', e); } return; }
    return ao(r, from);
  };
}

// ---------- 2. stack targets follow a permanent that changed controller ----------
{
  const rm = l19Remap;
  l19Remap = function(opid, oid, npid, nid){
    let ch = rm(opid, oid, npid, nid);
    try { for (const it of (S.stk || [])){ for (const g of (it.tgts || [])) for (const t of (Array.isArray(g) ? g : [g])){ if (t && t.t === 'card' && t.pid === opid && t.id === oid){ t.pid = npid; t.id = nid; ch = true; } }
      for (const t of (it.r20tg || [])) if (t.pid === opid && t.id === oid){ t.pid = npid; t.id = nid; } } } catch (e){ console.warn('r20 remap', e); }
    return ch;
  };
}

// ---------- 3. timestamps ----------
// (a) handing a permanent I borrowed to its owner until end of turn: when their effect ends it comes back to me
{
  const ga = giveAway;
  giveAway = function(c, to, f = {}){
    try {
      if (c && c.own && to === c.own.pid && f && f.eot && S.bf.includes(c) && !UI.dry){
        if (!c.eot){ const ref = rid(6); (S.r20hold ||= []).push({ref, k:c.k, owner:to, dur:c.l19dur ? {...c.l19dur} : null, r21by:c.r21by, t:Date.now()});
          sendRq(to, 'r20rev', 0, cname(c), {ref:c.own.ref, d:`${ref}|${f.untap ? 1 : 0}${f.haste ? 1 : 0}`}); }
        log(`${nameOf(to)} gains control of ${cname(c)} (they own it) until end of turn${c.eot ? '' : ' — then it comes back to me'}`);
        delete c.l19dur; sendBack(c, 'bf'); commit(); return;
      }
      // a borrowed permanent passed on to a third player until end of turn: its owner hands it back to me afterwards
      if (c && c.own && to !== c.own.pid && to !== MYPID && f && f.eot && !c.eot && S.bf.includes(c) && !UI.dry && OPP.has(c.own.pid)){
        const ref = rid(6); (S.r20hold ||= []).push({ref, k:c.k, owner:c.own.pid, dur:c.l19dur ? {...c.l19dur} : null, r21by:c.r21by, t:Date.now()});
        f = {...f, r20bk:ref};
      }
    } catch (e){ console.warn('r20 eot-owner', e); }
    return ga(c, to, f);
  };
  const ao = applyOp;
  applyOp = function(r, from){
    if (r && r.op === 'r20rev'){ try { const [ref, fl] = String(r.d || '').split('|'); const l = (S.lent || []).find(x => x.ref === r.ref); const c = l ? l.card : (Q20.back && Q20.back.get(r.ref));
        if (c){ (S.r20rev ||= []).push({cid:c.id, pid:from, ref, untap:fl && fl[0] === '1', haste:fl && fl[1] === '1', t:turnStr()}); if (S.bf.includes(c)) r20AfterBack(c, r.ref); commit(); } } catch (e){ console.warn('r20rev', e); } return; }
    return ao(r, from);
  };
  const tc = turnChanged;
  turnChanged = function(){ const r = tc(); r20Resume(); return r; };
  const rd = o19Redirect;
  o19Redirect = function(r, from){
    try { const to = String(r.d || ''); const l = (S.lent || []).find(x => x.ref === r.ref); if (l && l.card && r.f && r.f.r20bk && to !== MYPID) (S.r20rev ||= []).push({cid:l.card.id, pid:from, ref:r.f.r20bk, t:turnStr(), via:1}); } catch (e){ console.warn('r20 redir', e); }
    return rd(r, from);
  };
  const tk = takeCard;
  takeCard = function(r, from){
    const before = new Set(S.bf.map(b => b.id)); const out = tk(r, from);
    try { if (r && r.f && r.f.r20rv){ const i = (S.r20hold || []).findIndex(h => h.ref === r.f.r20rv); const nc = S.bf.find(b => !before.has(b.id) && r.c && b.k === r.c.k);
      if (i >= 0 && nc){ const h = S.r20hold.splice(i, 1)[0]; if (h.dur) nc.l19dur = h.dur; if (h.r21by != null) nc.r21by = h.r21by; nc.sk = false; log(`${cname(nc)} is mine again (my earlier control effect)`); } } } catch (e){ console.warn('r20 regain', e); }
    return out;
  };
}
// a temporary control effect on my card has ended: the earlier effect of the player who held it applies again
function r20Resume(){
  try { if (!S || !S.r20rev || !S.r20rev.length || UI.dry) return; const now = turnStr();
    S.r20rev = S.r20rev.filter(e => { const c = S.bf.find(b => b.id === e.cid); const lent = (S.lent || []).some(l => l.card && l.card.id === e.cid);
      if (!c) return lent;                 // still away (keep waiting) or gone for good
      if (c.own || e.t === now) return true;   // not back yet / its effect is still running
      log(`${cname(c)}: the "until end of turn" control effect has ended — ${nameOf(e.pid)}'s earlier control effect applies again`); giveAway(single(c), e.pid, {r20rv:e.ref}); return false; });
    commit(); } catch (e){ console.warn('r20 resume', e); }
}
// the owner got their card back from a holder whose effect resumes later: untap it / give it haste as their effect said
function r20AfterBack(c, ref){ const e = (S.r20rev || []).find(x => x.cid === c.id); if (!e || e.done) return; e.done = 1; if (e.untap){ c.tap = false; c.tn = 0; } if (e.haste) c.ekw = [...new Set([...(c.ekw || []), 'haste'])]; }

// (b) a later control effect without a duration on a permanent I already control replaces my temporary one
function r20Keep(c, why){ if (!c || !c.own) return false; if (!(c.eot || c.l19dur || c.r21by != null)) return false; delete c.eot; delete c.l19dur; delete c.r21by; log(`${cname(c)}: ${why} — I keep control of it (the later effect has no duration)`); commit(); return true; }
{
  const ao = applyOp;
  applyOp = function(r, from){
    if (r && r.op === 'steal' && from === MYPID){ const c = r.tid != null ? S.bf.find(b => b.id === r.tid) : null; if (c && !(r.f && r.f.eot)) r20Keep(c, r.src || 'gain control'); commit(); return; }
    return ao(r, from);
  };
  const ds = doSentence;
  doSentence = async function(s0, ctx){
    let grp = null;
    try { const l = String(s0).replace(/\.$/, '').trim().toLowerCase(); if (ctx && /^(?:you may )?gain control of (?:up to (?:one|\w+) )?(?:another )?target /.test(l) && !/until end of turn|for as long as|this turn|until your next turn|until the end of/.test(l)) grp = ((ctx.tgts || [])[ctx.ti || 0] || []).slice(); } catch {}
    const r = await ds(s0, ctx);
    try { if (grp && !UI.dry) for (const t of grp) if (t && t.t === 'card' && t.pid === MYPID) r20Keep(S.bf.find(b => b.id === t.id), ctx.name || 'gain control'); } catch (e){ console.warn('r20 keep', e); }
    return r;
  };
}
// (c) "for as long as ~ remains on the battlefield" survives ~ changing controller (it's still on the battlefield)
{
  const dur = l19DurOf;
  l19DurOf = function(clause){ const d = dur(clause); try { if (d && /^(?:~|this (?:creature|artifact|enchantment|permanent)|[a-z ,'\-]+) remains on the battlefield$/.test(String(clause || '').toLowerCase().trim())) d.bf = true; } catch {} return d; };
  const ex = l19Expect;
  l19Expect = function(pid, k, srcId, d){ ex(pid, k, srcId, d); try { if (d && d.bf) (Q20.bfDur ||= []).push({pid, k, src:srcId}); } catch {} };
  const tk = takeCard;
  takeCard = function(r, from){
    const before = new Set(S.bf.map(b => b.id)); const out = tk(r, from);
    try { const i = (Q20.bfDur || []).findIndex(x => x.pid === from && r.c && x.k === r.c.k); if (i >= 0){ const x = Q20.bfDur.splice(i, 1)[0]; const nc = S.bf.find(b => !before.has(b.id) && b.k === x.k && b.l19dur && b.l19dur.src === x.src); if (nc) nc.l19dur.bf = true; } } catch {}
    return out;
  };
  const lc = l19Check;
  l19Check = function(){
    const stash = [];
    try { for (const c of (S && S.bf) || []){ const d = c.l19dur; if (d && d.bf && !S.bf.some(b => b.id === d.src) && (S.lent || []).some(l => l.card && l.card.id === d.src)){ stash.push([c, d]); delete c.l19dur; } } } catch {}
    try { return lc(); } finally { stash.forEach(([c, d]) => { if (S.bf.includes(c)) c.l19dur = d; }); }
  };
}
// Reins of Power: every creature each player controls changes hands, borrowed ones included
{
  const rh = B26.h.reins;
  B26.h.reins = (r, from) => { try { const list = S.bf.filter(c => c.k && !c.fd && isCreatureCard(c)); list.forEach(c => { c.tap = false; giveAway(single(c), from, {eot:1, haste:1, untap:1}); }); commit(); } catch (e){ console.warn('r20 reins', e); return rh(r, from); } };
}

// ---------- 4–7. card effects ----------
// Dack Fayden's emblem: remember the permanents a spell targeted when it was cast
{
  const bc = beginCast;
  beginCast = async function(c, zone, o){ UI.r20tg = []; return bc(c, zone, o); };
  const ctg = chooseTargets;
  chooseTargets = async function(text, src, name){
    const r = await ctg(text, src, name);
    try { if (UI.castFrom){ const list = Array.isArray(r) ? r.flat(2) : []; UI.r20tg = list.filter(t => t && t.t === 'card' && t.id != null && boardOf(t.pid).some(b => b.id === t.id)).map(t => ({pid:t.pid, id:t.id, k:t.k, nm:t.nm})); } } catch {}
    return r;
  };
  const ct = classifyTrig;
  classifyTrig = function(w, c){ if (w === 'whenever' && /^you cast a spell that targets one or more permanents$/.test(c)) return {ev:'cast', subj:'any', ctl:'you', desc:'', r20perm:true}; return ct(w, c); };
  const pt = pushTrigger;
  pushTrigger = function(src, t, ev, evPid){
    if (t && t.r20perm){ if (!ev || ev.type !== 'cast' || evPid !== MYPID) return; const tg = (UI.r20tg || []).slice(); if (!tg.length) return;
      const n0 = S.stk.length; const r = pt(src, t, ev, evPid); if (S.stk.length > n0) S.stk[S.stk.length - 1].r20tg = tg; return r; }
    return pt(src, t, ev, evPid);
  };
}
STATIC_KNOWN.push(/^equipped creature gets \+2\/\+2, has haste, can't attack you or planeswalkers you control, and can't be sacrificed$/);
async function doFix20bPre(s, l, ctx){
  let m; const name = ctx.name || ''; const it = ctx.it || {}; const full = String(ctx.full || '').toLowerCase();
  // Dack Fayden's emblem
  if (/^gain control of those permanents$/.test(l) && (it.r20tg || UI.dry)){
    if (UI.dry) return true; let n = 0;
    for (const t of it.r20tg){ if (t.pid === MYPID){ r20Keep(S.bf.find(b => b.id === t.id), name); continue; } if (!targetStillThere(t)) continue; applyTo({t:'card', pid:t.pid, id:t.id, k:t.k}, {op:'steal', src:name, f:{}}); n++; }
    log(`${name}: gaining control of ${n} permanent${n === 1 ? '' : 's'} the spell targets`); commit(); return true;
  }
  // Coveted Jewel
  if ((m = l.match(/^that player draws three cards and gains control of (?:~|this artifact)$/)) && /untap it/.test(full)){
    const c = srcCardOf(ctx); const pid = it.evPid && it.evPid !== MYPID ? it.evPid : it.evDp; ctx.r20jewel = 1; if (UI.dry || !pid || pid === MYPID) return true;
    sendRq(pid, 'draw', 3, name); log(`${name}: ${nameOf(pid)} draws three cards`);
    if (c && S.bf.includes(c)){ c.tap = false; c.tn = 0; giveAway(single(c), pid, {untap:1}); } commit(); return true;
  }
  if (/^untap it$/.test(l) && ctx.r20jewel) return true;   // given untapped
  // Expropriate: for each money vote, choose a permanent owned by that voter and gain control of it
  if (/^for each money vote, choose a permanent owned by the voter and gain control of it$/.test(l) && (ctx.f19who || UI.dry)){
    if (UI.dry) return true; const taken = new Set();
    for (const [vp, vs] of Object.entries(ctx.f19who || {})){
      const n = (vs || []).filter(v => v === 'money').length;
      for (let i = 0; i < n; i++){
        const cands = []; for (const b of boardsAll()) for (const c of b.bf){ if (!c.k || c.emb || c.fd || b.pid === MYPID) continue; if (r20Owner(b.pid, c) !== vp || taken.has(b.pid + '|' + c.id)) continue; cands.push({pid:b.pid, id:c.id, k:c.k}); }
        if (!cands.length){ log(`${name}: ${vp === MYPID ? 'I' : nameOf(vp)} own${vp === MYPID ? '' : 's'} no permanent I don't already control — nothing to gain`); continue; }
        let pick = cands[0];
        if (cands.length > 1){ const ids = await pickCards({title:`${name}: money vote by ${vp === MYPID ? 'you' : nameOf(vp)} — gain control of a permanent ${vp === MYPID ? 'you own' : 'they own'}`, cards:cands.map((x, j) => ({id:-7000 - j, k:x.k})), min:1, max:1}); const j = ids && ids.length ? -7000 - ids[0] : 0; pick = cands[j] || cands[0]; }
        taken.add(pick.pid + '|' + pick.id); applyTo({t:'card', pid:pick.pid, id:pick.id, k:pick.k}, {op:'steal', src:name, f:{}});
        log(`${name}: gaining control of ${nameOf(pick.pid)}'s ${info(pick.k)?.n || 'permanent'} (money vote by ${nameOf(vp)})`);
      }
    }
    commit(); return true;
  }
  // Reins of Power, caster's side: hand over every creature I control (borrowed ones too)
  if (/^you and that opponent each gain control of all creatures the other controls until end of turn$/.test(l) && ctx.b26reins !== undefined){
    const pid = ctx.b26reins; if (!pid || pid === MYPID || UI.dry) return true;
    b26Ask(pid, 'reins', 0, name, '', false);
    S.bf.filter(c => c.k && !c.fd && isCreatureCard(c)).forEach(c => giveAway(single(c), pid, {eot:1, haste:1, untap:1})); commit(); return true;
  }
  return false;
}
{ const ds = doSentence; doSentence = async function(s0, ctx){ const s = String(s0).replace(/\.$/, '').trim(); const l = m24Low(s, ctx); if (l && ctx && await doFix20bPre(s, l, ctx)) return; return ds(s0, ctx); }; }

// ---------- 6. Assault Suit-style lists on Equipment / Auras ----------
// "Equipped creature gets +2/+2, has haste, can't attack you or planeswalkers you control, and can't be sacrificed."
{
  const af = attachFx;
  attachFx = function(c, pid = MYPID){
    const fx = af(c, pid); if (!fx || fx.r20 || !c) return fx; fx.r20 = 1;
    try {
      let you = false, any = false; const noYou = [];
      for (const b of boardsAll()) for (const s of b.bf){
        if (!s.att || s.att.pid !== pid || s.att.id !== c.id || !s.k || s.fd) continue; const f = faceOf(s); if (!f) continue;
        for (const sen of tname(f.o, f.n).toLowerCase().split(/\.\s*|\n/)){
          const x = sen.trim(); if (!/^(equipped|enchanted) (creature|permanent)/.test(x)) continue;
          if (/can't attack you(?: or planeswalkers you control)?\b/.test(x)){ you = true; noYou.push(b.pid); }
          if (/can't attack(?! you\b)/.test(x)) any = true;
          const parts = x.replace(/^(equipped|enchanted) (creature|permanent) /, '').split(/,\s*(?:and\s+)?/);
          if (parts.length >= 3) for (const p of parts){ const m = p.match(/^has ([a-z ]+)$/); if (m && !fx.kws.includes(m[1].trim())) fx.kws.push(m[1].trim()); }
          if (/can't be sacrificed/.test(x)) fx.noSac = true;
        }
      }
      if (you){ fx.noAtk = any; fx.r20noYou = noYou; }
    } catch (e){ console.warn('r20 afx', e); }
    return fx;
  };
  const ap = p24AtkPlan;
  p24AtkPlan = function(){
    const e = ap(); if (e) return e;
    try { for (const [id, d] of Object.entries(UI.atkSel || {})){ if (!d) continue; const c = S.bf.find(x => x.id === +id); if (!c) continue; const p = parseDef(d); const dp = p && attackTargetProtector(p); if (!dp) continue;
      const fx = attachFx(c, MYPID); if ((fx.r20noYou || []).includes(dp)) return `${cname(c)} can't attack ${nameOf(dp)} or planeswalkers they control (${fx.names.join(', ')})`; } } catch (e){ console.warn('r20 atk', e); }
    return '';
  };
  const ns = v25noSac;
  v25noSac = function(c){ if (ns(c)) return true; try { if (c && S && S.bf.includes(c) && attachFx(c, MYPID).noSac) return true; } catch {} return false; };
}
// haste granted by an Equipment / Aura another player controls (Assault Suit on a creature its holder lent away)
{ const hh = hasHaste; hasHaste = function(c){ if (hh(c) === true) return true; try { if (S && c && S.bf.includes(c) && attachFx(c, MYPID).kws.includes('haste')) return true; } catch {} return hh(c); }; }
