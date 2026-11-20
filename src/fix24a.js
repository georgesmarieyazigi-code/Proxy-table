/* ---------------------------------------------------------------- fix24a: combos (v25) */
// The game is over once every opponent has lost (CR 104.2a). In a two-player game the loser stays in the player list,
// so a drain loop (Sanguine Bond + Exquisite Blood, Vito + Bloodthirsty Conqueror …) used to go on forever. No new
// triggers once the game is over, and my leftover triggers are removed from the stack.
function f24GameOver(){ try { if (!S || S.lost) return false; const o = [...OPP.keys()]; return o.length > 0 && o.every(pid => f27oppLost(pid)); } catch { return false; } }
{ const pt = pushTrigger;
  pushTrigger = function(...a){ const t = a[1] || {}; if (f24GameOver() && !/loses the game|lost the game|win the game/i.test(String(t.raw || '') + ' ' + String(t.eff || ''))){ if (!UI.f24over){ UI.f24over = 1; log('🏆 every opponent has lost — the game is over'); } return; } UI.f24over = 0; return pt.apply(this, a); };
  const et = engineTick;
  engineTick = function(...a){ const keep = i => i.kind !== 'trigger' || /win the game|loses the game|lost the game/i.test(String(i.txt || ''));
    try { if (f24GameOver() && S.stk.some(i => !keep(i)) && !UI.resolving){ S.stk = S.stk.filter(keep); log('the game is over — leftover triggers removed'); commit(); } } catch {} return et.apply(this, a); };
}
// "You win the game" (Thassa's Oracle, Laboratory Maniac, Jace, Approach …): every opponent loses (CR 104.2a).
// The win is announced in many places with a 🏆 log line; that line is the hook.
{ const lg = log;
  log = function(s, ...a){ const r = lg.call(this, s, ...a);
    try { if (!UI.dry && S && !S.lost && /\bwins? the game\b/i.test(String(s)) && !/lost the game after|every opponent has lost|can't win|cannot win|no win|would win|wins the game if/i.test(String(s))){
        const src = (String(s).match(/^(?:🏆\s*)?([^:]+):/) || [])[1] || 'a win';
        for (const p of opponents()) if (!f27oppLost(p.pid)) sendRq(p.pid, 'g23lose', 0, src.trim());
      } } catch (e){ console.warn('f24 win', e); }
    return r; }; }
// Power Artifact (and "Enchanted artifact's activated abilities cost {N} less … can't reduce the mana in that cost to less than one mana")
{ const ac = n24adjCost;
  n24adjCost = function(c, cost, ab, isMana){ let out = ac.apply(this, arguments);
    try { if (!S || !c || isMana) return out; let red = 0, floor = 0;
      for (const a of S.bf){ if (!a.att || a.att.id !== c.id || (a.att.pid && a.att.pid !== MYPID) || a.fd) continue; const o = info(a.k)?.o || ''; const m = o.match(/enchanted (?:artifact|creature|permanent)'s activated abilities cost \{(\d+)\} less to activate/i); if (!m) continue; red += +m[1]; if (/can't reduce the mana in that cost to less than one mana/i.test(o)) floor = 1; }
      if (red){ const parts = n24manaParts(out); const gen = n24genOf(out); const other = parts.length - (gen ? 1 : 0); const min = floor && other === 0 ? 1 : 0; out = n24setGeneric(out, Math.max(min, gen - red)); }
    } catch (e){ console.warn('f24 power artifact', e); }
    return out; }; }
// -1/-1 counters on my creatures: Melira ("can't have -1/-1 counters put on them") and Vizier of Remedies ("that many minus one")
function f24cmN(c, n){ try { if (!S || !c || !S.bf.includes(c) || !(n > 0)) return n; if (!isCreatureCard(c) && !/Creature/.test(info(c.k)?.t || '')) return n;
    let viz = 0;
    for (const s of S.bf){ if (s.fd || !s.k) continue; const o = info(s.k)?.o || '';
      if (/creatures you control can't have -1\/-1 counters put on them/i.test(o)) return 0;
      if (/if one or more -1\/-1 counters would be put on a creature you control, that many -1\/-1 counters minus one are put on it instead/i.test(o)) viz++; }
    const out = Math.max(0, n - viz); if (out !== n) log(`${cname(c)}: ${n} −1/−1 counter${n > 1 ? 's' : ''} became ${out} (replacement effects)`); return out; } catch { return n; } }
function f24cmAdd(c, n){ const k = f24cmN(c, n); if (k > 0){ c.cm = (c.cm || 0) + k; try { cancelCounters(c); } catch {} } return k; }
{ const mc = modCounters; modCounters = function(c, kind, n, ...a){ if (kind === 'cm') n = f24cmN(c, n); if (!(n > 0)) return 0; return mc.call(this, c, kind, n, ...a); }; }
// A loop nobody can stop by choice (Worldgorger Dragon + Animate Dead, two Worldgorgers, …): after 40 triggers from the
// same card within 30 seconds the table asks whether to keep going; "stop" ends the loop for this turn.
{ const pt = pushTrigger; const hist = new Map(); UI.f24blk = UI.f24blk || {};
  pushTrigger = function(src, t, ev, evPid){
    try { if (src && src.k && !UI.dry && !(UI.replay)){
        const k = src.k; const T = turnStr(); if (UI.f24blk[k] === T){ return; } if (typeof F25 !== 'undefined' && F25.bud[k] && F25.bud[k].T === T && Date.now() - F25.bud[k].last < 5000) return pt.apply(this, arguments);
        const now = Date.now(); const h = (hist.get(k) || []).filter(x => now - x < 30000); h.push(now); hist.set(k, h);
        if (h.length >= 40 && !UI.f24ask){ UI.f24ask = 1; const nm = info(k)?.n || 'A card'; UI.f24blk[k] = T;
          (async () => { try { const v = await askChoice({title:`${nm} has triggered ${h.length} times in a row — this looks like a loop that never ends`, options:[{label:'Stop the loop here', value:'stop'}, {label:'Keep going (40 more)', value:'go'}]});
              if (v === 'go'){ delete UI.f24blk[k]; hist.set(k, []); } else { log(`${nm}: stopped an endless loop (CR 104.4b — the game would be a draw if nobody could stop it)`); S.stk = S.stk.filter(i => i.k !== k || i.kind !== 'trigger'); commit(); } } finally { UI.f24ask = 0; } })();
          return; } } } catch (e){ console.warn('f24 loop', e); }
    return pt.apply(this, arguments); }; }
