/* ===================== Rules engine — round 24 helper Q: missing events and rare whole mechanics ===================== */
// New events (shared with every client through EV_TYPES): cast/play from a zone, permanents entering from exile, activated
// abilities, targets chosen, cards exiled from the battlefield / library / graveyard, cards put into a graveyard from a library,
// mill summaries, coin flips won, crew, explore results, life paid, investigate, players dealt damage, creatures dealt damage,
// attacks on a player, fights, time counters removed in exile, mutate, exploit, expend.
const Q24 = {};
EV_TYPES.push('qcast', 'qland', 'qentex', 'qact', 'qtgt', 'qexbf', 'qexlg', 'qlibgy', 'qlibgy1', 'qmill', 'qcoin', 'qcrew', 'qexpl', 'qpaylife', 'qinv', 'qpdealt', 'qcdealt', 'qatkd', 'qfight', 'qtimeoff', 'qmutate', 'qexploit', 'qexpend', 'qdaynight', 'qunstep', 'qtogy');
const Q24ZONE = {hand:1, gy:2, ex:3, cz:4, lib:5};
function q24Desc(k, d, o = {}){ d = String(d || '').trim(); if (!d) return true; if (!k) return false;
  if (/\bor\b/.test(d)) return d.split(/,\s*(?:or\s+)?|\s+or\s+/).map(x => x.trim()).filter(Boolean).some(x => descOk(k, sing(x), o));
  if (/,/.test(d)) return d.split(/,\s*/).every(x => descOk(k, sing(x.trim()), o));
  return descOk(k, sing(d), o); }
function q24Active(){ try { return currentTurn()[1]; } catch { return null; } }
function q24Src(src){ return src && S.bf.find(b => b.id === src.id); }
function q24Emit(ev){ if (!S || UI.dry) return; try { emit(ev); } catch (e){ console.warn(e); } }

