/* ===================== v33: extra turns gained during another player's turn =====================
   CR 500.7: an extra turn is taken right after the turn it was created in. When I get one while it's
   someone else's turn (Nexus of Fate, Alrund's Epiphany, a miracle Temporal Mastery on their turn),
   it goes in right after THAT turn, then play goes on from the player after them.
   - my pending ones are published as x33 [{after, c, ts}]
   - the player whose turn it is hands the turn over when they pass, marking it ['x33']
   - the receiving player counts one off when that turn starts, and passes on from `after` when done */
{
  const cm = commit;
  commit = function(keepMenu){
    try { if (S && (S.xt || 0) > 0 && !UI.dry){ const [n, pid] = currentTurn();
        if (n > 0 && pid && pid !== MYPID){ S.x33 = (S.x33 || []).concat({after:pid, n, c:S.xt, ts:Date.now()}); log(`will take ${S.xt === 1 ? 'an extra turn' : S.xt + ' extra turns'} after ${nameOf(pid)}'s turn`); S.xt = 0; } } } catch (e){ console.warn('x33', e); }
    return cm(keepMenu);
  };
  const ps = publicState;
  publicState = function(){ const o = ps(); try { const l = (S.x33 || []).filter(e => e.c > 0); if (l.length) o.x33 = l; } catch {} return o; };
  const ss = sanitizeState;
  sanitizeState = function(st){ const o = ss(st); try { if (o && st){
      if (Array.isArray(st.x33)) o.x33 = st.x33.slice(0, 8).filter(e => e && typeof e.after === 'string').map(e => ({after:e.after.slice(0, 40), n:+e.n || 0, c:Math.max(0, Math.min(9, +e.c || 0)), ts:+e.ts || 0}));
      if (Array.isArray(st.turn) && st.turn[3] === 'x33' && Array.isArray(o.turn)) o.turn[3] = 'x33'; } } catch {} return o; };
  const smt = startMyTurn;
  startMyTurn = function(...a){
    try { const t = currentTurn(); const l = (S.x33 || []).filter(e => e.c > 0);
      if (t[3] === 'x33' && l.length && S.x33n !== t[0]){ S.x33n = t[0]; const e = l.sort((x, y) => y.ts - x.ts)[0]; e.c--; S.x33res = e.after; S.x33 = S.x33.filter(x => x.c > 0); log('takes an extra turn'); } } catch (e){ console.warn('x33 start', e); }
    return smt.apply(this, a);
  };
  const pt = passTurn;
  passTurn = function(){
    try { const [n, pid, g = 0] = currentTurn();
      if (n > 0 && pid === MYPID){
        // someone got an extra turn during this turn of mine: it comes next (the latest one first)
        let best = null; for (const [op, s] of OPP) for (const e of (s && s.x33) || []) if (e.after === MYPID && e.c > 0 && e.n <= n && (!best || e.ts > best.e.ts)) best = {op, e};
        if (best && players().some(p => p.pid === best.op) && !(S.x33given || []).includes(best.e.ts + ':' + n)){
          S.x33given = (S.x33given || []).slice(-20).concat(best.e.ts + ':' + n);
          S.turn = [n + 1, best.op, g, 'x33']; log(`passed the turn to ${nameOf(best.op)} (an extra turn)`); commit(); return; }
        // my own off-turn extra turns: more to take, or resume the normal order after the player I took them after
        if (!((S.xt || 0) > 0)){
          const mine = (S.x33 || []).filter(e => e.c > 0);
          if (mine.length && S.x33res){ S.turn = [n + 1, MYPID, g, 'x33']; log('passed the turn to themself'); commit(); return; }
          if (S.x33res){ const after = S.x33res; S.x33res = null;
            const np = typeof j18NextLive === 'function' ? j18NextLive(after) : null; const ps = players(); const i = ps.findIndex(p => p.pid === after);
            const next = np || (ps[(i < 0 ? 0 : i + 1) % ps.length] || {}).pid;
            if (next){ S.turn = [n + 1, next, g]; log(`extra turn over — passed the turn to ${next === MYPID ? 'themself' : nameOf(next)}`); commit(); return; } }
        }
      }
    } catch (e){ console.warn('x33 pass', e); }
    return pt();
  };
}
