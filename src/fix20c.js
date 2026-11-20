/* ===== fix20c: Mindslaver / Emrakul — the controller activates the controlled player's abilities (helper R, GAPS20 section R) =====
   1. While another player controls my turn (Mindslaver, Emrakul, the Promised End — engine24q S.qSlave, fix19d panel), every
      non-mana activated ability I could activate is published (battlefield: tap / mana-cost / sacrifice abilities, equip, crew,
      level up …; loyalty abilities; graveyard abilities — all public objects). Hand abilities (cycling, transmute, suspend, plot)
      are worked out on the controller's screen from the private hand the controller already sees.
      The controller's panel lists them; a click sends an 'o19slv' command 'act:<zone>:<id>:<i>'. MY client activates (CR 723.5:
      the controller makes the decisions, but the costs are paid from my resources): mana from my pool / lands (autopay), my life,
      my permanents for sacrifice costs. Every choice on the way — targets, modes, X, which permanent to sacrifice, which card to
      discard — goes to the controller's screen (engine24q askChoice / pickCards, fix19d pickTargets, and askNumber here).
      My own clicks on loyalty / hand / graveyard abilities are refused while I'm controlled, like casting already was.
   Mana abilities are not listed: the engine pays costs automatically (autopay), so the controller never has to tap mana by hand.
      Scry / surveil during a controlled turn go to the controller as a pick (bottom / graveyard) and an order question.
   Found on the way (they broke the Mindslaver test in ordinary games too):
   2. Loyalty −X / +X: the X chosen while activating is now the ability's X ("−X: you gain X life" asked "how many?" again).
   3. "target tapped creature" / "target untapped …": no candidate ever matched (descOk reads card characteristics, not the
      tapped status), so Royal Assassin & co. had no legal target. The status is checked on the permanent. */
// a short hash of an ability's label: the command names the ability by index AND label, so a list that changed in between can't misfire
function r20H(s){ let h = 5381; for (const ch of String(s)) h = ((h * 33) ^ ch.charCodeAt(0)) >>> 0; return h.toString(36).slice(0, 6); }

// ---- what the controlled player can activate right now (my client, published while controlled)
function r20Slaved(){ try { const q = !UI.dry && typeof q24Slaved === 'function' && q24Slaved(); return q && q.on && o19SlvLive(q) ? q : null; } catch { return null; } }
function r20AbLabel(c, cost, eff){ return `${cname(c)} — ${String(cost).replace(/\s+/g, ' ')}: ${short(String(eff).replace(/~/g, cname(c)), 70)}`.slice(0, 120); }
function r20MyAbs(){
  const out = [];
  for (const c of S.bf){ if (!c || c.fd || !c.k) continue;
    let al = []; try { al = abilityList(c) || []; } catch {}
    al.forEach((ab, i) => { let why = ''; const lab = r20AbLabel(c, ab.cost, ab.eff); try { why = abilityReady(c, ab, false); } catch (e){ why = 'not available'; } if (why === 'Summoning sick'){ try { if (hasHaste(c) === 'maybe') why = ''; } catch {} }
      out.push({z:'a', id:c.id, i, lab, h:r20H(lab), why}); });
    let la = []; try { la = loyaltyAbs(c) || []; } catch {}
    la.forEach((ab, i) => { let why = ''; try { why = loyaltyReady(c, ab); } catch { why = 'not available'; } const lab = r20AbLabel(c, ab.raw, ab.eff); out.push({z:'l', id:c.id, i, lab, h:r20H(lab), why}); });
  }
  for (const c of S.gy){ if (!c || !c.k) continue; let ga = []; try { ga = typeof r21bGyAbils === 'function' ? r21bGyAbils(c) || [] : []; } catch {}
    ga.forEach((o, i) => out.push({z:'g', id:c.id, i, lab:`${cname(c)} (graveyard) — ${String(o.label).slice(0, 60)}`, h:r20H(o.label), why:o.why || ''})); }
  return out;
}
function r20Enc(list){ // public: zone, id, index, label, why — tab-separated, one per line, within a size budget
  const lines = []; let n = 0; for (const a of list){ const l = [a.z, a.id, a.i, a.lab.replace(/[\t\n]/g, ' '), String(a.why || '').replace(/[\t\n]/g, ' ').slice(0, 50), a.h || ''].join('\t'); if (n + l.length > 3500) break; lines.push(l); n += l.length + 1; }
  return lines.join('\n');
}
function r20Dec(s){ return String(s || '').split('\n').filter(Boolean).map(l => { const [z, id, i, lab, why, h] = l.split('\t'); return {z, id:+id, i:+i, lab:lab || '', why:why || '', h:/^[0-9a-z]{1,6}$/.test(h || '') ? h : ''}; }).filter(a => /^[alg]$/.test(a.z) && Number.isFinite(a.id) && Number.isFinite(a.i)); }
{
  const ep = enginePublic;
  enginePublic = function(){ const o = ep(); try { if (S && r20Slaved()) o.r20ab = r20Enc(r20MyAbs()); else delete o.r20ab; } catch (e){ console.warn('r20 pub', e); } return o; };
  const se = sanitizeEngine;
  sanitizeEngine = function(s){ const o = se(s); try { o.r20ab = s && typeof s.r20ab === 'string' ? s.r20ab.slice(0, 4000) : ''; } catch {} return o; };
}

