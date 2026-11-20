/* ===================== Rules engine — round 25 helper U: the long tail, EDHREC ranks 0–3060 ===================== */
// One-off wordings of popular cards that no family handler covers. Each handler is anchored to the card's own sentence.
const U25 = { seq:0, mv:[] };
// every card movement gets a sequence number, so "… this way" sentences can look at what the earlier sentences of the same effect moved
{
  const mc = moveCard;
  moveCard = function(id, to, o = {}){
    const before = find(id); const k = before && before[2] && before[2].k; let ty = ''; try { ty = before && before[2] && before[0] === 'bf' ? typeOf(before[2]) : ''; } catch {}
    const r = mc(id, to, o);
    try { const after = find(id); if (after && after[0] === to){ U25.mv.push({s:++U25.seq, id, k, to, from:before && before[0], ty}); if (U25.mv.length > 400) U25.mv.splice(0, 200); } } catch {}
    return r;
  };
}
function u25movedSince(ctx, to){ const s0 = ctx.u25s0 || 0; return U25.mv.filter(x => x.s > s0 && (!to || x.to === to)); }
function u25ctypes(c){ const t = (typeOf(c) || info(c.k)?.t || ''); const sub = (t.split('—')[1] || '').trim().split(/\s+/).filter(Boolean).map(x => x.toLowerCase()); return sub; }
function u25allTypes(c){ return /changeling/i.test(info(c.k)?.o || '') || (c.lx || []).some(m => m && m.allCT && l24live(m)); }
function u25shareType(a, b){ if (!/Creature/.test(typeOf(a)) || !/Creature/.test(typeOf(b))) return false; if (u25allTypes(a) || u25allTypes(b)) return true; const x = new Set(u25ctypes(a)); return u25ctypes(b).some(t => x.has(t)); }
function u25src(ctx){ const c = srcCardOf(ctx); return c && S.bf.includes(c) ? c : null; }
function u25evCard(ctx){ const id = ctx.it && ctx.it.evId; return id != null ? S.bf.find(b => b.id === id) : null; }
function u25allCreatures(){ const out = []; for (const b of boardsAll()) for (const c of b.bf){ if (!c.k || c.fd || !isCreatureCard(c)) continue; out.push({t:'card', pid:b.pid, id:c.id, k:c.k, nm:cname(c)}); } return out; }
// pick cards from any board: returns the chosen {t,pid,id,k} refs
async function u25pickRefs(title, refs, min, max){
  if (!refs.length) return [];
  if (UI.dry) return refs.slice(0, min);
  const cards = refs.map((r, i) => ({id:-5000 - i, k:r.k}));
  const ids = await pickCards({title, cards, min, max}); if (!ids) return refs.slice(0, min);
  return ids.map(id => refs[-(id + 5000)]).filter(Boolean);
}
async function u25payX(max, title){
  // how much to pay is the player's choice; the most they can pay is capped by mana available
  if (UI.dry || max <= 0) return 0;
  while (max > 0 && payPlan(parseCost(`{${max}}`), S.pool).err) max--; if (max <= 0){ log(`${title}: no mana to pay`); return 0; }
  const opts = []; for (let i = 0; i <= max; i++) opts.push({label:i ? `Pay {${i}}` : "Don't pay", value:String(i)});
  const v = await askChoice({title, options:opts}); const x = +(v || 0); if (!x) return 0;
  const plan = payPlan(parseCost(`{${x}}`), S.pool);
  if (plan.err){ toast(`Can't pay {${x}}: ${plan.err}`); return 0; }
  S.pool = plan.pool;
  return x;
}

// graveyard cards of one player (or all), as target-like refs
function u25gyRefs(pred, onlyPid){ const out = [];
  if (!onlyPid || onlyPid === MYPID) S.gy.forEach(c => { if (pred(c.k)) out.push({t:'gy', pid:MYPID, id:c.id, k:c.k}); });
  for (const [pid, st] of OPP){ if (onlyPid && pid !== onlyPid) continue; (st.gy || []).forEach((g, i) => { const k = typeof g === 'object' ? g.k : g; if (k && pred(k)) out.push({t:'gy', pid, id:'g' + i, k}); }); }
  return out; }
function u25takeGy(r, src){ if (r.pid === MYPID){ if (find(r.id)[0] === 'gy') moveCard(r.id, 'bf'); } else { sendRq(r.pid, 'gytake', 0, src, {d:r.k}); log(`${src}: takes ${info(r.k)?.n || 'a card'} from ${nameOf(r.pid)}'s graveyard`); } }
async function u25pickTotal(title, refs, max){
  const ok = refs.filter(r => (info(r.k)?.mv || 0) <= max); if (UI.dry || !ok.length) return [];
  for (let guard = 0; guard < 5; guard++){ const ch = await u25pickRefs(title, ok, 0, ok.length); const tot = ch.reduce((a, r) => a + (info(r.k)?.mv || 0), 0); if (tot <= max) return ch; toast(`Total mana value ${tot} is more than ${max} — choose again`); }
  return []; }

function u25colSym(w){ return {white:'W', blue:'U', black:'B', red:'R', green:'G'}[String(w).toLowerCase()] || String(w).toUpperCase().slice(0, 1); }
function u25nextEnd(){ return {n:currentTurn()[0], me:currentTurn()[1] === MYPID}; }
function U25wraith(c){ if (!c) return; c.u25wraith = 1; log(`${cname(c)} is a Wraith while it has a shadow counter`); }
// airbend (CR 701.65): exile it; while it remains exiled its owner may cast it for {2} rather than its mana cost
function u25airbend(r, src){ if (!r || r.t !== 'card') return; if (r.pid === MYPID){ const c = S.bf.find(b => b.id === r.id); if (!c) return; moveCard(c.id, 'ex', {quiet:true}); const e = find(c.id)[2]; if (e && find(c.id)[0] === 'ex'){ e.airK = 1; e.mayPlay = {t:turnStr(), adv:true, cast:true, src}; } } else sendRq(r.pid, 'u25air', 0, src, {tid:r.id}); }

