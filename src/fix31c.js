/* ===== fix31c: Underworld Breach-style loops (escape / flashback casts from the graveyard) ===== */
// 1) A spell cast from the graveyard remembers HOW it was cast (escape, flashback, …). Repeating it used to call the plain
//    "cast from graveyard", which can't cast a card without such a permission — the repeat did nothing, silently.
const F31C = {how:{}};
{ const cg = castFromGy; castFromGy = async function(c, g){ try { if (c && g && !UI.replay) F31C.how[c.k] = g.label || ''; } catch {} return cg.apply(this, arguments); }; }
{ const bc = beginCast; beginCast = async function(c, zone, o = {}){
    try { if (UI.replay && c && zone === 'gy' && !(o && o.gy)){ const want = F31C.how[c.k]; const opts = typeof gyOptions === 'function' ? gyOptions(c) : [];
        const g = opts.find(x => (x.label || '') === want) || opts.find(x => /escape/i.test(x.label || '')) || opts[0];
        if (g) return castFromGy(c, g);
        UI.replay.fail = `${cname(c)} can't be cast from the graveyard any more`; return; } } catch (e){ console.warn('f31c cast', e); }
    return bc.apply(this, arguments); }; }
// 2) "Exile three other cards from your graveyard" (escape) picks different cards every time round. When repeating, pick
//    cards that the loop doesn't need (never the loop's own pieces), instead of the first card offered.
{ const pc = pickCards; pickCards = function(m){
    try { if (UI.replay && m && /^exile .*from your graveyard/i.test(m.title || '')){
        const need = new Set(((UI.recDone && UI.recDone.acts) || []).map(a => a.k));
        const spare = (m.cards || []).filter(c => !need.has(c.k)); const n = m.min || m.max || 3;
        if (spare.length >= n){ replayAns(); return Promise.resolve(spare.slice(0, n).map(c => c.id)); }
        UI.replay.fail = 'not enough other cards in your graveyard to exile'; replayAns(); return Promise.resolve(null); } } catch (e){ console.warn('f31c pick', e); }
    return pc.apply(this, arguments); }; }
// 3) A repeat round that did nothing (no card moved, no mana, nothing milled) is a stop, not a success.
{ const rl = runLoop; runLoop = async function(n){
    const rec = UI.recDone; if (!rec || !rec.acts.some(a => a.t === 'cast' && a.zone === 'gy')) return rl.apply(this, arguments);
    // run one round at a time and check something happened
    let done = 0; const sig = () => [S.gy.length, S.ex.length, S.bf.length, S.hand.length, JSON.stringify(S.pool), [...OPP.values()].reduce((x, o) => x + (o.lc || 0) + (o.life || 0), 0)].join('|');
    const logN = S.log.length;
    const need = new Set(rec.acts.map(a => a.k)); const exN = rec.acts.filter(a => a.t === 'cast' && a.zone === 'gy' && /escape/i.test(F31C.how[a.k] || '')).length * 3;
    for (; done < n; done++){
      if (exN && S.gy.filter(c => !need.has(c.k)).length < exN){ log(`repeated the loop ${done} time${done === 1 ? '' : 's'} — stopped: not enough other cards in your graveyard to exile for another round (needs ${exN})`); commit(); return; }
      const s0 = sig(); await rl.call(this, 1);
      const last = S.log.slice(-1)[0]?.s || '';
      for (let i = S.log.length - 1; i >= Math.max(0, S.log.length - 400); i--) if (/^repeated the loop [01] times?(?: —|$)/.test(S.log[i].s || '')) S.log.splice(i, 1);
      if (/stopped:/.test(last)){ log(`repeated the loop ${done} time${done === 1 ? '' : 's'} — ${last.replace(/^.*stopped: /, 'stopped: ')}`); commit(); return; }
      if (sig() === s0){ log(`repeated the loop ${done} time${done === 1 ? '' : 's'} — stopped: the last round didn't do anything`); commit(); return; }
      if (opponents().length && opponents().every(p => (p.s?.life ?? 1) <= 0 || p.s?.lost)){ done++; break; }
      if (opponents().length && opponents().every(p => (p.s?.lc ?? 1) <= 0) && /\bmills?\b/i.test(JSON.stringify(rec.acts.map(a => info(a.k)?.o || '')))){ done++; break; }
    }
    log(`repeated the loop ${done} time${done === 1 ? '' : 's'}`); commit(); }; }