// ---- choices during a controlled turn: X and other numbers go to the controller too
{
  const an = askNumber;
  askNumber = function(title, hint, def){
    const q = r20Slaved(); if (!q) return an(title, hint, def);
    return (async () => { const a = await q24Ask(q.by, {kind:'num', title:`(controlling ${nameOf(MYPID)}) ${String(title || '').slice(0, 100)}`}, q.src || 'Mindslaver');
      const v = a == null || a === '' ? (def ?? 0) : Math.max(0, +a || 0); log(`${nameOf(q.by)} chose ${v} for ${nameOf(MYPID)} (${short(String(title || ''), 50)})`); return v; })();
  };
}

// ---- my own clicks are refused while I'm controlled (fix19d does cast / play / activateAbility / attack / next)
{
  const al = activateLoyalty;
  activateLoyalty = async function(c, i, ...a){ if (o19Blocked('activate')) return; return al(c, i, ...a); };
  for (const k of ['r21bh', 'r21bg']){ const f = ACT[k]; if (typeof f === 'function') ACT[k] = function(el, ...a){ if (o19Blocked('activate')) { try { closeMenu(); closeModal(); } catch {} return; } return f.call(this, el, ...a); }; }
}

// ---- the controlled client carries out an activation the controller asked for
async function r20SlvAct(r, from){
  const q = typeof q24Slaved === 'function' && q24Slaved(); if (!q || q.by !== from){ log(`ignored a command from ${nameOf(from)} — they don't control this turn`); return; }
  const [, z, id0, i0, hh] = String(r.d || '').split(':'); const id = +id0; let i = +i0;
  // the controller's list was built from labels; if this client's list moved, find the same label (hand options are worked out on both sides)
  const pickI = (labs) => { if (!hh || r20H(labs[i] || '') === hh) return i; const j = labs.findIndex(l => r20H(l) === hh); return j >= 0 ? j : -1; };
  const say = s => { log(`${nameOf(from)} can't activate that for ${nameOf(MYPID)}: ${s}`); commit(); };
  if (UI.casting || UI.resolving){ say('another spell or ability is being put on the stack'); return; }
  O19.remote = true;
  try {
    if (z === 'a' || z === 'l'){
      const c = S.bf.find(x => x.id === id); if (!c){ say('that permanent is gone'); return; }
      if (z === 'a'){ const L = abilityList(c) || []; i = pickI(L.map(ab => r20AbLabel(c, ab.cost, ab.eff))); const ab = L[i]; if (!ab){ say('that ability is gone'); return; }
        const why = abilityReady(c, ab, false); if (why && why !== 'Summoning sick'){ say(why); return; }
        log(`${nameOf(from)} has ${nameOf(MYPID)} activate ${cname(c)}: ${short(String(ab.eff), 70)}`); await activateAbility(c, ab); }
      else { const L = loyaltyAbs(c) || []; i = pickI(L.map(ab => r20AbLabel(c, ab.raw, ab.eff))); const ab = L[i]; if (!ab){ say('that loyalty ability is gone'); return; }
        const why = loyaltyReady(c, ab); if (why){ say(why); return; }
        log(`${nameOf(from)} has ${nameOf(MYPID)} activate ${cname(c)} ${ab.raw}`); await activateLoyalty(c, i); }
    } else if (z === 'h'){
      const c = S.hand.find(x => x.id === id); if (!c){ say('that card is no longer in hand'); return; }
      const L = typeof r21bHandOpts === 'function' ? r21bHandOpts(c) : []; i = pickI(L.map(o => o.label)); const o = L[i]; if (!o){ say('that ability is gone'); return; } if (o.why){ say(o.why); return; }
      log(`${nameOf(from)} has ${nameOf(MYPID)} use ${cname(c)}: ${o.label}`); await o.run();
    } else if (z === 'g'){
      const c = S.gy.find(x => x.id === id); if (!c){ say('that card is no longer in the graveyard'); return; }
      const L = typeof r21bGyAbils === 'function' ? r21bGyAbils(c) : []; i = pickI(L.map(o => o.label)); const o = L[i]; if (!o){ say('that ability is gone'); return; } if (o.why){ say(o.why); return; }
      log(`${nameOf(from)} has ${nameOf(MYPID)} use ${cname(c)}: ${o.label}`); await o.run();
    }
    commit();
  } catch (e){ console.warn('r20 slv act', e); } finally { O19.remote = false; }
}
{
  const ao = applyOp;
  applyOp = function(r, from){
    if (r && r.op === 'o19slv' && /^act:[alhg]:\d+:\d+(?::[0-9a-z]{1,6})?$/.test(String(r.d || ''))){ r20SlvAct(r, from); return; }
    return ao(r, from);
  };
}

