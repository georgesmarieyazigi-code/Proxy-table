/* =================== fix19b: timing and choice order (GAPS19 section M, helper M) ===================
   1/12. Targets are chosen when a spell is cast or an ability triggers (CR 601.2c / 603.3d), not on resolution, and the stack
         shows them to every player before anyone passes: Balor (a mode per opponent), Kitesail Larcenist (+ ward of the chosen
         permanents), Guff Rewrites History, Agadeem's Awakening (X first, then the cards), Phoenix, Warden of Fire III,
         Fire Lord Sozin (a real reflexive trigger that goes on the stack after {X} is paid) and every "for each opponent /
         each player, … up to one target … that player controls" spell or trigger (its resolution prompts are answered from
         the choices made earlier).
   2.    Gift: the opponent who gets the gift is chosen while casting; "promised" is stored on that spell, not globally.
   3.    Escalate "tap an untapped creature you control" is paid with the other costs.
   4.    "X. If <gift/city's blessing>, instead Y." is resolved before the text is split, so only one branch runs — and the
         targets chosen while casting are only the ones the chosen branch needs (Into the Flood Maw).
   5.    Share the Spoils' "When they do, exile the top card of their library" is its own trigger on the stack.
   6.    Saddle goes on the stack like any activated ability (the creatures are tapped as the cost).
   7.    A spell only becomes cast once its costs are paid (601.2i): "cast" events, cast triggers and the cast count are held
         back until then, so a spell whose additional cost fails leaves nothing behind.
   9.    Senu: its controller chooses which player or planeswalker it attacks.
   10.   Illusionist's Gambit's attack requirement and restriction last only for the additional combat.
   11.   Sokrates' prevention vs damage increases: the damaged player chooses the order (CR 616.1). */
const M19 = {q:Promise.resolve(), defer:null, probe:null};

const m19Sol = () => { try { return S && !UI.dry; } catch { return false; } };
const m19Txt = k => { try { const a = info(k); return a ? tname(a.o || '', a.n || '') : ''; } catch { return ''; } };
function m19Later(fn){ M19.q = M19.q.then(fn).catch(e => console.warn('f19', e)).then(() => { try { commit(); } catch {} }); return M19.q; }
// a stack item that still needs its choices: hold it, ask, then give it a fresh priority round so nobody has passed on it unseen
function m19Hold(it, fn){
  it.hold = true; it.m19wait = 1; commit();
  return m19Later(async () => {
    // triggers are put on the stack (and their targets chosen) once nothing else is being decided
    await waitUntil(() => !UI.modal && !UI.resolving && !UI.casting, 600000);
    let r; try { r = await fn(it); } catch (e){ console.warn('f19 choose', e); }
    delete it.m19wait;
    const i = S.stk.indexOf(it);
    if (r === 'remove'){ if (i >= 0) S.stk.splice(i, 1); it.hold = false; return; }
    if (i >= 0){ it.sid = rid(6); if (S.stk[S.stk.length - 1] === it) S.pass = 's:' + it.sid; }
    it.hold = false;
  });
}
function m19Who(pid){ return pid === MYPID ? nameOf(MYPID) : nameOf(pid); }
function m19Label(list){ return list.filter(Boolean).join('; ').slice(0, 118); }

/* =============== 1. choosing targets early =============== */
const M19_BALOR = /^choose one or more\. Each mode must target a different player\.\n• Target opponent draws three cards, then discards three cards at random\.\n• Target opponent sacrifices a nontoken artifact of their choice\.\n• (?:This creature|~|Balor) deals damage to target opponent equal to the number of cards in their hand\.?$/i;
const M19_LARC = /^for each player, choose up to one other target artifact or creature that player controls\. For as long as (?:this creature|~|Kitesail Larcenist) remains on the battlefield/i;
const M19_GUFF = /^For each player, choose target nonenchantment, nonland permanent that player controls\. Those permanents' owners shuffle them/i;
const M19_TOTMV = /^(?:[A-Z][^—\n]* — )?Return any number of target creature cards with total mana value (\d+) or less from your graveyard to the battlefield\b/i;
const M19_AGA = /^Return from your graveyard to the battlefield any number of target creature cards that each have a different mana value X or less\.?$/i;
// "for each opponent / player, … (up to one) target <desc> that player controls / they control …"
function m19PerSpec(txt){
  const t = String(txt || '').replace(/^[A-Z][^—\n]* — /, ''); if (/^when you do\b/i.test(t) || M19_LARC.test(t) || M19_GUFF.test(t)) return null;
  const s = t.split(/\.\s+|\n/)[0].toLowerCase();
  const m = s.match(/^for each (opponent|player), ([^.]*?)\b(up to one )?(other )?target ([a-z ,\-]+?) (?:that player|target player|they) controls?\b(.*)$/); if (!m) return null;
  if (/\bgraveyard\b/.test(m[5])) return null;
  const par = /with an even mana value/.test(m[6]) ? 0 : /with an odd mana value/.test(m[6]) ? 1 : null;
  return {who:m[1], upTo:!!m[3], other:!!m[4], desc:m[5].trim(), par};
}
function m19PerCands(sp, pid, srcId){
  return boardOf(pid).filter(c => c.k && !c.fd && descOk(c.k, sp.desc === 'permanent' ? '' : sp.desc, {tok:c.tok}) && !(sp.other && pid === MYPID && c.id === srcId)
    && (pid === MYPID || !(kwOf(c, 'hexproof', pid) || kwOf(c, 'shroud', pid))) && !(pid === MYPID && kwOf(c, 'shroud', pid))
    && (sp.par == null || ((info(c.k)?.mv || 0) % 2) === sp.par));
}
async function m19ChoosePer(sp, name, srcId){
  const ps = (sp.who === 'player' ? players() : opponents()).filter(p => !(p.s && p.s.lost)); const out = [];
  for (const p of ps){
    const list = m19PerCands(sp, p.pid, srcId); if (!list.length){ out.push({pid:p.pid, id:null}); continue; }
    const opts = list.map(c => ({label:info(c.k)?.n || '?', value:String(c.id)})); if (sp.upTo) opts.push({label:'None', value:''});
    const v = await askChoice({title:`${name}: choose ${sp.upTo ? 'up to one ' : ''}target ${sp.desc} ${p.me ? 'you control' : p.nm + ' controls'}`, options:opts, q24local:false});
    const c = v ? list.find(x => String(x.id) === String(v)) : null;
    out.push(c ? {pid:p.pid, id:c.id, k:c.k, nm:info(c.k)?.n || '?'} : {pid:p.pid, id:null});
  }
  return out;
}
const m19PerLabel = ans => m19Label(ans.filter(a => a.id != null).map(a => (a.pid === MYPID ? 'my ' : nameOf(a.pid) + "'s ") + a.nm)) || 'no targets';
// pick creature cards from my graveyard one at a time, re-checking a group rule
async function m19PickGy(title, hint, pool, okWith){
  const chosen = [];
  while (true){
    const legal = pool.filter(c => !chosen.includes(c) && okWith(chosen.concat(c))); if (!legal.length) break;
    const ids = await pickCards({title:`${title}${chosen.length ? ` (${chosen.length} chosen)` : ''}`, hint, cards:legal, min:0, max:1, noneLabel:chosen.length ? 'Done' : 'None'});
    const c = ids && ids[0] != null ? legal.find(x => x.id === ids[0]) : null; if (!c) break; chosen.push(c);
  }
  return chosen;
}
const m19GyT = (c, pid = MYPID) => ({t:'gy', pid, id:c.id, k:c.k, nm:info(c.k)?.n || '?'});

