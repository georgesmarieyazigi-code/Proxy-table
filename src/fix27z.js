/* ===== fix27z: lead's loop fixes that must wrap the helpers' runLoop versions ===== */
// A loop can be spotted one step early (in the middle of the second time round), so the recorded steps may start in
// the middle. Before repeating, start the steps at the one that matches where the player is now (board, mana, hand).
{ const rl = runLoop; runLoop = async function(){
    try { const rec = UI.recDone, B = rec && rec.f25blk;
      if (B && B.length > 1 && !rec.f25rot){ const pool = Object.values(S.pool || {}).reduce((x, y) => x + (+y || 0), 0), sig = f25sig();
        let best = 0, bs = Infinity;
        B.forEach((e, r) => { const sc = (e.sig === sig ? 0 : 100) + Math.abs(e.pool - pool) * 3 + Math.abs(e.hand - S.hand.length); if (sc < bs){ bs = sc; best = r; } });
        if (best){ const R = [...B.slice(best), ...B.slice(0, best)]; rec.acts = R.map(e => ({...e.a})); rec.ans = R.flatMap(e => e.ans); }
        rec.f25rot = 1; } } catch (e){ console.warn('f25 rotate', e); }
    return rl.apply(this, arguments); }; }

// Loop autopilot: while a trigger loop runs the chosen number of times, every question it asks again ("Curiosity: you may
// draw a card?", "Niv-Mizzet: choose target") gets the same answer as last time, so nothing has to be clicked.
// If the loop draws and your library is empty, it ends the loop safely instead: the ping goes to the loop's own creature
// (Niv-Mizzet pings himself) and a "may draw" is declined, so you never draw from an empty library.
const F25L = {last:{}};
const f25lKey = t => String(t || '').replace(/\d+/g, '#');
function f25lActive(){ const now = Date.now(), T = turnStr(); return typeof F25 !== 'undefined' && Object.values(F25.bud || {}).some(b => b.T === T && b.left > 0 && now - b.last < 8000); }
function f25lStop(why){ for (const b of Object.values(F25.bud || {})) b.left = 0; log(`loop ended: ${why}`); }
setInterval(() => { try {
  const m = UI.modal; if (!m || m.f25l || !m.resolve || typeof S === 'undefined' || !S) return; m.f25l = 1;
  const key = f25lKey(m.title), last = F25L.last[key], act = f25lActive() && !UI.replay;
  const empty = S.lib.length === 0;
  if (act && m.type === 'target' && (last || empty)){
    const ok = (m.cands || []).filter(c => c.ok !== false); let pick = null;
    if (empty){ const src = String(m.title || '').split(':')[0]; pick = ok.find(c => c.pid === MYPID && c.t !== 'player' && (c.nm || '') === src) || ok.find(c => c.pid === MYPID && c.t !== 'player');
      if (pick){ f25lStop(`your library is empty, so ${src} hits ${pick.nm} instead of an opponent`); } }
    else pick = ok.find(c => c.pid === last.pid && c.t === last.t && (c.nm || '') === last.nm) || ok.find(c => c.pid === last.pid && c.t === last.t);
    if (pick){ m.onClose = null; closeModal(); m.resolve([pick]); return; } }
  if (act && m.type === 'choice' && (last || empty)){
    const os = (m.options || []).filter(o => !o.disabled); let o = null;
    if (empty && /\bdraw\b/i.test((m.title || '') + ' ' + (m.text || ''))){ o = os.find(x => /^(no|don't|skip|decline)/i.test(x.label)); if (o) f25lStop('your library is empty, so no more cards are drawn'); }
    else if (last) o = os.find(x => x.value === last.v) || os.find(x => x.label === last.l);
    if (o){ m.onClose = null; closeModal(); m.resolve(o.value); return; } }
  // remember what the player answers, to repeat it while a loop runs
  const r = m.resolve; m.resolve = function(v){ try {
      if (m.type === 'target' && Array.isArray(v) && v[0]) F25L.last[key] = {pid:v[0].pid, t:v[0].t, nm:v[0].nm || ''};
      else if (m.type === 'choice'){ const o = (m.options || []).find(x => x.value === v); F25L.last[key] = {v, l:o && o.label}; } } catch {}
    return r.apply(this, arguments); };
} catch (e){ console.warn('f25 autopilot', e); } }, 80);