// ---- the controller's panel: an "Abilities" section under fix19d's hand / attack / next controls
function r20PanelAbs(v){
  const st = OPP.get(v.pid) || {}; const list = r20Dec(st.r20ab);
  // hand abilities from the hand the controller sees (fix19d UI.o19slv: ids + keys); readiness is checked on the controlled client
  try { (v.ids || []).forEach((id, j) => { const k = (v.ks || [])[j]; if (!k || !info(k) || typeof r21bHandOpts !== 'function') return;
      const opts = r20HandOptsOf({id, k}); opts.forEach((o, i) => list.push({z:'h', id, i, lab:`${info(k).n} (hand) — ${String(o.label).slice(0, 60)}`, h:r20H(o.label), why:''})); }); } catch (e){ console.warn('r20 hand abs', e); }
  return list;
}
// the hand options of a card in another player's hand: only their labels (r21bHandOpts reads my own state for readiness)
function r20HandOptsOf(c){ try { return r21bHandOpts(c).map(o => ({label:o.label})); } catch { return []; } }
{
  const sp = o19SlvPanel;
  o19SlvPanel = function(...a){
    const r = sp.apply(this, a);
    try { const el = document.getElementById('o19slv'); const v = UI.o19slv; if (el && v){
        const list = r20PanelAbs(v);
        const html = `<div style="margin:4px 0">Abilities: ${list.length ? list.map(x => `<button type="button" class="btn small" data-r20act="${x.z}:${x.id}:${x.i}${x.h ? ':' + x.h : ''}" ${x.why ? `disabled title="${esc(x.why)}"` : ''}>${manaHTML(esc(x.lab))}${x.why ? ` <small class="dim">(${esc(x.why)})</small>` : ''}</button>`).join(' ') : '<span class="dim">none</span>'}</div>`;
        let box = el.querySelector('#r20abs'); if (!box){ box = document.createElement('div'); box.id = 'r20abs'; el.appendChild(box); }
        if (box.dataset.k !== html){ box.innerHTML = html; box.dataset.k = html; } } } catch (e){ console.warn('r20 panel', e); }
    return r;
  };
}
function r20SlvSend(code){ const v = UI.o19slv; if (!v) return; sendRq(v.pid, 'o19slv', 0, v.src || 'Mindslaver', {d:'act:' + code}); commit(); }
if (typeof document !== 'undefined') document.addEventListener('click', e => { const b = e.target.closest && e.target.closest('[data-r20act]'); if (!b || b.disabled) return; r20SlvSend(b.dataset.r20act); });