// ---- triggered abilities: choose as they are put on the stack
async function m19EarlyTrig(it){
  const txt = String(it.txt || ''); const name = it.nm;
  if (M19_BALOR.test(txt)) return m19Hold(it, async () => {
    const opps = opponents().filter(p => !(p.s && p.s.lost)); if (!opps.length) return;
    const picks = []; const used = new Set(); const max = Math.min(3, opps.length);
    while (picks.length < max){
      const opts = B27BALOR.map((t, j) => ({label:t.replace(/~/g, name), value:j, disabled:picks.some(p => p.m === j)})); if (picks.length) opts.push({label:"That's all", value:'done'});
      const mi = await askChoice({title:`${name}: choose ${picks.length ? 'another mode' : 'one or more modes'} (each targets a different opponent)`, options:opts});
      if (mi == null || mi === 'done') break;
      const left = opps.filter(p => !used.has(p.pid)); const pid = left.length === 1 ? left[0].pid : await askChoice({title:`${name}: ${B27BALOR[mi].replace(/~/g, name)} — which opponent?`, options:left.map(p => ({label:p.nm, value:p.pid}))});
      if (pid == null) break; used.add(pid); picks.push({m:+mi, pid});
    }
    if (!picks.length && opps.length){ picks.push({m:2, pid:opps[0].pid}); }   // "one or more": at least one mode
    it.m19balor = picks; it.tgts = picks.map(p => [{t:'player', pid:p.pid, nm:nameOf(p.pid)}]);
    it.tgtNm = m19Label(picks.map(p => `${nameOf(p.pid)}: ${['draws 3, discards 3 at random', 'sacrifices a nontoken artifact', 'damage = cards in hand'][p.m]}`));
    log(`${name}: ${it.tgtNm}`);
  });
  if (M19_LARC.test(txt)) return m19Hold(it, async () => {
    const picks = [];
    for (const p of players()){
      if (p.s && p.s.lost) continue;
      const cands = boardOf(p.pid).filter(b => b.k && !b.fd && !(p.me && b.id === it.srcId) && /\b(Artifact|Creature)\b/.test(p.me ? typeOf(b) : (typeof l24typeOf === 'function' ? l24typeOf(b, p.pid) : info(b.k)?.t || '')) && (p.me || !(kwOf(b, 'hexproof', p.pid) || kwOf(b, 'shroud', p.pid))));
      if (!cands.length) continue;
      const ids = await pickCards({title:`${name}: choose up to one other target artifact or creature ${p.me ? 'you control' : nameOf(p.pid) + ' controls'} — it becomes a Treasure`, cards:cands, min:0, max:1, noneLabel:'None'});
      const c = ids && ids[0] != null && cands.find(x => x.id === ids[0]); if (c) picks.push({t:'card', pid:p.pid, id:c.id, k:c.k, nm:info(c.k)?.n || '?'});
    }
    it.m19lar = picks; it.tgts = picks.map(x => [x]); it.tgtNm = tgtLabel(it.tgts).slice(0, 118) || 'no targets';
    if (picks.length && !(await payWard(it.tgts, name))){ log(`${name}: countered by ward`); return 'remove'; }
    log(`${name} targets ${it.tgtNm}`);
  });
  const mv = txt.match(M19_TOTMV);
  if (mv && !it.m19gy) return m19Hold(it, async () => {
    const lim = +mv[1]; const pool = S.gy.filter(c => isCreatureCard(c) && (info(c.k)?.mv || 0) <= lim);
    const got = await m19PickGy(`${name}: choose target creature cards with total mana value ${lim} or less in your graveyard`, `Their total mana value can be at most ${lim}.`, pool, cs => cs.reduce((a, c) => a + (info(c.k)?.mv || 0), 0) <= lim);
    it.m19gy = 1; it.tgts = [got.map(c => m19GyT(c))]; it.tgtNm = tgtLabel(it.tgts).slice(0, 118) || 'no targets';
    log(`${name}: targets ${it.tgtNm}`);
  });
  const sp = m19PerSpec(txt);
  if (sp && !it.m19per && !it.tgts) return m19Hold(it, async () => {
    const ans = await m19ChoosePer(sp, name, it.srcId); it.m19per = ans; it.tgts = m19PerTgts(ans); it.tgtNm = m19PerLabel(ans); log(`${name}: targets ${it.tgtNm}`);
  });
  // every other triggered ability with targets: chosen as it's put on the stack (603.3d), ward paid then
  if (!it.tgts && !it.tgt && !/•|\bwhen you do\b|\bwhenever you do\b/i.test(txt) && !/^if\b/i.test(txt.trim()) && !(typeof m24StackSpec === 'function' && m24StackSpec(txt)) && targetSpecs(txt).length) return m19Hold(it, async () => {
    const t = await chooseTargets(txt, {pid:MYPID, col:info(it.k)?.c, types:info(it.k)?.t, id:it.srcId}, name);
    if (t == null){ log(`${name}: no target chosen — the trigger is removed`); return 'remove'; }
    it.tgts = t; it.tgtNm = tgtLabel(t).slice(0, 118);
    if (t.flat().length && !(await payWard(t, name))){ log(`${name}: countered by ward`); return 'remove'; }
  });
}
const m19PerTgts = ans => { const g = ans.filter(a => a.id != null).map(a => [{t:'card', pid:a.pid, id:a.id, k:a.k, nm:a.nm}]); return g.length ? g : [[]]; };
{
  const pt = pushTrigger;
  pushTrigger = function(src, t, ev, evPid){
    const n0 = S ? S.stk.length : 0; const r = pt(src, t, ev, evPid);
    try { if (m19Sol() && S.stk.length > n0) for (const it of S.stk.slice(n0)) if (it.kind === 'trigger' && !it.m19seen){ it.m19seen = 1; m19EarlyTrig(it); } } catch (e){ console.warn('f19 trig', e); }
    return r;
  };
  const sr = sagaReached;
  sagaReached = function(c, from, to){
    const n0 = S ? S.stk.length : 0; const r = sr(c, from, to);
    try { if (m19Sol() && S.stk.length > n0) for (const it of S.stk.slice(n0)) if (it.op === 'saga' && !it.m19seen){ it.m19seen = 1; m19EarlyTrig(it); } } catch (e){ console.warn('f19 saga', e); }
    return r;
  };
}

