/* fix27a: loop fixes from helper a (top combos) */
const F27A = {skipRec:null};
// an action recorded before its questions: fix25a's loop check saw the question open and gave up, so look again once it's done
function f27aRecheck(){ try { if (typeof f25check === 'function' && !UI.replay && !UI.f25wait) f25check(); } catch {} }

// 1) "Add X mana in any combination of colors" (Selvala, Heart of the Wilds): the colour was asked before the tap was
//    recorded, so a spotted loop filed the answer under the previous action and the replay stopped. Record the tap first.
{ const am = activateMana; activateMana = async function(c, ab, ch){
    try { if (c && ab && S && ab.r21combo && !(ab.outs || []).length && !ab.r21late && !UI.replay && !abilityReady(c, ab, true)){
        const ai = manaAbs(c).findIndex(x => x.line === ab.line && x.cost === ab.cost);
        recAct({t:'mana', id:c.id, k:c.k, ai, ch}); F27A.skipRec = c.id;
        try { return await am.apply(this, arguments); } finally { F27A.skipRec = null; f27aRecheck(); } } } catch (e){ console.warn('f27a mana', e); }
    return am.apply(this, arguments); }; }
{ const ra = recAct; recAct = function(a){ if (a && a.t === 'mana' && F27A.skipRec != null && a.id === F27A.skipRec){ F27A.skipRec = null; return; } return ra.apply(this, arguments); }; }