// ---- scry / surveil during a controlled turn: the controller decides (the zone dialog would open on the controlled screen)
{
  const lt = lookTopAwait;
  lookTopAwait = function(n, title, dests, hint){
    const q = r20Slaved(); if (!q || UI.replay || !/^(Scry|Surveil)$/.test(String(title))) return lt(n, title, dests, hint);
    return (async () => {
      const top = S.lib.slice(0, Math.max(0, n)); if (!top.length) return; const scry = title === 'Scry';
      const ids = await pickCards({title:`${title} ${top.length}: choose the cards to put ${scry ? 'on the bottom of the library' : 'into the graveyard'} (the rest stay on top)`, cards:top, min:0, max:top.length, noneLabel:'Keep them all on top'}) || [];
      const out = top.filter(c => ids.includes(c.id)); let keep = top.filter(c => !ids.includes(c.id));
      if (keep.length > 1){ const ord = []; let left = keep.slice();
        while (left.length > 1){ const v = await askChoice({title:`${title}: which card goes on top${ord.length ? ' next' : ''}?`, options:left.map(c => ({label:cname(c), value:c.id}))}); const c = left.find(x => x.id === v) || left[0]; ord.push(c); left = left.filter(x => x !== c); }
        keep = ord.concat(left); }
      for (const c of top){ const i = S.lib.indexOf(c); if (i >= 0) S.lib.splice(i, 1); }
      S.lib.unshift(...keep);
      for (const c of out){ if (scry) S.lib.push(c); else { S.lib.unshift(c); moveCard(c.id, 'gy'); } }
      log(`${title.toLowerCase()} ${top.length}: ${keep.length} on top, ${out.length} ${scry ? 'on the bottom' : 'into the graveyard'} (chosen by ${nameOf(q.by)})`);
      commit();
    })();
  };
}

// ---- loyalty −X / +X: the X chosen while activating is the X of the ability (CR 606.4 / 107.3) — "you gain X life" never asks again
{
  const al = activateLoyalty;
  activateLoyalty = async function(c, i, ...a){
    let ab = null, co0 = 0, n0 = 0; try { ab = (loyaltyAbs(c) || [])[i]; co0 = c.co || 0; n0 = S.stk.length; } catch {}
    const r = await al(c, i, ...a);
    try { if (ab && /X/.test(String(ab.raw || ab.cost)) && S.stk.length > n0){ const it = S.stk.slice(n0).find(x => x.srcId === c.id && x.kind === 'ability');
        if (it && it.x == null || it && !it.xSet){ const x = Math.abs((c.co || 0) - co0); it.x = x; it.xSet = true; commit(); } } } catch (e){ console.warn('r20 loyX', e); }
    return r;
  };
}

// ---- "target tapped creature" / "target untapped …": descOk reads card characteristics only, so a tapped/untapped adjective
//      matched nothing and Royal Assassin & co. had no legal target in any game. Tapped is the permanent's status (CR 110.5):
//      match the rest of the description, then keep the permanents in that state (my S.bf .tap/.tn, other players' published .tp/.tn).
function r20Tapped(pid, id){
  const b = pid === MYPID ? S.bf.find(x => x.id === id) : ((OPP.get(pid) || {}).bf || []).find(x => x.id === id); if (!b) return null;
  const n = b.n || 1, tn = b.tn || 0; const t = pid === MYPID ? !!b.tap : !!b.tp;
  return {tapped:t || tn > 0, untapped:!t && tn < n};
}
{
  const tc = targetCands;
  targetCands = function(spec, src){
    try { const d = spec && spec.zone === 'bf' && !spec.any && typeof spec.desc === 'string' ? spec.desc : '';
      const m = d && d.match(/^((?:[a-z]+ )*?)(untapped|tapped) ([a-z][a-z ,\/-]*)$/);
      if (m && !/\b(?:untapped|tapped)\b/.test(m[3])){
        const want = m[2]; const out = tc({...spec, desc:(m[1] + m[3]).trim()}, src);
        return out.filter(o => { if (o.t !== 'card') return true; const st = r20Tapped(o.pid, o.id); return st ? st[want] : false; });
      } } catch (e){ console.warn('r20 tapped', e); }
    return tc(spec, src);
  };
}