// ---- spells: choose before the costs (601.2c), attach to the stack item as it's put on the stack
async function m19PreCast(c, zone, o){
  const a = info(c.k); if (!a) return null; const txt = tname(a.o || '', a.n || ''); const name = a.n;
  if (!o.free){ const tm = timingOk(c); if (!tm.ok) return null; }
  if (M19_GUFF.test(txt)){
    const picks = [];
    for (const p of players()){
      if (p.s && p.s.lost) continue;
      const cands = boardOf(p.pid).filter(b => b.k && !b.fd && !isLand(b.k) && !/\bEnchantment\b/.test(p.me ? typeOf(b) : info(b.k)?.t || '') && (p.me || !(kwOf(b, 'hexproof', p.pid) || kwOf(b, 'shroud', p.pid))));
      if (!cands.length) continue;
      const ids = cands.length === 1 ? [cands[0].id] : await pickCards({title:`${name}: choose target nonenchantment, nonland permanent ${p.me ? 'you control' : nameOf(p.pid) + ' controls'}`, cards:cands, min:1, max:1});
      if (!ids) return false;
      const x = cands.find(b => b.id === ids[0]); if (x) picks.push({t:'card', pid:p.pid, id:x.id, k:x.k, nm:info(x.k)?.n || '?'});
    }
    return {tgts:picks.map(x => [x]), f:{m19guff:1}, ward:true};
  }
  if (M19_AGA.test(txt.split('\n')[0] || '') && zone !== 'bf'){
    const x = await askNumber(`Choose X for ${name}`, 'Your pool: ' + (poolText(S.pool) || 'empty'), 0); if (x == null) return false;
    const pool = S.gy.filter(g => g.id !== c.id && isCreatureCard(g) && (info(g.k)?.mv || 0) <= x);
    const got = await m19PickGy(`${name}: choose target creature cards with different mana values, each ${x} or less`, 'Each card must have a different mana value.', pool, cs => new Set(cs.map(g => info(g.k)?.mv || 0)).size === cs.length);
    return {tgts:[got.map(g => m19GyT(g))], f:{m19gy:1}, x};
  }
  if (/\b(Instant|Sorcery)\b/.test(a.t || '')){
    const sp = m19PerSpec(txt.split('\n').find(l => /^for each (opponent|player),/i.test(l.trim())) || '');
    if (sp){ const ans = await m19ChoosePer(sp, name, null); return {f:{m19per:ans}, tgts:m19PerTgts(ans), label:m19PerLabel(ans), noSpecs:true}; }
  }
  return null;
}
{
  const an = askNumber;
  askNumber = function(title, hint, def){ const d = M19.defer; if (d && d.pre && d.pre.x != null && !d.xUsed && /^Choose X for /.test(String(title))){ d.xUsed = 1; return Promise.resolve(d.pre.x); } return an(title, hint, def); };
}