async function doRound25UPre(s, l, ctx){
  let m; const name = ctx.name || ''; const it = ctx.it || {};
  // Spelunking
  if ((m = l.match(/^if you put an? (\w+) onto the battlefield this way, you gain (\d+) life$/))){
    const sub = m[1]; const hit = u25movedSince(ctx, 'bf').some(x => x.k && new RegExp('\\b' + sub + '\\b', 'i').test(info(x.k)?.t || ''));
    if (hit && gainLife(+m[2], name)) log(`${name}: gained ${m[2]} life → ${S.life}`); commit(); return true; }
  // Shared Animosity
  if (/^it gets \+1\/\+0 until end of turn for each other attacking creature that shares a creature type with it$/.test(l)){
    const c = u25evCard(ctx); if (!c) return true;
    const n = S.bf.filter(b => b !== c && b.atk && !b.fd && u25shareType(c, b)).length;
    if (n){ r19bPump(c, n, 0); log(`${cname(c)} gets +${n}/+0 until end of turn (${name})`); } commit(); return true; }
  // Mount Doom
  if (/^choose up to two creatures$/.test(l) && /destroy the rest/i.test(ctx.full || '') || /^choose up to two creatures, then destroy the rest$/.test(l)){
    const all = u25allCreatures(); const keep = await u25pickRefs(`${name}: choose up to two creatures to keep`, all, 0, 2);
    const keepK = new Set(keep.map(r => r.pid + ':' + r.id)); ctx.u25rest = all.filter(r => !keepK.has(r.pid + ':' + r.id));
    if (/destroy the rest/.test(l)){ await doRound25UPre('Destroy the rest', 'destroy the rest', ctx); }
    return true; }
  if (/^destroy the rest$/.test(l) && ctx.u25rest){
    for (const r of ctx.u25rest){ if (r.pid === MYPID){ const c = S.bf.find(b => b.id === r.id); if (c) destroyCard(c, name); } else applyTo(r, {op:'destroy', src:name}); }
    if (ctx.u25rest.length) log(`${name}: destroyed ${ctx.u25rest.length} creature${ctx.u25rest.length === 1 ? '' : 's'}`); ctx.u25rest = null; commit(); return true; }
  // Mirror Entity / Allosaurus Shepherd
  if ((m = l.match(/^until end of turn, (creatures you control|each (\w+) creature you control) (?:have|has) base power and toughness (x|\d+)\/(x|\d+) and (gain all creature types|becomes? an? (\w+) in addition to (?:its|their) other creature types)$/))){
    const x = m[3] === 'x' ? (it.x || 0) : +m[3]; const y = m[4] === 'x' ? (it.x || 0) : +m[4];
    const list = S.bf.filter(c => !c.fd && isCreatureCard(c) && (!m[2] || descOk(c.k, m[2]))).map(c => ({t:'card', pid:MYPID, id:c.id, k:c.k}));
    const mod = {pt:[x, y], u:'e' + turnStr()}; if (/all creature types/.test(m[5])) mod.allCT = 1; else mod.addS = [l24capW(m[6])];
    list.forEach(t => l24modTo(t, mod, name)); if (list.length) log(`${name}: ${list.length} creature${list.length === 1 ? '' : 's'} become ${x}/${y} until end of turn`); commit(); return true; }
  // Myr Battlesphere
  if ((m = l.match(/^tap x untapped (\w+) you control$/))){
    const d = sing(m[1]); const src = u25src(ctx); const list = S.bf.filter(b => !b.fd && !b.tap && b !== src && descOk(b.k, d, {tok:b.tok}));
    const ids = UI.dry || !list.length ? [] : await pickCards({title:`${name}: tap any number of untapped ${m[1]} (X)`, cards:list, min:0, max:list.length});
    (ids || []).forEach(id => { const b = S.bf.find(x => x.id === id); if (b) b.tap = true; }); ctx.u25X = (ids || []).length; if (ctx.u25X === 0) ctx.didPay = false;
    if (ctx.u25X) log(`${name}: tapped ${ctx.u25X} ${m[1]} (X = ${ctx.u25X})`); commit(); return true; }
  if (/^~ gets \+x\/\+0 until end of turn and deals x damage to the player or planeswalker it's attacking$/.test(l)){
    const x = ctx.u25X || 0; const src = u25src(ctx); if (!x || !src) return true;
    r19bPump(src, x, 0); const d = parseDef(src.atk || attackDefFor(ctx));
    if (d && d.pid && d.id == null){ if (d.pid === MYPID) damageMe(x, srcFlags(src.k, MYPID, src)); else dealDamage({t:'player', pid:d.pid}, x, src.k, src); }
    else if (d && d.id != null) dealDamage({t:'card', pid:d.pid, id:d.id, k:d.k}, x, src.k, src);
    log(`${name} gets +${x}/+0 and deals ${x} damage to what it's attacking`); commit(); return true; }
  // Arcane Lighthouse
  if (/^until end of turn, creatures your opponents control lose hexproof and shroud and can't have hexproof or shroud$/.test(l)){ S.u25lh = turnStr(); log(`${name}: opponents' creatures lose hexproof and shroud this turn`); commit(); return true; }
  // Forgotten Ancient
  if (/^(?:you may )?move any number of \+1\/\+1 counters from ~ onto other creatures$/.test(l)){
    const src = u25src(ctx); if (!src || !(src.cp > 0) || UI.dry) return true;
    while (src.cp > 0){ const others = S.bf.filter(b => b !== src && !b.fd && isCreatureCard(b)); if (!others.length) break;
      const ids = await pickCards({title:`${name}: move a +1/+1 counter onto which creature? (${src.cp} left)`, cards:others, min:0, max:1, noneLabel:'Done'}); if (!ids || !ids.length) break;
      const t = S.bf.find(b => b.id === ids[0]); if (!t) break; modCounters(src, 'cp', -1); modCounters(t, 'cp', 1); log(`${name}: moved a +1/+1 counter onto ${cname(t)}`); }
    commit(); return true; }
  // Combustible Gearhulk / Palantír of Orthanc
  if ((m = l.match(/^(?:then )?target opponent may have you draw (a card|three cards)$/))){
    const t = (ctx.tgts ? nextTargets(ctx) : []).find(x => x && x.t === 'player') || (opponents()[0] ? {pid:opponents()[0].pid} : null);
    ctx.u25opp = t && t.pid; if (!t){ ctx.u25drew = false; return true; }
    const yes = await r22ask(t.pid, `let ${nameOf(MYPID)} draw ${m[1]}? (otherwise they mill and you lose life / take damage)`, name);
    ctx.u25drew = yes; if (yes){ const n = m[1] === 'a card' ? 1 : 3; draw(n); log(`${name}: ${nameOf(t.pid)} let me draw ${n}`); } commit(); return true; }
  if ((m = l.match(/^if (?:the|that) player doesn't, you mill (three cards|x cards, where x is the number of influence counters on ~)$/))){
    if (ctx.u25drew !== false) return true; const src = u25src(ctx); const n = m[1] === 'three cards' ? 3 : ((src && src.nc || {}).influence || 0);
    const before = S.gy.length; mill(n); const milled = S.gy.slice(before); ctx.u25mvSum = milled.reduce((a, c) => a + (info(c.k)?.mv || 0), 0); log(`${name}: milled ${n} (total mana value ${ctx.u25mvSum})`); commit(); return true; }
  if (/^if that player doesn't, you mill x cards, where x is the number of influence counters on ~, and that player loses life equal to the total mana value of those cards$/.test(l)){
    await doRound25UPre('', "if that player doesn't, you mill x cards, where x is the number of influence counters on ~", ctx);
    await doRound25UPre('', 'that player loses life equal to the total mana value of those cards', ctx); return true; }
  if (/^(?:~ deals damage to that player|that player loses life) equal to the total mana value of those cards$/.test(l) || /^and that player loses life equal to the total mana value of those cards$/.test(l)){
    if (ctx.u25drew !== false || !ctx.u25opp) return true; const n = ctx.u25mvSum || 0; if (!n) return true;
    if (/damage/.test(l)){ const src = u25src(ctx); dealDamage({t:'player', pid:ctx.u25opp}, n, ctx.k, src); log(`${name} deals ${n} damage to ${nameOf(ctx.u25opp)}`); }
    else loseLife(ctx.u25opp, n, name); commit(); return true; }
  // Arid Archway
  if ((m = l.match(/^if another (\w+) was returned this way, (surveil \d+|scry \d+|draw a card)$/))){
    const sub = m[1]; const src = u25src(ctx); const hit = u25movedSince(ctx, 'hand').some(x => x.from === 'bf' && x.id !== (src && src.id) && x.k && new RegExp('\\b' + sub + '\\b', 'i').test(x.ty || info(x.k)?.t || ''));
    if (hit) await doSentence(cap(m[2]), ctx); return true; }
  // Koma: "Its activated abilities can't be activated this turn" (after tapping the target)
  if (/^its activated abilities can't be activated this turn$/.test(l)){
    const t = (ctx.lastT || [])[0]; if (!t) return true;
    if (t.pid === MYPID || !t.pid){ const c = S.bf.find(b => b.id === t.id); if (c) c.r21noAct = turnStr(); } else sendRq(t.pid, 'u25noAct', 0, name, {tid:t.id});
    log(`${name}: ${t.nm || 'that permanent'}'s activated abilities can't be activated this turn`); commit(); return true; }
  // Run Away Together
  if (/^choose two target creatures controlled by different players$/.test(l)){
    const ts = ctx.tgts ? nextTargets(ctx) : []; const a = ts.filter(Boolean);
    if (a.length === 2 && a[0].pid === a[1].pid){ log(`${name}: the two creatures must be controlled by different players`); ctx.lastT = []; return true; }
    ctx.lastT = a; return true; }
  if (/^return those creatures to their owners' hands$/.test(l) && ctx.lastT){ for (const t of ctx.lastT){ if (t.pid === MYPID){ const c = S.bf.find(b => b.id === t.id); if (c) moveCard(c.id, c.tok ? 'gy' : 'hand'); } else applyTo(t, {op:'bounce', src:name}); } commit(); return true; }
  // Open the Way
  if (/^x can't be greater than the number of players in the game$/.test(l)){ const n = players().length; if (ctx.it && (ctx.it.x || 0) > n){ ctx.it.x = n; log(`${name}: X is capped at ${n} (the number of players)`); } return true; }
  // Season of Gathering / Season of Weaving / Final Showdown: "choose …" then act on the choice
  if ((m = l.match(/^choose artifact or enchantment$/))){ const v = UI.dry ? 'artifact' : await askChoice({title:`${name}: choose a card type`, options:[{label:'Artifact', value:'artifact'}, {label:'Enchantment', value:'enchantment'}]}); ctx.u25type = v || 'artifact'; log(`${name}: chose ${ctx.u25type}`); return true; }
  if (/^destroy all permanents of the chosen type$/.test(l)){ const d = ctx.u25type || 'artifact'; await doSentence(`Destroy all ${d}s`, ctx); return true; }
  if ((m = l.match(/^choose (an artifact or creature|a creature|an artifact) you control$/))){ const d = m[1].replace(/^an? /, ''); const list = S.bf.filter(c => !c.fd && descOk(c.k, d, {tok:c.tok}));
    const ids = !list.length ? [] : UI.dry || list.length === 1 ? [list[0].id] : await pickCards({title:`${name}: choose ${m[1]} you control`, cards:list, min:1, max:1});
    const c = ids && ids[0] != null ? S.bf.find(b => b.id === ids[0]) : null; ctx.lastT = c ? [{t:'card', pid:MYPID, id:c.id, k:c.k, nm:cname(c)}] : []; if (c) log(`${name}: chose ${cname(c)}`); return true; }
  if (/^return each nonland, nontoken permanent to its owner's hand$/.test(l)){
    S.bf.filter(c => !c.fd && !c.tok && !isLand(c.k)).forEach(c => moveCard(c.id, 'hand', {quiet:true}));
    opponents().forEach(p => sendRq(p.pid, 'u25bounceAll', 0, name)); log(`${name}: returned each nonland, nontoken permanent to its owner's hand`); commit(); return true; }
  // "that player loses the game" (Vorpal Sword, Summon: Primal Odin)
  if (/^(?:that|target) player loses the game$/.test(l)){
    const t = /^target/.test(l) ? (ctx.tgts ? nextTargets(ctx) : []).find(x => x && x.t === 'player') : null; const pid = (t && t.pid) || it.evDp || (it.evPid !== MYPID ? it.evPid : null);
    if (!pid) return true; if (pid === MYPID){ S.lost = `lost the game (${name})`; S.g23lost = 1; log(`☠ ${name}: loses the game`); } else { sendRq(pid, 'g23lose', 0, name); log(`${name}: ${nameOf(pid)} loses the game`); } commit(); return true; }
  // Ajani, Strength of the Pride
  if (/^if you have at least 15 life more than your starting life total, exile ~ and each artifact and creature your opponents control$/.test(l)){
    const start = S.life0 || (FMT[S.fmt]?.life || 40); if (S.life < start + 15){ log(`${name}: ${S.life} life is not 15 more than ${start}`); return true; }
    const src = u25src(ctx); if (src) moveCard(src.id, 'ex'); opponents().forEach(p => { sendRq(p.pid, 'wipeEx', 0, name, {d:'artifact'}); sendRq(p.pid, 'wipeEx', 0, name, {d:'creature'}); });
    log(`${name}: exiled itself and each artifact and creature my opponents control`); commit(); return true; }
  // Comet Storm: one target plus one per kick, X damage to each
  if (/^choose any target, then choose another target for each time ~ was kicked$/.test(l) || /^choose any target$/.test(l) && /choose another target for each time/i.test(ctx.full || '')){
    ctx.u25tg = (ctx.tgts ? nextTargets(ctx) : []).filter(Boolean); return true; }
  if (/^choose another target for each time ~ was kicked$/.test(l)){ let t; while (ctx.tgts && (t = nextTargets(ctx)).length) (ctx.u25tg = ctx.u25tg || []).push(...t.filter(Boolean)); return true; }
  if (/^~ deals x damage to each of them$/.test(l)){ const x = it.x || 0; const src = u25src(ctx); for (const t of (ctx.u25tg || [])) dealDamage(t, x, ctx.k, src); if ((ctx.u25tg || []).length) log(`${name} deals ${x} damage to each of ${(ctx.u25tg || []).length} targets`); commit(); return true; }
  // Pact of the Serpent
  if (/^target player draws x cards and loses x life, where x is the number of creatures they control of the chosen type$/.test(l)){
    const t = (ctx.tgts ? nextTargets(ctx) : []).find(x => x && x.t === 'player'); if (!t) return true; const ty = String(ctx.ctype || 'Elf').trim();
    const n = boardOf(t.pid).filter(c => c.k && !c.fd && isCreatureCard(c) && (u25allTypes(c) || new RegExp('\\b' + ty + '\\b', 'i').test(typeOf(c)))).reduce((a, c) => a + (c.n || 1), 0);
    if (t.pid === MYPID){ draw(n); S.life -= n; } else { sendRq(t.pid, 'draw', n, name); sendRq(t.pid, 'life', -n, name); }
    log(`${name}: ${nameOf(t.pid)} draws ${n} and loses ${n} life`); commit(); return true; }
  // Swarmyard Massacre
  if (/^(?:then )?each creature that isn't an insect, rat, spider, or squirrel gets -1\/-1 until end of turn for each creature you control that's an insect, rat, spider, or squirrel$/.test(l)){
    const re = /\b(Insect|Rat|Spider|Squirrel)\b/; const is = c => u25allTypes(c) || re.test(typeOf(c));
    const n = S.bf.filter(c => !c.fd && isCreatureCard(c) && is(c)).reduce((a, c) => a + (c.n || 1), 0); if (!n) return true;
    for (const b of boardsAll()) for (const c of b.bf){ if (!c.k || c.fd || !isCreatureCard(c) || is(c)) continue; applyTo({t:'card', pid:b.pid, id:c.id, k:c.k}, {op:'pump', src:name, f:{p:-n, t:-n}}); }
    log(`${name}: each non-Insect/Rat/Spider/Squirrel creature gets -${n}/-${n}`); commit(); return true; }
  // Tree of Perdition
  if (/^exchange target opponent's life total with ~'s toughness$/.test(l)){
    const t = (ctx.tgts ? nextTargets(ctx) : []).find(x => x && x.t === 'player'); const src = u25src(ctx); if (!t || !src) return true;
    const life = t.pid === MYPID ? S.life : (OPP.get(t.pid)?.life ?? null); if (life == null) return true; const st = stats(src);
    if (t.pid === MYPID) S.life = st[1]; else sendRq(t.pid, 'life', st[1] - life, name);
    const e = l24eff(src, MYPID); const bp = ((e && e.pt) || ptOf(faceOf(src)) || [0, 0])[0];
    l24modTo({t:'card', pid:MYPID, id:src.id, k:src.k}, {pt:[bp, life]}, name);
    log(`${name}: exchanged ${nameOf(t.pid)}'s life total (${life}) with its toughness (${st[1]})`); commit(); return true; }
  // Electro: "you may pay {X}. When you do, he deals X damage to target player."
  if (/^(?:you may )?pay \{x\}$/.test(l) && /when you do, (?:he|she|it|~) deals x damage/i.test(ctx.full || '')){ const x = await u25payX(99, `${name}: pay {X}`); ctx.u25X = x; ctx.didPay = x > 0; if (it) it.x = x; return true; }
  if (/^(?:when you do, )?(?:he|she|~) deals x damage to target player$/.test(l)){ const t = (ctx.tgts ? nextTargets(ctx) : []).find(x => x && x.t === 'player'); const x = ctx.u25X || 0; if (!t || !x) return true; dealDamage(t, x, ctx.k, u25src(ctx)); log(`${name} deals ${x} damage to ${nameOf(t.pid)}`); commit(); return true; }
  // Well of Lost Dreams
  if (/^(?:you may )?pay \{x\}, where x is less than or equal to the amount of life you gained$/.test(l)){ const max = it.evN || it.evAmt || 0; const x = await u25payX(max, `${name}: pay {X} (up to ${max}) to draw X`); ctx.u25X = x; ctx.didPay = x > 0; return true; }
  if (/^(?:if you do, )?draw x cards$/.test(l) && ctx.u25X != null){ if (ctx.u25X > 0){ draw(ctx.u25X); log(`${name}: drew ${ctx.u25X}`); } commit(); return true; }
  // Animist's Awakening (spell mastery)
  if (/^untap those lands$/.test(l)){ const ids = u25movedSince(ctx, 'bf').filter(x => x.k && isLand(x.k)).map(x => x.id); ids.forEach(id => { const c = S.bf.find(b => b.id === id); if (c) c.tap = false; }); if (ids.length) log(`${name}: untapped ${ids.length} lands`); commit(); return true; }
  // Skyclave Apparition (leaves trigger; the exiled card is remembered when the enters trigger resolves)
  if (/^the exiled card's owner creates an x\/x blue illusion creature token, where x is the mana value of the exiled card$/.test(l)){
    const rec = (S.u25link || {})[ctx.srcId != null ? ctx.srcId : (it.srcId)]; if (!rec) return true; const x = info(rec.k)?.mv || 0;
    ctrlCreate({pid:rec.pid}, `a ${x}/${x} blue Illusion creature token`, ctx); delete S.u25link[ctx.srcId]; commit(); return true; }
  // Kodama of the East Tree
  if (/^if it wasn't put onto the battlefield with this ability, you may put a permanent card with equal or lesser mana value from your hand onto the battlefield$/.test(l)){
    const e = u25evCard(ctx); if (!e || e.u25kod) return true; const mv = info(e.k)?.mv || 0;
    const list = S.hand.filter(c => isPermType(info(c.k)?.t) && (info(c.k)?.mv || 0) <= mv); if (!list.length || UI.dry) return true;
    const ids = await pickCards({title:`${name}: put a permanent card with mana value ${mv} or less onto the battlefield`, cards:list, min:0, max:1, noneLabel:'None'});
    if (ids && ids[0] != null){ moveCard(ids[0], 'bf'); const c = S.bf.find(b => b.id === ids[0]); if (c){ c.u25kod = 1; log(`${name}: put ${cname(c)} onto the battlefield`); } } commit(); return true; }
  // Ezuri's Predation
  if (/^for each creature your opponents control, create a 4\/4 green phyrexian beast creature token$/.test(l)){
    const opp = []; for (const p of opponents()) for (const c of boardOf(p.pid)) if (c.k && !c.fd && isCreatureCard(c)) for (let i = 0; i < (c.n || 1); i++) opp.push({t:'card', pid:p.pid, id:c.id, k:c.k});
    ctx.u25prey = opp; if (!opp.length) return true; const before = new Set(S.bf.map(b => b.id));
    await createFromText(`Create ${opp.length} 4/4 green Phyrexian Beast creature tokens`, ctx); ctx.u25beasts = S.bf.filter(b => !before.has(b.id) && b.tok).map(b => b.id); commit(); return true; }
  if (/^each of those tokens fights a different one of those creatures$/.test(l) && ctx.u25prey){
    for (const r of ctx.u25prey){ let tok = null; for (const id of ctx.u25beasts || []){ const st = S.bf.find(b => b.id === id); if (st && !st.u25f){ tok = (st.n || 1) > 1 ? single(st) : st; break; } } if (!tok) break; tok.u25f = 1; g23fight({pid:MYPID, id:tok.id, k:tok.k}, r, name); }
    S.bf.forEach(b => { delete b.u25f; }); commit(); return true; }
  // Call the Coppercoats (strive is a cost rule, not something that happens on resolution)
  if (/^(?:~|this spell) costs (?:\{[^}]+\})+ more to cast for each target beyond the first$/.test(l)) return true;
  if (/^choose any number of target opponents$/.test(l)){ const ps = (ctx.tgts || []).flat().filter(x => x && x.t === 'player' && x.pid !== MYPID && targetStillThere(x)); ctx.ti = (ctx.tgts || []).length; ctx.u25opps = [...new Map(ps.map(p => [p.pid, p])).values()]; return true; }
  if (/^create x 1\/1 white human soldier creature tokens, where x is the number of creatures those opponents control$/.test(l)){
    const n = (ctx.u25opps || []).reduce((a, t) => a + boardOf(t.pid).filter(c => c.k && !c.fd && isCreatureCard(c)).reduce((x, c) => x + (c.n || 1), 0), 0);
    if (n) await createFromText(`Create ${n} 1/1 white Human Soldier creature tokens`, ctx); commit(); return true; }
  // Winds of Abandon (and its overload)
  if ((m = l.match(/^exile (target creature|each creature) you don't control$/)) && /for each creature exiled this way, its controller searches their library for a basic land card/i.test(ctx.full || '')){
    const refs = m[1] === 'target creature' ? (ctx.tgts ? nextTargets(ctx) : []).filter(Boolean) : opponents().flatMap(p => boardOf(p.pid).filter(c => c.k && !c.fd && isCreatureCard(c)).map(c => ({t:'card', pid:p.pid, id:c.id, k:c.k, n:c.n || 1})));
    const per = {}; for (const r of refs){ if (r.pid === MYPID) continue; applyTo(r, {op:'exile', src:name}); per[r.pid] = (per[r.pid] || 0) + (r.n || 1); }
    ctx.u25ramp = per; commit(); return true; }
  if (/^for each creature exiled this way, its controller searches their library for a basic land card$/.test(l)){ for (const [pid, n] of Object.entries(ctx.u25ramp || {})){ sendRq(pid, 'u25ramp', n, name); log(`${name}: ${nameOf(pid)} searches for ${n} basic land card${n === 1 ? '' : 's'}`); } commit(); return true; }
  if (/^those players put those cards onto the battlefield tapped$/.test(l) && ctx.u25ramp) return true;
  // Kazuul, Tyrant of the Cliffs
  if (/^if you're the (?:target|defending) player, create a 3\/3 red ogre creature token unless that creature's controller pays \{3\}$/.test(l)){
    if (it.evDp && it.evDp !== MYPID) return true; const pid = it.evPid; if (pid && pid !== MYPID && await askOpponentPay(pid, '{3}', name)){ log(`${name}: ${nameOf(pid)} paid {3}`); return true; }
    await createFromText('Create a 3/3 red Ogre creature token', ctx); commit(); return true; }
  // Jaxis, the Troublemaker
  if ((m = s.match(/^It gains haste and "When (.+?) dies, draw a card\." Sacrifice it at the beginning of the next end step$/))){
    const tid = (ctx.lastTok || []).slice(-1)[0]; const tok = tid != null ? S.bf.find(b => b.id === tid) : null; if (!tok && !UI.dry) return true;
    const sv = ctx.l24it; if (tok) ctx.l24it = {t:'card', pid:MYPID, id:tok.id, k:tok.k}; else ctx.l24it = null;
    if (tok || UI.dry) await doSentence('It gains haste and "When ~ dies, draw a card."', ctx); ctx.l24it = sv;
    if (tok){ S.dly.push({id:rid(6), eff:'Sacrifice it.', k:ctx.k, nm:name, srcId:tok.id, op:'sac'}); log(`${name}: sacrifice the token at the beginning of the next end step`); } commit(); return true; }
  // Ancient Brass Dragon
  if ((m = l.match(/^put any number of target creature cards with total mana value (\d+|x) or less from graveyards onto the battlefield under your control(?:, where x is the result)?$/))){
    const X = m[1] === 'x' ? (ctx.roll || it.x || 0) : +m[1]; const refs = u25gyRefs(k => isCreatureCard({k}));
    const pick = await u25pickTotal(`${name}: creature cards with total mana value ${X} or less`, refs, X); for (const r of pick) u25takeGy(r, name); commit(); return true; }
  // Sepulchral Primordial
  if (/^for each opponent, you may put up to one target creature card from (?:that|target) player's graveyard onto the battlefield under your control$/.test(l)){
    for (const p of opponents()){ const refs = u25gyRefs(k => isCreatureCard({k}), p.pid); const ch = await u25pickRefs(`${name}: up to one creature card from ${nameOf(p.pid)}'s graveyard`, refs, 0, 1); ch.forEach(r => u25takeGy(r, name)); }
    commit(); return true; }
  // Breach the Multiverse
  if (/^for each player, choose a creature or planeswalker card in (?:that|target) player's graveyard$/.test(l)){
    if (!UI.dry) await new Promise(r => setTimeout(r, 2500)); // the other players' mills arrive over the network
    ctx.u25breach = []; for (const p of players()){ const refs = u25gyRefs(k => /\b(Creature|Planeswalker)\b/.test(info(k)?.t || ''), p.pid); const ch = await u25pickRefs(`${name}: a creature or planeswalker card in ${p.me ? 'your' : nameOf(p.pid) + "'s"} graveyard`, refs, Math.min(1, refs.length), 1); ctx.u25breach.push(...ch); }
    return true; }
  if (/^put those cards onto the battlefield under your control$/.test(l) && ctx.u25breach){ ctx.u25breach.forEach(r => u25takeGy(r, name)); if (!UI.dry) await new Promise(r => setTimeout(r, 1500)); commit(); return true; }
  // Expressive Iteration
  if (/^look at the top three cards of your library$/.test(l) && /put one of them into your hand, put one of them on the bottom of your library, and exile one of them/i.test(ctx.full || '')){
    ctx.looked = true; ctx.u25ei = true; const top = S.lib.slice(0, 3); if (!top.length || UI.dry) return true;
    let left = top.slice(); const pick1 = async (title) => { if (left.length <= 1) return left[0]; const ids = await pickCards({title, cards:left, min:1, max:1}); const c = left.find(x => x.id === (ids || [])[0]) || left[0]; left = left.filter(x => x !== c); return c; };
    const h = await pick1(`${name}: put one into your hand`); left = left.filter(x => x !== h); if (h) moveCard(h.id, 'hand');
    const b = left.length > 1 ? await pick1(`${name}: put one on the bottom of your library`) : (left.length === 2 ? left[0] : null); if (b){ const i = S.lib.indexOf(b); if (i >= 0){ S.lib.splice(i, 1); S.lib.push(b); } left = left.filter(x => x !== b); }
    const e = left[0]; if (e){ moveCard(e.id, 'ex'); grantPlay([e.id], {src:name}); }
    log(`${name}: one card to hand, one on the bottom, one exiled (playable this turn)`); commit(); return true; }
  if (ctx.u25ei && (/^put one of them into your hand, put one of them on the bottom of your library, and exile one of them/.test(l) || /^you may play the exiled card this turn$/.test(l))) return true;
  // Loot, Exuberant Explorer
  if (/^look at the top six cards of your library$/.test(l) && /reveal a creature card with mana value less than or equal to the number of lands you control from among them/i.test(ctx.full || '')){
    ctx.looked = true; ctx.u25loot = true; const top = S.lib.slice(0, 6); if (UI.dry || !top.length) return true; const n = S.bf.filter(c => !c.fd && isLand(c.k)).length;
    const ok = top.filter(c => isCreatureCard(c) && (info(c.k)?.mv || 0) <= n); const ids = ok.length ? await pickCards({title:`${name}: a creature card with mana value ${n} or less onto the battlefield`, cards:ok, extra:top.filter(c => !ok.includes(c)), min:0, max:1, noneLabel:'None'}) : [];
    const c = ok.find(x => x.id === (ids || [])[0]); if (c){ moveCard(c.id, 'bf'); log(`${name}: put ${cname(c)} onto the battlefield`); }
    const rest = top.filter(x => x !== c && S.lib.includes(x)); rest.forEach(x => S.lib.splice(S.lib.indexOf(x), 1)); shuffle(rest); S.lib.push(...rest); commit(); return true; }
  if (ctx.u25loot && (/^you may reveal a creature card with mana value less than or equal to the number of lands you control from among them and put it onto the battlefield$/.test(l) || /^put the rest on the bottom in a random order$/.test(l))) return true;
  // Six
  if (/^(?:you may )?put a land card from among them into your hand$/.test(l)){
    const ids = u25movedSince(ctx, 'gy').filter(x => x.from === 'lib' && x.k && isLand(x.k)).map(x => x.id); const list = ids.map(id => S.gy.find(c => c.id === id)).filter(Boolean);
    if (!list.length || UI.dry) return true; const ch = await pickCards({title:`${name}: put a land card from among them into your hand`, cards:list, min:0, max:1, noneLabel:'None'}); if (ch && ch[0] != null) moveCard(ch[0], 'hand'); commit(); return true; }
  // Unstoppable Slasher
  if ((m = l.match(/^(?:if it had no counters on it, )?return it to the battlefield tapped under its owner's control with two stun counters on it$/))){
    const id = it.evId != null ? it.evId : ctx.srcId; const rec = (U25.lastCtr || {})[id]; if (/^if/.test(l) && rec && rec > 0){ log(`${name}: it had counters — it stays in the graveyard`); return true; }
    if (id == null || find(id)[0] !== 'gy') return true; moveCard(id, 'bf', {quiet:true}); const c = S.bf.find(b => b.id === id); if (c){ c.tap = true; addNamed(c, 'stun', 2); log(`${cname(c)} returned to the battlefield tapped with two stun counters`); } commit(); return true; }
  // Valakut Exploration
  if (/^if there are cards exiled with ~, put them into their owner's graveyard, then ~ deals that much damage to each opponent$/.test(l) || /^if there are cards exiled with ~, put them into their owner's graveyard$/.test(l)){
    const list = S.ex.filter(c => c.mayPlay && c.mayPlay.src === name); ctx.u25n = list.length; if (!list.length) return true;
    list.forEach(c => { delete c.mayPlay; moveCard(c.id, 'gy', {quiet:true}); }); log(`${name}: put ${list.length} exiled card${list.length === 1 ? '' : 's'} into my graveyard`);
    if (/deals that much damage/.test(l)){ const src = u25src(ctx); opponents().forEach(p => dealDamage({t:'player', pid:p.pid}, list.length, ctx.k, src)); log(`${name} deals ${list.length} damage to each opponent`); }
    commit(); return true; }
  if (/^~ deals that much damage to each opponent$/.test(l) && ctx.u25n != null){ const n = ctx.u25n; if (n){ const src = u25src(ctx); opponents().forEach(p => dealDamage({t:'player', pid:p.pid}, n, ctx.k, src)); } commit(); return true; }
  // Consuming Aberration
  if (/^each opponent reveals cards from the top of their library until they reveal a land card, then puts those cards into their graveyard$/.test(l) || /^each opponent reveals cards from the top of their library until they reveal a land card$/.test(l)){
    opponents().forEach(p => sendRq(p.pid, 'u25untilLandGy', 0, name)); if (opponents().length) log(`${name}: each opponent reveals until a land and puts those cards into their graveyard`); ctx.u25cab = true; commit(); return true; }
  if (/^(?:then )?puts those cards into their graveyard$/.test(l) && ctx.u25cab) return true;
  // Smuggler's Share
  if (/^draw a card for each opponent who drew two or more cards this turn, then create a treasure token for each opponent who had two or more lands enter the battlefield under their control this turn$/.test(l) || /^draw a card for each opponent who drew two or more cards this turn$/.test(l)){
    const T = (U25.tally || {})[turnStr()] || {}; const ops = opponents().map(p => T[p.pid] || {});
    const d = ops.filter(x => (x.draw || 0) >= 2).length; const tr = ops.filter(x => (x.land || 0) >= 2).length;
    if (d){ draw(d); log(`${name}: drew ${d}`); }
    if (/treasure/.test(l) && tr) await createFromText(`Create ${tr} Treasure token${tr === 1 ? '' : 's'}`, ctx); ctx.u25tr = tr; commit(); return true; }
  if (/^(?:then )?create a treasure token for each opponent who had two or more lands enter the battlefield under their control this turn$/.test(l)){
    const T = (U25.tally || {})[turnStr()] || {}; const tr = opponents().filter(p => ((T[p.pid] || {}).land || 0) >= 2).length; if (tr) await createFromText(`Create ${tr} Treasure token${tr === 1 ? '' : 's'}`, ctx); commit(); return true; }
  // Firemane Commando
  if (/^(?:they|target player|that player) draws? a card if none of those creatures attacked you$/.test(l)){
    const pid = it.evPid; if (!pid || pid === MYPID) return true; const atk = (OPP.get(pid)?.bf || []).filter(c => c.atk);
    const me = atk.some(c => { const d = parseDef(c.atk); return d && (d.pid === MYPID); }); if (!me){ sendRq(pid, 'draw', 1, name); log(`${name}: ${nameOf(pid)} draws a card`); } commit(); return true; }
  // Ardenn, Intrepid Archaeologist
  if (/^(?:you may )?attach any number of auras and equipment you control to target permanent or player$/.test(l)){
    const t = (ctx.tgts ? nextTargets(ctx) : [])[0]; if (!t || UI.dry) return true;
    const ok = c => /\bEquipment\b/.test(typeOf(c)) ? (t.t === 'card' && isCreatureCard({k:t.k})) : /\bAura\b/.test(typeOf(c)) && (t.t === 'player' ? /enchant player/i.test(info(c.k)?.o || '') : true);
    const list = S.bf.filter(c => !c.fd && ok(c)); if (!list.length) return true;
    const ids = await pickCards({title:`${name}: attach any number of Auras and Equipment to ${t.nm || 'the target'}`, cards:list, min:0, max:list.length});
    (ids || []).forEach(id => { const c = S.bf.find(b => b.id === id); if (c) c.att = t.t === 'player' ? {pid:t.pid} : {pid:t.pid, id:t.id}; }); if ((ids || []).length) log(`${name}: attached ${(ids || []).length} to ${t.nm || 'the target'}`); commit(); return true; }
  // Jaya's Immolating Inferno
  if (/^~ deals x damage to each of up to three targets$/.test(l)){ const x = it.x || 0; const src = u25src(ctx); let ts = [], t; while (ctx.tgts && (t = nextTargets(ctx)).length && ts.length < 3) ts.push(...t.filter(Boolean)); ts.slice(0, 3).forEach(t => dealDamage(t, x, ctx.k, src)); if (ts.length) log(`${name} deals ${x} damage to each of ${ts.length} targets`); commit(); return true; }
  // Wrathful Red Dragon
  if (/^it deals that much damage to any target that isn't a dragon$/.test(l)){
    const n = it.evN || it.evAmt || 0; const t = (ctx.tgts ? nextTargets(ctx) : [])[0]; const d = u25evCard(ctx); if (!t || !n) return true;
    if (t.t === 'card' && /\bDragon\b/.test(info(t.k)?.t || '')){ log(`${name}: a Dragon can't be the target`); return true; }
    dealDamage(t, n, d ? d.k : ctx.k, d); log(`${d ? cname(d) : name} deals ${n} damage (${name})`); commit(); return true; }
  // Stuffy Doll
  if (/^it deals that much damage to the chosen player$/.test(l)){ const src = u25src(ctx); const pid = src && src.u25player; const n = it.evN || it.evAmt || 0; if (!pid || !n) return true; dealDamage({t:'player', pid}, n, ctx.k, src); log(`${name} deals ${n} damage to ${nameOf(pid)}`); commit(); return true; }
  if (/^~ deals 1 damage to itself$/.test(l)){ const src = u25src(ctx); if (src) dealDamage({t:'card', pid:MYPID, id:src.id, k:src.k}, 1, src.k, src); commit(); return true; }
  // Lae'zel's Acrobatics (10—20): flicker, then exile again until the next end step
  if (/^return those cards to the battlefield under their owner's control, then exile them again$/.test(l) || /^exile them again$/.test(l)){
    const ids = u25movedSince(ctx, 'ex').filter(x => x.from === 'bf').map(x => x.id); const uniq = [...new Set(ids)];
    if (/^return/.test(l)) uniq.forEach(id => { if (find(id)[0] === 'ex') moveCard(id, 'bf'); });
    uniq.forEach(id => { if (find(id)[0] === 'bf') moveCard(id, 'ex', {quiet:true}); }); ctx.u25lz = uniq; commit(); return true; }
  // Inscription of Abundance
  if (/^target player gains x life, where x is the greatest power among creatures they control$/.test(l)){
    const t = (ctx.tgts ? nextTargets(ctx) : []).find(x => x && x.t === 'player'); if (!t) return true;
    const n = Math.max(0, ...boardOf(t.pid).filter(c => c.k && !c.fd && isCreatureCard(c)).map(c => (statsAny({t:'card', pid:t.pid, id:c.id, k:c.k}) || [0])[0]));
    if (n > 0){ if (t.pid === MYPID){ if (gainLife(n, name)) log(`gained ${n} life → ${S.life}`); } else sendRq(t.pid, 'life', n, name); } log(`${name}: ${nameOf(t.pid)} gains ${n} life`); commit(); return true; }
  // Baleful Mastery
  if (/^if the \{1\}\{b\} cost was paid, an opponent draws a card$/.test(l)){
    const c = it.card; if (!(c && c.u25alt && c.u25alt.t === turnStr() && /\{1\}\{B\}/i.test(c.u25alt.lab))) return true;
    const pid = opponents().length === 1 ? opponents()[0].pid : UI.dry ? null : await choosePlayer(`${name}: which opponent draws a card?`, true); if (pid){ sendRq(pid, 'draw', 1, name); log(`${name}: ${nameOf(pid)} draws a card (alternative cost)`); } commit(); return true; }
  // Hoarding Broodlord / Aerial Extortionist: play the exiled card for as long as it remains exiled
  if (/^for as long as that card remains exiled, you may play it$/.test(l)){ const mv = u25movedSince(ctx, 'ex').filter(x => x.from === 'lib').slice(-1)[0]; const c = mv && S.ex.find(x => x.id === mv.id); if (c){ c.mayPlay = {t:turnStr(), adv:true, src:name}; log(`${name}: may play the exiled card for as long as it remains exiled`); } commit(); return true; }
  if (/^for as long as that card remains exiled, its owner may cast it$/.test(l)){ const t = (ctx.lastT || [])[0]; if (!t) return true;
    if (t.pid === MYPID){ const c = S.ex.find(x => x.id === t.id); if (c && !c.tok) c.mayPlay = {t:turnStr(), adv:true, cast:true, src:name}; } else sendRq(t.pid, 'u25mayCastEx', 0, name, {d:t.k}); commit(); return true; }
  // Inti: "Play that card until your next end step"
  if (/^(?:you may )?play that card until your next end step$/.test(l)){ const mv = u25movedSince(ctx, 'ex').filter(x => x.from === 'lib').slice(-1)[0]; const c = mv && S.ex.find(x => x.id === mv.id); if (c){ c.mayPlay = {t:turnStr(), adv:true, src:name, u25end:u25nextEnd()}; log(`${name}: may play ${cname(c)} until my next end step`); } commit(); return true; }
  // Ugin, Eye of the Storms −11
  if (/^until end of turn, you may cast those cards without paying their mana costs$/.test(l)){ const ids = u25movedSince(ctx, 'ex').filter(x => x.from === 'lib').map(x => x.id).filter(id => S.ex.some(c => c.id === id)); if (ids.length) grantPlay(ids, {cast:true, free:true, src:name}); commit(); return true; }
  // Yawgmoth's Will
  if (/^until end of turn, you may play lands and cast spells from your graveyard$/.test(l)){ S.u25yw = turnStr(); log(`${name}: may play lands and cast spells from my graveyard this turn`); commit(); return true; }
  if (/^if a card would be put into your graveyard from anywhere this turn, exile that card instead$/.test(l)){ S.u25ywEx = turnStr(); log(`${name}: cards going to my graveyard are exiled instead this turn`); commit(); return true; }
  // Klauth
  if (/^add x mana in any combination of colors, where x is the total power of attacking creatures$/.test(l)){
    const x = S.bf.filter(c => c.atk && !c.fd && isCreatureCard(c)).reduce((a, c) => a + Math.max(0, (stats(c) || [0])[0]) * (c.n || 1), 0); if (!x || UI.dry){ ctx.u25X = x; return true; }
    const outs = []; for (let i = 0; i < x; i++){ const v = await askChoice({title:`${name}: mana ${i + 1} of ${x} — which color?`, options:['W', 'U', 'B', 'R', 'G'].map(c => ({label:`{${c}}`, value:c}))}); outs.push(v || 'R'); }
    addMana(outs); S.keepMana = turnStr(); log(`${name}: added ${outs.map(c => '{' + c + '}').join('')}`); commit(); return true; }
  if (/^spend this mana only to cast spells$/.test(l) || /^until end of turn, you don't lose this mana as steps and phases end$/.test(l)) { if (/don't lose/.test(l)) S.keepMana = turnStr(); return true; }
  // Selvala, Explorer Returned (parley)
  if (/^each player reveals the top card of their library$/.test(l) && /for each nonland card revealed this way/i.test(ctx.full || '')){
    if (!UI.dry) await new Promise(r => setTimeout(r, 300)); let n = 0; const shown = [];
    const mine = S.lib[0]; if (mine){ shown.push(cname(mine)); if (!isLand(mine.k)) n++; }
    for (const p of opponents()){ const top = (OPP.get(p.pid) || {}).libTop || (OPP.get(p.pid) || {}).top; const k = Array.isArray(top) ? top[0] : top; if (k){ shown.push(info(k)?.n || k); if (!isLand(k)) n++; } else ctx.u25unk = true; }
    if (ctx.u25unk) opponents().forEach(p => sendRq(p.pid, 'u25revTop', 0, name)); ctx.u25parley = n; log(`${name}: revealed ${shown.join(', ')}`); return true; }
  if (/^for each nonland card revealed this way, add \{g\} and you gain 1 life$/.test(l) && ctx.u25parley != null){
    let n = ctx.u25parley; if (ctx.u25unk && !UI.dry){ const ref = U25.revRef = {}; await waitUntil(() => Object.keys(ref).length >= opponents().length, 4000); n += Object.values(ref).filter(Boolean).length; }
    if (n){ addMana(Array(n).fill('G')); if (gainLife(n, name)) log(`${name}: added ${'{G}'.repeat(n)} and gained ${n} life → ${S.life}`); } commit(); return true; }
  // Semblance Anvil
  if (/^(?:you may )?exile a nonland card from your hand$/.test(l)){ const list = S.hand.filter(c => !isLand(c.k)); const src = u25src(ctx); if (!list.length || UI.dry) return true;
    const ids = await pickCards({title:`${name}: exile a nonland card from your hand`, cards:list, min:0, max:1, noneLabel:'None'}); if (ids && ids[0] != null){ const c = S.hand.find(x => x.id === ids[0]); moveCard(ids[0], 'ex'); if (src && c){ src.u25imp = c.k; log(`${name}: imprinted ${cname(c)}`); } } commit(); return true; }
  // Forge of Heroes
  if (/^choose target commander that entered this turn$/.test(l)){ const t = (ctx.tgts ? nextTargets(ctx) : [])[0]; if (!t) return true; const c = t.pid === MYPID ? S.bf.find(b => b.id === t.id) : null;
    if (!c || !c.cmd || !(U25.entered || {})[c.id] || U25.entered[c.id] !== turnStr()){ log(`${name}: that isn't a commander that entered this turn`); ctx.lastT = []; return true; } ctx.lastT = [t]; return true; }
  if (/^put a \+1\/\+1 counter on it if it's a creature and a loyalty counter on it if it's a planeswalker$/.test(l)){ const t = (ctx.lastT || [])[0]; const c = t && S.bf.find(b => b.id === t.id); if (!c) return true;
    if (isCreatureCard(c)) modCounters(c, 'cp', 1); if (isPW(c)) c.co = (c.co || 0) + 1; log(`${name}: ${cname(c)} gets its counter`); commit(); return true; }
  // Minas Morgul
  if (/^for as long as that creature has a shadow counter on it, it's a wraith in addition to its other types$/.test(l)){ const t = (ctx.lastT || [])[0]; if (!t) return true; if (t.pid === MYPID) U25wraith(S.bf.find(b => b.id === t.id)); else sendRq(t.pid, 'u25wraith', 0, name, {tid:t.id}); commit(); return true; }
  // Warden of the Grove: endure
  if ((m = l.match(/^(it|~|that creature) endures (\d+|x)(?:, where x is the number of counters on ~)?$/))){
    let n = m[2] === 'x' ? 0 : +m[2]; if (m[2] === 'x' || /where x is the number of counters on ~/.test(l)){ const src = u25src(ctx); n = src ? (src.cp || 0) + (src.cm || 0) + Object.values(src.nc || {}).reduce((a, b) => a + (b || 0), 0) : 0; }
    if (!n) return true; const c = m[1] === '~' ? u25src(ctx) : u25evCard(ctx) || (ctx.lastT && ctx.lastT[0] && S.bf.find(b => b.id === ctx.lastT[0].id));
    const ctr = c && !UI.dry ? await askChoice({title:`${name}: endure ${n}`, options:[{label:`Put ${n} +1/+1 counter${n === 1 ? '' : 's'} on ${cname(c)}`, value:'c'}, {label:`Create a ${n}/${n} white Spirit token`, value:'t'}]}) : 'c';
    if (c && ctr === 'c'){ modCounters(c, 'cp', n); log(`${cname(c)} endures ${n}: +${n} counters`); } else if (!UI.dry || !c) await createFromText(`Create a ${n}/${n} white Spirit creature token`, ctx); commit(); return true; }
  // Scourge of the Throne
  if (/^if it's attacking the player with the most life or tied for most life, untap all attacking creatures$/.test(l)){
    const src = u25src(ctx); const d = src && parseDef(src.atk); const pid = d && d.id == null ? d.pid : null; if (!pid) return true; const top = Math.max(...players().map(p => p.me ? S.life : (OPP.get(p.pid)?.life ?? -999)));
    const life = pid === MYPID ? S.life : (OPP.get(pid)?.life ?? -999); ctx.condResult = life >= top; if (!ctx.condResult){ log(`${name}: not attacking the player with the most life`); ctx.u25stop = true; return true; }
    S.bf.filter(c => c.atk).forEach(c => { c.tap = false; c.tn = 0; }); log(`${name}: untapped all attacking creatures`); commit(); return true; }
  if (ctx.u25stop && /^after this phase, there is an additional combat phase$/.test(l)) return true;
  // Skrelv: hexproof from / can't be blocked by creatures of the chosen color
  if (/^it can't be blocked by creatures of that color this turn$/.test(l)){ const t = (ctx.lastT || [])[0]; const c = t && S.bf.find(b => b.id === t.id); const col = ctx.color || ctx.chosenColor; if (c && col){ c.u25unblk = {t:turnStr(), col:/^[WUBRG]$/.test(col) ? col : u25colSym(col)}; log(`${cname(c)} can't be blocked by ${col} creatures this turn`); } commit(); return true; }
  // The Black Gate
  if (/^choose a player with the most life or tied for most life$/.test(l)){ const top = Math.max(...players().map(p => p.me ? S.life : (OPP.get(p.pid)?.life ?? -999))); const list = players().filter(p => (p.me ? S.life : OPP.get(p.pid)?.life) === top);
    const pid = list.length === 1 || UI.dry ? (list[0] || {}).pid : await askChoice({title:`${name}: choose a player with the most life`, options:list.map(p => ({label:p.nm, value:p.pid}))}); ctx.u25pl = pid; if (pid) log(`${name}: chose ${nameOf(pid)}`); return true; }
  if (/^target creature can't be blocked by creatures (?:that|target) player controls this turn$/.test(l)){ const t = (ctx.tgts ? nextTargets(ctx) : []).find(x => x && x.t === 'card'); const pid = ctx.u25pl; if (!t || !pid) return true;
    if (t.pid === MYPID){ const c = S.bf.find(b => b.id === t.id); if (c){ c.u25unblkP = {t:turnStr(), pid}; log(`${cname(c)} can't be blocked by creatures ${nameOf(pid)} controls this turn`); } } else sendRq(t.pid, 'u25unblkP', 0, name, {tid:t.id, d:pid}); commit(); return true; }
  // Urza's Bauble
  if (/^look at a card at random in target player's hand$/.test(l)){ const t = (ctx.tgts ? nextTargets(ctx) : []).find(x => x && x.t === 'player'); if (!t) return true;
    if (t.pid === MYPID){ const c = S.hand[Math.floor(Math.random() * S.hand.length)]; if (c) log(`${name}: random card in my hand: ${cname(c)}`); } else sendRq(t.pid, 'u25randHand', 0, name); commit(); return true; }
  // Appa / Avatar's Wrath: airbend
  if (/^airbend any number of other target nonland permanents you control$/.test(l)){ let t; while (ctx.tgts && (t = nextTargets(ctx)).length) t.filter(Boolean).forEach(x => u25airbend(x, name)); commit(); return true; }
  if (/^airbend all other creatures$/.test(l)){ const keep = new Set((ctx.lastT || []).map(t => t.pid + ':' + t.id)); u25allCreatures().filter(r => !keep.has(r.pid + ':' + r.id)).forEach(r => u25airbend(r, name)); bent('air'); log(`${name}: airbent all other creatures`); commit(); return true; }
  if (/^choose up to one target creature$/.test(l) && /airbend all other creatures/i.test(ctx.full || '')){ ctx.lastT = (ctx.tgts ? nextTargets(ctx) : []).filter(Boolean); return true; }
  if (/^until your next turn, your opponents can't cast spells from anywhere other than their hands$/.test(l)){ opponents().forEach(p => sendRq(p.pid, 'u25handOnly', 0, name, {d:turnStr()})); log(`${name}: until my next turn, opponents can cast spells only from their hands`); commit(); return true; }
  return false;
}
{
  const ds = doSentence;
  doSentence = async function(s0, ctx){ if (ctx && ctx.u25s0 == null) ctx.u25s0 = U25.seq; const s = String(s0).replace(/\.$/, '').trim(); const l = s.toLowerCase(); if (l && await doRound25UPre(s, l, ctx)) return; return ds(s0, ctx); };
  // Arcane Lighthouse: my spells and abilities ignore hexproof and shroud of opponents' creatures this turn
  const tcs = targetCands;
  targetCands = function(spec, src){ const out = tcs(spec, src);
    try { if (S && S.u25lh === turnStr() && src && src.pid === MYPID) out.forEach(x => { if (x.ok || x.pid === MYPID || x.t !== 'card') return; if (/hexproof|shroud/.test(x.why || '') && isCreatureCard({k:x.k})){ x.ok = true; x.why = ''; } }); } catch {}
    return out; };
  RQ_OPS.push('u25noAct', 'u25bounceAll', 'u25ramp', 'u25untilLandGy', 'u25mayCastEx', 'u25wraith', 'u25unblkP', 'u25randHand', 'u25show', 'u25air', 'u25handOnly', 'u25revTop', 'u25revAns');
  const ao = applyOp;
  applyOp = function(r, from){
    if (r.op === 'u25noAct'){ const c = S.bf.find(b => b.id === r.tid); if (c){ c.r21noAct = turnStr(); log(`${cname(c)}: its activated abilities can't be activated this turn (${r.src})`); commit(); } return; }
    if (r.op === 'u25ramp'){ (async () => { const n = r.n || 1; await searchLibrary(`up to ${n === 1 ? 'one' : n} basic land card${n === 1 ? '' : 's'}`, 'put them onto the battlefield tapped, then shuffle', {name:r.src, it:{}}); commit(); })(); return; }
    if (r.op === 'u25untilLandGy'){ const out = []; while (S.lib.length){ const c = S.lib[0]; out.push(c); moveCard(c.id, 'gy', {quiet:true}); if (isLand(c.k)) break; } log(`revealed until a land and put ${out.length} card${out.length === 1 ? '' : 's'} into my graveyard: ${out.map(cname).join(', ')} (${r.src})`); commit(); return; }
    if (r.op === 'u25mayCastEx'){ const c = S.ex.slice().reverse().find(x => x.k === r.d); if (c){ c.mayPlay = {t:turnStr(), adv:true, cast:true, src:r.src}; log(`may cast ${cname(c)} from exile for as long as it remains exiled (${r.src})`); commit(); } return; }
    if (r.op === 'u25wraith'){ U25wraith(S.bf.find(b => b.id === r.tid)); commit(); return; }
    if (r.op === 'u25unblkP'){ const c = S.bf.find(b => b.id === r.tid); if (c){ c.u25unblkP = {t:turnStr(), pid:r.d}; commit(); } return; }
    if (r.op === 'u25randHand'){ const c = S.hand[Math.floor(Math.random() * S.hand.length)]; log(`${nameOf(from)} looks at a card at random in my hand: ${c ? cname(c) : 'none'} (${r.src})`); sendRq(from, 'u25show', 0, r.src, {d:c ? c.k : ''}); commit(); return; }
    if (r.op === 'u25show'){ const nm = r.d ? (info(r.d)?.n || r.d) : 'no card'; log(`${r.src}: ${nameOf(from)}'s random card is ${nm}`); toast(`${r.src}: ${nameOf(from)}'s random card — ${nm}`); return; }
    if (r.op === 'u25air'){ const c = S.bf.find(b => b.id === r.tid); if (c){ moveCard(c.id, 'ex', {quiet:true}); const e = find(c.id)[2]; if (e && find(c.id)[0] === 'ex'){ e.airK = 1; e.mayPlay = {t:turnStr(), adv:true, cast:true, src:r.src}; } log(`${cname(c)} was airbent — I may cast it for {2} (${r.src})`); commit(); } return; }
    if (r.op === 'u25handOnly'){ S.u25handOnly = {pid:from, t:r.d, src:r.src}; log(`until ${nameOf(from)}'s next turn I can cast spells only from my hand (${r.src})`); commit(); return; }
    if (r.op === 'u25revTop'){ const c = S.lib[0]; log(`revealed the top card of my library: ${c ? cname(c) : 'nothing'} (${r.src})`); sendRq(from, 'u25revAns', c && !isLand(c.k) ? 1 : 0, r.src, {d:c ? c.k : ''}); commit(); return; }
    if (r.op === 'u25revAns'){ if (U25.revRef) U25.revRef[from] = r.n ? 1 : 0; return; }
    if (r.op === 'u25bounceAll'){ S.bf.filter(c => !c.fd && !c.tok && !isLand(c.k)).forEach(c => moveCard(c.id, 'hand', {quiet:true})); log(`returned each nonland, nontoken permanent I own to my hand (${r.src})`); commit(); return; }
    return ao(r, from);
  };
  // Devoted Druid: "Put a -1/-1 counter on this creature: Untap this creature." is an activated ability
  const lk = lineKind;
  lineKind = function(line){ if (/^put an? (?:-1\/-1|\+1\/\+1|-0\/-1) counter on (?:~|this creature|[^:]+?):\s/i.test(line) && !/^put an? [^:]+ counter on (?:target|each)/i.test(line)) return 'ability'; return lk(line); };
  const al = abilityList;
  abilityList = function(c){ const out = al(c); try { const f = faceOf(c); if (!f || c.fd) return out;
    for (const raw of tname(f.o, f.n).split('\n')){ const q = raw.trim().match(/^(put an? (?:-1\/-1|\+1\/\+1|-0\/-1) counter on ~):\s*(.+)$/i); if (q && !out.some(a => a.line === raw.trim())) out.push({cost:q[1], eff:q[2].trim(), sorc:/activate only as a sorcery/i.test(q[2]), line:raw.trim()}); } } catch {}
    return out; };
}

// legendary names whose short name is three letters ("Uro", "Six"-style shortenings are not replaced by tname)
{ const tn = tname; tname = function(txt, name){ let t = tn(txt, name); try { const n = String(name || '').split(' // ')[0]; const sh = n.split(',')[0]; if (sh !== n && sh.length === 3 && /^[A-Z][a-z]+$/.test(sh) && legendName(n)) t = t.replace(new RegExp('\\b' + sh + '\\b(?!\')', 'g'), '~'); } catch {} return t; }; }
// Skyclave Apparition: remember the card its enters ability exiled
{ const ds = doSentence; doSentence = async function(s0, ctx){ const r = await ds(s0, ctx);
    try { if (ctx && /the exiled card's owner creates an x\/x/i.test(info(ctx.k)?.o || '') && /^exile up to one target/i.test(String(s0)) && ctx.lastT && ctx.lastT[0] && ctx.srcId != null){ S.u25link = S.u25link || {}; S.u25link[ctx.srcId] = {k:ctx.lastT[0].k, pid:ctx.lastT[0].pid}; } } catch {}
    return r; }; }
// Six: nonland permanent cards in my graveyard have retrace during my turn
STATIC_RULES.push([/^during your turn, nonland permanent cards in your graveyard have retrace$/, m => ({kind:'u25six', who:'you'})]);
{ const go = gyOptions; gyOptions = function(c){ const r = go(c) || []; try { if (S && c && c.k && rulesOn('u25six').length && currentTurn()[1] === MYPID && !isLand(c.k) && isPermType(info(c.k)?.t) && !r.some(o => o.kind === 'retrace')){ const a = info(c.k); r.push({kind:'retrace', label:`Retrace ${a.m} + discard a land (Six)`, mana:a.m, extra:[{t:'discard', desc:'land', n:1, label:'discard a land card'}], after:''}); } } catch {} return r; }; }

// counters a creature had when it left (Unstoppable Slasher's "if it had no counters on it")
{ const ol = onLeave; onLeave = function(c, to, w){ try { const src = w || c; const n = (src.cp || 0) + (src.cm || 0) + Object.values(src.nc || {}).reduce((a, b) => a + (b || 0), 0) + (c.nc ? Object.values(c.nc).reduce((a, b) => a + (b || 0), 0) : 0); U25.lastCtr = U25.lastCtr || {}; U25.lastCtr[c.id] = n; } catch {} return ol(c, to, w); }; }
// per-turn tallies of every player's draws and land entries (Smuggler's Share)
{ const he = handleEvent; handleEvent = function(pid, ev){ try { if (ev && pid && (ev.type === 'draw' || ev.type === 'enter' && ev.k && isLand(ev.k))){ const key = pid + ':' + (ev.n != null ? ev.n : Math.random()); U25.seen = U25.seen || new Set(); if (!U25.seen.has(key)){ U25.seen.add(key); const T = (U25.tally = U25.tally || {}); const t = T[turnStr()] = T[turnStr()] || {}; const x = t[pid] = t[pid] || {}; if (ev.type === 'draw') x.draw = (x.draw || 0) + (ev.cnt || 1); else x.land = (x.land || 0) + (ev.cnt || 1); } } } catch {} return he(pid, ev); }; }
// Talion: "a spell with mana value, power, or toughness equal to the chosen number" — keep the condition in one piece
{ const tn = tname; tname = function(txt, name){ return tn(txt, name).replace(/with mana value, power, or toughness equal to the chosen number/g, 'with mana value or power or toughness equal to the chosen number'); }; }
{ const ct = classifyTrig; classifyTrig = function(w, c){
    if (w === 'whenever' && /^an opponent casts a spell with mana value or power or toughness equal to the chosen number$/.test(c)) return {ev:'cast', subj:'any', ctl:'any', desc:'', qf:(s, ev, pid) => { if (pid === MYPID || !ev.k) return false; const src = S.bf.find(b => b.id === s.id); const n = src && src.u25num; if (n == null) return false; const a = info(ev.k) || {}; const pt = ptOf(a) || []; return a.mv === n || pt[0] === n || pt[1] === n; }};
    return ct(w, c); }; }
// "As ~ enters, choose a number between 1 and 10" / "As ~ enters, choose a player" — remembered on the permanent
{ const oe = onEnter; onEnter = function(c, from, o = {}){ const r = oe(c, from, o);
    try { if (c && c.k && !UI.dry && S.bf.includes(c)){ const t = tname(info(c.k)?.o || '', info(c.k)?.n || ''); let m;
      if ((m = t.match(/As ~ enters, choose a number between (\d+) and (\d+)/i)) && c.u25num == null){ const lo = +m[1], hi = +m[2]; (async () => { const v = await askChoice({title:`${cname(c)}: choose a number`, options:Array.from({length:hi - lo + 1}, (_, i) => ({label:String(lo + i), value:lo + i}))}); c.u25num = v == null ? lo : +v; log(`${cname(c)}: chose ${c.u25num}`); commit(); })(); }
      if (/As ~ enters, choose a player\./i.test(t) && !c.u25player){ (async () => { const pid = await choosePlayer(`${cname(c)}: choose a player`, false); c.u25player = pid || (opponents()[0] || {}).pid; log(`${cname(c)}: chose ${nameOf(c.u25player)}`); commit(); })(); }
    } } catch (e){ console.warn(e); }
    return r; }; }
// Comet Storm: one target plus one more for each time it was kicked
{ const bc = beginCast; beginCast = async function(c, ...a){ const sv = U25.castC; U25.castC = c; try { return await bc.call(this, c, ...a); } finally { U25.castC = sv; } }; }
{ const ts = targetSpecs; targetSpecs = function(t){ const lo = String(t || '').toLowerCase();
    if (/choose any target, then choose another target for each time ~ was kicked/.test(lo) || /choose any target, then choose another target for each time comet storm was kicked/.test(lo)){ const k = (U25.castC && U25.castC.kicked) || 0; return [{desc:'any', any:true, zone:'bf', n:1 + k, upTo:false}]; }
    // targets this file's handlers choose themselves (cards in graveyards), or whose description needs a plain noun
    if (/for each opponent, you may put up to one target creature card from (?:that|target) player's graveyard onto the battlefield/.test(lo) || /put any number of target creature cards with total mana value (?:x|\d+) or less from graveyards/.test(lo)) return ts(String(t).replace(/up to one target creature card from (?:that|target) player's graveyard/i, 'up to one creature card from that player\'s graveyard').replace(/any number of target creature cards with total/i, 'any number of creature cards with total'));
    const out = ts(t); try { out.forEach(sp => { if (sp && typeof sp.desc === 'string' && /^creatures? controlled by different players$/.test(sp.desc)) sp.desc = 'creature'; }); } catch {} return out; }; }
// Aetheric Amplifier: "Choose one. Activate only as a sorcery." heads a modal ability
{ const pm = parseModes; parseModes = function(txt){ return pm(String(txt || '').replace(/^Choose (one|two)\. Activate only as a sorcery\.\s*\n/i, 'Choose $1 —\n').replace(/(^|\n)Choose one\. If (?:this spell|~|[^\n.]+?) was kicked, choose any number instead\.\s*\n/i, (w, a) => a + (U25.kickedNow === false ? 'Choose one —\n' : 'Choose any number —\n'))); }; }
// Inscriptions: "Choose one. If this spell was kicked, choose any number instead."
{ const mt = modalText; modalText = async function(txt, ctx){ const sv = U25.kickedNow; U25.kickedNow = !!(ctx && ctx.it && (ctx.it.kicked || (ctx.it.card && ctx.it.card.kicked))); try { return await mt(txt, ctx); } finally { U25.kickedNow = sv; } }; }

/* ---------- statics ---------- */
const U25_NONBASIC_LT = ['Cave', 'Cloud', 'Desert', 'Gate', 'Lair', 'Locus', 'Mine', 'Power-Plant', 'Sphere', 'Tower', 'Town', "Urza's"];
{ const lps = l24parseStatic; l24parseStatic = function(line){ const l = String(line || '').toLowerCase().replace(/\.$/, '').trim(); let m;
    // Planar Nexus
    if (/^(?:~|this land) is every nonbasic land type$/.test(l)) return {scope:'you', desc:'', cond:'u25self', mod:{addS:U25_NONBASIC_LT.slice()}};
    // Arixmethes, Slumbering Isle
    if ((m = l.match(/^as long as ~ has an? (\w+) counter on it, it's a land$/))) return {scope:'you', desc:'', cond:'u25selfctr:' + m[1], mod:{setC:['Land'], setSub:[]}};
    return lps(line); }; }
{ const la = l24applies; l24applies = function(src, c, pid, t4){ const st = src.st; if (st && st.cond && String(st.cond).startsWith('u25self')){ if (src.s !== c || src.pid !== pid) return false; const k = String(st.cond).split(':')[1]; if (k && !((c.nc || {})[k] > 0)) return false; return true; } return la(src, c, pid, t4); }; }
// Ulamog, the Defiler: annihilator X, where X is the number of +1/+1 counters on it
STATIC_RULES.push([/^~ has annihilator x, where x is the number of \+1\/\+1 counters on it$/, m => ({kind:'u25annX', who:'you'})]);
{ const kn = l24kwN; l24kwN = function(c, kw){ let n = kn(c, kw); try { if (kw === 'annihilator' && c && c.k && /has annihilator X, where X is the number of \+1\/\+1 counters on it/i.test(info(c.k)?.o || '')){ const e = l24eff(c); if (!(e && e.noAb)) n += Math.max(0, (c.cp || 0) - (c.cm || 0)); } } catch {} return n; }; }
// Daxos, Blessed by the Sun: toughness equal to your devotion to white
STATIC_RULES.push([/^~'s toughness is equal to your devotion to (white|blue|black|red|green)$/, m => ({kind:'u25devT', who:'you'})]);
{ const st0 = stats; stats = function(c, pid = MYPID){ const r = st0(c, pid); try { if (r && c && c.k && !c.fd){ const mm = tname(info(c.k)?.o || '', info(c.k)?.n || '').match(/~'s toughness is equal to your devotion to (white|blue|black|red|green)/i); if (mm){ const col = mm[1].toLowerCase(); let n = 0;
      if (pid === MYPID) n = devotion([col]); else { const sym = {white:'W', blue:'U', black:'B', red:'R', green:'G'}[col]; for (const b of boardOf(pid)){ if (b.fd || !b.k) continue; for (const x of (info(b.k)?.m || '').match(/\{[^}]+\}/g) || []) if (x.includes(sym)) n++; } }
      return [r[0], r[1] + n]; } } } catch {} return r; }; }
// Conqueror's Flail: only while attached to a creature
STATIC_RULES.push([/^as long as ~ is attached to a creature, your opponents can't cast spells during your turn$/, m => ({kind:'notOnTurn', who:'opp', u25att:1})]);
{ const sr = staticRules; staticRules = function(){ const out = sr(); try { return out.filter(r => !r.u25att || boardOf(r.pid).some(b => b.k && !b.fd && info(b.k)?.n === r.src && b.att && b.att.id != null)); } catch { return out; } }; }
// Nowhere to Run: my spells and abilities ignore hexproof of opponents' creatures; their ward doesn't trigger
STATIC_RULES.push([/^creatures your opponents control can be the targets of spells and abilities as though they didn't have hexproof$/, m => ({kind:'u25nohex', who:'you'})]);
STATIC_RULES.push([/^ward abilities of those creatures don't trigger$/, m => ({kind:'u25noward', who:'you'})]);
{ const tcs = targetCands; targetCands = function(spec, src){ const out = tcs(spec, src);
    try { if (S && src && src.pid === MYPID && rulesOn('u25nohex').length) out.forEach(x => { if (!x.ok && x.t === 'card' && x.pid !== MYPID && x.why === 'hexproof' && isCreatureCard({k:x.k})){ x.ok = true; x.why = ''; } }); } catch {}
    return out; };
  const wo = wardOf; wardOf = function(c){ try { if (S && c && rulesOn('u25noward').length && !S.bf.includes(c) && isCreatureCard(c)) return null; } catch {} return wo(c); }; }

/* ---------- machinery behind batch 5 ---------- */
// alternative cost chosen for a spell (Baleful Mastery)
{ const sc = spellCost; spellCost = function(c, zone, o = {}){ try { if (c && o && UI.casting){ if (o.alt && o.alt.label) c.u25alt = {lab:String(o.alt.label), t:turnStr()}; else if (o.alt === null) delete c.u25alt; } } catch {}
    let oo = o; try { if (c && zone === 'ex' && c.airK && !(o && o.alt)) oo = {...(o || {}), alt:{mana:'{2}', extra:[], label:'Airbend: {2}'}}; } catch {}
    return sc(c, zone, oo); }; }
// commanders: which turn they entered (Forge of Heroes)
{ const oe = onEnter; onEnter = function(c, from, o = {}){ try { if (c) (U25.entered = U25.entered || {})[c.id] = turnStr(); } catch {} return oe(c, from, o); }; }
// "until your next end step" play windows (Inti) and Yawgmoth's Will
{ const ew = exWindowOk; exWindowOk = function(c){ const mp = c && c.mayPlay; if (mp && mp.u25end) return !(mp.u25endT && mp.u25endT !== turnStr()); return ew(c); }; }
{ const ft = fireSteps; fireSteps = function(step, activePid, ...a){ try { if (S && step === 'end' && activePid === MYPID) S.ex.forEach(c => { const mp = c.mayPlay; if (mp && mp.u25end && !mp.u25endT) mp.u25endT = turnStr(); }); } catch {} return ft(step, activePid, ...a); }; }
{ const go = gyOptions; gyOptions = function(c){ const r = go(c) || []; try { if (S && S.u25yw === turnStr() && c && c.k && S.gy.includes(c) && !r.some(o => o.kind === 'u25yw')){ const a = info(c.k); if (isLand(c.k)) r.push({kind:'u25yw', label:"Play this land (Yawgmoth's Will)", land:true, mana:'', extra:[], after:''}); else r.push({kind:'u25yw', label:`Cast from graveyard ${a.m || ''} (Yawgmoth's Will)`, mana:a.m || '', extra:[], after:''}); } } catch {} return r; }; }
{ const gr = gyReplace; gyReplace = function(c, from){ try { if (S && S.u25ywEx === turnStr() && c && !c.tok) return 'ex'; } catch {} return gr(c, from); }; }
// Avatar's Wrath: opponents' casting from anywhere but the hand
{ const cc = castCheck; castCheck = function(c, zone){ try { const h = S && S.u25handOnly; if (h && zone && zone !== 'hand'){ const [, pid] = currentTurn(); if (pid === h.pid && turnStr() !== h.t) S.u25handOnly = null; else return {ok:false, why:`${h.src}: you can cast spells only from your hand until ${nameOf(h.pid)}'s next turn`}; } } catch {} return cc(c, zone); }; }
// Skrelv / The Black Gate: blocking restrictions
{ const cb = canBlock; canBlock = function(b, a, apid){ try { if (a && a.u25unblk && a.u25unblk.t === turnStr()){ const col = info(b.k)?.c || ''; if (col.includes(a.u25unblk.col)) return "can't be blocked by that colour"; }
      if (a && a.u25unblkP && a.u25unblkP.t === turnStr() && a.u25unblkP.pid === MYPID) return "can't be blocked by you"; } catch {} return cb(b, a, apid); }; }
// Minas Morgul: Wraith while it has a shadow counter
{ const to = typeOf; typeOf = function(c){ const t = to(c); try { if (c && c.u25wraith && (c.nc || {}).shadow > 0 && !/\bWraith\b/.test(t)) return /—/.test(t) ? t + ' Wraith' : t + ' — Wraith'; } catch {} return t; }; }
// Klauth: this mana isn't lost as steps and phases end this turn
// station thresholds on triggered abilities ("3+ | Whenever you cast an artifact spell, …")
{ const tg = trigsOf; const cache = new Map(); trigsOf = function(k, fl){ const out = tg(k, fl); try { const key = k + (fl ? '|b' : ''); if (cache.has(key)) return out.concat(cache.get(key)); const a = info(k); const f = a ? (fl && a.back ? a.back : a) : null; const add = [];
      if (f && /^\d+\+ \| (when|whenever|at) /im.test(f.o || '')) for (const line of tname(f.o, f.n).split('\n')){ const mm = line.trim().match(/^(\d+)\+ \| (when|whenever|at) (.+?), ([\s\S]+)$/i); if (!mm) continue; const cl = classifyTrig(mm[2].toLowerCase(), mm[3].toLowerCase().trim()); if (!cl) continue; add.push({...cl, eff:mm[4].trim(), raw:line.trim(), u25minCh:+mm[1]}); }
      if (a) cache.set(key, add); return out.concat(add); } catch { return out; } }; }
{ const pt = pushTrigger; pushTrigger = function(src, t, ev, evPid){ try { if (t && t.u25minCh){ const c = S.bf.find(b => b.id === src.id); if (!c || ((c.nc || {}).charge || 0) < t.u25minCh) return; } } catch {} return pt(src, t, ev, evPid); }; }
{ const cc = checkCard; checkCard = async function(k){ const r = await cc(k);
    try { const a = info(k); if (!a || !r || !r.issues) return r; const out = [];
      for (const x of r.issues){ const mm = x.kind === 'static' && String(x.text).match(/^(\d+)\+ \| (when|whenever|at) (.+?), ([\s\S]+)$/i);
        if (!mm){ out.push(x); continue; } const cond = tname(mm[3], a.n).toLowerCase().trim(); const cl = classifyTrig(mm[2].toLowerCase(), cond); if (!cl){ out.push({kind:'trigger', text:x.text}); continue; }
        (await dryAll(mm[4], k, a.n)).forEach(t => out.push({kind:'effect', text:t, where:x.text})); }
      r.issues = out; } catch (e){ console.warn(e); }
    return r; }; }

// Semblance Anvil: spells that share a card type with the imprinted card cost {2} less
{ const cm = costMods; costMods = function(c, caster){ const out = cm(c, caster); try { if (S && c && c.k && caster === MYPID) for (const b of S.bf){ if (b.fd || !b.u25imp) continue; const mm = tname(info(b.k)?.o || '', info(b.k)?.n || '').match(/spells you cast that share a card type with the exiled card cost \{(\d+)\} less to cast/i); if (!mm) continue;
      const ty = t => ['Artifact', 'Creature', 'Enchantment', 'Instant', 'Sorcery', 'Planeswalker', 'Land', 'Battle', 'Kindred', 'Tribal'].filter(x => new RegExp('\\b' + x + '\\b').test(t || ''));
      const a = ty(info(b.u25imp)?.t), mine = ty(info(c.k)?.t); if (a.some(x => mine.includes(x))) out.less.push({n:+mm[1], src:info(b.k)?.n}); } } catch {} return out; }; }
// "the number of cards in your opponents' graveyards" (Consuming Aberration's power and toughness)
{ const co = countOf; countOf = function(phrase, ctx){ try { if (/^cards in (?:your opponents'|all opponents') graveyards$/.test(String(phrase || '').trim().toLowerCase())) return opponents().reduce((a, p) => a + ((OPP.get(p.pid) || {}).gy || []).length, 0); } catch {} return co(phrase, ctx); }; }
