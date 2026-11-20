/* fix27c: loop fixes from helper c (top combos) */
// 1) Damage to an opponent counts as draining them for the loop questions (Niv-Mizzet + Curiosity, Aetherflux Reservoir…):
//    the trigger-loop question offers "until every opponent is dead", and a hand loop that deals damage counts as a gain.
{ const sr = sendRq; sendRq = function(to, op, n){
    try { if (op === 'pdmg' && n > 0 && to !== MYPID && typeof F25 !== 'undefined'){ F25.drainAt = Date.now();
        if (!UI.replay){ const e = F25.sh[F25.sh.length - 1]; if (e) e.loss[to] = (e.loss[to] || 0) + n; } } } catch {}
    return sr.apply(this, arguments); }; }
// 2) Repeating a loop: when an action sent something to another player (damage, life loss…), wait for that player's
//    answer before the next action, so triggers it sets off here (Exquisite Blood, Bloodthirsty Conqueror…) resolve first.
const F27C = {pend:new Map()};
{ const sr = sendRq; sendRq = function(to, op){
    try { if (UI.replay && to && to !== MYPID && OPP.has(to) && !F27C.pend.has(to)) F27C.pend.set(to, (NET.seen.get(to) || {}).sv || 0); } catch {}
    return sr.apply(this, arguments); };
  const ws = waitStack; waitStack = async function(ms = 8000){
    const r = await ws(ms); if (!r || !UI.replay || !F27C.pend.size) return r;
    const pend = [...F27C.pend]; F27C.pend.clear(); const t0 = Date.now();
    while (Date.now() - t0 < 3000 && pend.some(([pid, sv]) => OPP.has(pid) && ((NET.seen.get(pid) || {}).sv || 0) <= sv)) await sleep(40);
    await sleep(120); return ws(ms); }; }