// Jeska's Will (and the like): "Add {R} for each card in target opponent's hand" added nothing.
{ const ds = doSentence; doSentence = async function(s0, ctx){
    try { const l = String(s0).replace(/\.$/, '').trim().toLowerCase().replace(/^•\s*/, '');
      const m = l.match(/^add \{([wubrgc])\} for each card in (target opponent's|target player's|that player's|their|an opponent's|each opponent's) hand$/);
      if (m && ctx){ if (UI.dry) return;
        let pid = null; try { const t = ctx.tgts ? (nextTargets(ctx) || []).find(x => x && x.t === 'player') : null; if (t) pid = t.pid; } catch {}
        if (!pid){ const o = opponents(); if (o.length === 1) pid = o[0].pid; else if (o.length) pid = o.slice().sort((a, b) => (OPP.get(b.pid)?.hc || 0) - (OPP.get(a.pid)?.hc || 0))[0].pid; }
        const n = pid === MYPID ? S.hand.length : (OPP.get(pid)?.hc || 0);
        const col = m[1].toUpperCase(); if (n) addMana(Array(n).fill(col));
        log(`${ctx.name || 'It'}: added ${n} {${col}} (${n} card${n === 1 ? '' : 's'} in ${pid === MYPID ? 'your' : nameOf(pid) + "'s"} hand)`); commit(); return; } } catch (e){ console.warn('f31c jeska', e); }
    return ds.apply(this, arguments); }; }

// Loops on top of a spell held on the stack (Reiterate / Narset's Reversal + Jeska's Will, Mana Geyser …): the loop check
// waited for an empty stack, which never comes while you hold the spell. Check when the stack is back down to the depth
// the loop started at and you have priority.
setInterval(() => { try {
  if (typeof F25 === 'undefined' || !S || f25quiet() || UI.modal || UI.resolving || UI.casting || UI.f31held) return;
  const L = F25.sh; if (!L.length) return; const last = L[L.length - 1]; const n = stackAll().length;
  if (!(last.a && last.a.sd > 0) || n !== last.a.sd || !phaseNow) return;
  const sig = n + ':' + (S.stk[S.stk.length - 1] || {}).sid + ':' + L.length; if (F31C.heldSig !== sig){ F31C.heldSig = sig; F31C.heldAt = Date.now(); return; }
  if (Date.now() - F31C.heldAt < 1200) return;
  let hit = f25find();
  if (!hit && L.length >= 2){   // one spell recast on top of the held spell (Reiterate with buyback): two times round is enough for a known combo that gains each time
    const a = L[L.length - 2], b = L[L.length - 1]; const pool = Object.values(S.pool || {}).reduce((x, y) => x + (+y || 0), 0);
    const held = stackAll().map(i => i.k); const c = f25comboFor([b.a.k, ...held]);
    if (f25same(a.a, b.a) && a.a.sd === b.a.sd && b.T === turnStr() && b.sig === f25sig() && pool > b.pool && b.pool > a.pool && c && c.low.includes(f25nm(b.a.k)) && held.some(k => c.low.includes(f25nm(k)))) hit = {k:1, last:[b], prev:[a]};
  }
  if (!hit || hit.last[0].sig !== f25sig()) return;
  const key = turnStr() + ':held:' + hit.last.map(e => e.a.t + e.a.k + (e.a.ai ?? '')).join(',');
  if (F25.asked[key]) return; F25.asked[key] = 1; UI.f31held = 1;
  f25offer(hit.last).finally(() => { UI.f31held = 0; });
} catch (e){ console.warn('f31c held', e); } }, 400);

// Holding your own spell: once everyone else had passed, your own spell resolved at once, so you couldn't copy it again
// (Reiterate / Narset's Reversal on your own Jeska's Will). After you copy your own spell, the original is held for
// 12 seconds (each new cast extends it), so you can copy it again; Next / Pass lets it resolve.
F31C.hold = null;
const f31cCopies = it => /copy target instant or sorcery spell|copy target (?:spell|instant spell|sorcery spell)/i.test(String(it && (it.txt || '') || '') + ' ' + String((it && it.k && info(it.k)?.o) || ''));
{ const rt = resolveTop; resolveTop = async function(it){
    const isCopy = it && S.stk.includes(it) && f31cCopies(it);
    const r = await rt.apply(this, arguments);
    try { if (isCopy){ const mine = stackAll().filter(x => x.pid === MYPID && x.it && x.it.kind === 'spell' && !/\(copy\)/.test(x.it.nm || ''));
        const orig = mine[mine.length - 1]; if (orig){ F31C.hold = {sid:orig.it.sid, until:Date.now() + 12000}; if (!UI.replay) toast(`Holding ${orig.it.nm} on the stack so you can copy it again — press Next to let it resolve`); } } } catch (e){ console.warn('f31c hold', e); }
    return r; }; }
{ const pc = priorityCheck; priorityCheck = function(){
    try { const h = F31C.hold; if (h){ const top = stackTop();
        if (!top || Date.now() > h.until || !S.stk.some(x => x.sid === h.sid)) F31C.hold = null;
        else if (top.pid === MYPID && top.it && top.it.sid === h.sid) return; } } catch {}
    return pc.apply(this, arguments); }; }
{ const bc = beginCast; beginCast = async function(){ if (F31C.hold) F31C.hold.until = Date.now() + 12000; return bc.apply(this, arguments); }; }
{ const na = nextAction; nextAction = function(){ try { const top = stackTop(); if (F31C.hold && top && top.it && top.it.sid === F31C.hold.sid){ F31C.hold = null; log(`lets ${top.it.nm} resolve`); commit(); return true; } } catch {} return na.apply(this, arguments); }; }
// while a loop repeat runs, the hold stays on until it ends
setInterval(() => { try { if (F31C.hold && (UI.replay || (typeof S !== 'undefined' && S && S.lp))) F31C.hold.until = Date.now() + 12000; } catch {} }, 500);
// …and a repeat of such a loop waits until the stack is back down to the held spell (not until it's empty, which never
// happens while you hold it).
{ const ws = waitStack; waitStack = async function(ms = 8000){
    const rec = UI.recDone;
    if (!UI.replay || !rec || !rec.acts.length || !rec.acts.every(a => a.sd > 0)) return ws.apply(this, arguments);
    const d = Math.min(...rec.acts.map(a => a.sd)); const t0 = Date.now(); let ok = 0;
    while (Date.now() - t0 < Math.max(ms, 15000)){ if (stackAll().length <= d && !UI.resolving && !UI.casting){ if (++ok >= 5) return true; } else ok = 0; await sleep(80); }
    return false; }; }