/* ---------- Trigger wording → events ---------- */
function q24Classify(w, c){
  let m; const me = pid => pid === MYPID; const T = (ev, qf, extra = {}) => ({ev, subj:'any', ctl:'any', desc:'', qf, ...extra});
  if (w === 'at') return null;
  // discards by card type
  if ((m = c.match(/^an opponent discards an? (.+?) card$/))){ const d = m[1]; return T('discard', (s, ev, pid) => !me(pid) && q24Desc(ev.k, d)); }
  if ((m = c.match(/^you discard an? (.+?, .+?) card$/))){ const d = m[1]; return T('discard', (s, ev, pid) => me(pid) && q24Desc(ev.k, d)); }
  if (/^an opponent sacrifices a nontoken permanent or discards a permanent card$/.test(c)) return T('sac', (s, ev, pid) => !me(pid) && !!ev.k && (ev.type === 'sac' ? !ev.tok : /\b(Artifact|Creature|Enchantment|Land|Planeswalker|Battle)\b/.test(info(ev.k)?.t || '')), {evs:['sac', 'discard']});
  // sacrifices by anyone
  if ((m = c.match(/^an opponent sacrifices an? (.+)$/))){ const d = m[1]; return T('sac', (s, ev, pid) => !me(pid) && q24Desc(ev.k, d.replace(/^permanent$/, ''), {tok:ev.tok})); }
  if (/^a player sacrifices another permanent$/.test(c)) return T('sac', (s, ev, pid) => !(me(pid) && ev.id === s.id));
  // exile
  if ((m = c.match(/^an? (creature|permanent|nontoken creature) is exiled from the battlefield$/))){ const d = m[1]; return T('qexbf', (s, ev) => q24Desc(ev.k, d, {tok:ev.tok})); }
  if (/^one or more cards are put into exile from your library and\/or your graveyard$/.test(c)) return T('qexlg', (s, ev, pid) => me(pid), {batch:true});
  // cards put into a graveyard from a library
  if ((m = c.match(/^one or more (?:(land|creature|nonland|permanent) )?cards are put into your graveyard from your library$/))){ const d = m[1] || ''; return T('qlibgy', (s, ev, pid) => me(pid) && (!d || q24Ids(ev).some(id => { const x = find(id)[2]; return x && q24Desc(x.k, d); })), {qd:d}); }
  if ((m = c.match(/^an? (creature|permanent|land|nonland) card is put into (your|an opponent's) graveyard from (?:your|their) library$/))){ const d = m[1], who = m[2]; return T('qlibgy1', (s, ev, pid) => (who === 'your' ? me(pid) : !me(pid)) && q24Desc(ev.k, d)); }
  if ((m = c.match(/^a player mills one or more (creature|nonland|land|artifact) cards$/))){ const d = m[1]; return T('qmill', (s, ev) => q24MillN(ev, d) > 0); }
  if ((m = c.match(/^(a player|an opponent|you) mills? an? (creature|nonland|land) card$/))){ const d = m[2], who = m[1]; return T('qmill', (s, ev, pid) => (who === 'you' ? me(pid) : who === 'an opponent' ? !me(pid) : true) && q24MillN(ev, d) > 0, {qper:ev => q24MillN(ev, d)}); }
  // crimes, second draws
  if (/^an opponent commits a crime$/.test(c)) return T('crime', (s, ev, pid) => !me(pid));
  if ((m = c.match(/^a player draws their second card (during their turn|each turn)$/))){ const dur = /during/.test(m[1]); return T('draw', (s, ev, pid) => ev.nth === 2 && (!dur || q24Active() === pid)); }
  // damage to players / creatures
  if (/^you're dealt damage$/.test(c)) return T('qpdealt', (s, ev, pid) => me(pid));
  if (/^enchanted player is dealt damage$/.test(c)) return T('qpdealt', (s, ev, pid) => { const a = q24Src(s); return !!(a && a.att && a.att.id == null && a.att.pid === pid); });
  if (/^equipped creature is dealt damage$/.test(c)) return T('qcdealt', (s, ev, pid) => { const a = q24Src(s); return !!(a && a.att && a.att.id === ev.id && a.att.pid === pid && me(pid)); });
  // life loss of exactly 1
  if (/^one or more opponents each lose exactly 1 life$/.test(c)) return T('loselife', (s, ev, pid) => !me(pid) && ev.amt === 1, {batch:true});
  // activated abilities
  if ((m = c.match(/^an opponent activates an ability of an? (.+?)(?: on the battlefield| that isn't a mana ability)$/))){ const d = m[1]; return T('qact', (s, ev, pid) => !me(pid) && q24Desc(ev.k, d)); }
  // becoming the target
  if ((m = c.match(/^(another )?(?:an? )?(.+?) you control becomes the target of (a spell|a spell or ability|an ability)( an opponent controls)?$/))){ const other = !!m[1], d = m[2], kind = m[3], opp = !!m[4];
    return T('qtgt', (s, ev, pid) => ev.dp === MYPID && (!other || ev.id !== s.id) && q24Desc(ev.k, d) && (kind !== 'a spell' || ev.x === 1) && (kind !== 'an ability' || ev.x !== 1) && (!opp || !me(pid))); }
  if ((m = c.match(/^one or more (.+?) you control become the target of an? (activated ability|spell|spell or ability)$/))){ const d = m[1], kind = m[2]; return T('qtgt', (s, ev) => ev.dp === MYPID && q24Desc(ev.k, d) && (kind === 'spell' ? ev.x === 1 : kind === 'activated ability' ? ev.x === 2 : true), {batch:true}); }
  if ((m = c.match(/^~ becomes the target of (a spell|a spell or ability)( an opponent controls)?$/))){ const kind = m[1], opp = !!m[2]; return T('qtgt', (s, ev, pid) => ev.dp === MYPID && ev.id === s.id && (kind !== 'a spell' || ev.x === 1) && (!opp || !me(pid))); }
  // mana
  if ((m = c.match(/^an opponent taps an? (artifact|land) for mana$/))){ const d = m[1]; return T('manatap', (s, ev, pid) => !me(pid) && q24Desc(ev.k, d)); }
  // coin flips, crew, explore, life paid, investigate
  if (/^you win a coin flip$/.test(c)) return T('qcoin', (s, ev, pid) => me(pid));
  if ((m = c.match(/^~ becomes crewed$/))) return T('qcrew', (s, ev, pid) => me(pid) && ev.id === s.id);
  if ((m = c.match(/^a creature you control explores an? (land|nonland) card$/))){ const land = m[1] === 'land'; return T('qexpl', (s, ev, pid) => me(pid) && (land ? ev.x === 1 : ev.x === 2)); }
  if (/^you pay life$/.test(c)) return T('qpaylife', (s, ev, pid) => me(pid));
  if (/^you investigate for the first time each turn$/.test(c)) return T('qinv', (s, ev, pid) => me(pid) && ev.x === 1);
  // casting / playing from exile or not from hand
  if (/^you cast a spell from exile or a land you control enters from exile$/.test(c) || /^you cast a spell from exile and whenever a permanent you control enters from exile$/.test(c)){ const landOnly = /a land you control/.test(c); return T('qcast', (s, ev, pid) => me(pid) && (ev.type === 'qcast' ? ev.x === 3 : (!landOnly || isLand(ev.k))), {evs:['qcast', 'qentex']}); }
  if (/^you play a card from exile$/.test(c)) return T('qcast', (s, ev, pid) => me(pid) && ev.x === 3, {evs:['qcast', 'qland']});
  if (/^you play a land from exile or cast a spell from exile$/.test(c)) return T('qcast', (s, ev, pid) => me(pid) && ev.x === 3, {evs:['qcast', 'qland']});
  if (/^a player plays a land from exile or casts a spell from exile$/.test(c)) return T('qcast', (s, ev) => ev.x === 3, {evs:['qcast', 'qland']});
  if (/^another player casts a spell from anywhere other than their hand$/.test(c)) return T('qcast', (s, ev, pid) => !me(pid) && ev.x !== 1);
  if (/^you play a land or cast a spell from anywhere other than your hand$/.test(c)) return T('qcast', (s, ev, pid) => me(pid) && ev.x !== 1, {evs:['qcast', 'qland']});
  // time counters leaving an exiled card
  if (/^a time counter is removed from ~ while it's exiled$/.test(c)) return T('qtimeoff', (s, ev, pid) => me(pid) && ev.id === s.id, {qExile:true});
  // attacks on a player
  if (/^enchanted player is attacked$/.test(c)) return T('qatkd', (s, ev) => { const a = q24Src(s); return !!(a && a.att && a.att.id == null && a.att.pid === ev.dp); });
  if (/^two or more creatures you control attack a player$/.test(c)) return T('qatkd', (s, ev, pid) => me(pid) && ev.amt >= 2);
  if (/^an opponent attacks you with two or more creatures, draws their second card each turn, or casts their second spell each turn$/.test(c))
    return T('qatkd', (s, ev, pid) => !me(pid) && (ev.type === 'qatkd' ? ev.dp === MYPID && ev.amt >= 2 : ev.nth === 2), {evs:['qatkd', 'draw', 'cast']});
  // fights / blocked
  if (/^one or more creatures you control fight or become blocked$/.test(c)) return T('qfight', (s, ev, pid) => me(pid), {evs:['qfight', 'blocked'], batch:true});
  // zombies dealing combat damage to opponents
  if ((m = c.match(/^one or more (zombies|pirates|warriors|assassins|ninjas|rogues) you control deal combat damage to one or more of your opponents$/))){ const d = sing(m[1]); return T('cdmg', (s, ev, pid) => me(pid) && ev.dp && ev.dp !== MYPID && q24Desc(ev.k, d), {batch:true}); }
  // untap step
  if (/^you untap one or more permanents during your untap step$/.test(c)) return T('qunstep', (s, ev, pid) => me(pid) && ev.amt > 0);
  // mutate / exploit / expend / day-night
  if (/^~ mutates$/.test(c)) return T('qmutate', (s, ev, pid) => me(pid) && ev.id === s.id);
  if (/^~ exploits a creature$/.test(c)) return T('qexploit', (s, ev, pid) => me(pid) && ev.id === s.id);
  if ((m = c.match(/^you expend (\d+)$/))){ const n = +m[1]; return T('qexpend', (s, ev, pid) => me(pid) && ev.x === n); }
  if (/^day becomes night or night becomes day$/.test(c)) return T('qdaynight', (s, ev, pid) => me(pid));
  // the entering creature's own enters trigger (Aboleth Spawn)
  if (/^a creature entering under an opponent's control causes a triggered ability of that creature to trigger$/.test(c)) return T('enter', (s, ev, pid) => !me(pid) && !!ev.k && isCreatureCard({k:ev.k}) && q24EtbOf(ev.k).length > 0);
  // enchanted player draws / casts
  if (/^enchanted player draws a card$/.test(c)) return T('draw', (s, ev, pid) => { const a = q24Src(s); return !!(a && a.att && a.att.id == null && a.att.pid === pid); });
  if ((m = c.match(/^enchanted player casts an? (.+?) spell$/))){ const d = m[1]; return T('cast', (s, ev, pid) => { const a = q24Src(s); return !!(a && a.att && a.att.id == null && a.att.pid === pid) && q24Desc(ev.k, d); }); }
  // more activation triggers
  // the Ring
  if (/^you choose a creature as your ring-bearer$/.test(c)) return T('tempt', (s, ev, pid) => me(pid) && S.bf.some(x => x.ring));
  // commanders entering or attacking
  if (/^your commander enters or attacks$/.test(c)) return T('enter', (s, ev, pid) => me(pid) && !!S.bf.find(x => x.id === ev.id && x.cmd), {evs:['enter', 'attack']});
  // combat damage dealt to you
  if (/^one or more creatures deal combat damage to you$/.test(c)) return T('cdmg', (s, ev, pid) => ev.dp === MYPID && !me(pid), {batch:true});
  // attacking with a crowd / alone
  if ((m = c.match(/^~ and at least (one|two|three) other creatures? attack$/))){ const n = wn(m[1]) + 1; return T('qatkd', (s, ev, pid) => { const a = q24Src(s); return me(pid) && !!(a && a.atk) && q24Def(a) === ev.dp && S.bf.filter(x => x.atk).length >= n; }); }
  if ((m = c.match(/^equipped creature and at least (one|two) other creatures? attack$/))){ const n = wn(m[1]) + 1; return T('qatkd', (s, ev, pid) => { const e = q24Src(s); const h = e && e.att && S.bf.find(x => x.id === e.att.id); return me(pid) && !!(h && h.atk) && q24Def(h) === ev.dp && S.bf.filter(x => x.atk).length >= n; }); }
  if (/^~ or a commander you control attacks alone$/.test(c)) return T('qatkd', (s, ev, pid) => { if (!me(pid)) return false; const at = S.bf.filter(x => x.atk); return at.length === 1 && (at[0].id === s.id || !!at[0].cmd); });
  // cards put into your graveyard from anywhere
  if ((m = c.match(/^one or more (creature|land|artifact|enchantment|instant|sorcery|nonland|permanent) cards are put into your graveyard from anywhere during your turn$/))){ const d = m[1]; return T('qtogy', (s, ev, pid) => me(pid) && q24Active() === MYPID && q24Ids(ev).some(id => { const x = find(id)[2]; return x && q24Desc(x.k, d); })); }
  // legendary plays
  if (/^you play a legendary land or cast a legendary spell$/.test(c)) return T('cast', (s, ev, pid) => me(pid) && /Legendary/.test(info(ev.k)?.t || ''), {evs:['cast', 'land']});
  // Valkyrie's Call and friends: "a nontoken, non-Angel creature you control dies"
  if ((m = c.match(/^an? nontoken, (non-?\w+) creature you control dies$/))){ const d = m[1]; return T('die', (s, ev, pid) => me(pid) && !ev.tok && descOk(ev.k, d) && isCreatureCard({k:ev.k})); }
  // Rielle: the first discards each turn
  if (/^you discard one or more cards for the first time each turn$/.test(c)) return T('discard', (s, ev, pid) => { if (!me(pid)) return false; const key = s.id + ':' + turnStr(); Q24.firstDisc = Q24.firstDisc || {}; if (Q24.firstDisc[key]) return false; Q24.firstDisc[key] = 1; return true; }, {batch:true});
  // tokens
  if (/^you create a token$/.test(c)) return T('enter', (s, ev, pid) => me(pid) && !!ev.tok);
  if ((m = c.match(/^you create an? (blood|clue|food|treasure|map|junk|gold|powerstone) token$/))){ const d = m[1]; return T('enter', (s, ev, pid) => me(pid) && !!ev.tok && new RegExp('\\b' + d + '\\b', 'i').test(info(ev.k)?.n || info(ev.k)?.t || '')); }
  // sagas
  if (/^the final chapter ability of a saga you control triggers$/.test(c)) return T('sagaend', (s, ev, pid) => me(pid));
  // cast or attack
  if (/^you cast ~ and whenever ~ attacks$/.test(c)) return T('cast', (s, ev, pid) => me(pid) && ev.id === s.id, {evs:['cast', 'attack']});
  if (/^~ enters and whenever one or more assassins you control deal combat damage to a player$/.test(c)) return T('enter', (s, ev, pid) => me(pid) && (ev.type === 'enter' ? ev.id === s.id : !!ev.dp && /Assassin/.test(info(ev.k)?.t || '')), {evs:['enter', 'cdmg'], batch:true});
  if (/^enchanted permanent leaves the battlefield$/.test(c)) return T('leave', (s, ev, pid) => { const a = q24Src(s); return !!(a && a.att && a.att.id === ev.id && a.att.pid === pid); });
  return null;
}
function q24Def(c){ const d = parseDef(c.atk); return d ? attackTargetProtector(d) : null; }
function q24MillN(ev, d){ const p = String(ev.dp || '').split(','); const [tot, land, cre, nl] = [+ev.amt || 0, +p[0] || 0, +p[1] || 0, +p[2] || 0]; return d === 'creature' ? cre : d === 'land' ? land : d === 'nonland' ? nl : d === 'artifact' ? (+p[4] || 0) : tot; }
function q24Ids(ev){ return (Q24.batches && Q24.batches[ev.n]) || []; }
function q24EtbOf(k){ try { return trigsOf(k, false).filter(t => t.ev === 'enter' && (t.subj === 'self' || t.subj === 'selfOr') && !t.qf); } catch { return []; } }
{
  const ct = classifyTrig;
  classifyTrig = function(w, c){ const r = q24Classify(w, c); if (r) return r; return ct(w, c); };
  // lines whose trigger condition contains commas ("discards a noncreature, nonland card"): try later comma positions
  const tg = trigsOf;
  trigsOf = function(k, fl){
    const out = tg(k, fl); if (out.q24) return out; out.q24 = true;
    try { const a = info(k); const f = a ? (fl && a.back ? a.back : a) : null; if (!f) return out;
      for (const line of q24Lines(f)){ const r = q24Split(line); if (!r) continue; const i = out.findIndex(t => t.raw === line); if (i >= 0) out.splice(i, 1, r); else out.push(r); }
    } catch (e){ console.warn(e); }
    return out;
  };
  const sm = subjMatch;
  subjMatch = function(t, src, ev, pid){ if (t && t.qf) return true; return sm(t, src, ev, pid); };
  const pt = pushTrigger;
  pushTrigger = function(src, t, ev, evPid){
    if (t && t.qf){
      if (!ev || !t.qf(src, ev, evPid)) return;
      const n = t.qper ? Math.min(20, t.qper(ev)) : 1;
      for (let i = 0; i < n; i++){ const n0 = S.stk.length; pt(src, t, ev, evPid); const it = S.stk[S.stk.length - 1];
        if (S.stk.length > n0 && it){ it.qev = ev.type; it.evN = ev.amt || it.evN; it.evDp = ev.dp || it.evDp; if (ev.type === 'qatkd') it.qatk = evPid; if (Q24.batches && Q24.batches[ev.n]) it.qids = Q24.batches[ev.n].slice(); if (ev.type === 'qact') it.qact = 1; } }
      return;
    }
    return pt(src, t, ev, evPid);
  };
}
function q24Lines(f){ const lines = []; for (const l of tname(f.o, f.n).split('\n')){ if (/^\s*•/.test(l) && lines.length) lines[lines.length - 1] += '\n' + l.trim(); else lines.push(l.trim()); } return lines.filter(Boolean); }
function q24Split(line){
  const m = line.match(/^(when|whenever|at) ([\s\S]+)$/i); if (!m) return null;
  const rest = m[2]; let i = rest.indexOf(', '); let first = true;
  while (i >= 0){ if (!first){ const cond = rest.slice(0, i).toLowerCase().trim(); const eff = rest.slice(i + 2).trim(); const cl = q24Classify(m[1].toLowerCase(), cond); if (cl && eff) return {...cl, eff, raw:line}; } first = false; i = rest.indexOf(', ', i + 2); }
  return null;
}
// the checker: lines with comma conditions
{
  const cc = checkCard;
  checkCard = async function(k){
    const r = await cc(k);
    try { const a = info(k); if (r && r.issues && a){ const faces = a.back ? [a, a.back] : [a];
      for (const f of faces) for (const line of q24Lines(f)){ const cl = q24Split(line); if (!cl) continue; const txt = line.replace(/~/g, f.n);
        const had = r.issues.filter(x => (x.kind === 'trigger' && x.text === txt) || (x.kind === 'effect' && x.where === txt)); if (!had.length) continue;
        had.forEach(x => r.issues.splice(r.issues.indexOf(x), 1)); const miss = await dryAll(cl.eff.replace(/~/g, f.n), k, f.n); miss.forEach(t => r.issues.push({kind:'effect', text:t, where:txt})); }
      if (!r.issues.length) r.ok = Math.max(1, r.ok || 0); } } catch (e){ console.warn(e); }
    return r;
  };
}

/* ---------- Emitting the new events ---------- */
// zone tracking: every commit compares where each of my cards is with the last commit
function q24Snap(){ const m = new Map(); for (const z of ['lib', 'gy', 'ex', 'bf', 'hand']) for (const c of S[z] || []) m.set(c.id, [z, c]); return m; }
function q24Diff(){
  if (!S || UI.dry) return; if (Q24.snapS !== S){ Q24.snapS = S; Q24.snap = q24Snap(); return; }
  const now = q24Snap(); const prev = Q24.snap; Q24.snap = now;
  const libGy = [], exLG = [], toGy = [];
  for (const [id, [z, c]] of now){ const p = prev.get(id); if (!p){ if (z === 'gy') toGy.push(c); continue; } const pz = p[0];
    if (pz === 'lib' && z === 'gy') libGy.push(c);
    if (pz !== 'gy' && z === 'gy') toGy.push(c);
    if ((pz === 'lib' || pz === 'gy') && z === 'ex') exLG.push(c); }
  if (libGy.length){ const ev = {type:'qlibgy', cnt:1, amt:libGy.length}; Q24.pend = Q24.pend || []; Q24.pend.push([ev, libGy.map(c => c.id)]);
    libGy.slice(0, 15).forEach(c => Q24.pend.push([{type:'qlibgy1', k:c.k, id:c.id, cnt:1}, null])); }
  if (toGy.length) (Q24.pend = Q24.pend || []).push([{type:'qtogy', cnt:1, amt:toGy.length}, toGy.map(c => c.id)]);
  if (exLG.length) (Q24.pend = Q24.pend || []).push([{type:'qexlg', cnt:1, amt:exLG.length}, exLG.map(c => c.id)]);
}
function q24Flush(){ const p = Q24.pend; if (!p || !p.length) return; Q24.pend = []; for (const [ev, ids] of p){ q24Emit(ev); if (ids && ev.n){ Q24.batches = Q24.batches || {}; Q24.batches[ev.n] = ids; const ks = Object.keys(Q24.batches); if (ks.length > 60) delete Q24.batches[ks[0]]; } } }
{
  const cm = commit;
  commit = function(...a){ try { q24Diff(); } catch (e){ console.warn(e); } const r = cm.apply(this, a); try { q24Flush(); } catch (e){ console.warn(e); } return r; };
  // exile from the battlefield (tokens too); entering from exile
  const mc = moveCard;
  moveCard = function(id, to, o = {}){
    const [from, , c] = find(id); const k = c && (c.origK || c.k); const tok = c && c.tok ? 1 : 0;
    const r = mc(id, to, o);
    try { if (c && S && !UI.dry && from !== to){ const [now] = find(id);
      if (from === 'bf' && now !== 'bf' && (now === 'ex' || (tok && to === 'ex'))) q24Emit({type:'qexbf', k, id, tok, cnt:1});
      if (from === 'ex' && now === 'bf') q24Emit({type:'qentex', k:c.k, id, cnt:1}); } } catch (e){ console.warn(e); }
    return r;
  };
  // casting: remember the zone it was cast from
  const em = emit;
  emit = function(ev){
    const r = em(ev);
    try { if (S && ev && !UI.dry){
      if (ev.type === 'cast' && ev.id != null){ const it = S.stk.find(x => x.kind === 'spell' && x.card && x.card.id === ev.id); const z = it && it.from; em({type:'qcast', k:ev.k, id:ev.id, nth:ev.nth || 0, x:Q24ZONE[z] || 6, cnt:1}); }
    } } catch (e){ console.warn(e); }
    return r;
  };
  const pl = playLand;
  playLand = function(c, o){ const z = c && find(c.id)[0]; const r = pl(c, o); try { if (c && S.bf.some(b => b.id === c.id)) q24Emit({type:'qland', k:c.k, id:c.id, x:Q24ZONE[z] || 6, cnt:1}); } catch {} return r; };
  // activated abilities (not mana abilities); targets chosen by abilities vs spells; crew
  const aa = activateAbility;
  activateAbility = async function(c, ab){
    const n0 = S.stk.length; const tapped0 = new Set(S.bf.filter(x => x.tap).map(x => x.id)); const life0 = S.life; const crewed0 = c && c.anim;
    UI.qAct = (UI.qAct || 0) + 1; let r;
    try { r = await aa(c, ab); } finally { UI.qAct--; }
    try { if (!UI.dry && c){
      const didCrew = ab && ab.crew && c.anim === 'crew' && S.bf.some(x => x.id !== c.id && x.tap && !tapped0.has(x.id));
      if (S.stk.length > n0 || didCrew) q24Emit({type:'qact', k:c.k, id:c.id, cnt:1});
      if (didCrew){ const crew = S.bf.filter(x => x.id !== c.id && x.tap && !tapped0.has(x.id) && isCreatureCard(x)); c.qCrewT = turnStr(); c.qCrewers = crew.map(x => x.id); c.qCrewN = (c.qCrewNT === turnStr() ? c.qCrewN || 0 : 0) + 1; c.qCrewNT = turnStr(); q24Emit({type:'qcrew', k:c.k, id:c.id, x:crew.length, nth:c.qCrewN, cnt:1}); }
      if (S.life < life0) q24Emit({type:'qpaylife', amt:life0 - S.life, cnt:1}); } } catch (e){ console.warn(e); }
    return r;
  };
  const ctg = chooseTargets;
  chooseTargets = async function(text, src, name){
    const r = await ctg(text, src, name);
    try { if (!UI.dry){ const kind = UI.qAct ? 2 : UI.casting ? 1 : 3; const seen = new Set();
      (Array.isArray(r) ? r.flat(2) : []).filter(t => t && t.t === 'card' && t.pid && t.k).forEach(t => { const key = t.pid + ':' + t.id; if (seen.has(key)) return; seen.add(key); q24Emit({type:'qtgt', k:t.k, id:t.id, dp:t.pid, x:kind, cnt:1}); }); } } catch (e){ console.warn(e); }
    return r;
  };
  // damage to creatures
  const dc = damageCard;
  damageCard = function(c, n, f){ const r = dc(c, n, f); try { if (r > 0 && c && S && S.bf.includes(c) && isCreatureCard(c)) q24Emit({type:'qcdealt', k:c.k, id:c.id, amt:r, cnt:1}); } catch {} return r; };
  // explore: was the revealed card a land?
  const ex = explore;
  explore = async function(c, ctx){ const top = S.lib[0]; const r = await ex(c, ctx); try { if (c && top) q24Emit({type:'qexpl', k:c.k, id:c.id, x:isLand(top.k) ? 1 : 2, cnt:1}); } catch {} return r; };
  // mill summary: lands, creatures, nonland, card types, artifacts
  const ml = mill;
  mill = function(n = 1){ const before = S.lib.slice(0, n); const r = ml(n); try { const gone = before.filter(c => !S.lib.includes(c)); if (gone.length){ const ty = new Set(gone.flatMap(c => typesOf(c.k))).size;
    q24Emit({type:'qmill', cnt:1, amt:gone.length, dp:[gone.filter(c => isLand(c.k)).length, gone.filter(c => isCreatureCard(c)).length, gone.filter(c => !isLand(c.k)).length, ty, gone.filter(c => /Artifact/.test(info(c.k)?.t || '')).length].join(',')}); } } catch (e){ console.warn(e); } return r; };
  // suspend: a time counter removed while exiled
  if (typeof R21BOP === 'object' && R21BOP.susTick){ const st = R21BOP.susTick; R21BOP.susTick = async it => { const c = S.ex.find(x => x.id === it.srcId); const t0 = c && (c.nc || {}).time; const r = await st(it); try { if (c && (c.nc || {}).time < t0) q24TimeOff(c); } catch (e){ console.warn(e); } return r; }; }
  // combat: one event per attacked player when attackers are declared
  const ss = setStep;
  setStep = function(step){ const r = ss(step); try { if (step === 'atkd' && S.cb && !UI.dry){ const key = S.cb.t + ':' + (S.cb.n || 0); if (Q24.atkKey !== key){ Q24.atkKey = key; const by = {};
    S.bf.filter(c => c.atk).forEach(c => { const d = parseDef(c.atk); const p = d && attackTargetProtector(d); if (p){ (by[p] = by[p] || []).push(c); } });
    Object.entries(by).forEach(([p, cs]) => q24Emit({type:'qatkd', dp:p, amt:cs.length, k:cs[0].k, id:cs[0].id, cnt:1})); } } } catch (e){ console.warn(e); } return r; };
}
function q24TimeOff(c){ q24Emit({type:'qtimeoff', k:c.k, id:c.id, cnt:1});
  // the exiled card's own trigger (it isn't on the battlefield, so handleEvent doesn't look at it)
  for (const t of trigsOf(c.k, false)) if (t.ev === 'qtimeoff' && t.qExile) pushTrigger({k:c.k, id:c.id, fl:false}, t, {type:'qtimeoff', k:c.k, id:c.id, cnt:1}, MYPID); }

async function doRound24QPre(s, l, ctx){
  let m; const name = ctx.name || ''; const it = ctx.it || {}; const full = String(info(ctx.k)?.o || ctx.full || '').toLowerCase();
  const say = t => doSentence(cap(t), ctx); const srcC = srcCardOf(ctx); const lt = name ? l.split(name.toLowerCase()).join('~') : l;
  // ---- curses: "Each opponent attacking that player does the same"
  if (/^each opponent attacking (?:that|target) player does the same$/.test(l)){
    const atk = it.qatk; const prev = String(ctx.q24prev || '');
    if (atk && atk !== MYPID && OPP.has(atk)){ let mm;
      if ((mm = prev.match(/^create (.+)$/i))){ sendRq(atk, 'tokText', 0, name, {d:mm[1].replace(/\.$/, '')}); log(`${nameOf(atk)} also creates ${mm[1]} (${name})`); }
      else if (/^you draw a card$/i.test(prev)){ sendRq(atk, 'draw', 1, name); log(`${nameOf(atk)} also draws a card (${name})`); }
      else if ((mm = prev.match(/^you draw (\w+) cards$/i))){ sendRq(atk, 'draw', wn(mm[1]) || 1, name); }
      commit(); }
    return true; }
  // ---- Hedge Shredder: the land cards that just went from the library to the graveyard
  if (/^put them onto the battlefield tapped$/.test(l) && (it.qids || (UI.dry && /graveyard from your library/.test(full)))){
    const want = /one or more land cards/.test(full) ? 'land' : ''; let n = 0;
    for (const id of it.qids || []){ const c = S.gy.find(g => g.id === id); if (!c || (want && !isLand(c.k))) continue; moveCard(id, 'bf'); const b = S.bf.find(x => x.id === id); if (b){ b.tap = true; n++; } }
    if (n) log(`${name}: put ${n} land${n === 1 ? '' : 's'} onto the battlefield tapped`); commit(); return true; }
  // ---- It That Betrays / Tergrid: the sacrificed or discarded card
  if (/^(?:you may )?put that card (?:from a graveyard )?onto the battlefield under your control$/.test(l) && (it.qev === 'sac' || it.qev === 'discard' || (UI.dry && /sacrifices|discards/.test(full)))){
    if (!it.evk) return true; if (/^you may/.test(l) && !UI.dry && !(await askYes(`${name}: put ${info(it.evk)?.n || 'that card'} onto the battlefield under your control?`, 'Yes', 'No'))) return true;
    if (!it.evPid || it.evPid === MYPID){ const c = S.gy.find(g => g.id === it.evId) || S.gy.find(g => g.k === it.evk); if (c) moveCard(c.id, 'bf'); }
    else { const ok = await q24WaitGy(it.evPid, it.evk); if (ok){ sendRq(it.evPid, 'gytake', 0, name, {d:it.evk}); log(`${name}: puts ${info(it.evk)?.n} from ${nameOf(it.evPid)}'s graveyard onto the battlefield under my control`); } else log(`${name}: ${info(it.evk)?.n} is no longer in a graveyard`); }
    commit(); return true; }
  // ---- Treasure Nabber
  if (/^gain control of that artifact until the end of your next turn$/.test(l)){
    if (it.evPid && it.evPid !== MYPID && it.evId != null){ (Q24.nab = Q24.nab || []).push({k:it.evk, from:it.evPid, n:currentTurn()[0], t:Date.now()}); sendRq(it.evPid, 'steal', 0, name, {tid:it.evId}); log(`${name}: gains control of ${info(it.evk)?.n || 'that artifact'} until the end of my next turn`); commit(); }
    return true; }
  // ---- Bonecrusher Giant
  if ((m = lt.match(/^(?:~|it) deals (\d+) damage to that spell's controller$/)) && (it.qev === 'qtgt' || UI.dry)){
    const p = it.evPid; const n = +m[1]; if (p){ if (p === MYPID) dealDamage({t:'player', pid:MYPID}, n, ctx.k, srcC); else sendRq(p, 'pdmg', n, name, {f:srcFlags(ctx.k, MYPID, srcC)}); log(`${name} deals ${n} damage to ${nameOf(p)}`); } commit(); return true; }
  // ---- War's Toll
  if (/^tap all lands that player controls$/.test(l)){ const p = it.evPid; if (p && p !== MYPID){ sendRq(p, 'qtapLands', 0, name); log(`${name}: taps all lands ${nameOf(p)} controls`); } else if (p === MYPID){ S.bf.filter(c => isLand(c.k)).forEach(c => { c.tap = true; }); } commit(); return true; }
  // ---- Maddening Hex
  if (/^~ deals damage to (?:that|target) player equal to the result$/.test(lt) && (srcC || UI.dry)){
    const p = srcC && srcC.att && srcC.att.id == null ? srcC.att.pid : it.evPid; const n = ctx.roll || 0; if (p && n){ if (p === MYPID) dealDamage({t:'player', pid:MYPID}, n, ctx.k, srcC); else sendRq(p, 'pdmg', n, name, {f:srcFlags(ctx.k, MYPID, srcC)}); log(`${name} deals ${n} damage to ${nameOf(p)}`); } commit(); return true; }
  if (/^(?:then )?attach ~ to another one of your opponents chosen at random$/.test(lt)){
    if (srcC && srcC.att){ const os = opponents().filter(o => o.pid !== srcC.att.pid); if (os.length){ const o = os[Math.floor(Math.random() * os.length)]; srcC.att = {pid:o.pid}; log(`${name} is now attached to ${o.nm}`); } } commit(); return true; }
  // ---- Aboleth Spawn: copy the entering creature's enters trigger
  if (/^copy that ability$/.test(l) && (it.qev === 'enter' || (UI.dry && /entering under an opponent's control/.test(full)))){
    if (!it.evk) return true; const tr = q24EtbOf(it.evk)[0]; if (!tr) return true;
    const cp = {sid:rid(6), o:nextO(), kind:'trigger', k:it.evk, nm:info(it.evk)?.n + ' (copy)', txt:tr.eff, srcId:null}; S.stk.push(cp); S.pass = 's:' + cp.sid;
    log(`${name}: copies ${info(it.evk)?.n}'s enters ability`); commit(); return true; }
  if (/^you may choose new targets for the copy$/.test(l) && (it.qev === 'enter' || UI.dry) && /entering under an opponent's control/.test(full)) return true;
  // ---- Curator's Ward
  if ((m = l.match(/^if it was historic, (.+)$/)) && (it.evk || UI.dry)){ const k = it.evk; const hist = k && (/Legendary/.test(info(k)?.t || '') || /\b(Artifact|Saga)\b/.test(info(k)?.t || '')); if (hist || UI.dry) await say(s.slice(s.length - m[1].length)); else log(`${name}: it wasn't historic`); return true; }
  // ---- numbers with thousands separators
  if ((m = l.match(/^each opponent loses (\d{1,3}(?:,\d{3})+) life$/))){ await say(`each opponent loses ${m[1].replace(/,/g, '')} life`); return true; }
  // ---- Mobilizer Mech
  if (/^up to one other target vehicle you control becomes an artifact creature until end of turn$/.test(l)){ const t = (ctx.tgts ? nextTargets(ctx) : [])[0]; const c = t && t.pid === MYPID && S.bf.find(x => x.id === t.id); if (c && c !== srcC && /Vehicle/.test(typeOf(c))){ c.anim = 'crew'; log(`${cname(c)} becomes an artifact creature until end of turn`); } commit(); return true; }
  // ---- Erdwal Illuminator
  if (/^investigate an additional time$/.test(l)){ await say('Investigate'); return true; }
  // ---- Undead Alchemist / Grolnok: the card that went from a library to a graveyard
  if (/^exile that card$/.test(l) && (it.qev === 'qlibgy1' || (UI.dry && /graveyard from (?:their|your) library/.test(full)))){
    if (it.evk){ if (!it.evPid || it.evPid === MYPID){ const c = S.gy.find(g => g.id === it.evId); if (c) moveCard(c.id, 'ex'); } else sendRq(it.evPid, 'r23Igyex', 0, name, {d:it.evk}); log(`${name}: exiles ${info(it.evk)?.n}`); }
    commit(); return true; }
  if (/^exile it with a croak counter on it$/.test(l) && (it.qev === 'qlibgy1' || UI.dry)){
    const c = it.evId != null && S.gy.find(g => g.id === it.evId); if (c){ moveCard(c.id, 'ex'); const e = S.ex.find(x => x.id === c.id); if (e) addNamed(e, 'croak', 1); log(`${name}: exiled ${cname(c)} with a croak counter`); } commit(); return true; }
  // ---- Harsh Mentor / Rings: the trigger only sees non-mana abilities
  if ((m = l.match(/^if it isn't a mana ability, (.+)$/)) && (it.qact || UI.dry)){ await say(s.slice(s.length - m[1].length)); return true; }
  // ---- Monk Gyatso: airbend the targeted creature
  if (/^(?:you may )?airbend that creature$/.test(l)){ const c = it.evId != null && S.bf.find(x => x.id === it.evId);
    if (c && (UI.dry || await askYes(`${name}: airbend ${cname(c)}?`, 'Airbend', 'No'))){ moveCard(c.id, 'ex'); const e = find(c.id)[2]; if (e){ e.airK = 1; grantPlay([e.id], {cast:true, src:name, alt:'{2}'}); } log(`${name}: airbent ${cname(c)} (its owner may cast it for {2})`); }
    commit(); return true; }
  // ---- Exploit
  if (/^exploit$/.test(l)){ await q24Exploit(ctx); return true; }
  // ---- keywords that act when the spell is cast (handled at cast time), not on resolution
  if (/^(demonstrate|undaunted)$/.test(l)) return true;
  if (it.q24demo && /^demonstrate: you may copy (?:this spell|~)$/.test(lt)){
    const sp = stackAll().find(x => x.sid === it.tgt); if (!sp){ log(`${name}: the spell is gone`); return true; }
    if (!UI.dry && await askYes(`Demonstrate: copy ${sp.nm}?`, 'Copy it', 'No')){
      await copyMany({...ctx, it:{...it, tgt:sp.sid}}, 1); const os = opponents();
      const pid = os.length === 1 ? os[0].pid : await askChoice({title:`${sp.nm}: choose an opponent to also copy it`, options:os.map(p => ({label:p.nm || nameOf(p.pid), value:p.pid}))});
      if (pid){ sendRq(pid, 'qcopyK', 0, name, {d:sp.k}); log(`${nameOf(pid)} also copies ${sp.nm}`); } }
    commit(); return true; }
  if (it.q24demo && /^if you do, choose an opponent to also copy it$/.test(l)) return true;
  // ---- Final Fortune / Last Chance
  if (/^at the beginning of that turn's end step, you lose the game$/.test(l)){ if (!UI.dry){ S.qLoseAfter = currentTurn()[0]; S.qLoseSrc = name; log(`${name}: will lose the game at the end of the extra turn`); commit(); } return true; }
  // ---- Meld
  if ((m = lt.match(/^(?:if )?you both own and control (?:~|this land|this creature|this artifact) and an? (creature|artifact|land) named (.+?), exile them$/)) || (m = lt.match(/^if (?:~) and a (creature) named (.+?) are attacking, and you both own and control them, exile them$/))){
    if (ctx.qMeldOk === false){ ctx.qMeld = null; return true; }
    const other = s.slice(s.length - (m[2].length + ', exile them'.length), s.length - ', exile them'.length); const me0 = srcC && S.bf.includes(srcC) && !srcC.own ? srcC : null;
    const mate = S.bf.find(b => b !== me0 && !b.own && !b.fd && info(b.k)?.n === other && (m[1] !== 'creature' || isCreatureCard(b)));
    const att = /are attacking/.test(lt); if (me0 && mate && (!att || (me0.atk && mate.atk))){ ctx.qMeld = [me0.id, mate.id]; ctx.qMeldAtk = att ? me0.atk : ''; } else { ctx.qMeld = null; log(`${name}: can't meld — you don't own and control both ${name} and ${other}${att ? ' attacking' : ''}`); }
    return true; }
  if ((m = l.match(/^(?:then )?meld them into (.+)$/))){ if (ctx.qMeld){ const into = s.slice(s.length - m[1].length); await q24Meld(ctx, ctx.qMeld, into, {attacking:!!ctx.qMeldAtk}); const mm = ctx.lastT && S.bf.find(b => b.id === ctx.lastT[0].id); if (mm && ctx.qMeldAtk){ mm.tap = true; mm.atk = ctx.qMeldAtk; } } ctx.qMeld = null; return true; }
  if ((m = l.match(/^if there are (\w+) or more land cards in your graveyard$/))){ ctx.qMeldOk = S.gy.filter(c => isLand(c.k)).length >= (wn(m[1]) || 0); if (!ctx.qMeldOk && !UI.dry) log(`${name}: fewer than ${m[1]} land cards in your graveyard`); return true; }
  if (/^it enters tapped and attacking$/.test(l) && /meld them into/.test(full)) return true;
  // ---- emblems for opponents
  if ((m = l.match(/^(each opponent|target opponent|target player) gets an emblem with ["“](.+?)["”]?$/))){
    const ps = m[1] === 'each opponent' ? opponents().map(p => p.pid) : ((ctx.tgts ? nextTargets(ctx) : []).filter(t => t.t === 'player').map(t => t.pid));
    for (const pid of ps){ if (pid === MYPID){ const t = q24EmbText(ctx.k); if (t) makeEmblem(t.replace(/\.?$/, '.'), name); } else { sendRq(pid, 'qemb', 0, name, {d:ctx.k}); log(`${nameOf(pid)} gets an emblem (${name})`); } }
    commit(); return true; }
  if ((m = l.match(/^this emblem deals (\d+) damage to you$/))){ dealDamage({t:'player', pid:MYPID}, +m[1], ctx.k, null); commit(); return true; }
  // ---- Colossal Grave-Reaver: one of the creature cards that went from the library to the graveyard
  if (/^put one of them onto the battlefield$/.test(l) && (it.qids || (UI.dry && /graveyard from your library/.test(full)))){
    const d = /one or more creature cards/.test(full) ? 'creature' : ''; const list = (it.qids || []).map(id => S.gy.find(g => g.id === id)).filter(c => c && (!d || isCreatureCard(c)));
    if (list.length){ const ids = list.length === 1 ? [list[0].id] : await pickCards({title:`${name}: put one of them onto the battlefield`, cards:list, min:1, max:1}); if (ids && ids[0] != null){ moveCard(ids[0], 'bf'); log(`${name}: put ${cname(find(ids[0])[2] || list[0])} onto the battlefield`); } }
    commit(); return true; }
  // ---- day / night
  if (/^if it's night, it becomes day$/.test(l)){ ctx.qDNdone = q24DN() === 'night'; if (ctx.qDNdone) q24SetDN('day', name); return true; }
  if (/^otherwise, it becomes night$/.test(l)){ if (!ctx.qDNdone) q24SetDN('night', name); return true; }
  // ---- planar die (no planes in a Commander game: chaos and planeswalk have nothing to act on)
  if (/^roll the planar die$/.test(l)){ const r = 1 + Math.floor(Math.random() * 6); const res = r === 1 ? 'chaos' : r === 6 ? 'planeswalk' : 'blank'; ctx.planar = res; log(`🎲 ${name}: planar die — ${res}${res !== 'blank' ? ' (no plane is in play, so nothing happens)' : ''}`); commit(); return true; }
  // ---- control another player's turn
  if ((m = l.match(/^you (?:control target player during that player's next turn|gain control of target opponent during that player's next turn)$/))){
    const t = (ctx.tgts ? nextTargets(ctx) : []).find(x => x.t === 'player'); if (t && t.pid !== MYPID){ ctx.qSlavePid = t.pid; sendRq(t.pid, 'qslave', /gain control of target opponent/.test(l) && /takes an extra turn/.test(full) ? 1 : 0, name); log(`${name}: I control ${nameOf(t.pid)} during their next turn`); } commit(); return true; }
  if (/^after that turn, that player takes an extra turn$/.test(l)) return true;   // sent with the control request: their client adds the extra turn
  // ---- Sorin, Lord of Innistrad −6
  if (/^return each card put into a graveyard this way to the battlefield under your control$/.test(l)){
    for (const t of (ctx.lastT || ctx.tgtsAll || []).filter(x => x && x.t === 'card')){ if (t.pid === MYPID){ const c = S.gy.find(g => g.id === t.id); if (c) moveCard(c.id, 'bf'); } else if (t.k && await q24WaitGy(t.pid, t.k)){ sendRq(t.pid, 'gytake', 0, name, {d:t.k}); log(`${name}: returns ${info(t.k)?.n} under my control`); } }
    commit(); return true; }
  // ---- opponents' libraries
  if ((m = l.match(/^target opponent reveals the top x cards of their library$/))){ const t = (ctx.tgts ? nextTargets(ctx) : []).find(x => x.t === 'player') || (opponents()[0] && {pid:opponents()[0].pid}); const x = (it.x || ctx.x || 0);
    ctx.qRev = null; if (t && t.pid !== MYPID && x > 0){ const r = await q24LibReq(t.pid, 'qlib', x, name, 'top'); if (r){ ctx.qRev = {pid:t.pid, ks:r.ks, x}; log(`${name}: ${nameOf(t.pid)} reveals ${r.ks.map(k => info(k)?.n).join(', ')}`); } } commit(); return true; }
  if ((m = l.match(/^you may put a nonland permanent card with mana value x or less from among them onto the battlefield under your control$/))){ const R = ctx.qRev; if (!R) return true;
    const ok = R.ks.filter(k => !isLand(k) && /\b(Artifact|Creature|Enchantment|Planeswalker|Battle)\b/.test(info(k)?.t || '') && (info(k)?.mv || 0) <= R.x);
    const v = ok.length ? await askChoice({title:`${name}: put one onto the battlefield under your control?`, options:[...ok.map(k => ({label:info(k)?.n, value:k})), {label:'None', value:''}]}) : '';
    if (v){ await q24LibReq(R.pid, 'qlibTake', 0, name, v); R.ks.splice(R.ks.indexOf(v), 1); log(`${name}: put ${info(v)?.n} onto the battlefield under my control`); } R.left = R.ks.length; commit(); return true; }
  if (/^(?:target|that) player puts the rest on the bottom of their library in a random order$/.test(l) && (ctx.qRev || UI.dry)){ const R = ctx.qRev; if (R && R.left) sendRq(R.pid, 'qlibBottom', R.left, name); commit(); return true; }
  if ((m = l.match(/^each opponent reveals cards from the top of their library until they reveal x land cards$/))){ ctx.qMG = it.x || ctx.x || 0; return true; }
  if (/^(?:then )?puts? all cards revealed this way into their graveyard$/.test(l) && ctx.qMG != null){ const x = ctx.qMG; if (x > 0) opponents().forEach(p => sendRq(p.pid, 'qrevMill', x, name)); log(`${name}: each opponent reveals until ${x} land${x === 1 ? '' : 's'} and mills them`); commit(); return true; }
  if ((m = l.match(/^each opponent exiles cards from the top of their library until they have exiled cards with total mana value (\d+) or greater this way$/))){ opponents().forEach(p => sendRq(p.pid, 'qexMvGive', +m[1], name)); ctx.qDH = true; log(`${name}: each opponent exiles cards until total mana value ${m[1]}`); commit(); return true; }
  if (/^until end of turn, you may cast cards exiled this way without paying their mana costs$/.test(l) && (ctx.qDH || UI.dry)) return true;   // the cards arrive with permission to cast them free this turn
  if ((m = l.match(/^search (that|target) player's library for an? (artifact|creature|land|enchantment|instant|sorcery) card and exile it$/))){
    const pid = m[1] === 'that' ? (it.evDp || it.evPid) : ((ctx.tgts ? nextTargets(ctx) : []).find(x => x.t === 'player') || {}).pid; ctx.qThada = null;
    if (pid && pid !== MYPID){ const r = await q24LibReq(pid, 'qlib', 0, name, m[2]); const ks = r ? r.ks : [];
      const v = ks.length ? (ks.length === 1 ? ks[0] : await askChoice({title:`${name}: exile which ${m[2]} card from ${nameOf(pid)}'s library?`, options:ks.map(k => ({label:info(k)?.n, value:k}))})) : null;
      if (v){ sendRq(pid, 'qlibTake', 1, name, {d:v, f:{other:true}}); ctx.qThada = v; log(`${name}: exiles ${info(v)?.n} from ${nameOf(pid)}'s library`); } else if (r) sendRq(pid, 'qlibBottom', 0, name); }
    commit(); return true; }
  if (/^then that player shuffles$/.test(l) && (ctx.qThada !== undefined || UI.dry)) return true;  // shuffled when the card is taken
  if (/^until end of turn, you may play that card$/.test(l) && (ctx.qThada !== undefined || UI.dry)) return true;   // the exiled card comes with permission to play it this turn
  // ---- piles
  if ((m = l.match(/^separate all permanents target player controls into two piles$/))){ const t = (ctx.tgts ? nextTargets(ctx) : []).find(x => x.t === 'player'); ctx.qPiles = null; if (!t) return true;
    const list = t.pid === MYPID ? S.bf.filter(c => !c.emb).map(c => ({id:c.id, k:c.k})) : (OPP.get(t.pid)?.bf || []).filter(c => c.k && !c.emb).map(c => ({id:c.id, k:c.k}));
    const ids = UI.dry || !list.length ? [] : await pickCards({title:`${name}: choose pile 1 of ${nameOf(t.pid)}'s permanents (the rest is pile 2)`, cards:list, min:0, max:list.length});
    ctx.qPiles = {pid:t.pid, p:[list.filter(c => (ids || []).includes(c.id)), list.filter(c => !(ids || []).includes(c.id))]}; return true; }
  if (/^(?:that|target) player sacrifices all permanents in the pile of their choice$/.test(l) && (ctx.qPiles || UI.dry)){ const P = ctx.qPiles; if (!P) return true;
    const lbl = p => p.length ? p.map(c => info(c.k)?.n).join(', ').slice(0, 38) : '(empty)';
    let i = 0; if (P.pid === MYPID) i = +(await askChoice({title:`${name}: sacrifice which pile?`, q24local:true, options:[{label:'Pile 1: ' + lbl(P.p[0]), value:'0'}, {label:'Pile 2: ' + lbl(P.p[1]), value:'1'}]})) || 0;
    else i = +(await q24Ask(P.pid, {kind:'choice', title:'sacrifice which pile?', opts:['Pile 1: ' + lbl(P.p[0]), 'Pile 2: ' + lbl(P.p[1])]}, name)) || 0;
    const ids = P.p[i].map(c => c.id); if (P.pid === MYPID) S.bf.filter(c => ids.includes(c.id)).forEach(c => moveCard(c.id, 'gy', {sac:true})); else q24SendIds(P.pid, 'qsacIds', ids, name);
    log(`${name}: ${nameOf(P.pid)} sacrifices pile ${i + 1} (${ids.length} permanent${ids.length === 1 ? '' : 's'})`); commit(); return true; }
  if (/^each opponent separates the creatures they control into two piles$/.test(l)){ ctx.qOppPiles = {}; for (const p of opponents()){ const r = await q24LibReq(p.pid, 'qpiles', 0, name); let pp = [[], []]; try { if (r) pp = JSON.parse(r.d); } catch {} ctx.qOppPiles[p.pid] = pp; } return true; }
  if (/^for each opponent, you choose one of their piles$/.test(l) && (ctx.qOppPiles || UI.dry)){ ctx.qOppPick = {}; for (const [pid, pp] of Object.entries(ctx.qOppPiles || {})){ const lbl = p => p.length ? p.map(x => x[1]).join(', ').slice(0, 38) : '(empty)';
    ctx.qOppPick[pid] = +(await askChoice({title:`${name}: which of ${nameOf(pid)}'s piles do they sacrifice?`, q24local:true, options:[{label:'Pile 1: ' + lbl(pp[0]), value:'0'}, {label:'Pile 2: ' + lbl(pp[1]), value:'1'}]})) || 0; } return true; }
  if (/^each opponent sacrifices the creatures in their chosen pile$/.test(l) && (ctx.qOppPick || UI.dry)){ for (const [pid, i] of Object.entries(ctx.qOppPick || {})){ const ids = ((ctx.qOppPiles[pid] || [])[i] || []).map(x => x[0]); if (ids.length) q24SendIds(pid, 'qsacIds', ids, name); log(`${name}: ${nameOf(pid)} sacrifices ${ids.length} creature${ids.length === 1 ? '' : 's'}`); } commit(); return true; }
  if (/^choose an opponent$/.test(l) && /face-down pile and a face-up pile/.test(full)){ const os = opponents(); ctx.qSR = os.length === 1 || UI.dry ? (os[0] || {}).pid : await askChoice({title:`${name}: choose an opponent`, q24local:true, options:os.map(p => ({label:p.nm || nameOf(p.pid), value:p.pid}))}); return true; }
  if (/^they look at the top four cards of your library and separate them into a face-down pile and a face-up pile$/.test(l)){ const top = S.lib.slice(0, 4); ctx.qSRp = null; if (!top.length) return true;
    let down = []; if (ctx.qSR && !UI.dry){ const a = await q24Ask(ctx.qSR, {kind:'pick', title:`${name}: choose the face-down pile (the rest is face up)`, ks:top.map(c => c.k), min:0, max:top.length}); down = String(a || '').split(',').filter(x => x !== '').map(Number); }
    ctx.qSRp = [top.filter((c, i) => down.includes(i)), top.filter((c, i) => !down.includes(i))]; log(`${name}: face-up pile — ${ctx.qSRp[1].map(cname).join(', ') || 'empty'}; face-down pile — ${ctx.qSRp[0].length} card${ctx.qSRp[0].length === 1 ? '' : 's'}`); return true; }
  if (/^put one pile into your hand and the other into your graveyard$/.test(l) && (ctx.qSRp || UI.dry)){ const P = ctx.qSRp; if (!P) return true;
    const i = +(await askChoice({title:`${name}: which pile goes to your hand?`, q24local:true, options:[{label:`Face-down pile (${P[0].length} card${P[0].length === 1 ? '' : 's'})`, value:'0'}, {label:'Face-up pile: ' + (P[1].map(cname).join(', ').slice(0, 40) || 'empty'), value:'1'}]})) || 0;
    P[i].forEach(c => moveCard(c.id, 'hand')); P[1 - i].forEach(c => moveCard(c.id, 'gy')); log(`${name}: put ${P[i].length} card${P[i].length === 1 ? '' : 's'} into hand and ${P[1 - i].length} into the graveyard`); commit(); return true; }
  // ---- secret simultaneous choices
  if (/^each player secretly chooses a number 0 or greater$/.test(l)){ ctx.qNums = {}; if (UI.dry) return true;
    const asks = opponents().map(p => q24Ask(p.pid, {kind:'num', title:'secretly choose a number 0 or greater'}, name).then(v => { ctx.qNums[p.pid] = Math.max(0, +v || 0); }));
    ctx.qNums[MYPID] = Math.max(0, +(await askNumber(`${name}: secretly choose a number 0 or greater`, 'The others choose at the same time.', 0)) || 0); await Promise.all(asks); return true; }
  if (/^(?:then )?all players reveal those numbers simultaneously and determine the highest and lowest numbers revealed this way$/.test(l) && (ctx.qNums || UI.dry)){ const v = Object.values(ctx.qNums || {}); ctx.qHi = v.length ? Math.max(...v) : 0; ctx.qLo = v.length ? Math.min(...v) : 0; log(`${name}: ${Object.entries(ctx.qNums || {}).map(([p, n]) => nameOf(p) + ' ' + n).join(', ')}`); return true; }
  if (/^~ deals damage equal to the highest number to each player who chose that number$/.test(lt) && (ctx.qNums || UI.dry)){ const hi = ctx.qHi || 0; if (hi > 0) for (const [p, n] of Object.entries(ctx.qNums || {})){ if (n !== hi) continue; if (p === MYPID) dealDamage({t:'player', pid:MYPID}, hi, ctx.k, srcC); else sendRq(p, 'pdmg', hi, name, {f:srcFlags(ctx.k, MYPID, srcC)}); } commit(); return true; }
  if (/^(?:then )?draws seven cards$/.test(l) && ctx.qWheelDone) return true;
  if (/^each player who didn't choose the lowest number discards their hand(?:, then draws seven cards)?$/.test(l) && (ctx.qNums || UI.dry)){ ctx.qWheelDone = true; for (const [p, n] of Object.entries(ctx.qNums || {})){ if (n === ctx.qLo) continue; if (p === MYPID){ UI.discarding = []; S.hand.slice().forEach(c => moveCard(c.id, 'gy')); UI.discarding = null; draw(7); } else sendRq(p, 'qwheel', 0, name); } commit(); return true; }
  if (/^each opponent chooses fame or fortune$/.test(l)){ ctx.qFame = {}; if (UI.dry) return true; await Promise.all(opponents().map(p => q24Ask(p.pid, {kind:'choice', title:'choose fame or fortune', opts:['Fame', 'Fortune']}, name).then(v => { ctx.qFame[p.pid] = +v === 0 ? 'fame' : 'fortune'; log(`${nameOf(p.pid)} chose ${ctx.qFame[p.pid]}`); }))); return true; }
  if (/^for each player who chose fame, gain control of a creature that player controls until end of turn$/.test(l) && (ctx.qFame || UI.dry)){ for (const [pid, v] of Object.entries(ctx.qFame || {})){ if (v !== 'fame') continue; const cr = (OPP.get(pid)?.bf || []).filter(c => c.k && isCreatureCard(c)); if (!cr.length) continue;
    const ids = cr.length === 1 ? [cr[0].id] : await pickCards({title:`${name}: gain control of which of ${nameOf(pid)}'s creatures?`, cards:cr.map(c => ({id:c.id, k:c.k})), min:1, max:1}); if (ids && ids[0] != null){ sendRq(pid, 'steal', 0, name, {tid:ids[0], f:{eot:true, untap:true, haste:true}}); log(`${name}: gains control of ${info(cr.find(c => c.id === ids[0]).k)?.n} until end of turn`); } } commit(); return true; }
  if (/^untap those creatures and they gain haste until end of turn$/.test(l) && (ctx.qFame || UI.dry)) return true;   // sent with the control change (untap + haste)
  if (/^for each player who chose fortune, you draw a card and create a treasure token$/.test(l) && (ctx.qFame || UI.dry)){ const n = Object.values(ctx.qFame || {}).filter(v => v === 'fortune').length; for (let i = 0; i < n; i++){ draw(1); await createFromText('Create a Treasure token', ctx); } commit(); return true; }
  if (/^each player chooses a creature type$/.test(l)){ ctx.qTypes = []; if (UI.dry) return true; const tys = q24CreatureTypes(); if (!tys.length) return true;
    const mine = await askChoice({title:`${name}: choose a creature type`, q24local:true, options:tys.slice(0, 30).map(t => ({label:t, value:t}))}); if (mine) ctx.qTypes.push(mine);
    const opts = tys.slice(0, 8); await Promise.all(opponents().map(p => q24Ask(p.pid, {kind:'choice', title:'choose a creature type', opts}, name).then(v => { const t = opts[+v]; if (t){ ctx.qTypes.push(t); log(`${nameOf(p.pid)} chose ${t}`); } }))); return true; }
  if (/^each player returns all creature cards of a type chosen this way from their graveyard to the battlefield$/.test(l) && (ctx.qTypes || UI.dry)){ const tys = [...new Set(ctx.qTypes || [])]; if (!tys.length) return true; q24Bid(tys, name); opponents().forEach(p => sendRq(p.pid, 'qbid', 0, name, {d:tys.join(',').slice(0, 80)})); commit(); return true; }
  return false;
}
function q24Re(x){ return String(x).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
async function q24WaitGy(pid, k){ if (UI.dry) return false; const t0 = Date.now(); while (Date.now() - t0 < 6000){ if ((OPP.get(pid)?.gy || []).includes(k)) return true; await new Promise(r => setTimeout(r, 200)); } return (OPP.get(pid)?.gy || []).includes(k); }
RQ_OPS.push('qtapLands');
{
  const ao = applyOp;
  applyOp = function(r, from){
    if (r && r.op === 'qtapLands'){ S.bf.filter(c => isLand(c.k)).forEach(c => { c.tap = true; }); log(`${r.src || 'an effect'}: all my lands are tapped`); commit(); return; }
    return ao(r, from);
  };
  // Treasure Nabber: the borrowed artifact goes back at the end of my next turn
  const tk = takeCard;
  takeCard = function(r, from){ const n0 = S.bf.length; const out = tk(r, from);
    try { const w = (Q24.nab || []).findIndex(x => x.from === from && r.c && x.k === r.c.k && Date.now() - x.t < 60000); if (w >= 0 && S.bf.length > n0){ const c = S.bf[S.bf.length - 1]; c.qBackN = Q24.nab[w].n; Q24.nab.splice(w, 1); } } catch (e){ console.warn(e); }
    return out; };
  const tc = turnChanged;
  turnChanged = function(...a){ const prev = Q24.prevTurn; try { Q24.prevTurn = currentTurn().slice(); } catch {}
    try { if (prev && prev[1] === MYPID) for (const c of S.bf.slice()) if (c.own && c.qBackN != null && prev[0] > c.qBackN) sendBack(c, 'bf'); } catch (e){ console.warn(e); }
    return tc.apply(this, a); };
}
// sentence-level events: investigate, coin flips won, life paid, fights
{
  const ds = doSentence;
  doSentence = async function(s0, ctx){
    const l = String(s0).replace(/\.$/, '').trim().toLowerCase(); const life0 = S ? S.life : 0;
    const r = await ds(s0, ctx);
    try { if (S && !UI.dry && ctx){
      if (/^investigate$/.test(l)){ S.qInv = S.qInv && S.qInv.t === turnStr() ? S.qInv : {t:turnStr(), n:0}; S.qInv.n++; q24Emit({type:'qinv', x:S.qInv.n === 1 ? 1 : 0, cnt:1}); }
      if (/^flip a coin$/.test(l) && ctx.coin === 'heads') q24Emit({type:'qcoin', x:1, cnt:1});
      if (/^flip a coin until you lose a flip$/.test(l) && ctx.h23wins) for (let i = 0; i < Math.min(ctx.h23wins, 20); i++) q24Emit({type:'qcoin', x:1, cnt:1});
      if (/^(?:you may )?pay (\d+|x) life$/.test(l) && S.life < life0) q24Emit({type:'qpaylife', amt:life0 - S.life, cnt:1});
      if (/\bfights?\b/.test(l) && !/\bcan't\b|\bwhenever\b/.test(l)) q24Emit({type:'qfight', cnt:1});
    } ctx.q24prev = String(s0).replace(/\.$/, '').trim(); } catch (e){ console.warn(e); }
    return r;
  };
  // the untap step: how many permanents untapped
  const sp = setPhase;
  setPhase = function(i){ let before = null; try { if (i === 0 && S && !UI.dry) before = new Set(S.bf.filter(c => c.tap).map(c => c.id)); } catch {}
    const r = sp(i);
    try { if (before){ const n = S.bf.filter(c => before.has(c.id) && !c.tap).reduce((a, c) => a + (c.n || 1), 0); q24Emit({type:'qunstep', amt:n, cnt:1}); } } catch (e){ console.warn(e); }
    return r; };
}
{ const ds = doSentence; doSentence = async function(s0, ctx){ const s = String(s0).replace(/\.$/, '').trim(); const l = s.toLowerCase(); if (l && await doRound24QPre(s, l, ctx)) return; return ds(s0, ctx); }; }

/* ===================== Whole mechanics ===================== */
// ---------- Exploit: "When this creature enters, you may sacrifice a creature." ----------
{
  const tg = trigsOf;
  trigsOf = function(k, fl){ const out = tg(k, fl); if (out.q24x) return out; out.q24x = true;
    try { const a = info(k); const f = a ? (fl && a.back ? a.back : a) : null; if (f && /^exploit$/im.test(tname(f.o, f.n)) && /\bCreature\b/.test(f.t || '')) out.push({ev:'enter', subj:'self', ctl:'you', desc:'', eff:'Exploit.', raw:'exploit'}); } catch {}
    return out; };
}
async function q24Exploit(ctx){
  const src = srcCardOf(ctx); if (!src || !S.bf.includes(src)) return;
  const list = S.bf.filter(c => isCreatureCard(c) && !c.fd); if (!list.length) return;
  const ids = UI.dry ? [] : await pickCards({title:`${cname(src)} — exploit: you may sacrifice a creature`, cards:list, min:0, max:1, noneLabel:"Don't sacrifice"});
  const v = ids && ids[0] != null && S.bf.find(c => c.id === ids[0]); if (!v) return;
  moveCard(v.id, 'gy', {sac:true}); log(`${cname(src)} exploits ${cname(v)}`);
  // the "when ~ exploits a creature" ability triggers even if it sacrificed itself
  for (const t of trigsOf(src.k, src.fl)) if (t.ev === 'qexploit') pushTrigger({k:src.k, id:src.id, fl:src.fl}, {...t, qf:null}, {type:'qexploit', k:src.k, id:src.id, cnt:1}, MYPID);
  commit();
}
// ---------- Expend: mana spent on spells this turn ----------
{
  const am = addMana;
  addMana = function(outs){ try { if (UI.qCastAdd != null) UI.qCastAdd += (outs || []).length; } catch {} return am(outs); };
  const bc = beginCast;
  beginCast = async function(c, zone, o = {}){
    const n0 = S.stk.length; const p0 = poolTotal(S.pool); UI.qCastAdd = 0; let r;
    try { r = await bc(c, zone, o); } finally {
      try { const it = S.stk.length > n0 ? S.stk.find(x => x.kind === 'spell' && x.card && c && x.card.id === c.id) : null;
        if (it && !UI.dry){ const spent = Math.max(0, p0 + (UI.qCastAdd || 0) - poolTotal(S.pool)); it.qspent = spent;
          if (UI.qMutCast === c.id){ it.qmut = 1; UI.qMutCast = null; await q24MutTarget(it); }
          if (spent){ if (!S.qExp || S.qExp.t !== turnStr()) S.qExp = {t:turnStr(), n:0}; const a = S.qExp.n; S.qExp.n += spent; for (let i = a + 1; i <= Math.min(S.qExp.n, 20); i++) q24Emit({type:'qexpend', x:i, cnt:1}); } } } catch (e){ console.warn(e); }
      UI.qCastAdd = null; UI.qMutCast = null; }
    return r;
  };
}
// ---------- Day and night ----------
RQ_OPS.push('qdn', 'qemb', 'qcopyK');
function q24SetDN(v, src, quiet){
  if (!S || (S.qDN || '') === v) return; const was = S.qDN || ''; S.qDN = v; log(`it becomes ${v}${src ? ' (' + src + ')' : ''}`);
  if (!quiet) for (const p of opponents()) sendRq(p.pid, 'qdn', 0, src || 'day/night', {d:v});
  if (was) q24Emit({type:'qdaynight', cnt:1}); commit();
}
function q24DN(){ if (S && S.qDN) return S.qDN; for (const s of OPP.values()) if (s.qDN) return s.qDN; return ''; }
{
  const ep = enginePublic; enginePublic = function(){ const o = ep(); try { o.qDN = S.qDN || ''; o.q24 = r18PubQ24(S.q24pub || []); } catch {} return o; };
  const se = sanitizeEngine; sanitizeEngine = function(s){ const o = se(s); try { o.qDN = s.qDN === 'day' || s.qDN === 'night' ? s.qDN : '';
    o.q24 = Array.isArray(s.q24) ? s.q24.slice(-6).map(x => ({ref:String(x.ref || '').slice(0, 16), d:String(x.d || '').slice(0, 300), ks:(Array.isArray(x.ks) ? x.ks.slice(0, 80) : []).map(k => typeof k === 'string' ? k.slice(0, 80) : '').filter(Boolean)})) : []; } catch {} return o; };
  const tc = turnChanged;
  turnChanged = function(...a){ const prev = Q24.prevTurnDN; try { Q24.prevTurnDN = currentTurn().slice(); } catch {}
    try { if (prev && prev[1] === MYPID && q24DN()){ S.qDN = S.qDN || q24DN(); const n = (S.casts || []).filter(x => x.t === turnStr(prev)).length;
      if (S.qDN === 'day' && n === 0) q24SetDN('night', 'no spells were cast'); else if (S.qDN === 'night' && n >= 2) q24SetDN('day', 'two or more spells were cast'); } } catch (e){ console.warn(e); }
    return tc.apply(this, a); };
  const oe = onEnter;
  onEnter = function(c, from, o = {}){ const r = oe(c, from, o);
    try { const t = tname(info(c.k)?.o || '', info(c.k)?.n || '');
      if (/^if it's neither day nor night, it becomes day as ~ enters\.?$/im.test(t) && !q24DN() && !UI.dry) q24SetDN('day', cname(c));
      // Auras with "Enchant player/opponent" (curses) are attached to a player
      if (/\bAura\b/.test(info(c.k)?.t || '') && !c.att && S.bf.includes(c)){ const ed = enchantDesc(t); if (ed && /^(player|opponent)$/.test(ed)) q24AttachPlayer(c, ed); }
    } catch (e){ console.warn(e); }
    return r; };
}
STATIC_KNOWN.push(/^if it's neither day nor night, it becomes day as ~ enters\.?$/i);
async function q24AttachPlayer(c, ed){
  const ps = ed === 'opponent' ? opponents() : players(); if (!ps.length) return;
  let pid = ps[0].pid;
  if (!UI.dry && ps.length > 1){ const v = await askChoice({title:`${cname(c)}: enchant which ${ed}?`, options:ps.map(p => ({label:p.nm || nameOf(p.pid), value:p.pid}))}); if (v) pid = v; }
  c.att = {pid}; log(`${cname(c)} enchants ${nameOf(pid)}`); commit();
}
// ---------- Mutate ----------
function q24MutKeys(k){ return String(k).slice(4).split('|').filter(Boolean); }
function q24MutInfo(k, parts){
  parts = parts || q24MutKeys(k); const fs = parts.map(x => info(x)).filter(Boolean); if (!fs.length) return null; const top = fs[0];
  const o = fs.map(f => f.o || '').join('\n'); return {...top, k, o, back:null, lay:'normal', tok:false};
}
{
  const df = deriveFace;
  deriveFace = function(k){ if (typeof k === 'string' && k.startsWith('mut:')){ const a = q24MutInfo(k); if (a){ DICT.set(k, a); return a; } return null; } return df(k); };
  const ac = altCosts;
  altCosts = function(c, zone = 'hand'){ const out = ac(c, zone);
    try { const a = info(c.k); const m = a && /\bCreature\b/.test(a.t || '') && (a.o || '').match(/^Mutate ((?:\{[^}]+\})+)/m);
      if (m && zone === 'hand'){ const ok = S.bf.some(b => isCreatureCard(b) && !b.fd && !/\bHuman\b/.test(typeOf(b)) && !b.own); const p = payPlan(spellCost(c, zone, {alt:{mana:m[1]}}).cost, S.pool);
        out.push({label:`Mutate ${m[1]} (onto a non-Human creature you own)`, mana:m[1], extra:[], ok:ok && !p.err, why:!ok ? 'you own no non-Human creature on the battlefield' : (p.err || ''), q24mut:true}); } } catch (e){ console.warn(e); }
    return out; };
  const sc = spellCost;
  spellCost = function(c, zone, o = {}){ const r = sc(c, zone, o);
    try { if (o && o.alt && o.alt.q24mut && UI.casting) UI.qMutCast = c.id;
      // Undaunted: costs {1} less for each opponent
      const a = info(c.k); if (a && hasKwText(a, 'undaunted')){ const n = Math.min(opponents().length, r.cost.gen); if (n){ r.cost.gen -= n; r.notes.push(`undaunted −${n}`); } } } catch (e){ console.warn(e); }
    return r; };
  const rt = resolveTop;
  resolveTop = async function(it, ...a){
    if (it && it.kind === 'spell' && it.qmut && it.card && !UI.resolving){
      const tg = it.qmutT != null && S.bf.find(b => b.id === it.qmutT && isCreatureCard(b) && !/\bHuman\b/.test(typeOf(b)));
      if (tg){ const i = S.stk.indexOf(it); if (i >= 0){ S.stk.splice(i, 1); await q24Merge(it.card, tg); return; } }
      log(`${it.nm}: the mutate target is gone — it enters as a creature`);
    }
    return rt(it, ...a);
  };
  const mc = moveCard;
  moveCard = function(id, to, o = {}){
    const [from, , c] = find(id);
    if (from === 'bf' && to !== 'bf' && c && c.qMutObjs && c.qMutObjs.length){
      const objs = c.qMutObjs; c.qMutObjs = null; c.k = c.qMutBase || c.k; c.qMutBase = null; DICT.has(c.k);
      const r = mc(id, to, o); const [now] = find(id); const z = now && now !== 'bf' ? now : (['gy', 'hand', 'lib', 'ex'].includes(to) ? to : 'gy');
      for (const x of objs){ x.fl = false; if (z === 'lib'){ if (o.bottom) S.lib.push(x); else S.lib.unshift(x); } else S[z].push(x); }
      log(`the cards merged under ${cname(c)} go to the ${z === 'gy' ? 'graveyard' : z === 'ex' ? 'exile' : z === 'lib' ? 'library' : 'hand'} too`); commit(); return r;
    }
    return mc(id, to, o);
  };
}
async function q24MutTarget(it){
  const list = S.bf.filter(b => isCreatureCard(b) && !b.fd && !/\bHuman\b/.test(typeOf(b)) && !b.own);
  const ids = list.length === 1 ? [list[0].id] : await pickCards({title:`${it.nm}: mutate onto which non-Human creature you own?`, cards:list, min:1, max:1});
  it.qmutT = ids && ids[0] != null ? ids[0] : null; const t = S.bf.find(b => b.id === it.qmutT); it.tgtNm = t ? cname(t) : ''; if (t) log(`${it.nm} will mutate onto ${cname(t)}`); commit();
}
async function q24Merge(card, tg){
  const onTop = UI.dry ? true : (await askChoice({title:`${info(card.k)?.n}: mutate over or under ${cname(tg)}?`, options:[{label:`On top — it becomes ${info(card.k)?.n}`, value:'top'}, {label:`Underneath — it stays ${cname(tg)}`, value:'under'}]})) !== 'under';
  const base = tg.qMutBase || tg.k; const cur = tg.qMutParts || [base];
  const parts = onTop ? [card.k, ...cur] : [cur[0], card.k, ...cur.slice(1)];
  const k = 'mut:' + parts[0] + '|' + parts[parts.length - 1]; const inf = q24MutInfo(k, parts); if (inf) DICT.set(k, inf);
  tg.qMutBase = base; tg.qMutParts = parts; tg.qMutObjs = [...(tg.qMutObjs || []), card]; tg.k = k;
  if (typeof TRIG_CACHE !== 'undefined') TRIG_CACHE.delete(k); if (typeof AB_CACHE !== 'undefined') AB_CACHE.delete(k);
  log(`${info(card.k)?.n} mutated ${onTop ? 'onto' : 'under'} ${info(base)?.n} — it is now ${inf ? inf.n : cname(tg)} with all their abilities`);
  q24Emit({type:'qmutate', k:tg.k, id:tg.id, cnt:1}); commit();
}
// ---------- Meld ----------
const Q24MELD = {"Gisela, the Broken Blade":"Brisela, Voice of Nightmares", "Bruna, the Fading Light":"Brisela, Voice of Nightmares", "Hanweir Battlements":"Hanweir, the Writhing Township", "Hanweir Garrison":"Hanweir, the Writhing Township",
  "Urza, Lord Protector":"Urza, Planeswalker", "The Mightstone and Weakstone":"Urza, Planeswalker", "Titania, Voice of Gaea":"Titania, Gaea Incarnate", "Argoth, Sanctum of Nature":"Titania, Gaea Incarnate",
  "Mishra, Claimed by Gix":"Mishra, Lost to Phyrexia", "Phyrexian Dragon Engine":"Mishra, Lost to Phyrexia", "Graf Rats":"Chittering Host", "Midnight Scavengers":"Chittering Host"};
async function q24FetchNamed(nm){
  for (const a of DICT.values()) if (a && a.n === nm) return a;
  try { const c = await sf('/cards/named?exact=' + encodeURIComponent(nm)); if (c && c.object === 'card'){ const a = addInfo(infoFrom(c)); return a; } } catch (e){ console.warn(e); }
  return null;
}
async function q24Meld(ctx, ids, into, o = {}){
  const cs = ids.map(id => S.bf.find(b => b.id === id)).filter(Boolean); if (cs.length < 2) return;
  const a = UI.dry ? null : await q24FetchNamed(into);
  if (!a && !UI.dry){ log(`${ctx.name}: couldn't load ${into} — meld didn't happen`); return; }
  if (UI.dry) return;
  const objs = cs.map(c => { const i = S.bf.indexOf(c); S.bf.splice(i, 1); onLeave(c, 'ex', {cp:c.cp || 0, cm:c.cm || 0}); reset(c); return c; });
  const m = {id:S.nid++, k:a.k, tap:!!o.tapped, qMutObjs:objs, qMutBase:a.k, sk:!o.haste}; place(m); S.bf.push(m);
  log(`${objs.map(cname).join(' and ')} meld into ${a.n}`); onEnter(m, 'ex', {}); if (o.attacking){ m.tap = true; const d = objs.map(x => x.atkWas).find(Boolean); if (d) m.atk = d; } commit();
  ctx.lastT = [{t:'card', pid:MYPID, id:m.id, k:m.k, nm:a.n}];
}
// ---------- Emblems for opponents ----------
function q24EmbText(k){ const o = String(info(k)?.o || ''); const m = o.match(/(?:each opponent|target opponent|target player|each player) gets? an emblem with ["“]([^"”]+)["”]/i); return m ? m[1] : null; }
{
  const ao = applyOp;
  applyOp = function(r, from){
    if (r && r.op === 'qdn'){ if (r.d === 'day' || r.d === 'night'){ S.qDN = ''; q24SetDN(r.d, r.src, true); } return; }
    if (r && r.op === 'qemb'){ const t = q24EmbText(r.d); if (t) makeEmblem(t.replace(/\.?$/, '.'), r.src || 'emblem'); return; }
    if (r && r.op === 'qcopyK'){ (async () => { const k = r.d; const a = info(k); if (!a) return; let tgts = null; const txt = a.o || '';
      if (targetSpecs(txt).length){ tgts = await chooseTargets(txt, {pid:MYPID, col:a.c, types:a.t, id:null}, `${a.n} (copy)`); }
      const cp = {sid:rid(6), o:nextO(), kind:'spell', k, nm:`${a.n} (copy)`, txt, x:0, copy:true, tgts, tgtNm:tgtLabel(tgts)}; S.stk.push(cp); S.pass = 's:' + cp.sid; log(`copied ${a.n} (${r.src})`); commit(); })(); return; }
    return ao(r, from);
  };
}
// ---------- Demonstrate: when you cast it, you may copy it; then an opponent copies it too ----------
{
  const ct = castTriggers;
  castTriggers = function(c, a, it){ const r = ct(c, a, it);
    try { if (a && hasKwText(a, 'demonstrate')) pushTrig(a.n, 'Demonstrate: you may copy this spell. If you do, choose an opponent to also copy it.', {k:c.k, tgt:it.sid, q24demo:1}); } catch (e){ console.warn(e); }
    return r; };
}

// Final Fortune: lose at the beginning of the extra turn's end step
{
  const fs = fireSteps;
  fireSteps = function(step, activePid){
    try { if (step === 'end' && activePid === MYPID && S.qLoseAfter != null && currentTurn()[0] > S.qLoseAfter){ const src = S.qLoseSrc || 'Final Fortune'; S.qLoseAfter = null; S.g23lost = 1; S.lost = S.qLoseMsg = `lost the game (${src})`; log(`☠ loses the game (${src})`); toast(`${src}: you lose the game`); commit(); } } catch (e){ console.warn(e); }
    return fs(step, activePid); };
}

/* ---------- Remote questions and private-zone data between players ---------- */
// q24Pub publishes a longer payload (up to 80 card keys + 300 chars) on my public state; the other client answers with qans.
RQ_OPS.push('qask', 'qans', 'qlib', 'qlibTake', 'qlibBottom', 'qrevMill', 'qexMvGive', 'qtakeEx', 'qsacIds', 'qwheel', 'qbid', 'qslave', 'qslaveAsk', 'qpiles');
Q24.ans = {};
// `to`: the one player this entry is for — it is published sealed for them (fix18.js), since every client receives the public state
function q24Pub(ref, d, ks, to){ S.q24pub = (S.q24pub || []).filter(x => x.ref !== ref).concat({ref, d:String(d || '').slice(0, 300), ks:(ks || []).slice(0, 80), to:to || ''}).slice(-6); }
function q24PubOf(pid, ref){ return ((OPP.get(pid) || {}).q24 || []).find(x => x.ref === ref) || null; }
async function q24Wait(ref, ms = 90000){ if (UI.dry) return null; const a = await waitUntil(() => Q24.ans[ref], ms); return a || null; }
async function q24Ask(pid, q, src){ // q: {kind:'choice'|'num'|'pick', title, opts:[labels], ks:[keys], min, max}
  if (UI.dry) return null; const ref = rid(8); q24Pub(ref, JSON.stringify({kind:q.kind, title:String(q.title || '').slice(0, 120), opts:(q.opts || []).map(x => String(x).slice(0, 40)).slice(0, 8), min:q.min || 0, max:q.max || 1}), q.ks || [], pid);
  await r18PubReady(ref); sendRq(pid, 'qask', 0, src, {ref}); commit(); const a = await q24Wait(ref); return a ? a.d : null; }
// a request's d is cut at 80 chars: send a long id list as several requests of whole ids
function q24SendIds(pid, op, ids, src){ let cur = []; const out = () => { if (cur.length) sendRq(pid, op, 0, src, {d:cur.join(',')}); cur = []; };
  for (const id of ids){ if ((cur.concat(id)).join(',').length > 80) out(); cur.push(id); } out(); }
async function q24LibReq(pid, op, n, src, d){ if (UI.dry) return null; const ref = rid(8); sendRq(pid, op, n, src, {ref, d:d || ''}); commit(); const a = await q24Wait(ref, 30000); if (!a) return null; const p = await q24PubGet(pid, ref); return p ? {ks:p.ks, d:p.d, ans:a.d} : {ks:[], d:'', ans:a.d}; }
async function q24AnswerLocal(q, ks, src, from){
  if (q.kind === 'num'){ const v = await askNumber(`${src} (${nameOf(from)}): ${q.title}`, 'Your choice is secret until everyone has chosen.', 0); return String(Math.max(0, +v || 0)); }
  if (q.kind === 'choice'){ const v = await askChoice({title:`${src} (${nameOf(from)}): ${q.title}`, options:q.opts.map((l, i) => ({label:l, value:String(i)}))}); return v == null ? '0' : String(v); }
  if (q.kind === 'pick'){ const cards = ks.map((k, i) => ({id:-5000 - i, k})); const ids = await pickCards({title:`${src} (${nameOf(from)}): ${q.title}`, cards, min:q.min || 0, max:Math.min(q.max || cards.length, cards.length)}); return (ids || []).map(id => -(id + 5000)).join(','); }
  return '';
}
{
  const ao = applyOp;
  applyOp = function(r, from){
    if (!r || !String(r.op || '').startsWith('q')) return ao(r, from);
    const reply = (d, pubKs, pubD) => { const send = () => { sendRq(from, 'qans', 0, r.src, {ref:r.ref, d:String(d == null ? '' : d).slice(0, 80)}); commit(); };
      if (pubKs || pubD){ q24Pub(r.ref, pubD || '', pubKs || [], from); r18PubReady(r.ref).then(send, send); } else send(); };
    switch (r.op){
      case 'qans': Q24.ans[r.ref] = {d:String(r.d || '')}; return;
      case 'qask': (async () => { const p = await q24PubGet(from, r.ref); if (!p) return reply(''); let q = {}; try { q = JSON.parse(p.d); } catch {} reply(await q24AnswerLocal(q, p.ks || [], r.src || '', from)); })(); return;
      // reveal / list library cards: d = 'top' (top n) | 'artifact' etc. (every matching card)
      case 'qlib': { const ks = r.d === 'top' ? S.lib.slice(0, clamp(r.n, 0, 80)).map(c => c.k) : S.lib.filter(c => descOk(c.k, String(r.d || 'card'))).map(c => c.k);
        log(`${r.d === 'top' ? `revealed the top ${ks.length} cards of their library` : `${nameOf(from)} searches their library`} (${r.src})${r.d === 'top' ? ': ' + ks.map(k => info(k)?.n).join(', ') : ''}`); reply('ok', ks, r.d); return; }
      // give a library card to the requester: onto the battlefield (d = key) or into their exile (n = 1)
      case 'qlibTake': { const i = S.lib.findIndex(c => c.k === r.d); if (i < 0) return reply('');
        const [c] = S.lib.splice(i, 1); if (r.n === 1){ sendRq(from, 'qtakeEx', 0, r.src, {d:c.k}); log(`${nameOf(from)} exiles ${cname(c)} from their library (${r.src})`); }
        else { const ref = rid(6); S.lent.push({ref, to:from, card:c, perm:true}); sendRq(from, 'give', 0, '', {ref, c:{k:c.k}, f:{fromGy:1}}); log(`${nameOf(from)} puts ${cname(c)} from their library onto the battlefield (${r.src})`); }
        if (r.f && r.f.other) { shuffle(S.lib); log('shuffled their library'); } reply('ok'); return; }
      case 'qlibBottom': { const n = clamp(r.n, 0, 80); const top = S.lib.splice(0, n); shuffle(top); S.lib.push(...top); log(`put ${top.length} cards on the bottom of their library in a random order (${r.src})`); commit(); return; }
      case 'qrevMill': { const want = clamp(r.n, 0, 99); let lands = 0; const out = []; while (S.lib.length && lands < want){ const c = S.lib.shift(); out.push(c); if (isLand(c.k)) lands++; }
        S.gy.push(...out); log(`revealed ${out.map(cname).join(', ') || 'nothing'} and put them into their graveyard (${r.src})`); commit(); return; }
      case 'qexMvGive': { let tot = 0; const out = []; while (S.lib.length && tot < r.n){ const c = S.lib.shift(); out.push(c); tot += info(c.k)?.mv || 0; }
        log(`exiled ${out.map(cname).join(', ') || 'nothing'} (total mana value ${tot}) — ${nameOf(from)} may cast them this turn (${r.src})`);
        out.forEach(c => sendRq(from, 'qtakeEx', 2, r.src, {d:c.k})); commit(); return; }
      case 'qtakeEx': { const a = info(r.d); if (!a) return; const c = {id:S.nid++, k:r.d, tap:false}; S.ex.push(c); grantPlay([c.id], {src:r.src || 'an effect', cast:r.n === 2, free:r.n === 2}); log(`exiled ${a.n} from ${nameOf(from)}'s library — may ${r.n === 2 ? 'cast it without paying its mana cost' : 'play it'} this turn`); commit(); return; }
      case 'qsacIds': { const ids = String(r.d || '').split(',').filter(Boolean).map(Number); S.bf.filter(c => ids.includes(c.id)).forEach(c => moveCard(c.id, 'gy', {sac:true})); log(`sacrificed ${ids.length} permanent${ids.length === 1 ? '' : 's'} (${r.src})`); commit(); return; }
      case 'qwheel': { const n = S.hand.length; UI.discarding = []; S.hand.slice().forEach(c => moveCard(c.id, 'gy')); UI.discarding = null; draw(7); log(`discarded their hand (${n}) and drew seven cards (${r.src})`); commit(); return; }
      case 'qbid': { const tys = String(r.d || '').split(',').filter(Boolean); q24Bid(tys, r.src); return; }
      case 'qslave': { S.qSlave = {by:from, after:currentTurn()[0], extra:r.n === 1, src:r.src}; log(`${nameOf(from)} will control ${nameOf(MYPID)} during their next turn (${r.src})`); toast(`${r.src}: ${nameOf(from)} controls your next turn`); commit(); return; }
      case 'qpiles': (async () => { // split my creatures into two piles; publish them
        const cr = S.bf.filter(c => isCreatureCard(c) && !c.fd); const ids = cr.length ? await pickCards({title:`${r.src}: separate your creatures into two piles — choose pile 1 (the rest is pile 2)`, cards:cr, min:0, max:cr.length}) : [];
        const p1 = cr.filter(c => (ids || []).includes(c.id)), p2 = cr.filter(c => !(ids || []).includes(c.id));
        reply('ok', [], JSON.stringify([p1.map(c => [c.id, cname(c)]), p2.map(c => [c.id, cname(c)])]).slice(0, 300)); })(); return;
    }
    return ao(r, from);
  };
}
function q24Bid(tys, src){ const got = S.gy.filter(c => isCreatureCard(c) && tys.some(t => new RegExp('\\b' + q24Re(t) + '\\b', 'i').test(info(c.k)?.t || ''))); got.forEach(c => moveCard(c.id, 'bf')); log(`returned ${got.length} creature card${got.length === 1 ? '' : 's'} of the chosen types (${tys.join(', ')}) from their graveyard (${src})`); commit(); }
function q24CreatureTypes(){ const set = new Set(); const add = k => { const t = info(k)?.t || ''; if (!/Creature/.test(t)) return; (t.split('—')[1] || '').trim().split(/\s+/).filter(Boolean).forEach(x => set.add(x)); };
  S.gy.forEach(c => add(c.k)); for (const s of OPP.values()) (s.gy || []).forEach(add); S.bf.forEach(c => add(c.k)); return [...set].sort(); }

/* ---------- Mindslaver / Emrakul, the Promised End: another player controls your turn ---------- */
function q24Slaved(){ const q = S && S.qSlave; if (!q) return null; const [n, pid] = currentTurn(); if (pid !== MYPID || n <= q.after) return null; return q; }
{
  const ac = askChoice;
  askChoice = function(m){ const q = !UI.dry && q24Slaved(); if (!q || !m || m.q24local) return ac(m);
    const opts = (m.options || []).filter(o => !o.disabled); if (!opts.length) return ac(m);
    return (async () => { const a = await q24Ask(q.by, {kind:'choice', title:`(controlling ${nameOf(MYPID)}) ${m.title || ''}`, opts:opts.map(o => o.label)}, q.src || 'Mindslaver'); const o = opts[+a] || opts[0]; log(`${nameOf(q.by)} chose “${short(String(o.label), 60)}” for ${nameOf(MYPID)}`); return o.value; })(); };
  const pc = pickCards;
  pickCards = function(m){ const q = !UI.dry && q24Slaved(); if (!q || !m || !(m.cards || []).length) return pc(m);
    return (async () => { const cards = m.cards.slice(0, 80); const a = await q24Ask(q.by, {kind:'pick', title:`(controlling ${nameOf(MYPID)}) ${m.title || ''}`, ks:cards.map(c => c.k), min:m.min || 0, max:m.max || 1}, q.src || 'Mindslaver');
      const idx = String(a || '').split(',').filter(x => x !== '').map(Number); const ids = idx.map(i => cards[i]).filter(Boolean).map(c => c.id); return ids.length >= (m.min || 0) ? ids : cards.slice(0, m.min || 0).map(c => c.id); })(); };
  const ss = startMyTurn;
  startMyTurn = function(...a){ try { const q = S.qSlave; const [n] = currentTurn(); if (q && n > q.after && !q.on){ q.on = n; log(`🕹 ${nameOf(q.by)} controls this turn (${q.src})`); toast(`${nameOf(q.by)} controls this turn — they make every choice`); q24Pub('slavehand', 'hand', S.hand.map(c => c.k), q.by); r18PubReady('slavehand').then(() => { sendRq(q.by, 'qslaveAsk', 0, q.src, {ref:'slavehand'}); commit(); }); if (q.extra) S.xt = (S.xt || 0) + 1; } else if (q && q.on && n > q.on){ S.qSlave = null; S.q24pub = (S.q24pub || []).filter(x => x.ref !== 'slavehand'); log('no longer controlled by another player'); } } catch (e){ console.warn(e); } return ss.apply(this, a); };
  const ao = applyOp;
  applyOp = function(r, from){ if (r && r.op === 'qslaveAsk'){ (async () => { const p = await q24PubGet(from, 'slavehand'); const hand = (p ? p.ks : []).map(k => info(k)?.n).join(', ') || 'empty';
    // the log is public: only the controller's own screen shows the hand
    log(`🕹 you control ${nameOf(from)}'s turn (${r.src}) — you can see their hand`); UI.q24slaveHand = {pid:from, t:turnStr(), hand}; toast(`You control ${nameOf(from)}'s turn — their choices come to your screen. Their hand: ${hand}`); commit(); })(); return; } return ao(r, from); };
}
// auras attached to a player (curses) are legal as long as that player is in the game
{
  const as = attachSBA;
  attachSBA = function(...a){ const held = [];
    try { for (const c of S.bf) if (c.att && c.att.id == null && c.att.pid && (c.att.pid === MYPID || OPP.has(c.att.pid))){ held.push([c, c.att]); c.att = null; } } catch {}
    try { return as.apply(this, a); } finally { for (const [c, at] of held) if (S.bf.includes(c)) c.att = at; } };
  const sb = sba;
  sba = function(...a){ const r = sb.apply(this, a); try { if (S && S.g23lost && S.qLoseMsg && /^lost the game$/.test(S.lost || '')) S.lost = S.qLoseMsg; } catch {} return r; };
}