// 3) "Whenever a card is put into an opponent's graveyard from anywhere" saw only land cards: use the per-card zone event (one trigger per card).
{ const ct = classifyTrig; classifyTrig = function(w, c){
    if (w === 'whenever' && /^a card is put into an opponent's graveyard from anywhere$/.test(c)) return {ev:'qtogy', subj:'any', ctl:'opp', desc:'', qf:(s, ev, pid) => pid !== MYPID && (ev.amt || 0) > 0, qper:ev => ev.amt || 1};
    return ct.apply(this, arguments); }; }
// 4) Planeswalker loyalty abilities weren't recorded, so loops using one (Teferi, Time Raveler + Displacer Kitten) were never
//    spotted or repeated. Record them and replay them.
{ const al = activateLoyalty; activateLoyalty = async function(c, i){
    try { const ab = c && loyaltyAbs(c)[i]; if (ab && !UI.replay && !loyaltyReady(c, ab)) recAct({t:'loy', id:c.id, k:c.k, ai:i}); } catch (e){ console.warn('f27c loy', e); }
    return al.apply(this, arguments); }; }
async function f27cStep(a){   // one recorded action; returns why it couldn't be done ('' if done)
  if (a.t === 'gyab' && typeof f27aGyRet === 'function'){ const c = S.gy.find(x => x.id === a.id) || S.gy.find(x => x.k === a.k); const o = c && f27aGyRet(c)[a.ai];
    if (!o) return `couldn't find ${info(a.k)?.n || 'a card'} in the graveyard`; if (o.why) return `${cname(c)}: ${o.why}`; await o.run(); return ''; }
  const c = findForReplay(a); if (!c) return `couldn't find ${info(a.k)?.n || 'a card'}`;
  if (a.t === 'loy'){ const ab = loyaltyAbs(c)[a.ai]; const r = ab ? loyaltyReady(c, ab) : 'gone'; if (r) return `${cname(c)}: ${r}`; await activateLoyalty(c, a.ai); return ''; }
  if (a.t === 'mana'){ const ab = manaAbs(c)[a.ai]; if (!ab || abilityReady(c, ab, true)) return `${cname(c)} can't make mana`; await activateMana(c, ab, a.ch); return ''; }
  if (a.t === 'ab'){ const ab = abilityList(c)[a.ai]; const r = ab ? abilityReady(c, ab, false) : 'gone'; if (!ab || (r && r !== 'Summoning sick')) return `${cname(c)}: ${r}`; await activateAbility(c, ab); return ''; }
  if (a.t === 'cast'){ await beginCast(c, a.zone, {free:a.free}); return ''; }
  return 'unknown action';
}
{ const rl = runLoop; runLoop = async function(n){
    const rec = UI.recDone; if (!rec || !rec.acts.some(a => a.t === 'loy')) return rl.apply(this, arguments);
    S.lp = 1; commit(); let done = 0, why = '';
    try {
      for (; done < n; done++){
        UI.replay = {ans:rec.ans.map(x => x && x.map ? x.map(y => (typeof y === 'object' && y) ? {...y} : y) : x)};
        for (const a of rec.acts){
          why = await f27cStep(a); if (why) break;
          if (UI.replay.fail){ why = UI.replay.fail; break; }
          if (!(await waitStack())){ why = 'the stack did not finish'; break; }
        }
        if (why) break;
        if (opponents().length && opponents().every(p => (p.s?.life ?? 1) <= 0)){ done++; break; }
      }
    } finally { UI.replay = null; S.lp = 0; }
    log(`repeated the loop ${done} time${done === 1 ? '' : 's'}${why ? ' — stopped: ' + why : ''}`); commit(); }; }
// 5) "Target player draws … and loses …" / "That player may copy this spell" can be aimed at yourself on purpose
//    (Peer into the Abyss, Chain of Smog): don't auto-pick the only opponent for those.
{ const ct = chooseTargets; chooseTargets = async function(text){ const sv = F27C.selfOk; F27C.selfOk = /\bdraws?\b|\bmay copy\b/i.test(String(text || '')); try { return await ct.apply(this, arguments); } finally { F27C.selfOk = sv; } };
  const pk = pickTargets; pickTargets = function(spec){ if (F27C.selfOk && spec && spec.harm) spec = {...spec, harm:false}; return pk.apply(this, [spec, ...[...arguments].slice(1)]); }; }
// 6) Magecraft ("whenever you cast or copy an instant or sorcery spell") ignored copies: copying a spell is an event now.
EV_TYPES.push('f27copy');
{ const ct = classifyTrig; classifyTrig = function(w, c){ const r = ct.apply(this, arguments);
    try { if (r && r.ev === 'cast' && w === 'whenever' && /^you cast or copy /.test(c)) return {...r, evs:['cast', 'f27copy']}; } catch {} return r; };
  const sm = subjMatch; subjMatch = function(t, src, ev, pid){ if (ev && ev.type === 'f27copy') return pid === MYPID && (!t.desc || descOk(ev.k, t.desc)); return sm.apply(this, arguments); };
  const cp = m24Copy; m24Copy = async function(){ const out = await cp.apply(this, arguments);
    try { f27cCopied(out); } catch (e){ console.warn('f27c copy', e); }
    return out; };
  const cm = copyMany; copyMany = async function(){ const before = new Set(S.stk); const r = await cm.apply(this, arguments);
    try { f27cCopied(S.stk.filter(x => !before.has(x) && x.copy)); } catch (e){ console.warn('f27c storm', e); } return r; }; }
function f27cCopied(list){ if (UI.dry) return; (list || []).forEach(x => { if (x && x.kind === 'spell' && !x.f27e){ x.f27e = 1; emit({type:'f27copy', k:x.k, cnt:1}); } }); }
// 7) Milling: "each opponent mills half their library" (Maddening Cacophony kicked); mill requests over 60 cards were cut
//    to 60; Bruvac the Grandiloquent ("they mill twice that many cards instead") wasn't applied.
STATIC_RULES.push([/^if an opponent would mill one or more cards, they mill twice that many cards instead$/, m => ({kind:'f27cMill2', who:'opp'})]);
const f27cMill2 = n => { const k = (S && !UI.dry && n > 0) ? rulesOn('f27cMill2').length : 0; if (!k) return n; const n2 = Math.min(n * 2 ** Math.min(k, 6), 4000); log(`mills twice that many (${rulesOn('f27cMill2').map(r => r.src).join(', ')}): ${n} → ${n2}`); return n2; };
F27C.raw = mill;
mill = function(n = 1, ...a){ if (!F27C.noDbl){ try { n = f27cMill2(n); } catch {} } return F27C.raw.call(this, n, ...a); };
{ const ao = applyOp; applyOp = function(r, from){
    if (r && r.op === 'mill' && r.n > 60){ let left = f27cMill2(Math.min(r.n, 2000)), out; F27C.noDbl = 1;
      try { while (left > 0 && S.lib.length){ const c = Math.min(60, left); out = ao.call(this, {...r, n:c}, from); left -= c; } } finally { F27C.noDbl = 0; } return out; }
    return ao.apply(this, arguments); }; }
{ const ds = doSentence; doSentence = async function(s0, ctx){
    const l = String(s0).replace(/\.$/, '').trim().toLowerCase(); let m;
    if ((m = l.match(/^(?:instead,? )?each opponent mills half their library, rounded (up|down)$/))){ if (UI.dry) return true;
      opponents().forEach(p => sendRq(p.pid, 'r23Imillh', m[1] === 'up' ? 1 : 0, ctx && ctx.name)); log(`${ctx && ctx.name}: each opponent mills half their library, rounded ${m[1]}`); commit(); return true; }
    return ds.apply(this, arguments); }; }
// 8) "This spell costs {1} less to cast for each creature on the battlefield" (Blasphemous Act …) was left to adjust by hand.
{ const cm = costMods; costMods = function(c, caster){ const out = cm.apply(this, arguments);
    try { if (!S || !c || !c.k || (caster != null && caster !== MYPID)) return out;
      const own = tname(info(c.k)?.o || '', info(c.k)?.n).toLowerCase(); const re = /(?:^|\n)~ costs \{(\d+)\} (less|more) to cast for each ([^.\n]+)\.?/g; let m, hit = false;
      while ((m = re.exec(own))){ if (/sacrificed|discarded|exiled this way/.test(m[3])) continue;
        const n = countOf(m[3].trim(), {k:c.k, card:c, srcId:c.id, name:cname(c)}); if (n == null) continue; hit = true;
        if (n) (m[2] === 'less' ? out.less : out.more).push({n:+m[1] * n, src:info(c.k).n}); }
      if (hit && out.warn) out.warn = out.warn.filter(w => !/changes its own cost/.test(w)); } catch (e){ console.warn('f27c selfcost', e); }
    return out; }; }
// 9) Repeating a loop that sacrifices tokens (Savvy Hunter + Ygra's Rats): the recorded picks name tokens that are gone,
//    and the replay fell back to the first card offered (Savvy Hunter itself). Remember what each picked card was.
F27C.idK = {};
{ const pc = pickCards; pickCards = function(m){
    try { const r = UI.replay && UI.replay.ans && UI.replay.ans[0];   // a picked card that is gone → an unused one of the same kind (or name)
      if (Array.isArray(r) && m && m.cards){ const used = new Set(r.filter(id => m.cards.some(x => x.id === id)));
        UI.replay.ans[0] = r.map(id => { if (m.cards.some(x => x.id === id)) return id; const k = F27C.idK[id]; if (!k) return id; const nm = String(info(k)?.n || '');
          const c = m.cards.find(x => !used.has(x.id) && x.k === k) || m.cards.find(x => !used.has(x.id) && nm && cname(x) === nm); if (!c) return id; used.add(c.id); return c.id; }); } } catch {}
    const p = pc.apply(this, arguments);
    try { if (!UI.replay && m && m.cards && p && p.then) p.then(ids => { try { (Array.isArray(ids) ? ids : []).forEach(id => { const c = m.cards.find(x => x.id === id); if (c) F27C.idK[id] = c.k; }); } catch {} }); } catch {}
    return p; };
  const ra = replayAns; replayAns = function(){ if (UI.replay && !UI.replay.k) UI.replay.k = F27C.idK; return ra.apply(this, arguments); }; }