// ---- resolution: use what was chosen
{
  // per-player prompts of the existing handlers are answered from the early choices
  const ac = askChoice;
  askChoice = function(m){
    const P = M19.pre;
    try { if (P && m && Array.isArray(m.options)){ const title = String(m.title || '');
      for (const a of P){ if (a.used) continue;
        const who = a.pid === MYPID ? (/\byou control\b|\byour\b/i.test(title) || title.includes(nameOf(MYPID))) : title.includes(nameOf(a.pid)); if (!who) continue;
        const hit = a.id != null ? m.options.find(o => String(o.value) === String(a.id) && !o.disabled) : null;
        const none = m.options.find(o => o.value === '' || o.value === null || /^none$/i.test(String(o.label)));
        if (hit){ a.used = 1; return Promise.resolve(hit.value); }
        if (none && (a.id == null || !boardOf(a.pid).some(b => b.id === a.id && b.k === a.k))){ a.used = 1; if (a.id != null) log(`${a.nm} is no longer a legal target`); return Promise.resolve(none.value); }
      } } } catch (e){ console.warn('f19 ask', e); }
    return ac(m);
  };
  const rt = resolveTop;
  resolveTop = async function(it, ...a){
    if (it && it.m19wait) return;   // still choosing its targets
    const keep = M19.pre; M19.pre = it && Array.isArray(it.m19per) ? it.m19per.map(x => ({...x, used:0})) : null;
    try { return await rt(it, ...a); } finally { M19.pre = keep; }
  };
  // Balor
  const bal = b27Balor;
  b27Balor = async function(ctx){
    const it = ctx && ctx.it; if (!it || !Array.isArray(it.m19balor) || UI.dry) return bal(ctx);
    const name = ctx.name; const src = b27Src(ctx);
    for (const {m:mi, pid} of it.m19balor){
      if (!opponents().some(p => p.pid === pid && !(p.s && p.s.lost))){ log(`${name}: ${nameOf(pid)} is no longer a legal target`); continue; }
      if (mi === 0){ sendRq(pid, 'draw', 3, name); sendRq(pid, 'g23discRand', 3, name); log(`${name}: ${nameOf(pid)} draws three cards, then discards three at random`); }
      if (mi === 1){ sendRq(pid, 'sac', 1, name, {d:'nontoken artifact'}); log(`${name}: ${nameOf(pid)} sacrifices a nontoken artifact`); }
      if (mi === 2){ const n = OPP.get(pid)?.hc || 0; if (n) dealDamage({t:'player', pid}, n, ctx.k, src && S.bf.includes(src) ? src : null); log(`${name} deals ${n} damage to ${nameOf(pid)} (cards in their hand)`); }
    }
    commit();
  };
  // Kitesail Larcenist
  const lar = b27Larcenist;
  b27Larcenist = async function(ctx){
    const it = ctx && ctx.it; if (!it || !Array.isArray(it.m19lar) || UI.dry) return lar(ctx);
    const name = ctx.name; const src = b27Src(ctx); if (!src || !S.bf.includes(src)){ log(`${name} has left the battlefield — nothing becomes a Treasure`); return; }
    if (!src.b27et) src.b27et = rid(4);
    const mod = {s:name, u:`b${MYPID}|${src.id}|${src.b27et}`, setC:['Artifact'], setSub:['Treasure'], noAb:1, ab:['{T}, Sacrifice this artifact: Add one mana of any color.']};
    for (const t of it.m19lar){
      if (!targetStillThere(t)){ log(`${name}: ${t.nm} is no longer a legal target`); continue; }
      l24modTo(t, mod, name); log(`${name}: ${t.nm} becomes a Treasure artifact with no other abilities while ${name} remains`);
    }
    commit();
  };
  // Guff Rewrites History
  const gf = b27Guff;
  b27Guff = async function(ctx){
    const it = ctx && ctx.it; if (!it || !it.m19guff || UI.dry) return gf(ctx);
    const name = ctx.name; const picks = (it.tgts || []).flat().filter(t => { if (!targetStillThere(t)){ log(`${name}: ${t.nm} is no longer a legal target`); return false; } return true; });
    if (picks.length) log(`${name}: ${picks.map(x => x.nm).join(', ')} will be shuffled away`);
    for (const x of picks) if (x.pid !== MYPID) sendRq(x.pid, 'r27b', 0, name, {tid:x.id, d:'guff|'});
    commit();
    const me = picks.find(x => x.pid === MYPID); if (me) await b27GuffSelf(me.id, name);
  };
}
async function m19Pre(s, l, ctx){
  let m; const it = ctx.it || {}; const name = ctx.name;
  // Agadeem's Awakening / Phoenix III: the chosen graveyard cards
  if (it.m19gy && (/^return from your graveyard to the battlefield any number of target creature cards that each have a different mana value x or less$/.test(l) || /^(?:[a-z ,']+ — )?return any number of target creature cards with total mana value \d+ or less from your graveyard to the battlefield$/.test(l))){
    const g = ctx.tgts ? nextTargets(ctx) : []; if (UI.dry) return true;
    const cards = g.map(t => S.gy.find(c => c.id === t.id)).filter(Boolean);
    cards.forEach(c => { moveCard(c.id, 'bf'); log(`${name}: returned ${cname(c)} to the battlefield`); });
    if (!cards.length) log(`${name}: returned nothing`); commit(); return true;
  }
  // Fire Lord Sozin: "When you do, put …" is a reflexive trigger with its own targets (603.12)
  if ((m = l.match(/^(?:when you do, )?put any number of target creature cards with total mana value x or less from (?:that|target) player's graveyard onto the battlefield under your control$/)) && !it.m19soz && (/^when you do/.test(l) || ctx.e27X != null)){
    const x = ctx.e27X != null ? ctx.e27X : 0; const pid = it.evDp && it.evDp !== 'dry-opp' ? it.evDp : null;
    if (UI.dry || !pid || pid === MYPID || !(x > 0)) return true;
    const gy = (OPP.get(pid)?.gy || []).map((k, i) => ({id:-1000 - i, k})).filter(c => isCreatureCard({k:c.k}) && e27Mv(c.k) <= x);
    const got = gy.length ? await m19PickGy(`${name}: choose target creature cards with total mana value ${x} or less in ${nameOf(pid)}'s graveyard`, `Total mana value at most ${x}.`, gy, cs => cs.reduce((a, c) => a + e27Mv(c.k), 0) <= x) : [];
    const tgts = [got.map(c => m19GyT(c, pid))];
    const t2 = pushTrig(name, `Put any number of target creature cards with total mana value ${x} or less from that player's graveyard onto the battlefield under your control.`, {k:ctx.k, srcId:it.srcId, m19soz:{pid, x}, tgts, tgtNm:tgtLabel(tgts).slice(0, 118) || 'no targets', x, evDp:pid});
    log(`${name}: reflexive trigger → ${t2.tgtNm}`); commit(); return true;
  }
  if (it.m19soz && /^put any number of target creature cards with total mana value \d+ or less from that player's graveyard onto the battlefield under your control$/.test(l)){
    const g = ctx.tgts ? nextTargets(ctx) : []; if (UI.dry) return true; const {pid} = it.m19soz; const seen = [];
    for (const t of g){ sendRq(pid, 'gytake', 0, name, {d:t.k}); seen.push(t.nm); }
    log(seen.length ? `${name}: puts ${seen.join(', ')} onto the battlefield under ${nameOf(MYPID)}'s control` : `${name}: no card was put onto the battlefield`); commit(); return true;
  }
  // 2. gift: the opponent chosen while casting gets it (702.174j)
  if ((m = l.match(/^gift (?:a |an )?(card|food|treasure|clue|tapped fish|fish|octopus|extra turn)$/)) && it.kind === 'spell' && it.m19giftTo !== undefined){
    if (!it.gift || UI.dry) return true; const pid = it.m19giftTo;
    if (!pid || !opponents().some(p => p.pid === pid)){ log(`${name}: the gift's recipient has left the game`); return true; }
    if (m[1] === 'extra turn'){ S.r18kGiveXt = (S.r18kGiveXt || []).concat(pid); log(`${name}: gift — ${nameOf(pid)} takes an extra turn after this one`); }
    else if (m[1] === 'card'){ sendRq(pid, 'draw', 1, name); log(`${name}: gift — ${nameOf(pid)} draws a card`); }
    else { sendRq(pid, 'tokText', 0, name, {d:R18K_GIFT[m[1]]}); log(`${name}: gift — ${nameOf(pid)} creates ${R18K_GIFT[m[1]]}`); }
    commit(); return true;
  }
  // 5. Share the Spoils' reflexive trigger
  if (it.m19sts && /^when they do, exile the top card of their library$/.test(l)){
    if (UI.dry) return true; const {key, pid} = it.m19sts;
    if (pid === MYPID) b27StsExileTop(key, name); else { await b27Ask(pid, 'stsEx', 0, name, key, false); log(`${name}: ${nameOf(pid)} exiles the top card of their library`); }
    commit(); return true;
  }
  // 6. saddle resolves
  if (it.m19sad && /^~ becomes saddled until end of turn$/.test(l)){
    const c = S.bf.find(b => b.id === it.srcId); if (!c || UI.dry){ if (!c) log(`${name} left the battlefield — it isn't saddled`); return true; }
    const T = turnStr(); if (c.saddled !== T) c.saddledBy = []; c.saddled = T; for (const x of it.m19sad) c.saddledBy.push({...x, t:T});
    log(`${cname(c)} is saddled until end of turn`); try { emit({type:'m19saddled', k:c.k, id:c.id}); } catch {} commit(); return true;
  }
  return false;
}
{ const ds = doSentence; doSentence = async function(s0, ctx){ const s = String(s0).replace(/\.$/, '').trim(); const l = s.toLowerCase(); if (l && ctx && await m19Pre(s, l, ctx)) return; return ds(s0, ctx); }; }
EV_TYPES.push('m19saddled');

/* =============== 4. "X. If …, instead Y." — pick the branch before the text is split =============== */
const M19_INST = /(^|\n|\.\s+)([A-Z~][^.\n]*?)\.\s+If (the gift was promised|you have the city's blessing), instead ([^.\n]+)\./g;
function m19Branch(t, gift, city){
  return String(t || '').replace(M19_INST, (w, a, x, c, y) => { const on = c === 'the gift was promised' ? gift : city; return `${a}${on ? y.charAt(0).toUpperCase() + y.slice(1) : x}.`; });
}
function m19CityNow(txt){ if (S.cityB) return true; return /^Ascend\b/im.test(String(txt || '')) && S.bf.reduce((a, c) => a + (c.n || 1), 0) >= 10; }
{
  const re = runEffects;
  runEffects = async function(txt, ctx){
    let t = String(txt || '');
    try { if (ctx && ctx.it && ctx.it.kind === 'spell' && ctx.it.gift !== undefined && ctx.gift === undefined){ ctx.gift = !!ctx.it.gift; }
      if (!UI.dry && ctx && M19_INST.test(t)){ M19_INST.lastIndex = 0; t = m19Branch(t, !!(ctx.gift || (ctx.it && ctx.it.gift)), m19CityNow(t)); } M19_INST.lastIndex = 0; } catch (e){ console.warn('f19 branch', e); }
    return re(t, ctx);
  };
  // while casting: only the chosen branch's targets are chosen (the gift was decided first)
  const ts = targetSpecs;
  targetSpecs = function(t, ...a){
    try { const d = M19.defer; if (UI.casting && d && d.pre && d.pre.noSpecs && !d.xUsedT) return []; if (UI.casting && !UI.dry && M19.defer && /, instead /.test(String(t || ''))){ M19_INST.lastIndex = 0; if (M19_INST.test(String(t))){ M19_INST.lastIndex = 0; t = m19Branch(t, !!UI.giftNext, m19CityNow(t)); } M19_INST.lastIndex = 0; } } catch {}
    return ts.call(this, t, ...a);
  };
}

/* =============== 2. gift recipient while casting; 7. a spell is cast only once its costs are paid =============== */
{
  const ac = askChoice;
  askChoice = async function(m){
    const v = await ac(m);
    try { const d = M19.defer; if (d && m && /: promise the gift\?$/.test(String(m.title || '')) && !UI.dry){
      d.gift = !!v; d.giftTo = null;
      if (v){ const os = opponents().filter(p => !(p.s && p.s.lost)); d.giftTo = os.length === 1 ? os[0].pid : (os.length ? await choosePlayer(String(m.title).replace(/promise the gift\?$/, 'who gets the gift?'), true) : null); }
    } } catch (e){ console.warn('f19 gift', e); }
    return v;
  };
  const snap = () => ({castFrom:UI.castFrom, r21pool0:UI.r21pool0, r21free0:UI.r21free0, r18kCast:UI.r18kCast ? {...UI.r18kCast} : UI.r18kCast});
  const nc = noteCast;
  noteCast = function(c){ const d = M19.defer; if (d && c && c.id === d.cid && !d.flushing){ d.q.push({f:'noteCast', a:[c], s:snap()}); return; } return nc(c); };
  const em = emit;
  emit = function(ev){
    const d = M19.defer; if (d && ev && ev.type === 'cast' && ev.id === d.cid && !d.flushing){ d.q.push({f:'emit', a:[ev], s:snap()}); return; }
    if (M19.probe) return;   // 11: a damage probe has no side effects
    return em(ev);
  };
  const ct = castTriggers;
  castTriggers = function(c, a, it){
    const d = M19.defer;
    if (d && c && c.id === d.cid && !d.flushing){
      try { d.it = it; it.hold = true;
        if (d.pre){ if (d.pre.tgts){ it.tgts = d.pre.tgts; it.tgtNm = tgtLabel(d.pre.tgts).slice(0, 118) || 'no targets'; } if (d.pre.f) Object.assign(it, d.pre.f); if (d.pre.label) it.tgtNm = d.pre.label; if (d.pre.x != null) it.x = d.pre.x; }
        if (d.gift !== undefined){ it.gift = d.gift; it.m19giftTo = d.giftTo || null; UI.giftNext = null; if (d.gift && d.giftTo) it.tgtNm = m19Label([it.tgtNm, `gift → ${nameOf(d.giftTo)}`]); }
        if (d.esc) it.m19esc = d.esc.length;
      } catch (e){ console.warn('f19 attach', e); }
      d.q.push({f:'castTriggers', a:[c, a, it], s:snap()}); return;
    }
    return ct(c, a, it);
  };
  const FN = {noteCast:nc, emit:em, castTriggers:ct};
  function flush(d){
    d.flushing = true; const keep = snap();
    try { for (const x of d.q){ Object.assign(UI, x.s); if (x.f === 'castTriggers' && d.esc && UI.r18kCast) UI.r18kCast = {...UI.r18kCast, modes:1}; try { FN[x.f](...x.a); } catch (e){ console.warn('f19 flush', e); } } }
    finally { Object.assign(UI, keep); d.flushing = false; }
  }
  // 3. escalate's "tap an untapped creature you control" is part of paying the cost
  const xp = extraPayments;
  extraPayments = async function(c, sc){
    const d = M19.defer; const x = UI.r18kCast;
    if (d && c && d.cid === c.id && x && x.card && x.card.id === c.id && x.modes > 1 && r18kKw(info(c.k), /^escalate\s*—\s*tap an untapped creature you control$/i)){
      const need = x.modes - 1; const list = S.bf.filter(b => !b.fd && !b.tap && isCreatureCard(b));
      if (list.length < need){ toast(`Escalate: tap ${need} untapped creature${need > 1 ? 's' : ''}`); return false; }
      const ids = list.length === need ? list.map(b => b.id) : await pickCards({title:`${cname(c)}: escalate — tap ${need} untapped creature${need > 1 ? 's' : ''} you control`, cards:list, min:need, max:need});
      if (!ids || ids.length < need) return false;
      const base = await xp(c, sc); if (base === false) return false;
      sc.notes.push(`escalate: tap ${need}`);
      return {apply(){ if (base) base.apply(); const nm = []; ids.forEach(id => { const b = S.bf.find(y => y.id === id); if (b){ b.tap = true; nm.push(cname(b)); emit({type:'tapped', k:b.k, id:b.id}); } }); d.esc = ids; log(`escalate: tapped ${nm.join(', ')}`); }};
    }
    return xp(c, sc);
  };
  const bc = beginCast;
  beginCast = async function(c, zone, o = {}){
    if (UI.casting || UI.dry || !S || !c || isLand(c.k) || M19.defer) return bc(c, zone, o);
    let pre = null; try { pre = await m19PreCast(c, zone, o); } catch (e){ console.warn('f19 pre', e); }
    if (pre === false) return;
    const D = {cid:c.id, q:[], pre, it:null}; M19.defer = D; let r;
    try { r = await bc(c, zone, o); }
    finally { M19.defer = null; }
    const it = D.it && S.stk.includes(D.it) ? D.it : null;
    if (it){
      flush(D); it.hold = false;
      if (pre && pre.ward && it.tgts && it.tgts.flat().length && !(await payWard(it.tgts, it.nm))){ log(`${it.nm} is countered by ward`); counterMine(it); }
      commit();
    } else { if (D.q.length) log(`${info(c.k)?.n || 'that spell'} wasn't cast — nothing triggers`); if (D.gift !== undefined) UI.giftNext = null; }
    return r;
  };
}

/* =============== 5. Share the Spoils: "When they do" goes on the stack =============== */
B27.h.m19sts = async (r, from, rest) => { const key = String(rest || ''); m19StsTrig(key, from); return []; };
function m19StsTrig(key, pid){
  const [, id] = String(key).split('|'); const c = S.bf.find(b => String(b.id) === id); const nm = c ? cname(c) : 'Share the Spoils';
  pushTrig(nm, 'When they do, exile the top card of their library.', {k:c ? c.k : null, srcId:c ? c.id : null, m19sts:{key, pid}, tgtNm:`${pid === MYPID ? 'my' : nameOf(pid) + "'s"} library`}); commit();
}
{
  const ex = b27StsExileTop;
  b27StsExileTop = function(key, src){
    if (M19.stsPlay && m19Sol()){ M19.stsPlay = 0; const ctl = String(key || '').split('|')[0];
      if (ctl === MYPID) m19StsTrig(key, MYPID); else { b27Ask(ctl, 'm19sts', 0, src, key, false); log(`${src}: ${nameOf(ctl)}'s Share the Spoils triggers`); }
      return null; }
    return ex(key, src);
  };
  const bc = beginCast;
  beginCast = async function(c, zone, o = {}){ const k0 = M19.stsPlay; M19.stsPlay = zone === 'ex' && c && b27StsKey(c.mayPlay) ? 1 : 0; try { return await bc(c, zone, o); } finally { M19.stsPlay = k0; } };
  const pl = playLand;
  playLand = function(c, o){ const k0 = M19.stsPlay; M19.stsPlay = c && S && S.ex.includes(c) && b27StsKey(c.mayPlay) ? 1 : 0; try { return pl(c, o); } finally { M19.stsPlay = k0; } };
}

/* =============== 6. saddle uses the stack =============== */
{
  const aa = activateAbility;
  activateAbility = async function(c, ab, ...rest){
    if (!ab || !ab.saddle || UI.dry || !S) return aa(c, ab, ...rest);
    const why = abilityReady(c, ab, false); if (why){ toast(why); return; }
    const list = S.bf.filter(x => x !== c && !x.fd && !x.tap && isCreatureCard(x));
    const ids = await pickCards({title:`Saddle ${ab.saddle}: tap other untapped creatures with total power ${ab.saddle} or more`, cards:list, min:1, max:list.length}); if (!ids || !ids.length) return;
    const pw = ids.reduce((a, id) => a + Math.max(0, (stats(S.bf.find(y => y.id === id)) || [0])[0]), 0); if (pw < ab.saddle){ toast(`That's only ${pw} power — need ${ab.saddle}`); return; }
    const by = [];
    ids.forEach(id => { const x = S.bf.find(y => y.id === id); if (x){ x.tap = true; by.push({id:x.id, k:x.k}); try { emit({type:'tapped', k:x.k, id:x.id}); } catch {} } });
    const it = {sid:rid(6), o:nextO(), kind:'ability', k:c.k, nm:cname(c), txt:'~ becomes saddled until end of turn.', srcId:c.id, m19sad:by};
    S.stk.push(it); S.pass = 's:' + it.sid;
    log(`activated saddle ${ab.saddle} of ${cname(c)} — tapped ${by.map(x => info(x.k)?.n).join(', ')}`); commit();
  };
}

/* =============== 9. Senu: its controller chooses what it attacks =============== */
{
  const sn = b27Senu;
  b27Senu = async function(ctx){
    if (UI.dry) return sn(ctx);
    const opts = defOpts(); const keep = ctx.it ? ctx.it.b27atk : '';
    if (ctx.it && opts.length > 1){
      const def = opts.find(o => o.key === keep) || opts[0];
      const v = await askChoice({title:`${ctx.name} enters attacking — attack which player or planeswalker?`, options:opts.map(o => ({label:o.label + (o.key === keep ? ' (same as the legendary creature)' : ''), value:o.key}))});
      ctx.it.b27atk = v || def.key;
    } else if (ctx.it && opts.length === 1) ctx.it.b27atk = opts[0].key;
    return sn(ctx);
  };
}

/* =============== 10. Illusionist's Gambit: only the additional combat =============== */
function m19GambitOn(c){ const g = c && c.m19g; return !!(g && g.t === turnStr() && S.cb && S.cb.t === turnStr() && S.cb.n === g.n); }
function m19GambitSync(){ if (!S) return; for (const c of S.bf){ if (!c.m19g) continue; if (m19GambitOn(c)) c.a27g = {t:turnStr(), by:c.m19g.by}; else delete c.a27g; if (c.m19g.t !== turnStr()) delete c.m19g; } }
{
  const ao = applyOp;
  applyOp = function(r, from){
    if (r && r.op === 'a27gambit'){
      const keep = new Map(S.bf.map(c => [c.id, c.p24mustT])); const n = S.cb && S.cb.t === turnStr() ? S.cb.n || 1 : 1;
      const out = ao(r, from);
      try { for (const c of S.bf){ if (!c.a27g || c.a27g.t !== turnStr()) continue; c.m19g = {t:turnStr(), n:n + 1, by:c.a27g.by}; delete c.a27g; if (keep.get(c.id) === turnStr()) c.p24mustT = keep.get(c.id); else delete c.p24mustT; } commit(); } catch (e){ console.warn('f19 gambit', e); }
      return out;
    }
    return ao(r, from);
  };
  const ca = canAttack;
  canAttack = function(c){ try { m19GambitSync(); } catch {} return ca(c); };
  const ap = p24AtkPlan;
  p24AtkPlan = function(){ try { m19GambitSync(); } catch {} return ap(); };
  const ma = p24MustAtk;
  p24MustAtk = function(c){ const r = ma(c); if (r) return r; try { if (m19GambitOn(c)) return "Illusionist's Gambit"; } catch {} return ''; };
  const ss = startCombat;
  startCombat = function(...a){ const r = ss.apply(this, a); try { m19GambitSync(); } catch {} return r; };
}

/* =============== 11. Sokrates' prevention and damage increases: the damaged player orders them =============== */
function m19SokOn(c, t){ return !!(S && c && t && t.t === 'player' && t.pid && t.pid !== MYPID && S.bf.includes(c) && c.b27sok === turnStr()); }
// what the damage would be after every increase the engine applies on my side, with no side effects
function m19Probe(t, n, srcK, srcCard, extra){
  const keep = srcCard.b27sok; srcCard.b27sok = ''; const P = M19.probe = {pid:t.pid, n:0, hit:false}; const rec = UI.rec; UI.rec = null; const lg = S.log.length; const rq = S.rq.length; const life = S.life;
  try { M19.dd(t, n, srcK, srcCard, extra); } catch (e){ console.warn('f19 probe', e); }
  finally { M19.probe = null; srcCard.b27sok = keep; UI.rec = rec; if (S.log.length > lg) S.log.splice(lg); if (S.rq.length > rq) S.rq.splice(rq); S.life = life; }
  return P.hit ? P.n : n;
}
function m19Sokrates(t, n, srcK, srcCard, extra){
  const m = m19Probe(t, n, srcK, srcCard, extra); const nm = cname(srcCard); const pid = t.pid;
  log(`${nm}'s combat damage to ${nameOf(pid)} would be prevented (Sokratic Dialogue)${m !== n ? ` — ${n} damage, ${m} after increases` : ''}`);
  m19Later(async () => {
    let amt = n;
    if (m !== n){ const inc = await r22ask(pid, `${nm} → you: increase to ${m} first (each draws ${Math.floor(m / 2)}) or prevent ${n} first (each draws ${Math.floor(n / 2)})? Increase first?`.slice(0, 80), 'Sokratic Dialogue order');
      amt = inc ? m : n; log(`${nameOf(pid)} applies ${inc ? 'the damage increase first' : 'the prevention first'} — ${amt} damage prevented`); }
    const h = Math.floor(amt / 2);
    if (h){ draw(h); sendRq(pid, 'draw', h, nm); log(`${nm}: ${nameOf(MYPID)} and ${nameOf(pid)} each draw ${h}`); } else log(`${nm}: half of ${amt}, rounded down, is 0 — nobody draws`);
  });
}
{
  M19.dd = dealDamage;
  dealDamage = function(t, n, srcK, srcCard, extra = {}){
    try { if (!M19.probe && n > 0 && m19SokOn(srcCard, t) && (UI.r23cmb || UI.h23combat || M19.cmb)){ m19Sokrates(t, n, srcK, srcCard, extra); commit(); return 0; } } catch (e){ console.warn('f19 sok', e); }
    return M19.dd(t, n, srcK, srcCard, extra);
  };
  const hd = hitDefender;
  hitDefender = function(def, n, a, extra){
    try { if (def && def.t === 'player' && n > 0 && a && m19SokOn(a, def) && !UI.dry){ m19Sokrates({t:'player', pid:def.pid}, n, a.k, a, extra || {}); commit(); return; } } catch (e){ console.warn('f19 sok hit', e); }
    return hd(def, n, a, extra);
  };
  const sr = sendRq;
  sendRq = function(to, op, n, src, extra){ const P = M19.probe; if (P && to === P.pid && /^(pdmg|psn|life)$/.test(op)){ P.n += Math.abs(n || 0); P.hit = true; return; } return sr(to, op, n, src, extra); };
  const gl = gainLife;
  gainLife = function(...a){ if (M19.probe) return 0; return gl(...a); };
}
