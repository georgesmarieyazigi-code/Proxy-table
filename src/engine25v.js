/* ===================== Rules engine — round 25 helper V: remaining gaps among ranks 3061–5010 of the 7,000 most-played cards ===================== */
RQ_OPS.push('v25Flag');
const V25 = { cache:null };
const v25tgt = ctx => (ctx && ctx.tgts ? nextTargets(ctx) : [])[0];
const v25txt = c => { try { return tname(textOf(c), cname(c)).toLowerCase(); } catch { return ''; } };
// every permanent on every board whose rules text matches re (cached until the next microtask)
function v25perms(re){
  if (!S) return [];
  if (!V25.cache){ const C = []; for (const b of boardsAll()) for (const s of b.bf){ if (!s || !s.k || s.fd) continue; C.push({pid:b.pid, c:s, t:v25txt(s)}); } V25.cache = C; queueMicrotask(() => { V25.cache = null; }); }
  return V25.cache.filter(x => re.test(x.t));
}
const v25opp = (pid, other) => pid !== other;

/* ---------- Casting from the top of the library: more subtypes (Sigarda, Korlessa, Mihail, Hakoda, Mm'menon, Thundermane, Fortune Teller's Talent, Assemble the Players, Conspicuous Snoop) ---------- */
STATIC_RULES.push(
  [/^you may cast ([a-z]+) spells from the top of your library$/, m => ({kind:'v25Top', who:'you', ds:[m[1]]})],
  [/^you may cast ([a-z]+) spells and ([a-z]+) spells from the top of your library$/, m => ({kind:'v25Top', who:'you', ds:[m[1], m[2]]})],
  [/^you may cast creature spells with power (\d+) or greater from the top of your library$/, m => ({kind:'v25Top', who:'you', ds:['creature'], pmin:+m[1]})],
  [/^if you cast a creature spell this way, it gains haste until end of turn$/, m => ({kind:'v25TopHaste', who:'you'})],
  [/^as long as you've cast a spell this turn, you may play cards from the top of your library$/, m => ({kind:'v25Top', who:'you', ds:['card'], lands:true, castFirst:true})],
  [/^once each turn, you may cast a creature spell with power (\d+) or less from the top of your library$/, m => ({kind:'v25Top', who:'you', ds:['creature'], pmax:+m[1], once:true})],
);
function v25TopWays(c){
  const out = []; if (!S || !c) return out; const a = info(c.k); if (!a) return out; const land = isLand(c.k);
  for (const r of rulesOn('v25Top')){
    if (land && !r.lands) continue;
    if (r.castFirst && !(S.casts || []).some(x => x.t === turnStr())) continue;
    if (r.once && (S.v25TopOnce || {})[r.src] === turnStr()) continue;
    if (!land && !r.ds.some(d => d === 'card' || descOk(c.k, d))) continue;
    const p = parseInt(a.p); if (r.pmin != null && !(p >= r.pmin)) continue; if (r.pmax != null && !(isCreatureCard(c) && p <= r.pmax)) continue;
    out.push({r, land, v25:true});
  }
  return out;
}
{
  const tw = r23fTopWays;
  r23fTopWays = function(c){ const out = tw(c); try { v25TopWays(c).forEach(x => out.push(x)); } catch (e){ console.warn(e); } return out; };
  const pt = r23fPlayTop;
  r23fPlayTop = async function(useLife){
    const c = S && S.lib[0]; const mine = c ? v25TopWays(c) : []; const other = c ? r23fTopWays(c).filter(w => !w.v25) : [];
    if (!c || !mine.length || other.some(w => !w.life) || useLife) return pt(useLife);
    if (isLand(c.k)){ playLand(c, {}); commit(); return; }
    const w = mine.find(x => !x.r.once) || mine[0];
    const n0 = S.stk.length; await beginCast(c, 'lib', {});
    if (S.stk.length > n0){ if (w.r.once) S.v25TopOnce = {...(S.v25TopOnce || {}), [w.r.src]:turnStr()};
      if (isCreatureCard(c) && rulesOn('v25TopHaste').some(x => x.src === w.r.src)) S.v25hasteK = (S.v25hasteK || []).concat({k:c.k, t:turnStr()}); commit(); }
  };
  const oe = onEnter;
  onEnter = function(c, from, o){ const r = oe(c, from, o); try { if (S && c && S.v25hasteK && S.v25hasteK.length){ const i = S.v25hasteK.findIndex(p => p.k === c.k && p.t === turnStr()); if (i >= 0){ S.v25hasteK.splice(i, 1); c.ekw = [...new Set([...(c.ekw || []), 'haste'])]; log(`${cname(c)} gains haste until end of turn`); } } } catch {} return r; };
}

/* ---------- Self-conditional power/toughness (Putrid Imp, Armored Scrapgorger, Elenda, Elturel Survivors) ---------- */
const V25_SELF = [
  [/^as long as there are (\w+) or more cards in your graveyard, ~ gets \+(\d+)\/\+(\d+) and can't block$/, (m, c) => S.gy.length >= (wn(m[1]) || 0) ? {p:+m[2], t:+m[3], noBlk:true} : null],
  [/^~ gets \+(\d+)\/\+(\d+) as long as it has (\w+) or more (\w+) counters on it$/, (m, c) => ((c.nc || {})[m[4]] || 0) >= (wn(m[3]) || 0) ? {p:+m[1], t:+m[2]} : null],
  [/^as long as your life total is greater than your starting life total, ~ gets \+1\/\+1 and has menace\. ~ gets an additional \+5\/\+5 as long as your life total is at least 10 greater than your starting life total$/, (m, c) => { const st = v25start(); return S.life > st ? {p:S.life >= st + 10 ? 6 : 1, t:S.life >= st + 10 ? 6 : 1, kw:'menace'} : null; }],
  [/^as long as ~ is attacking, it gets \+x\/\+0, where x is the number of lands defending player controls$/, (m, c) => { if (!c.atk) return null; const d = parseDef(c.atk); const bf = d && d.pid ? boardOf(d.pid) : []; return {p:bf.filter(b => b.k && isLand(b.k)).length, t:0}; }],
];
function v25start(){ return (FMT && S && FMT[S.fmt] && FMT[S.fmt].life) || 40; }
function v25self(c){
  if (!S || !c || !c.k || c.fd || !S.bf.includes(c)) return null;
  for (const line of v25txt(c).split('\n')){ const l = line.trim().replace(/\.$/, ''); for (const [re, f] of V25_SELF){ const m = l.match(re); if (m){ const r = f(m, c); if (r) return r; } } }
  return null;
}
STATIC_KNOWN.push(...V25_SELF.map(([re]) => re), /^~ gets an additional \+5\/\+5 as long as your life total is at least 10 greater than your starting life total$/);
{
  const xa = xAnthems;
  xAnthems = function(c, ownerPid){ const r = xa(c, ownerPid); try { if (ownerPid === MYPID){ const v = v25self(c); if (v) return [r[0] + v.p, r[1] + v.t]; } } catch {} return r; };
  const cb = canBlock;
  canBlock = function(b, a, apid){ const w = cb(b, a, apid); if (w) return w; try { const v = v25self(b); if (v && v.noBlk) return "can't block (seven or more cards in graveyard)"; } catch {} return ''; };
  const kw = kwOf;
  kwOf = function(c, k, pid = MYPID){ if (kw(c, k, pid)) {
      // Archetype of Courage: opponents' creatures lose first strike
      if ((k === 'first strike') && c && !c.fd && isCreatureCard(c)){ const cp = l24pidOf(c) || pid; if (v25perms(/creatures your opponents control lose first strike and can't have or gain first strike/).some(x => x.pid !== cp)) return false; }
      return true; }
    try { if (pid === MYPID){ const v = v25self(c); if (v && v.kw === k) return true; } } catch {} return false; };
}

/* ---------- Life (Platinum Emperion, Grievous Wound) ---------- */
STATIC_RULES.push([/^your life total can't change$/, m => ({kind:'v25LifeLock', who:'you'})]);
STATIC_KNOWN.push(/^enchanted player can't gain life$/);
{
  const cg = canGain;
  canGain = function(){ try { if (S){ const w = v25perms(/^enchanted player can't gain life/m).find(x => x.c.att && x.c.att.pid === MYPID && /^enchant (?:player|opponent)/m.test(x.t)); if (w) return {ok:false, why:`${cname(w.c)}: you can't gain life`}; if (rulesOn('v25LifeLock').length) return {ok:false, why:`${rulesOn('v25LifeLock')[0].src}: your life total can't change`}; } } catch {} return cg(); };
  const cm = commit;
  commit = function(...a){ try { if (S && !UI.dry){ if (rulesOn('v25LifeLock').length){ if (S.v25lock == null) S.v25lock = S.life; else if (S.life !== S.v25lock){ log(`life total can't change (${rulesOn('v25LifeLock')[0].src}) — stays at ${S.v25lock}`); S.life = S.v25lock; } } else if (S.v25lock != null) S.v25lock = null; } } catch {} return cm.apply(this, a); };
}

/* ---------- Static goad (The Sound of Drums, Baeloth Barrityl) ---------- */
STATIC_RULES.push(
  [/^enchanted creature is goaded$/, m => ({kind:'noop'})],
  [/^creatures your opponents control with power less than ~'s power are goaded$/, m => ({kind:'noop'})],
  [/^creatures your opponents control lose first strike and can't have or gain first strike$/, m => ({kind:'noop'})],   // enforced in kwOf below
);
function v25goadSync(){
  if (!S || UI.dry) return; const n = currentTurn()[0];
  const drums = v25perms(/^enchanted creature is goaded/m); const bae = v25perms(/^creatures your opponents control with power less than ~'s power are goaded/m);
  for (const c of S.bf){ if (!c.k || c.fd || !isCreatureCard(c)) continue; let by = null;
    const d = drums.find(x => x.c.att && x.c.att.id === c.id && (x.c.att.pid || x.pid) === MYPID); if (d) by = d.pid;
    if (!by){ for (const x of bae){ if (x.pid === MYPID) continue; const bp = (stats(x.c, x.pid) || [0])[0]; const cp = (stats(c) || [0])[0]; if (cp < bp){ by = x.pid; break; } } }
    if (by){ if (!c.goad || c.v25sg){ c.goad = {by, n}; c.v25sg = 1; } }
    else if (c.v25sg){ delete c.goad; delete c.v25sg; }
  }
}
{
  const cm = commit;
  commit = function(...a){ try { v25goadSync(); } catch (e){ console.warn(e); } return cm.apply(this, a); };
}

/* ---------- Casting restrictions (Marisi, Phyrexian Censor, Soulless Jailer) ---------- */
STATIC_RULES.push(
  [/^your opponents can't cast spells during combat$/, m => ({kind:'v25NoCombatCast', who:'opp'})],
  [/^each player can't cast more than one non-phyrexian spell each turn$/, m => ({kind:'v25Censor', who:'all'})],
  [/^non-phyrexian creatures enter tapped$/, m => ({kind:'v25CensorTap', who:'all'})],
  [/^permanent cards in graveyards can't enter the battlefield$/, m => ({kind:'v25Jail', who:'all'})],
  [/^players can't cast noncreature spells from graveyards or exile$/, m => ({kind:'v25JailCast', who:'all'})],
);
const v25phyx = k => /\bPhyrexian\b/.test(info(k)?.t || '');
{
  const cl = castLimit;
  castLimit = function(c, zone){ const r = cl(c, zone); if (!r.ok || !c || !c.k) return r;
    try {
      const pn = phaseNow(); const nc = rulesOn('v25NoCombatCast')[0]; if (nc && pn.ph === 4) return {ok:false, why:`${nc.src}: you can't cast spells during combat`};
      const ce = rulesOn('v25Censor')[0]; if (ce && !v25phyx(c.k) && (S.casts || []).some(x => x.t === turnStr() && !v25phyx(x.k))) return {ok:false, why:`${ce.src}: you can't cast more than one non-Phyrexian spell each turn`};
      const j = rulesOn('v25JailCast')[0]; if (j && (zone === 'gy' || zone === 'ex') && !isCreatureCard(c)) return {ok:false, why:`${j.src}: noncreature spells can't be cast from graveyards or exile`};
    } catch (e){ console.warn(e); }
    return r; };
  const oe = onEnter;
  onEnter = function(c, from, o){ const r = oe(c, from, o); try { if (S && c && S.bf.includes(c) && isCreatureCard(c) && !v25phyx(c.k) && rulesOn('v25CensorTap').length && !c.tap){ c.tap = true; log(`${cname(c)} enters tapped (${rulesOn('v25CensorTap')[0].src})`); } } catch {} return r; };
  const mc = moveCard;
  moveCard = function(id, to, o = {}){ try { if (S && to === 'bf' && !UI.dry){ const c = S.gy.find(g => g.id === id); if (c && rulesOn('v25Jail').length){ const j = rulesOn('v25Jail')[0]; log(`${cname(c)} can't enter the battlefield from a graveyard (${j.src})`); toast(`${j.src}: permanent cards in graveyards can't enter the battlefield`); return; } } } catch {} return mc(id, to, o); };
}

/* ---------- Stun counters (CR 122.1d) and Fear of Sleep Paralysis ---------- */
STATIC_RULES.push([/^stun counters can't be removed from permanents your opponents control$/, m => ({kind:'v25StunLock', who:'opp'})]);
{
  const sp = setPhase;
  setPhase = function(i, ...a){
    if (i !== 0 || !S || UI.dry) return sp.call(this, i, ...a);
    // the stunned permanents stay tapped; each loses one stun counter instead of untapping
    UI.v25stun = S.bf.filter(c => c.tap && (c.nc || {}).stun > 0).map(c => c.id);
    try { return sp.call(this, i, ...a); } finally { UI.v25stun = null; }
  };
  const su = setPhase;
  // re-tap after the untap step ran (setPhase(0) recurses into setPhase(1))
  setPhase = function(i, ...a){
    if (i === 1 && S && UI.v25stun && UI.v25stun.length){ const lock = rulesOn('v25StunLock')[0];
      for (const id of UI.v25stun){ const c = S.bf.find(b => b.id === id); if (!c) continue; c.tap = true; if (lock) log(`${cname(c)} stays tapped — stun counters can't be removed (${lock.src})`); else { addNamed(c, 'stun', -1); log(`${cname(c)} stays tapped and loses a stun counter`); } }
      UI.v25stun = null; }
    return su.call(this, i, ...a);
  };
}

/* ---------- Harbinger of the Seas: nonbasic lands are Islands ---------- */
STATIC_RULES.push([/^nonbasic lands are islands$/, m => ({kind:'v25Harb', who:'all'})]);
{
  const ma = manaAbs;
  manaAbs = function(c){ const out = ma(c); try { if (S && c && c.k && isLand(c.k) && !/\bBasic\b/.test(info(c.k)?.t || '') && rulesOn('v25Harb').length) return [{cost:'{T}', eff:'Add {U}', rest:'', outs:[['U']], tapOnly:true, line:'{T}: Add {U}. (Harbinger of the Seas)'}]; } catch {} return out; };
  const al = abilityList;
  abilityList = function(c){ const out = al(c); try { if (S && c && c.k && isLand(c.k) && !/\bBasic\b/.test(info(c.k)?.t || '') && rulesOn('v25Harb').length) return []; } catch {} return out; };
}

/* ---------- Playing from the graveyard (Titania, Glacierwood Siege — Sultai, Gisa and Geralf) ---------- */
STATIC_RULES.push(
  [/^you may play forests from your graveyard$/, m => ({kind:'v25GyForest', who:'you'})],
  [/^once during each of your turns, you may cast a zombie creature spell from your graveyard$/, m => ({kind:'v25GyZombie', who:'you'})],
);
{
  const go = gyOptions;
  gyOptions = function(c){ const r = go(c) || []; try { if (!S || !c || !c.k) return r; const a = info(c.k);
      const sultai = S.bf.some(b => !b.fd && b.g23mode === 'Sultai' && /• sultai — you may play lands from your graveyard/.test(v25txt(b)));
      if (isLand(c.k) && !r.some(o => o.land) && (sultai || (rulesOn('v25GyForest').length && /\bForest\b/.test(typeOf(c))))) r.push({kind:'gyland', label:'Play land from graveyard', land:true});
      if (!isLand(c.k) && isCreatureCard(c) && descOk(c.k, 'zombie') && phaseNow().mine){ const g = rulesOn('v25GyZombie')[0]; if (g && (S.v25gz || {})[g.src] !== turnStr()) r.push({kind:'gycast', label:`Cast from graveyard (${g.src}) ${a.m}`, mana:a.m, extra:[], after:'', v25gz:g.src}); }
    } catch (e){ console.warn(e); } return r; };
  const cg = castFromGy;
  castFromGy = async function(c, g){ const r = await cg(c, g); try { if (g && g.v25gz && find(c.id)[0] !== 'gy'){ S.v25gz = {...(S.v25gz || {}), [g.v25gz]:turnStr()}; commit(); } } catch {} return r; };
  const cc = checkCard;
  checkCard = async function(k){ const r = await cc(k); try { if (r && r.issues){ const n0 = r.issues.length; if (/• Sultai — You may play lands from your graveyard/.test(info(k)?.o || '')) r.issues = r.issues.filter(x => !(x.kind === 'trigger' && /^(?:• Sultai — )?You may play lands from your graveyard\.?$/.test(x.text))); if (n0 && !r.issues.length) r.ok = (r.ok || 0) + 1; } } catch {} return r; };
}

/* ---------- Batch 2: effect sentences ---------- */
const v25sameType = (a, b) => { const sub = x => String(typeOf(x) || '').split('—')[1] || ''; const A = sub(a).trim().split(/\s+/).filter(Boolean); const B = new Set(sub(b).trim().split(/\s+/).filter(Boolean)); return A.some(w => B.has(w)) || (typeof hasKwText === 'function' && (hasKwText(faceOf(a), 'changeling') || hasKwText(faceOf(b), 'changeling'))); };
const v25sub = k => { const t = String(info(k)?.t || ''); const i = t.indexOf('—'); return i < 0 ? [] : t.slice(i + 1).trim().split(/\s+/).filter(Boolean); };
const v25shareK = (k, ks) => { const A = v25sub(k); const B = new Set(ks); return A.some(w => B.has(w)) || /\bchangeling\b/i.test(info(k)?.o || ''); };
async function v25Pre(s, l, ctx){
  let m; const name = ctx.name || ''; const full = (tname(String(ctx.full || ''), name) + '\n' + tname(String(info(ctx.k)?.o || ''), name)).toLowerCase(); const it = ctx.it || {};
  const src = () => srcCardOf(ctx);
  // Chandra, Awakened Inferno −3
  if ((m = l.match(/^~ deals (\d+) damage to each non-([a-z]+) creature$/))){ const n = +m[1]; const ty = m[2]; const f = srcFlags(ctx.k, MYPID, src());
    applyOp({op:'v25Flag', d:'dmgNon', n, ty, f, src:name}, MYPID); opponents().forEach(p => sendRq(p.pid, 'v25Flag', n, name, {d:'dmgNon|' + ty, f})); log(`${name}: ${n} damage to each non-${ty} creature`); commit(); return true; }
  // Master of Cruelties
  if (/^(?:that|target) player's life total becomes 1$/.test(l)){ const t = v25tgt(ctx); const pid = (t && t.t === 'player' && t.pid) || it.evDp || it.evPid; if (pid && pid !== MYPID){ sendRq(pid, 'h23setLife', 1, name); log(`${name}: ${nameOf(pid)}'s life total becomes 1`); } else if (pid === MYPID){ S.life = 1; } commit(); return true; }
  if (/^~ assigns no combat damage this combat$/.test(l)){ const c = src(); if (c){ c.v25noDmg = turnStr(); log(`${cname(c)} assigns no combat damage this combat`); } commit(); return true; }
  // Guild Artisan
  if ((m = s.match(/^if no opponent has more life than (?:that|target) player, (.+)$/i))){ const t = v25tgt(ctx); const pid = (t && t.t === 'player' && t.pid) || it.evDp || it.evPid; const lifeOf = p => p === MYPID ? S.life : (OPP.get(p)?.life ?? 0);
    const ok = UI.dry || (pid && !opponents().some(p => lifeOf(p.pid) > lifeOf(pid))); if (ok) await doSentence(cap(m[1]), ctx); else log(`${name}: an opponent has more life than ${nameOf(pid)}`); return true; }
  // Cerulean Wisps
  if ((m = l.match(/^target creature becomes (white|blue|black|red|green|colorless) until end of turn$/))){ const t = v25tgt(ctx); if (t) l24modTo(t, {col:m[1] === 'colorless' ? '' : L24_COLW[m[1]], u:'e' + turnStr()}, name); ctx.lastT = t ? [t] : []; commit(); return true; }
  // Sorcerer Class level 3
  if (/^that spell deals damage to each opponent equal to the number of instant and sorcery spells you've cast this turn$/.test(l)){ const n = (S.casts || []).filter(x => x.t === turnStr() && /\b(Instant|Sorcery)\b/.test(info(x.k)?.t || '')).length;
    const k = it.evK || (it.evId != null && (S.stk.find(x => x.srcId === it.evId) || {}).k) || ctx.k; if (n > 0) opponents().forEach(p => dealDamage({t:'player', pid:p.pid}, n, k, null)); log(`${name}: ${n} damage to each opponent`); commit(); return true; }
  // Desecrate Reality (adamant)
  if (/^return a permanent card with an odd mana value from your graveyard to the battlefield$/.test(l)){ const pool = S.gy.filter(c => isPermType(info(c.k)?.t || '') && (info(c.k)?.mv || 0) % 2 === 1); if (!pool.length || UI.dry){ if (!UI.dry) log(`${name}: no permanent card with an odd mana value in the graveyard`); return true; }
    const ids = pool.length === 1 ? [pool[0].id] : await pickCards({title:`${name}: return a permanent card with an odd mana value to the battlefield`, cards:pool, min:1, max:1}); const c = S.gy.find(g => g.id === (ids || [])[0]) || pool[0]; moveCard(c.id, 'bf'); log(`${name}: returned ${cname(c)} to the battlefield`); commit(); return true; }
  // Moonmist
  if (/^transform all humans$/.test(l)){ applyOp({op:'v25Flag', d:'xformHumans', src:name}, MYPID); opponents().forEach(p => sendRq(p.pid, 'v25Flag', 0, name, {d:'xformHumans'})); return true; }
  // Fireball
  if (/^~ deals x damage divided evenly, rounded down, among any number of targets$/.test(l)){ const ts = []; let g; while (ctx.tgts && (g = nextTargets(ctx)).length){ g.forEach(t => ts.push(t)); if (ts.length > 40) break; }
    const x = it.x || 0; if (!ts.length){ if (!UI.dry) log(`${name}: no targets`); return true; } const n = Math.floor(x / ts.length); ts.forEach(t => dealDamage(t, n, ctx.k, src())); log(`${name}: ${n} damage to each of ${ts.length} target${ts.length === 1 ? '' : 's'}`); commit(); return true; }
  // Haunted One (granted to commanders)
  if (/^it and other creatures you control that share a creature type with it each get \+2\/\+0 and gain undying until end of turn$/.test(l)){ const c = src() || (it.evId != null && S.bf.find(b => b.id === it.evId)); if (!c){ return true; }
    const list = S.bf.filter(b => !b.fd && isCreatureCard(b) && (b === c || v25sameType(b, c))); list.forEach(b => { b.pu = [(b.pu || [0, 0])[0] + 2, (b.pu || [0, 0])[1]]; b.ekw = [...new Set([...(b.ekw || []), 'undying'])]; }); log(`${name}: ${list.length} creature${list.length === 1 ? '' : 's'} get +2/+0 and undying until end of turn`); commit(); return true; }
  // Cauldron of Souls
  if (/^each of those creatures gains (persist|undying) until end of turn$/.test(l)){ const kw = l.match(/gains (\w+)/)[1]; const ts = (ctx.lastT || []).slice(); let g; while (ctx.tgts && (g = nextTargets(ctx)).length) g.forEach(t => ts.push(t));
    ts.forEach(t => { if (t.pid === MYPID){ const c = S.bf.find(b => b.id === t.id); if (c) c.ekw = [...new Set([...(c.ekw || []), kw])]; } else sendRq(t.pid, 'pump', 0, name, {tid:t.id, f:{p:0, t:0, kw:[kw]}}); }); log(`${name}: ${ts.length} creature${ts.length === 1 ? '' : 's'} gain ${kw} until end of turn`); commit(); return true; }
  // Tower Winder
  if (/^search your library and\/or graveyard for a card named ([^,]+), reveal it, and put it into your hand$/.test(l)){ const nm = s.match(/for a card named ([^,]+),/i)[1].trim(); const inLib = S.lib.find(c => info(c.k)?.n === nm); const inGy = S.gy.find(c => info(c.k)?.n === nm);
    let c = inLib || inGy; if (inLib && inGy && !UI.dry){ const v = await askChoice({title:`${name}: take ${nm} from`, options:[{label:'Library', value:'lib'}, {label:'Graveyard', value:'gy'}]}); c = v === 'gy' ? inGy : inLib; }
    if (c){ const fromLib = c === inLib; moveCard(c.id, 'hand'); log(`${name}: revealed ${nm} and put it into hand`); if (fromLib) shuffleLib(); } else { log(`${name}: no ${nm} found`); if (!UI.dry) shuffleLib(); } ctx.v25tw = 1; commit(); return true; }
  if (/^if you search your library this way, shuffle$/.test(l) && (ctx.v25tw || UI.dry)) return true;
  // Birthing Ritual (whole ability)
  if (/^(?:if you control a creature, )?look at the top seven cards of your library$/.test(l) && /then you may sacrifice a creature\. if you do, you may put a creature card with mana value x or less from among those cards onto the battlefield, where x is 1 plus the sacrificed creature's mana value/.test(full)){
    ctx.v25br = 1; if (UI.dry) return true; if (/^if you control/.test(l) && !S.bf.some(b => !b.fd && isCreatureCard(b))){ log(`${name}: you control no creature`); ctx.v25brNo = 1; return true; } const top = S.lib.slice(0, 7); log(`${name}: looked at the top ${top.length} cards`);
    let took = null; const crs = S.bf.filter(b => !b.fd && isCreatureCard(b));
    if (crs.length && await askYes(`${name}: sacrifice a creature? (Top seven: ${top.map(cname).join(', ')})`, 'Sacrifice', 'No')){
      const ids = await pickCards({title:`${name}: sacrifice a creature`, cards:crs, min:1, max:1}); const c = S.bf.find(b => b.id === (ids || [])[0]);
      if (c){ const x = 1 + (info(c.k)?.mv || 0); sacrificeOne(c); const pool = top.filter(t => isCreatureCard(t) && (info(t.k)?.mv || 0) <= x && S.lib.includes(t));
        if (pool.length){ const p = await pickCards({title:`${name}: put a creature card with mana value ${x} or less onto the battlefield`, cards:pool, min:0, max:1}); took = pool.find(t => t.id === (p || [])[0]); if (took){ moveCard(took.id, 'bf'); log(`${name}: put ${cname(took)} onto the battlefield`); } } } }
    const rest = top.filter(t => S.lib.includes(t) && t !== took); rest.forEach(t => S.lib.splice(S.lib.indexOf(t), 1)); shuffle(rest); S.lib.push(...rest); log(`${name}: put ${rest.length} card${rest.length === 1 ? '' : 's'} on the bottom in a random order`); commit(); return true; }
  if ((ctx.v25br || ctx.v25brNo) && /^(then you may sacrifice a creature|if you do, you may put a creature card with mana value x or less from among those cards onto the battlefield, where x is 1 plus the sacrificed creature's mana value|put the rest on the bottom of your library in a random order)$/.test(l)) return true;
  // Creative Technique
  if (/^shuffle your library, then reveal cards from the top of it until you reveal a nonland card$/.test(l) || (/^shuffle your library$/.test(l) && /reveal cards from the top of it until you reveal a nonland card\. exile that card and put the rest on the bottom of your library in a random order\. you may cast the exiled card without paying its mana cost/.test(full))){
    ctx.v25ct = 1; if (UI.dry) return true; shuffleLib(); const rev = []; let hit = null; for (const c of S.lib){ if (!isLand(c.k)){ hit = c; break; } rev.push(c); }
    if (hit){ moveCard(hit.id, 'ex'); } rev.forEach(c => { const i = S.lib.indexOf(c); if (i >= 0) S.lib.splice(i, 1); }); shuffle(rev); S.lib.push(...rev);
    log(`${name}: revealed ${rev.length + (hit ? 1 : 0)} card${rev.length + (hit ? 1 : 0) === 1 ? '' : 's'}${hit ? ', exiled ' + cname(hit) : ''}; the rest went to the bottom`); commit();
    if (hit) await jCastFree(hit, 'ex', ctx); return true; }
  if (ctx.v25ct && /^(reveal cards from the top of it until you reveal a nonland card|exile that card|put the rest on the bottom of your library in a random order|exile that card and put the rest on the bottom of your library in a random order|you may cast the exiled card without paying its mana cost|cast the exiled card without paying its mana cost)$/.test(l)) return true;
  return false;
}
{ const ds = doSentence; doSentence = async function(s0, ctx){ const s = String(s0).replace(/\.$/, '').trim(); const l = s.toLowerCase(); if (l && await v25Pre(s, l, ctx)) return; return ds(s0, ctx); }; }
{
  const ao = applyOp;
  applyOp = function(r, from){
    if (r && r.op === 'v25Flag'){
      if (/^dmgNon\|/.test(r.d || '') || r.d === 'dmgNon'){ const ty = String(r.ty || String(r.d).split('|')[1] || '').toLowerCase(); S.bf.filter(c => c.k && !c.fd && isCreatureCard(c) && !new RegExp('\\b' + ty + '\\b', 'i').test(typeOf(c))).forEach(c => damageCard(c, r.n, r.f || {})); commit(); return; }
      if (r.d === 'xformHumans'){ const l = S.bf.filter(c => c.k && !c.fd && isCreatureCard(c) && /\bHuman\b/.test(typeOf(c)) && info(c.k)?.back); l.forEach(c => { c.fl = !c.fl; }); if (l.length) log(`transformed ${l.map(cname).join(', ')} (${r.src})`); commit(); return; }
      return;
    }
    return ao(r, from);
  };
  // Master of Cruelties: assigns no combat damage this combat
  const ad = attackerDamage;
  attackerDamage = async function(...a){ const off = S ? S.bf.filter(c => c.atk && c.v25noDmg === turnStr()) : []; const saved = off.map(c => c.atk); off.forEach(c => { c.atk = ''; });
    try { return await ad.apply(this, a); } finally { off.forEach((c, i) => { if (S.bf.includes(c)) c.atk = saved[i]; }); } };
  // undying / persist granted until end of turn still work when the creature dies
  const ol = onLeave;
  onLeave = function(c, to, w){ try { if (S && c && to === 'gy' && (c.ekw || []).some(k => k === 'undying' || k === 'persist')){ S.v25und = {...(S.v25und || {}), [c.id]:{kw:(c.ekw || []).filter(k => k === 'undying' || k === 'persist'), t:turnStr()}}; } } catch {} return ol(c, to, w); };
  const gk = grantedKw;
  grantedKw = function(c, kw, bf = S.bf){ try { if (S && c && (kw === 'undying' || kw === 'persist') && S.v25und && S.v25und[c.id] && S.v25und[c.id].t === turnStr() && S.v25und[c.id].kw.includes(kw) && S.gy.includes(c)) return true; } catch {} return gk(c, kw, bf); };
}

/* ---------- Batch 3 ---------- */
// Hooded Hydra: "As ~ is turned face up, put five +1/+1 counters on it"
STATIC_RULES.push([/^as ~ is turned face up, put (\w+) \+1\/\+1 counters on it$/, m => ({kind:'noop'})]);
{
  const he = handleEvent;
  handleEvent = function(pid, ev){ try { if (S && pid === MYPID && ev && ev.type === 'turnup'){ const c = S.bf.find(b => b.id === ev.id); const mm = c && v25txt(c).match(/^as ~ is turned face up, put (\w+) \+1\/\+1 counters on it\.?$/m); if (mm){ const n = wn(mm[1]) || +mm[1] || 0; modCounters(c, 'cp', n); log(`${cname(c)}: ${n} +1/+1 counters as it's turned face up`); commit(); } } } catch (e){ console.warn(e); } return he(pid, ev); };
}
// Eluge: lands with a flood counter are Islands
{
  const to = typeOf;
  typeOf = c => { let t = to(c); try { if (c && c.nc && c.nc.flood > 0 && /\bLand\b/.test(t) && !/\bIsland\b/.test(t)) t += (/—/.test(t) ? ' ' : ' — ') + 'Island'; } catch {} return t; };
  const ma = manaAbs;
  manaAbs = function(c){ const out = ma(c); try { if (c && c.nc && c.nc.flood > 0 && c.k && isLand(c.k) && !out.some(o => o.v25fl) && !out.some(o => (o.outs || []).some(x => x.length === 1 && x[0] === 'U'))) return out.concat({cost:'{T}', eff:'Add {U}', rest:'', outs:[['U']], tapOnly:true, line:'{T}: Add {U}. (Island — flood counter)', v25fl:1}); } catch {} return out; };
}
async function v25Pre3(s, l, ctx){
  let m; const name = ctx.name || ''; const it = ctx.it || {}; const src = () => srcCardOf(ctx);
  if (/^it's an island in addition to its other types for as long as it has a flood counter on it$/.test(l)) return true;   // typeOf / manaAbs above read the flood counter
  // Éowyn
  if (/^legendary creatures you control gain protection from each of that creature's colors until end of turn$/.test(l)){ const t = (ctx.lastT || [])[0]; const col = t && t.k ? (info(t.k)?.c || '') : '';
    const cols = [...col].map(x => ({W:'white', U:'blue', B:'black', R:'red', G:'green'})[x]).filter(Boolean); if (!cols.length){ log(`${name}: that creature is colorless`); return true; }
    S.bf.filter(b => !b.fd && isCreatureCard(b) && /\bLegendary\b/.test(typeOf(b))).forEach(b => { b.ekw = [...new Set([...(b.ekw || []), ...cols.map(c => 'protection from ' + c)])]; }); log(`${name}: legendary creatures gain protection from ${cols.join(' and ')} until end of turn`); commit(); return true; }
  // Summon: Leviathan I
  if ((m = l.match(/^return each creature that isn't an? ((?:[a-z]+, )*[a-z]+,? or [a-z]+) to its owner's hand$/))){ const tys = m[1].split(/,\s*(?:or\s+)?|\s+or\s+/).map(x => x.trim()).filter(Boolean);
    applyOp({op:'v25Flag', d:'bounceNot', tys, src:name}, MYPID); opponents().forEach(p => sendRq(p.pid, 'v25Flag', 0, name, {d:'bounceNot|' + tys.join(',')})); return true; }
  // Lulu
  if (/^choose target creature attacking you$/.test(l)){ const t = v25tgt(ctx); ctx.lastT = t ? [t] : []; return true; }
  // Reflector Mage
  if (/^that creature's owner can't cast spells with the same name as that creature until your next turn$/.test(l)){ const t = (ctx.lastT || [])[0]; if (!t || !t.k) return true; const nm = info(t.k)?.n; const own = t.pid;
    const rec = {nm, by:MYPID, t0:turnStr()}; if (own === MYPID) S.v25noName = (S.v25noName || []).concat(rec); else if (own) sendRq(own, 'v25Flag', 0, name, {d:'noName|' + rec.t0 + '|' + nm}); log(`${name}: ${nameOf(own)} can't cast spells named ${nm} until ${nameOf(MYPID)}'s next turn`); commit(); return true; }
  // Zurgo (granted to Warrior tokens; enforced in sacrificeOne)
  if ((/^(?:~|this token) can't be sacrificed$/.test(l) || l === name.toLowerCase() + " can't be sacrificed") && /warrior tokens you control have/i.test(String(info(ctx.k)?.o || ''))) return true;
  // Hateful Eidolon
  if (/^draw a card for each aura you controlled that was attached to it$/.test(l)){ const id = it.evId; const pid = it.evPid || MYPID; const n = id == null ? 0 : S.bf.filter(b => b.att && b.att.id === id && (b.att.pid || MYPID) === pid && /\bAura\b/.test(typeOf(b))).length + (S.v25aurGone || []).filter(x => x.tid === id && x.tpid === pid && x.t === turnStr()).length;
    if (n) draw(n); log(`${name}: drew ${n} card${n === 1 ? '' : 's'}`); commit(); return true; }
  // Cyber Conversion
  if (/^turn target creature face down$/.test(l)){ const t = v25tgt(ctx); ctx.lastT = t ? [t] : []; if (!t) return true; if (t.pid === MYPID) v25faceDown(S.bf.find(b => b.id === t.id), name); else sendRq(t.pid, 'v25Flag', 0, name, {d:'faceDown', tid:t.id}); ctx.v25fd = 1; commit(); return true; }
  if (/^it's a 2\/2 cyberman artifact creature$/.test(l) && (ctx.v25fd || UI.dry)) return true;   // face-down 2/2 (fdc)
  // Mission Briefing
  if (/^(?:then )?choose an instant or sorcery card in your graveyard$/.test(l)){ const pool = S.gy.filter(c => /\b(Instant|Sorcery)\b/.test(info(c.k)?.t || '')); ctx.v25mb = 1; if (!pool.length || UI.dry) return true;
    const ids = pool.length === 1 ? [pool[0].id] : await pickCards({title:`${name}: choose an instant or sorcery card in your graveyard`, cards:pool, min:1, max:1}); const c = S.gy.find(g => g.id === (ids || [])[0]) || pool[0];
    c.v25gyCast = {t:turnStr(), src:name, ex:/would be put into your graveyard, exile it instead/i.test(String(ctx.full || ''))}; log(`${name}: may cast ${cname(c)} from the graveyard this turn`); commit(); return true; }
  if (/^you may cast it this turn$/.test(l) && ctx.v25mb) return true;
  if (/^if that spell would be put into your graveyard, exile it instead$/.test(l) && ctx.v25mb) return true;
  // Sword of Once and Future
  if (/^(?:then )?you may cast an instant or sorcery spell with mana value (\d+) or less from your graveyard without paying its mana cost$/.test(l) || /^cast an instant or sorcery spell with mana value (\d+) or less from your graveyard without paying its mana cost$/.test(l)){
    const n = +l.match(/mana value (\d+)/)[1]; const pool = S.gy.filter(c => /\b(Instant|Sorcery)\b/.test(info(c.k)?.t || '') && (info(c.k)?.mv || 0) <= n); ctx.v25sw = 1; if (!pool.length || UI.dry) return true;
    const ids = await pickCards({title:`${name}: cast an instant or sorcery with mana value ${n} or less from your graveyard for free`, cards:pool, min:0, max:1}); const c = S.gy.find(g => g.id === (ids || [])[0]); if (!c) return true;
    await jCastFree(c, 'gy', ctx, {exAfter:/would be put into your graveyard, exile it instead/i.test(String(ctx.full || ''))}); return true; }
  if (/^if that spell would be put into your graveyard, exile it instead$/.test(l) && ctx.v25sw) return true;
  return false;
}
{ const ds = doSentence; doSentence = async function(s0, ctx){ const s = String(s0).replace(/\.$/, '').trim(); const l = s.toLowerCase(); if (l && await v25Pre3(s, l, ctx)) return; return ds(s0, ctx); }; }
function v25faceDown(c, src){ if (!c || c.fd) return; const x = single(c); x.fd = true; x.fdc = 1; log(`${src}: turned a creature face down (2/2)`); }
function v25noNameLive(r){ if (!r) return false; const [n, pid] = currentTurn(); return !(pid === r.by && turnStr() !== r.t0); }
{
  const ao = applyOp;
  applyOp = function(r, from){
    if (r && r.op === 'v25Flag'){
      if (/^bounceNot/.test(r.d || '')){ const tys = (r.tys || String(r.d).split('|')[1].split(',')).map(x => String(x).toLowerCase()); const list = S.bf.filter(c => c.k && !c.fd && isCreatureCard(c) && !tys.some(t => new RegExp('\\b' + t + '\\b', 'i').test(typeOf(c)))); list.forEach(c => moveCard(c.id, 'hand', {quiet:true})); if (list.length) log(`returned ${list.map(cname).join(', ')} to hand (${r.src})`); commit(); return; }
      if (/^noName\|/.test(r.d || '')){ const [, t0, nm] = String(r.d).split('|'); S.v25noName = (S.v25noName || []).concat({nm, by:from, t0}); log(`can't cast spells named ${nm} until ${nameOf(from)}'s next turn (${r.src})`); commit(); return; }
      if (r.d === 'faceDown'){ v25faceDown(S.bf.find(b => b.id === r.tid), r.src); commit(); return; }
    }
    return ao(r, from);
  };
  const cl = castLimit;
  castLimit = function(c, zone){ const r = cl(c, zone); try { if (r.ok && c && c.k && S.v25noName && S.v25noName.length){ S.v25noName = S.v25noName.filter(v25noNameLive); const x = S.v25noName.find(y => y.nm === info(c.k)?.n); if (x) return {ok:false, why:`You can't cast spells named ${x.nm} until ${nameOf(x.by)}'s next turn`}; } } catch {} return r; };
  // auras of mine that left with their creature (Hateful Eidolon)
  const mc = moveCard;
  moveCard = function(id, to, o = {}){ try { if (S && to !== 'bf'){ const c = S.bf.find(b => b.id === id); if (c && c.att && c.att.id != null && /\bAura\b/.test(typeOf(c))) S.v25aurGone = (S.v25aurGone || []).filter(x => x.t === turnStr()).concat({tid:c.att.id, tpid:c.att.pid || MYPID, t:turnStr()}).slice(-20); } } catch {} return mc(id, to, o); };
  // Mission Briefing: cast from the graveyard this turn
  const go = gyOptions;
  gyOptions = function(c){ const r = go(c) || []; try { if (c && c.v25gyCast && c.v25gyCast.t === turnStr()){ const a = info(c.k); r.push({kind:'gycast', label:`Cast from graveyard (${c.v25gyCast.src}) ${a.m}`, mana:a.m, extra:[], after:c.v25gyCast.ex ? 'ex' : ''}); } } catch {} return r; };
}

/* ---------- Batch 4: whole-ability handlers ---------- */
async function v25Pre4(s, l, ctx){
  let m; const name = ctx.name || ''; const full = (tname(String(ctx.full || ''), name) + '\n' + tname(String(info(ctx.k)?.o || ''), name)).toLowerCase(); const it = ctx.it || {}; const src = () => srcCardOf(ctx);
  // Treasure Chest (20)
  if (/^search your library for a card$/.test(l) && /if it's an artifact card, you may put it onto the battlefield\. otherwise, put that card into your hand/.test(full)){ ctx.v25tc = 1; if (UI.dry) return true;
    const ids = await pickCards({title:`${name}: search your library for a card`, cards:S.lib.slice(), min:0, max:1, noneLabel:'Find nothing'}); const c = S.lib.find(x => x.id === (ids || [])[0]);
    if (c){ if (/\bArtifact\b/.test(info(c.k)?.t || '') && await askYes(`${name}: put ${cname(c)} onto the battlefield?`, 'Battlefield', 'Hand')){ moveCard(c.id, 'bf'); log(`${name}: put ${cname(c)} onto the battlefield`); } else { moveCard(c.id, 'hand', {quiet:true}); log(`${name}: put a card into their hand`); } }
    shuffleLib(); commit(); return true; }
  if (ctx.v25tc && /^(if it's an artifact card, you may put it onto the battlefield|otherwise, put that card into your hand|then shuffle|shuffle)$/.test(l)) return true;
  // Transmute Artifact
  if (/^sacrifice an artifact$/.test(l) && /search your library for an artifact card\. if that card's mana value is less than or equal to the sacrificed artifact's mana value/.test(full)){ ctx.v25ta = 1; if (UI.dry) return true;
    const arts = S.bf.filter(b => !b.fd && /\bArtifact\b/.test(typeOf(b))); if (!arts.length){ log(`${name}: no artifact to sacrifice`); ctx.v25taNo = 1; return true; }
    const ids = arts.length === 1 ? [arts[0].id] : await pickCards({title:`${name}: sacrifice an artifact`, cards:arts, min:1, max:1}); const a = S.bf.find(b => b.id === (ids || [])[0]) || arts[0]; const mv0 = info(a.k)?.mv || 0; sacrificeOne(a);
    const pool = S.lib.filter(c => /\bArtifact\b/.test(info(c.k)?.t || '')); const p = await pickCards({title:`${name}: search for an artifact card (sacrificed mana value ${mv0})`, cards:pool, min:0, max:1, noneLabel:'Find nothing'}); const c = S.lib.find(x => x.id === (p || [])[0]);
    if (c){ const mv = info(c.k)?.mv || 0; let put = mv <= mv0;
      if (!put){ const diff = mv - mv0; const plan = payPlan(parseCost(`{${diff}}`), S.pool); if (!plan.err && await askYes(`${name}: pay {${diff}} to put ${cname(c)} onto the battlefield?`, `Pay {${diff}}`, "Don't")){ S.pool = plan.pool; put = true; } }
      if (put){ moveCard(c.id, 'bf'); log(`${name}: put ${cname(c)} onto the battlefield`); } else { moveCard(c.id, 'gy'); log(`${name}: ${cname(c)} went to the graveyard`); } }
    shuffleLib(); commit(); return true; }
  if ((ctx.v25ta || ctx.v25taNo) && /^(if you do, search your library for an artifact card|if that card's mana value is less than or equal to the sacrificed artifact's mana value, put it onto the battlefield|put it onto the battlefield|if it's greater, you may pay \{x\}, where x is the difference|if you do, put it onto the battlefield|if you don't, put it into its owner's graveyard|put it into its owner's graveyard|then shuffle|shuffle)$/.test(l)) return true;
  // Pyre of Heroes
  if (/^search your library for a creature card that shares a creature type with the sacrificed creature and has mana value equal to 1 plus that creature's mana value$/.test(l)){ ctx.v25py = 1; if (UI.dry) return true; const sk = ctx.sacd && ctx.sacd.k; if (!sk){ log(`${name}: no sacrificed creature`); return true; }
    const want = (info(sk)?.mv || 0) + 1; const kinds = v25sub(sk); const pool = S.lib.filter(c => isCreatureCard(c) && (info(c.k)?.mv || 0) === want && (v25shareK(c.k, kinds) || /\bchangeling\b/i.test(info(sk)?.o || '')));
    const p = await pickCards({title:`${name}: search for a creature sharing a type with ${info(sk)?.n}, mana value ${want}`, cards:pool, min:0, max:1, noneLabel:'Find nothing'}); const c = S.lib.find(x => x.id === (p || [])[0]); if (c){ moveCard(c.id, 'bf'); log(`${name}: put ${cname(c)} onto the battlefield`); } else log(`${name}: found nothing`); shuffleLib(); commit(); return true; }
  if (ctx.v25py && /^put that card onto the battlefield, then shuffle$|^put that card onto the battlefield$|^then shuffle$/.test(l)) return true;
  // Descendants' Fury
  if (/^reveal cards from the top of your library until you reveal a creature card that shares a creature type with the sacrificed creature$/.test(l)){ ctx.v25df = 1; if (UI.dry) return true; const sk = ctx.sacd && ctx.sacd.k; if (!sk) return true; const kinds = v25sub(sk);
    const rev = []; let hit = null; for (const c of S.lib){ if (isCreatureCard(c) && (v25shareK(c.k, kinds) || /\bchangeling\b/i.test(info(sk)?.o || ''))){ hit = c; break; } rev.push(c); }
    if (hit) moveCard(hit.id, 'bf'); rev.forEach(c => { const i = S.lib.indexOf(c); if (i >= 0) S.lib.splice(i, 1); }); shuffle(rev); S.lib.push(...rev);
    log(`${name}: revealed ${rev.length + (hit ? 1 : 0)} cards${hit ? ', put ' + cname(hit) + ' onto the battlefield' : ''}; the rest on the bottom`); commit(); return true; }
  if (ctx.v25df && /^put that card onto the battlefield and the rest on the bottom of your library in a random order$/.test(l)) return true;
  // Flood of Tears
  if (/^return all nonland permanents to their owners' hands$/.test(l) && /if you return four or more nontoken permanents you control this way/.test(full) && !ctx.v25ft){ ctx.v25ft = S.bf.filter(b => !b.fd && !b.tok && b.k && !isLand(b.k) && !b.own).length; ctx.v25ftGo = 1; await doSentence(s, ctx); return true; }
  if (/^if you return four or more nontoken permanents you control this way, you may put a permanent card from your hand onto the battlefield$/.test(l)){ if (UI.dry) return true; const n = ctx.v25ft || 0; if (n < 4){ log(`${name}: returned only ${n} nontoken permanents of their own`); return true; }
    const pool = S.hand.filter(c => isPermType(info(c.k)?.t || '')); if (!pool.length) return true; const p = await pickCards({title:`${name}: you may put a permanent card from your hand onto the battlefield`, cards:pool, min:0, max:1}); const c = S.hand.find(x => x.id === (p || [])[0]); if (c){ moveCard(c.id, 'bf'); log(`${name}: put ${cname(c)} onto the battlefield`); } commit(); return true; }
  // Bag of Holding
  if (/^return all cards exiled with ~ to their owner's hand$/.test(l)){ const sid = ctx.srcId; const list = S.ex.filter(c => sid != null && c.g23by === sid); list.forEach(c => { c.g23by = null; moveCard(c.id, 'hand', {quiet:true}); }); log(`${name}: returned ${list.length} card${list.length === 1 ? '' : 's'} to hand`); commit(); return true; }
  // Unfinished Business
  if (/^(?:then )?return up to two target aura and\/or equipment cards from your graveyard to the battlefield attached to that creature$/.test(l)){ const host = (ctx.l24moved || []).map(id => S.bf.find(b => b.id === id)).filter(b => b && isCreatureCard(b)).pop() || (ctx.lastT || []).map(t => S.bf.find(b => b.id === t.id)).filter(Boolean)[0];
    const ts = []; let g; while (ctx.tgts && (g = nextTargets(ctx)).length){ g.forEach(t => ts.push(t)); if (ts.length >= 2) break; }
    for (const t of ts){ const c = S.gy.find(x => x.id === t.id); if (!c) continue; moveCard(c.id, 'bf', {quiet:true}); if (host) c.att = {pid:MYPID, id:host.id}; log(`${name}: returned ${cname(c)}${host ? ' attached to ' + cname(host) : ''}`); } commit(); return true; }
  // Danitha
  if (/^(?:you may )?put an aura or equipment card from your hand or graveyard onto the battlefield attached to ~$/.test(l)){ const host = src(); const pool = [...S.hand, ...S.gy].filter(c => /\b(Aura|Equipment)\b/.test(info(c.k)?.t || '')); if (!pool.length || UI.dry) return true;
    const p = await pickCards({title:`${name}: you may put an Aura or Equipment from your hand or graveyard onto the battlefield attached to it`, cards:pool, min:0, max:1}); const c = pool.find(x => x.id === (p || [])[0]); if (!c) return true;
    moveCard(c.id, 'bf', {quiet:true}); if (host && S.bf.includes(host)) c.att = {pid:MYPID, id:host.id}; log(`${name}: put ${cname(c)} onto the battlefield attached to it`); commit(); return true; }
  // Bonny Pall
  if (/^(?:then )?(?:you may )?put a land card from your hand or graveyard onto the battlefield$/.test(l)){ const pool = [...S.hand, ...S.gy].filter(c => isLand(c.k)); if (!pool.length || UI.dry) return true;
    const p = await pickCards({title:`${name}: you may put a land card from your hand or graveyard onto the battlefield`, cards:pool, min:0, max:1}); const c = pool.find(x => x.id === (p || [])[0]); if (c){ moveCard(c.id, 'bf'); log(`${name}: put ${cname(c)} onto the battlefield`); } commit(); return true; }
  // Calamity of the Titans
  if (/^exile each creature and planeswalker with mana value less than the revealed card's mana value$/.test(l)){ let k = ctx.v25rev || (it.revK); if (!k && !UI.dry){ const pool = S.hand.filter(c => isCreatureCard(c) && !(info(c.k)?.c || '')); if (pool.length){ const p = pool.length === 1 ? [pool[0].id] : await pickCards({title:`${name}: which colorless creature card did you reveal?`, cards:pool, min:1, max:1}); const c = pool.find(x => x.id === (p || [])[0]) || pool[0]; k = c.k; } }
    const mv = k ? (info(k)?.mv || 0) : 0; applyOp({op:'v25Flag', d:'exLess', n:mv, src:name}, MYPID); opponents().forEach(p => sendRq(p.pid, 'v25Flag', mv, name, {d:'exLess'})); log(`${name}: exiled each creature and planeswalker with mana value less than ${mv}`); commit(); return true; }
  // Slippery Bogbonder
  if (/^(?:then )?move any number of counters from among creatures you control onto that creature$/.test(l)){ const t = (ctx.lastT || [])[0]; const host = t && t.pid === MYPID ? S.bf.find(b => b.id === t.id) : null; if (UI.dry) return true; if (!t){ return true; }
    const donors = S.bf.filter(b => !b.fd && isCreatureCard(b) && b !== host && ((b.cp || 0) + (b.cm || 0) + Object.values(b.nc || {}).reduce((a, x) => a + x, 0)) > 0);
    for (const d of donors){ const kinds = [['cp', '+1/+1', d.cp || 0], ['cm', '-1/-1', d.cm || 0], ...Object.entries(d.nc || {}).filter(([, n]) => n > 0).map(([k, n]) => ['nc:' + k, k, n])].filter(x => x[2] > 0);
      for (const [key, lab, have] of kinds){ const v = await askChoice({title:`${name}: move how many ${lab} counters from ${cname(d)} onto ${t.nm || (host ? cname(host) : 'that creature')}?`, options:Array.from({length:have + 1}, (_, i) => ({label:String(i), value:i}))}); const n = +v || 0; if (!n) continue;
        if (key === 'cp' || key === 'cm'){ d[key] -= n; if (host) modCounters(host, key, n); else sendRq(t.pid, 'ctr', n, name, {tid:t.id, d:key}); } else { const nk = key.slice(3); addNamed(d, nk, -n); if (host) addNamed(host, nk, n); else sendRq(t.pid, 'r23kNamed', n, name, {tid:t.id, d:nk}); }
        log(`${name}: moved ${n} ${lab} counter${n === 1 ? '' : 's'} from ${cname(d)}`); } }
    commit(); return true; }
  return false;
}
{ const ds = doSentence; doSentence = async function(s0, ctx){ const s = String(s0).replace(/\.$/, '').trim(); const l = s.toLowerCase(); if (l && !(ctx && ctx.v25ftGo && /^return all nonland permanents/.test(l) && !(ctx.v25ftGo = 0)) && await v25Pre4(s, l, ctx)) return; return ds(s0, ctx); }; }
{
  const ao = applyOp;
  applyOp = function(r, from){
    if (r && r.op === 'v25Flag' && r.d === 'exLess'){ const n = +r.n || 0; const list = S.bf.filter(c => c.k && !c.fd && (isCreatureCard(c) || /\bPlaneswalker\b/.test(typeOf(c))) && (info(c.k)?.mv || 0) < n); list.forEach(c => moveCard(c.id, 'ex', {quiet:true})); if (list.length) log(`exiled ${list.map(cname).join(', ')} (${r.src})`); commit(); return; }
    return ao(r, from);
  };
}
// "~ can't be sacrificed" (Hithlain Rope; Zurgo's granted ability) — enforced here
STATIC_KNOWN.push(/^~ can't be sacrificed$/);
function v25noSac(c){ try { if (!S || !c || !S.bf.includes(c)) return false; if (/^~ can't be sacrificed\.?$/m.test(v25txt(c))) return true;
    if (c.tok && /\bWarrior\b/.test(typeOf(c)) && phaseNow().mine && phaseNow().ph === 6 && S.bf.some(b => !b.fd && /^during your end step, warrior tokens you control have "this token can't be sacrificed\.?"/m.test(v25txt(b)))) return true; } catch {} return false; }
{
  const so = sacrificeOne;
  sacrificeOne = function(c){ if (v25noSac(c)){ log(`${cname(c)} can't be sacrificed`); toast(`${cname(c)} can't be sacrificed`); return; } return so(c); };
  const mc = moveCard;
  moveCard = function(id, to, o = {}){ if (o && o.sac && S){ const c = S.bf.find(b => b.id === id); if (v25noSac(c)){ log(`${cname(c)} can't be sacrificed`); return; } } return mc(id, to, o); };
}
// the checker: a multi-sentence d20 row ("20 | Search … . If … . Then shuffle.") is checked by running it, not as passive text
{
  const cc = checkCard;
  checkCard = async function(k){ const r = await cc(k);
    try { const a = info(k); if (a && r && r.issues){ for (let i = r.issues.length - 1; i >= 0; i--){ const x = r.issues[i]; const mm = x.kind === 'static' && String(x.text).match(/^(\d+)(?:—(\d+))? \| ([\s\S]+)$/); if (!mm) continue;
        const miss = await dryAll(mm[3], k, a.n); r.issues.splice(i, 1, ...miss.filter(t => !r.issues.some(y => y.text === t)).map(t => ({kind:'effect', text:t, where:x.text}))); }
      if (!r.issues.length) r.ok = Math.max(1, r.ok || 0); } } catch (e){ console.warn(e); }
    return r; };
}

/* ---------- Batch 5 ---------- */
// Rose, Cutthroat Raider: "At end of combat on your turn"
{
  const ct = classifyTrig;
  classifyTrig = function(w, c){ if (w === 'at' && /^end of combat on your turn$/.test(c)) return {ev:'step', step:'v25eoc', whose:'your'}; return ct(w, c); };
  const sp = setPhase;
  setPhase = function(i, ...a){ const pn = S ? phaseNow() : null; const fire = !!(S && i === 5 && pn && pn.mine && pn.ph === 4 && !UI.dry); const r = sp.call(this, i, ...a); if (fire){ try { fireSteps('v25eoc', MYPID); commit(); } catch (e){ console.warn(e); } } return r; };
  const da = declareAttackers;
  declareAttackers = function(...a){ const r = da.apply(this, a); try { if (S){ const pids = new Set(); S.bf.forEach(c => { const d = parseDef(c.atk); if (d && d.t === 'player' && d.pid !== MYPID) pids.add(d.pid); }); if (pids.size){ const T = turnStr(); const old = S.v25atk && S.v25atk.t === T ? S.v25atk.pids : []; S.v25atk = {t:T, pids:[...new Set([...old, ...pids])]}; } } } catch {} return r; };
}
async function v25Pre5(s, l, ctx){
  let m; const name = ctx.name || ''; const it = ctx.it || {};
  if ((m = l.match(/^create (a|an) (junk|treasure|food|clue) token for each opponent you attacked(?: this turn)?$/))){ const n = S.v25atk && S.v25atk.t === turnStr() ? S.v25atk.pids.length : 0; if (n) await createFromText(`Create ${n === 1 ? 'a' : n} ${m[2]} token${n === 1 ? '' : 's'}`, ctx); log(`${name}: ${n} ${m[2]} token${n === 1 ? '' : 's'} (opponents attacked)`); commit(); return true; }
  // You Find Some Prisoners — Interrogate Them
  if (/^choose one of them$/.test(l) && (ctx.r21ids || []).length){ const pool = ctx.r21ids.map(id => S.ex.find(c => c.id === id)).filter(Boolean); if (UI.dry || pool.length <= 1){ ctx.r21ids = pool.slice(0, 1).map(c => c.id); return true; }
    const p = await pickCards({title:`${name}: choose one of them`, cards:pool, min:1, max:1}); const c = pool.find(x => x.id === (p || [])[0]) || pool[0]; ctx.r21ids = [c.id]; log(`${name}: chose ${cname(c)}`); return true; }
  if (/^choose one of them$/.test(l) && UI.dry){ ctx.r21 = true; return true; }
  // Laughing Jasper Flint
  if (/^exile the top x cards of target opponent's library, where x is the number of outlaws you control$/.test(l)){ const n = S.bf.filter(c => !c.fd && isCreatureCard(c) && /\b(Assassin|Mercenary|Pirate|Rogue|Warlock)\b/.test(typeOf(c))).reduce((a, c) => a + (c.n || 1), 0); ctx.r21x = n; ctx.r21 = true;
    if (!n){ log(`${name}: no outlaws — X is 0`); return true; } await r21ExileFrom(r21Pids("target opponent's", ctx), ctx, {n, w:'r'}); return true; }
  // Call the Spirit Dragons
  if (/^for each color, put a \+1\/\+1 counter on a dragon you control of that color$/.test(l)){ const got = new Set(); if (UI.dry){ ctx.v25csd = got; return true; }
    for (const [col, nm] of [['W', 'white'], ['U', 'blue'], ['B', 'black'], ['R', 'red'], ['G', 'green']]){ const ds = S.bf.filter(c => !c.fd && isCreatureCard(c) && /\bDragon\b/.test(typeOf(c)) && (typeof d27Col === 'function' ? String(d27Col(c) || '') : (info(c.k)?.c || '')).includes(col)); if (!ds.length) continue;
      const fresh = ds.filter(c => !got.has(c.id)); let c = (fresh.length === 1 ? fresh[0] : null);
      if (!c){ const p = await pickCards({title:`${name}: put a +1/+1 counter on a ${nm} Dragon`, cards:ds, min:1, max:1}); c = ds.find(x => x.id === (p || [])[0]) || ds[0]; }
      modCounters(c, 'cp', 1); got.add(c.id); log(`${name}: +1/+1 counter on ${cname(c)} (${nm})`); }
    ctx.v25csd = got; commit(); return true; }
  if (/^if you put \+1\/\+1 counters on five dragons this way, you win the game$/.test(l)){ if (UI.dry) return true; if ((ctx.v25csd || new Set()).size >= 5) await doSentence('You win the game.', ctx); else log(`${name}: ${(ctx.v25csd || new Set()).size} Dragons got counters`); return true; }
  // Clockspinning
  if (/^choose a counter on target permanent or suspended card$/.test(l)){ const t = v25tgt(ctx); ctx.lastT = t ? [t] : []; ctx.v25cs = null; if (!t || UI.dry) return true;
    const c = boardOf(t.pid).find(b => b.id === t.id); if (!c) return true; const kinds = [['cp', '+1/+1', c.cp || 0], ['cm', '-1/-1', c.cm || 0], ...Object.entries(c.nc || {}).filter(([, n]) => n > 0).map(([k, n]) => [k, k, n])].filter(x => x[2] > 0);
    if (!kinds.length){ log(`${name}: no counters on ${t.nm || cname(c)}`); return true; } const v = kinds.length === 1 ? kinds[0][0] : await askChoice({title:`${name}: choose a counter on ${t.nm || cname(c)}`, options:kinds.map(x => ({label:`${x[1]} (${x[2]})`, value:x[0]}))}); ctx.v25cs = v || kinds[0][0]; return true; }
  if (/^remove that counter from that permanent or card or put another of those counters on it$/.test(l)){ const t = (ctx.lastT || [])[0]; const k = ctx.v25cs; if (!t || !k || UI.dry) return true;
    const v = await askChoice({title:`${name}: ${k === 'cp' ? '+1/+1' : k === 'cm' ? '-1/-1' : k} counter`, options:[{label:'Remove one', value:-1}, {label:'Put another one on', value:1}]}); const d = v === 1 ? 1 : -1;
    if (t.pid === MYPID){ const c = S.bf.find(b => b.id === t.id); if (c){ if (k === 'cp' || k === 'cm'){ if (d > 0) modCounters(c, k, 1); else c[k] = Math.max(0, (c[k] || 0) - 1); } else addNamed(c, k, d); } }
    else sendRq(t.pid, 'v25Flag', d, name, {d:'ctr1|' + k, tid:t.id}); log(`${name}: ${d > 0 ? 'added' : 'removed'} a ${k === 'cp' ? '+1/+1' : k === 'cm' ? '-1/-1' : k} counter`); commit(); return true; }
  return false;
}
{ const ds = doSentence; doSentence = async function(s0, ctx){ const s = String(s0).replace(/\.$/, '').trim(); const l = s.toLowerCase(); if (l && await v25Pre5(s, l, ctx)) return; return ds(s0, ctx); }; }
{
  const ao = applyOp;
  applyOp = function(r, from){
    if (r && r.op === 'v25Flag' && /^ctr1\|/.test(r.d || '')){ const c = S.bf.find(b => b.id === r.tid); if (c){ const k = String(r.d).split('|')[1] || ''; const d = r.n > 0 ? 1 : -1; if (k === 'cp' || k === 'cm'){ if (d > 0) modCounters(c, k, 1); else c[k] = Math.max(0, (c[k] || 0) - 1); } else if (/^[a-z0-9 \-\/+]{1,20}$/i.test(k)) addNamed(c, k, d); log(`${cname(c)}: ${d > 0 ? '+' : '−'}1 ${k} counter (${r.src})`); } commit(); return; }
    return ao(r, from);
  };
}

/* ---------- Batch 6 ---------- */
async function v25Pre6(s, l, ctx){
  const name = ctx.name || ''; const it = ctx.it || {};
  // Ob Nixilis, Captive Kingpin
  if (/^until your next end step, you may play that card$/.test(l)){ const ids = (ctx.lastEx || []).filter(id => S.ex.some(c => c.id === id)); if (!ids.length) return true; const pn = phaseNow(); const thisTurn = pn.mine && pn.ph >= 0 && pn.ph < 6;
    ids.forEach(id => { const c = S.ex.find(x => x.id === id); if (c) c.mayPlay = {t:turnStr(), next:!thisTurn, cast:false, src:name, u0:S.untapN, free:false}; }); log(`${name}: may play that card until their next end step`); commit(); return true; }
  // Vivien, Champion of the Wilds −2
  if (/^for as long as it remains exiled, you may cast it if it's a creature spell$/.test(l)){ const ids = (ctx.lastEx || []).slice(); let c = ids.length ? S.ex.find(x => x.id === ids[ids.length - 1]) : null; if (!c) c = S.ex.slice().reverse().find(x => x.fd); if (!c) return true;
    if (isCreatureCard({k:c.k})){ c.mayPlay = {t:turnStr(), cast:true, src:name, u0:S.untapN, adv:true}; log(`${name}: may cast the exiled creature card for as long as it remains exiled`); } else log(`${name}: the exiled card isn't a creature card`); commit(); return true; }
  // Norn's Decree
  if (/^if one or more players being attacked are poisoned, the attacking player draws a card$/.test(l)){ const ap = it.evPid || currentTurn()[1]; if (!ap || UI.dry) return true;
    const bf = ap === MYPID ? S.bf : (OPP.get(ap)?.bf || []); const def = new Set(); bf.forEach(c => { const d = parseDef(c.atk); if (d && d.t === 'player') def.add(d.pid); });
    const psn = pid => pid === MYPID ? (S.psn || 0) : (OPP.get(pid)?.psn || 0); if (![...def].some(p => psn(p) > 0)){ log(`${name}: no attacked player is poisoned`); return true; }
    if (ap === MYPID) draw(1); else sendRq(ap, 'draw', 1, name); log(`${name}: ${nameOf(ap)} draws a card`); commit(); return true; }
  return false;
}
{ const ds = doSentence; doSentence = async function(s0, ctx){ const s = String(s0).replace(/\.$/, '').trim(); const l = s.toLowerCase(); if (l && await v25Pre6(s, l, ctx)) return; return ds(s0, ctx); }; }

// "Turn target creature face down": the target is a creature (not a "creature face down")
{
  const ts = targetSpecs;
  targetSpecs = function(t){ const out = ts(t); try { out.forEach(x => { if (x && typeof x.desc === 'string' && / face (?:down|up)$/.test(x.desc) && /\bturn target\b/i.test(String(t))) x.desc = x.desc.replace(/ face (?:down|up)$/, ''); }); } catch {} return out; };
}
// "Untap that creature" after an effect targeted another player's creature (Cerulean Wisps)
{ const ds = doSentence; doSentence = async function(s0, ctx){ const l = String(s0).replace(/\.$/, '').trim().toLowerCase();
    if (/^untap that creature$/.test(l) && ctx && (ctx.lastT || []).length && ctx.lastT[0].t === 'card' && ctx.lastT[0].pid && ctx.lastT[0].pid !== MYPID){ applyTo(ctx.lastT[0], {op:'untap', src:ctx.name}); commit(); return; }
    return ds(s0, ctx); }; }