// 2) "{1}{B}: Return this card from your graveyard to the battlefield tapped." (Reassembling Skeleton …) had no button.
function f27aGyRet(c){
  const out = []; let i = 0;
  for (const l of r21bLines(c.k)){
    const m = l.match(/^([^:"]+):\s*return (?:this card|~|this creature) from your graveyard to the battlefield( tapped)?\.?$/i); if (!m) continue;
    const cost = r21bCost(m[1]); if (!r21bKnown(cost)) continue; const ai = i++; const tapped = !!m[2];
    out.push({label:`${cost.label}: return it to the battlefield${tapped ? ' tapped' : ''}`, f27gy:ai, why:r21bWhy(cost, c), run:async () => {
      const w = r21bWhy(cost, c); if (w){ toast(w); return; }
      recAct({t:'gyab', id:c.id, k:c.k, ai});
      if (!(await r21bPay(cost, c))){ commit(); return; }
      r21bStack({kind:'ability', k:c.k, nm:cname(c), txt:`Return ~ from your graveyard to the battlefield${tapped ? ' tapped' : ''}.`, srcId:c.id});
      log(`activated ${cname(c)} from the graveyard (${cost.label})`); commit(); }});
  }
  return out;
}
{ const ga = r21bGyAbils; r21bGyAbils = function(c){ const out = ga.apply(this, arguments) || []; try { if (S && c && c.k) out.push(...f27aGyRet(c)); } catch (e){ console.warn('f27a gy', e); } return out; }; }
// …and loops that use it can be repeated (Record a loop / "looks like a loop").
{ const rl = runLoop; runLoop = async function(n){
    const rec = UI.recDone; if (!rec || !rec.acts.some(a => a.t === 'gyab')) return rl.apply(this, arguments);
    S.lp = 1; commit(); let done = 0, why = '';
    try {
      for (; done < n; done++){
        UI.replay = {ans:rec.ans.map(x => x && x.map ? x.map(y => (typeof y === 'object' && y) ? {...y} : y) : x)};
        for (const a of rec.acts){
          if (a.t === 'gyab'){ const c = S.gy.find(x => x.id === a.id) || S.gy.find(x => x.k === a.k); const o = c && f27aGyRet(c)[a.ai];
            if (!o){ why = `couldn't find ${info(a.k)?.n || 'a card'} in the graveyard`; break; } if (o.why){ why = `${cname(c)}: ${o.why}`; break; } await o.run(); }
          else { const c = findForReplay(a); if (!c){ why = `couldn't find ${info(a.k)?.n || 'a card'}`; break; }
            if (a.t === 'mana'){ const ab = manaAbs(c)[a.ai]; if (!ab || abilityReady(c, ab, true)){ why = `${cname(c)} can't make mana`; break; } await activateMana(c, ab, a.ch); }
            else if (a.t === 'ab'){ const ab = abilityList(c)[a.ai]; const r = ab ? abilityReady(c, ab, false) : 'gone'; if (!ab || (r && r !== 'Summoning sick')){ why = `${cname(c)}: ${r}`; break; } await activateAbility(c, ab); }
            else if (a.t === 'cast'){ await beginCast(c, a.zone, {free:a.free}); } }
          if (UI.replay.fail){ why = UI.replay.fail; break; }
          if (!(await waitStack())){ why = 'the stack did not finish'; break; }
        }
        if (why) break;
        if (opponents().length && opponents().every(p => (p.s?.life ?? 1) <= 0)){ done++; break; }
      }
    } finally { UI.replay = null; S.lp = 0; }
    log(`repeated the loop ${done} time${done === 1 ? '' : 's'}${why ? ' — stopped: ' + why : ''}`); commit(); }; }

// 3) "Target player draws …" for another player was capped at 20 cards (Peer into the Abyss drew 20 of 250).
{ const ao = applyOp; applyOp = function(r, from){
    if (r && r.op === 'draw' && r.n > 20){ let left = Math.min(r.n, 1000), out; while (left > 0){ const k = Math.min(20, left); out = ao.call(this, {...r, n:k}, from); left -= k; } return out; }
    return ao.apply(this, arguments); }; }

// 4) "target creature you control other than ~" (Rosie Cotton): no candidate matched, the trigger fizzled silently.
{ const ts = targetSpecs; targetSpecs = function(t){ const out = ts.apply(this, arguments);
    try { (out || []).forEach(sp => { if (sp && typeof sp.desc === 'string'){ const m = sp.desc.match(/^(.+?)\s+other than (?:~|this creature|this permanent|this artifact)$/); if (m){ sp.desc = m[1]; sp.other = true; } } }); } catch (e){ console.warn('f27a other', e); }
    return out; }; }

// 5) A burst of triggers with nothing resolving in between (Sheoldred + Peer into the Abyss: 270 draws at once) is not a
//    loop, but fix24a's "40 triggers in 30 s" guard asked to stop it and the default dropped the triggers.
//    fix25a already ignores bursts; let them past fix24a too (a one-push budget it honours).
{ const pt = pushTrigger; pushTrigger = function(src, t, ev, evPid){
    try { if (src && src.k && S && typeof F25 !== 'undefined' && !UI.dry && !UI.replay && !F25.bud[src.k] && F25.resAt.get(src.k) >= F25.resN){
        const k = src.k; F25.bud[k] = {T:turnStr(), left:1e9, last:Date.now()};
        try { return pt.apply(this, arguments); } finally { if (F25.bud[k] && F25.bud[k].left > 1e8) delete F25.bud[k]; } } } catch (e){ console.warn('f27a burst', e); }
    return pt.apply(this, arguments); }; }

// 6) "You may cast this card from your graveyard" is only a permission, so alternative costs still apply (Gravecrawler
//    with Rooftop Storm). The graveyard option used to replace the cost and skip the "how do you want to pay?" step.
{ const bc = beginCast; beginCast = function(c, zone, o = {}){
    try { if (zone === 'gy' && o && o.gy && o.gy.kind === 'gycast' && !o.free && S && altCosts(c, 'gy').length){ const o2 = {...o}; delete o2.gy; return bc.call(this, c, zone, o2); } } catch (e){ console.warn('f27a gycast', e); }
    return bc.apply(this, arguments); }; }

// 7) Shared abilities (Hazel's Brewmaster's Foods, Necrotic Ooze …) only saw abilities parsed before engine25r, so
//    lines recognised by later files (Devoted Druid's "Put a -1/-1 counter on ~: Untap ~") weren't shared.
{ const al = abilityList; abilityList = function(c){ const out = al.apply(this, arguments);
    try { if (S && c && !c.r25fake && !c.fd && S.bf.includes(c) && !F27A.shareBusy && typeof r25sources === 'function'){
        F27A.shareBusy = 1; let add = [];
        try { for (const s of r25sources(c)){ for (const ab of abilityList(s.c)){ if (!r25plain(ab) || ab.r25) continue;
              if (out.some(x => x.line === ab.line && x.cost === ab.cost) || add.some(x => x.line === ab.line && x.cost === ab.cost)) continue; add.push(r25obj(c, s, ab, 'a')); } } }
        finally { F27A.shareBusy = 0; }
        if (add.length) return out.concat(add); } } catch (e){ console.warn('f27a share', e); }
    return out; }; }

// 8) "Exile two target artifacts, creatures, and/or lands you control" (Ghostly Flicker) became "two target artifacts":
//    nothing matched and the spell resolved with no targets.
{ const NUM = {two:2, three:3, four:4, five:5};
  const ts = targetSpecs; targetSpecs = function(t){ const out = ts.apply(this, arguments);
    try { const m = String(t || '').toLowerCase().match(/\b(?:(up to )?(two|three|four|five) )?target ((?:[a-z]+s, )+[a-z]+s,? and\/or [a-z]+s)( you control| you don't control| an opponent controls)?/);
      if (m && out && out.length){ const kinds = m[3].split(/,\s*(?:and\/or\s+)?|\s+and\/or\s+/).map(x => x.trim().replace(/s$/, '')).filter(Boolean);
        const first = kinds[0] + 's'; const sp = out.find(x => x && (x.desc === first || x.desc === first + (m[4] || '') || x.desc === kinds[0]));
        if (sp && kinds.length > 1){ sp.desc = kinds.join(' or ') + (m[4] || ''); if (m[2]) sp.n = NUM[m[2]]; if (m[1]) sp.upTo = true; } } } catch (e){ console.warn('f27a multi', e); }
    return out; }; }

// 9) Additional costs (buyback, kicker …) were added after cost reductions had already stopped at {0}, so affinity /
//    "costs {N} less" never reduced them (Sprout Swarm with buyback under Witherbloom). Reductions apply to the total
//    cost (CR 601.2f), and the "Pay it?" check now counts them and convoke.
{ const sc = spellCost; spellCost = function(c, zone, o = {}){ const r = sc.apply(this, arguments);
    try { const ad = UI.r21badd; if (r && r.cost && ad && ad.mana && UI.casting && c && ad.cid === c.id && !F27A.scBusy){
        const base = o && o.alt ? (o.alt.mana || '') : (info(c.k)?.m || ''); F27A.scBusy = 1; UI.r21badd = null;
        let t; try { t = sc.call(this, c, zone, {...o, alt:{...(o && o.alt || {}), mana:base + ad.mana}}); } finally { UI.r21badd = ad; F27A.scBusy = 0; }
        if (t && t.cost && t.cost.gen < r.cost.gen){ const d = r.cost.gen - t.cost.gen; r.cost.gen = t.cost.gen; r.notes.push(`reductions also apply to ${ad.label || 'the additional cost'} (−${d})`); } } } catch (e){ console.warn('f27a addcost', e); }
    return r; }; }
{ const bc = beginCast; beginCast = async function(c, zone, o = {}){ const prev = F27A.cast; if (!UI.casting) F27A.cast = {c, zone, o}; try { return await bc.apply(this, arguments); } finally { F27A.cast = prev; } }; }
{ const ac = askChoice; askChoice = function(q){
    try { const k = F27A.cast; const opts = q && q.options; const pi = opts ? opts.findIndex(x => x && x.disabled && /^Pay it \(\+((?:\{[^}]+\})+)\)$/.test(x.label || '')) : -1;
      if (k && pi >= 0 && !UI.casting && S){ const add = opts[pi].label.match(/\+((?:\{[^}]+\})+)\)/)[1]; const sv = UI.r21badd;
        UI.r21badd = {cid:k.c.id, mana:add, extra:[], label:'it'}; UI.casting = true; let s;
        try { s = spellCost(k.c, k.zone, k.o && k.o.gy ? {alt:{mana:k.o.gy.mana}} : {}); } finally { UI.casting = false; UI.r21badd = sv; }
        if (s && (!payPlan(s.cost, S.pool).err || extraCanPay(k.c, s))){ q = {...q, text:'', options:opts.map((x, i) => i === pi ? {...x, disabled:false, why:''} : x)}; } } } catch (e){ console.warn('f27a pay it', e); }
    return ac.apply(this, arguments.length > 1 ? [q, ...[...arguments].slice(1)] : [q]); }; }

// 10) Spells with an additional cost asked "Pay buyback/kicker?" before the cast was recorded (answers went to the
//     previous action), and a replayed loop skipped the question, so a repeated Sprout Swarm lost its buyback.
//     Record the cast first; during a replay let the question be answered from the recording.
{ const bc = beginCast; beginCast = function(c, zone, o = {}){
    try { if (S && c && c.k && !UI.casting && !UI.dry && !isLand(c.k) && typeof r21bAdds === 'function'){ const adds = r21bAdds(c);
        if (adds.length && adds.every(a => a.max === 1)){
          if (!UI.replay){ recAct({t:'cast', id:c.id, k:c.k, zone, free:!!o.free}); F27A.skipCast = c.id; }
          else F27A.rpFor = c.id;
          const p = bc.apply(this, arguments);
          return Promise.resolve(p).finally(() => { if (F27A.skipCast === c.id) F27A.skipCast = null; if (F27A.rpFor === c.id) F27A.rpFor = null; if (F27A.rp){ UI.replay = F27A.rp; F27A.rp = null; } f27aRecheck(); }); } } } catch (e){ console.warn('f27a addrec', e); if (F27A.rp){ UI.replay = F27A.rp; F27A.rp = null; } }
    return bc.apply(this, arguments); }; }
{ const ra = recAct; recAct = function(a){ if (a && a.t === 'cast' && F27A.skipCast != null && a.id === F27A.skipCast){ F27A.skipCast = null; return; } return ra.apply(this, arguments); }; }
// engine21b checks "!UI.replay" right after r21bAdds(c): hide the replay for that check only, give it back at the question
{ const ra = r21bAdds; r21bAdds = function(c){ const out = ra.apply(this, arguments);
    try { if (c && F27A.rpFor === c.id && UI.replay && out && out.length && out.every(a => a.max === 1)){ F27A.rpFor = null; F27A.rp = UI.replay; UI.replay = null; } } catch {}
    return out; }; }
{ const ac = askChoice; askChoice = function(){ if (F27A.rp){ UI.replay = F27A.rp; F27A.rp = null; } return ac.apply(this, arguments); }; }

// 11) Replaying a loop that sacrifices a token: the recorded pick was a token that no longer exists, and the fallback
//     "same kind of card" (UI.replay.k) was never filled, so it took the first card offered (Zulaport Cutthroat instead
//     of a Squirrel). Remember what each offered card was.
F27A.idk = {}; F27A.idkN = 0;
{ const pc = pickCards; pickCards = function(m){
    try { if (UI.replay){ if (!UI.replay.k) UI.replay.k = F27A.idk; }
      else if (m && m.cards){ if (F27A.idkN > 5000){ F27A.idk = {}; F27A.idkN = 0; } m.cards.forEach(c => { if (c && c.id != null && c.k && F27A.idk[c.id] !== c.k){ F27A.idk[c.id] = c.k; F27A.idkN++; } }); } } catch {}
    return pc.apply(this, arguments); }; }
