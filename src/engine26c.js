/* ===================== Rules engine — round 26 helper C2: long tail, ranks 5081–6999 ===================== */
const C2 = {};
function c2Tg(ctx){ return ctx.tgts ? nextTargets(ctx) : []; }
function c2Mine(){ try { return currentTurn()[1] === MYPID; } catch { return true; } }
function c2Txt(c){ try { return tname(info(c.k)?.o || '', info(c.k)?.n || '').toLowerCase(); } catch { return ''; } }
function c2Live(u){ if (!u) return true; if (u[0] === 'e') return u.slice(1) === turnStr(); if (u[0] === 'n'){ const [pid, t0] = u.slice(1).split('|'); const cur = currentTurn(); return !(cur[1] === pid && turnStr() !== t0); } return true; }

STATIC_RULES.push(
  [/^if you would flip a coin, instead flip two coins and ignore one$/, m => ({kind:'c2thumb', who:'you'})],
  [/^your opponents play with their hands revealed$/, m => ({kind:'c2handRev', who:'opp'})],
  [/^players play with the top card of their libraries revealed$/, m => ({kind:'c2topRev', who:'all'})],
  [/^you may look at an additional two cards each time you surveil$/, m => ({kind:'c2surv', who:'you'})],
  [/^you gain life rather than lose life from radiation$/, m => ({kind:'c2radGain', who:'you'})],
  [/^as long as ~ entered this turn, you may activate (?:her|his|its|their) loyalty abilities any time you could cast an instant$/, m => ({kind:'c2pwFlash', who:'you'})],
  [/^each player may attack only the nearest opponent in the chosen direction and planeswalkers controlled by that opponent$/, m => ({kind:'c2pram', who:'all'})],
  [/^descend (\d+) — ~ can't attack or block unless there are (\w+) or more permanent cards in your graveyard$/, m => ({kind:'c2descAB', who:'you'})],
  [/^(?:if (?:~|this land) would enter, sacrifice a swamp instead|if you do, put (?:~|this land) onto the battlefield|if you don't, put it into its owner's graveyard)$/, m => ({kind:'c2lake', who:'you'})],
  [/^if a wizard you control entering causes a triggered ability of a permanent you control to trigger, that ability triggers an additional time$/, m => ({kind:'c2naban', who:'you'})],
  [/^if a triggered ability of another shrine you control triggers while you control six or more shrines, that ability triggers an additional time$/, m => ({kind:'c2sanctum', who:'you'})],
  [/^(?:enchanted creature has protection from the chosen color|this effect doesn't remove auras and equipment you control that are already attached to it)$/, m => ({kind:'c2protCol', who:'all'})],
  [/^vehicle creatures you control are the chosen creature type in addition to their other types$/, m => ({kind:'c2lifecraft', who:'you'})],
  [/^(?:creatures you control are the chosen type|the same is true for creature spells you control and creature cards you own that aren't on the battlefield)$/, m => ({kind:'c2consp', who:'you'})],
  [/^vanishing$/, m => ({kind:'c2van', who:'you'})],
  [/^(?:1 or 2 — \[\+2\], then create two 1\/1 green squirrel creature tokens|they gain haste until end of turn)$/, m => ({kind:'c2comet', who:'you'})],
  [/^3 — \[−1\], then return a card with mana value 2 or less from your graveyard to your hand$/, m => ({kind:'c2comet', who:'you'})],
  [/^4 or 5 — ~ deals damage equal to the number of loyalty counters on (?:him|her|it) to a creature or player, then \[−2\]$/, m => ({kind:'c2comet', who:'you'})],
  [/^6 — \[\+1\], and you may activate ~'s loyalty ability two more times this turn$/, m => ({kind:'c2comet', who:'you'})],
  [/^instant and sorcery spells you cast from your hand have cascade$/, m => ({kind:'c2handCasc', who:'you'})],
  [/^attacking warriors you control get \+x\/\+0, where x is the number of cowards your opponents control$/, m => ({kind:'c2gornog', who:'you'})],
);

/* ---------- Krark's Thumb: every coin flip is two flips, keep the better ---------- */
async function c2Flip(run){
  const n = rulesOn('c2thumb').length; if (!n || UI.dry) return run();
  const R = Math.random; const k = Math.min(2 ** n, 32);
  Math.random = function(){ let r = R(); for (let i = 1; i < k; i++) r = Math.min(r, R()); return r; };
  log(`Krark's Thumb: flipping ${k} coins for each flip and ignoring the rest`);
  try { return await run(); } finally { Math.random = R; }
}

/* ---------- Telepathy (hand revealed to opponents), Lantern of Insight (top card revealed) ---------- */
function c2RevSync(){
  if (!S || UI.dry) return false; let ch = false;
  try {
    const need = rulesOn('c2handRev').length > 0;
    if (need && !S.rh){ S.rh = true; S.c2rh = true; ch = true; log('plays with their hand revealed (Telepathy)'); }
    else if (!need && S.c2rh){ S.rh = false; delete S.c2rh; ch = true; }
    if (rulesOn('c2topRev').length && S.lib.length){ const k = S.lib[0].k + '#' + S.lib[0].id; if (S.c2top !== k){ S.c2top = k; log(`top card of library (revealed): ${cname(S.lib[0])}`); ch = true; } }
    else if (S.c2top) delete S.c2top;
  } catch (e){ console.warn(e); }
  return ch;
}
{
  const cm = commit;
  commit = function(...a){ try { c2RevSync(); } catch {} return cm.apply(this, a); };
  setInterval(() => { try { if (S && !UI.dry && c2RevSync()) commit(); } catch {} }, 1500);
}

/* ---------- Strong, the Brutish Thespian: radiation gains life instead ---------- */
{
  const fs = fireSteps;
  fireSteps = function(step, activePid){
    const on = step === 'main1' && activePid === MYPID && S && (S.pc || {}).rad && rulesOn('c2radGain').length;
    const r0 = on ? S.pc.rad : 0; const L0 = on ? S.life : 0;
    const r = fs(step, activePid);
    try { if (on){ const lost = Math.max(0, r0 - ((S.pc || {}).rad || 0)); const dl = L0 - S.life;
      if (lost && dl >= lost){ S.life += lost; gainLife(lost, 'radiation'); log(`Strong: gained ${lost} life from radiation instead of losing it`); commit(); } } } catch (e){ console.warn(e); }
    return r;
  };
}

/* ---------- The Wandering Emperor: instant-speed loyalty the turn she entered ---------- */
{
  const lr = loyaltyReady;
  loyaltyReady = function(c, ab){
    const r = lr(c, ab);
    try { if ((r === 'Only on your turn' || r === 'Only in your main phase with an empty stack') && c && c.et === turnStr() && S.bf.includes(c) &&
      /as long as ~ entered this turn, you may activate (?:her|his|its|their) loyalty abilities any time you could cast an instant/.test(c2Txt(c))){
      if (c.lu === turnStr()) return 'Already used a loyalty ability this turn';
      const v = /X/.test(ab.cost) ? 0 : +ab.cost; if (v < 0 && (c.co || 0) < -v) return `Needs ${-v} loyalty`;
      return ''; } } catch (e){ console.warn(e); }
    return r;
  };
}

/* ---------- Pramikon / Teyo: attack only the nearest opponent in the chosen direction ---------- */
function c2Nearest(fromPid, dir){
  const ps = players().map(p => p.pid); const i = ps.indexOf(fromPid); if (i < 0 || ps.length < 2) return null;
  const step = dir === 'right' ? -1 : 1; return ps[(i + step + ps.length) % ps.length];
}
function c2Dirs(){
  const out = [];
  for (const b of boardsAll()) for (const c of b.bf) if (c.k && !c.fd && c.c2dir && /attack only the nearest opponent in the chosen direction/i.test(info(c.k)?.o || '')) out.push({dir:c.c2dir, ts:c.id || 0});
  const teyo = [[MYPID, S.c2teyo]]; for (const [pid, s] of OPP) teyo.push([pid, s.c2teyo]);
  for (const [, t] of teyo) if (t && t.dir && c2Live(t.u)) out.push({dir:t.dir, ts:t.ts || 0});
  return out;
}
{
  const dO = defOpts;
  defOpts = function(){ const out = dO(); try { const ds = c2Dirs(); if (!ds.length) return out; let res = out;
    for (const d of ds){ const p = c2Nearest(MYPID, d.dir); if (p) res = res.filter(o => !o.pid || o.pid === p); }
    return res; } catch (e){ console.warn(e); return out; } };
  const oe = onEnter;
  onEnter = function(c, from, o){ const r = oe(c, from, o); try { if (c && S.bf.includes(c) && !c.c2dir && /^as ~ enters, choose left or right\.?$/im.test(tname(info(c.k)?.o || '', info(c.k)?.n || ''))){
    if (UI.dry) c.c2dir = 'left'; else (async () => { c.c2dir = await askChoice({title:`${cname(c)}: choose left or right`, options:[{label:'Left', value:'left'}, {label:'Right', value:'right'}]}) || 'left'; log(`${cname(c)}: chose ${c.c2dir}`); commit(); })(); } } catch {} return r; };
  const cpe = cardPublicExtra;
  cardPublicExtra = function(c){ const o = cpe(c); if (c && c.c2dir) o.c2dir = c.c2dir; return o; };
  const ss = sanitizeState;
  sanitizeState = function(s){ const r = ss(s); try { if (r && s && Array.isArray(s.bf)) r.bf.forEach((c, i) => { const o = s.bf[i]; if (o && (o.c2dir === 'left' || o.c2dir === 'right')) c.c2dir = o.c2dir; }); } catch {} return r; };
  const ep = enginePublic;
  enginePublic = function(){ const r = ep(); try { if (S.c2teyo && c2Live(S.c2teyo.u)) r.c2teyo = S.c2teyo; } catch {} return r; };
  const se = sanitizeEngine;
  sanitizeEngine = function(s){ const r = se(s); try { const t = s.c2teyo; if (t && typeof t === 'object' && typeof t.u === 'string') r.c2teyo = {dir:t.dir === 'right' ? 'right' : 'left', u:t.u.slice(0, 60), ts:Number.isFinite(t.ts) ? t.ts : 0}; } catch {} return r; };
}

/* ---------- The Ancient One: descend 8 ---------- */
function c2PermGy(){ return S.gy.filter(c => typesOf(c.k).some(t => /^(artifact|creature|enchantment|land|planeswalker|battle)$/i.test(t))).length; }
function c2DescBlock(c){ const m = c2Txt(c).match(/can't attack or block unless there are (\w+) or more permanent cards in your graveyard/); if (!m) return ''; const n = wn(m[1]) || +m[1] || 8; return c2PermGy() >= n ? '' : `needs ${n} permanent cards in your graveyard (descend ${n})`; }
{
  const ca = canAttack; canAttack = function(c){ let r = ca(c);
    try { if (r === "can't attack" && /can't attack or block unless there are \w+ or more permanent cards in your graveyard/.test(c2Txt(c)) && !/(?:^|\n|\. )~ can't attack(?! or block unless)/.test(c2Txt(c))){
      // the printed "~ can't attack" check matched the descend clause itself: judge the clause here instead
      const fx = attachFx(c, MYPID); r = fx.noAtk ? `can't attack (${fx.names.join(', ')})` : (c.ekw || []).includes('cantattack') ? "can't attack this turn" : ''; } } catch {}
    if (r) return r; try { return c2DescBlock(c) || ''; } catch { return ''; } };
  const cb = canBlock; canBlock = function(b, a, apid){ const r = cb(b, a, apid); if (r) return r; try { return c2DescBlock(b) || ''; } catch { return ''; } };
}

/* ---------- Gornog: attacking Warriors get +X/+0 (X = Cowards your opponents control) ---------- */
{
  const st0 = stats;
  stats = function(c, pid){ const r = st0(c, pid); try { if (!r || !c || !c.atk || !S) return r; const p = pid || l24pidOf(c) || MYPID;
    const g = boardOf(p).filter(x => x.k && !x.fd && /^attacking warriors you control get \+x\/\+0, where x is the number of cowards your opponents control\.?$/im.test(tname(info(x.k)?.o || '', info(x.k)?.n || ''))).length;
    if (!g || !/\bWarrior\b/.test(typeOf(c))) return r;
    let n = 0; for (const b of boardsAll()) if (b.pid !== p) n += b.bf.filter(x => x.k && isCreatureCard(x) && /\bCoward\b/.test(typeOf(x))).length;
    return n ? [r[0] + g * n, r[1]] : r; } catch { return r; } };
}

/* ---------- Omo, Lifecraft Engine, Conspiracy: type-changing statics ---------- */
const C2_LANDT = ['Plains', 'Island', 'Swamp', 'Mountain', 'Forest', 'Cave', 'Cloud', 'Desert', 'Gate', 'Lair', 'Locus', 'Mine', 'Power-Plant', 'Sphere', 'Tower', 'Town', "Urza's"];
{
  const ps = l24parseStatic;
  l24parseStatic = function(line){
    const l = String(line).toLowerCase();
    if (/^each land with an everything counter on it is every land type in addition to its other types$/.test(l)) return {scope:'all', desc:'land', cond:'ctr:everything', mod:{addS:C2_LANDT.slice()}};
    if (/^each nonland creature with an everything counter on it is every creature type$/.test(l)) return {scope:'all', desc:'nonland creature', cond:'ctr:everything', mod:{allCT:1}};
    return ps(line);
  };
}

/* ---------- Lake of the Dead: sacrifice a Swamp or it goes to the graveyard ---------- */
{
  const oe = onEnter;
  onEnter = function(c, from, o = {}){
    try { if (S && c && c.k && !UI.dry && from === 'hand' && /if (?:this land|~) would enter, sacrifice a swamp instead/i.test(c2Txt(c))){
      const sw = S.bf.filter(x => x !== c && !x.fd && /\bSwamp\b/.test(typeOf(x)));
      if (!sw.length){ moveCard(c.id, 'gy', {quiet:true}); log(`${cname(c)}: no Swamp to sacrifice — put into the graveyard`); commit(); return; }
      (async () => { const ids = await pickCards({title:`${cname(c)}: sacrifice a Swamp (or it goes to the graveyard)`, cards:sw, min:0, max:1, noneLabel:"Don't"});
        if (!ids || !ids.length){ moveCard(c.id, 'gy', {quiet:true}); log(`${cname(c)} was put into the graveyard`); }
        else { const x = S.bf.find(y => y.id === ids[0]); if (x){ sacrificeOne(x); log(`${cname(c)}: sacrificed ${cname(x)}`); } }
        commit(); })();
    } } catch (e){ console.warn(e); }
    return oe(c, from, o);
  };
}

/* ---------- Naban (Wizard ETB triggers twice), Sanctum of All (Shrine triggers twice at six Shrines) ---------- */
{
  const tm = trigMult;
  trigMult = function(ev, src){
    let n = tm(ev, src); if (!ev || !S || !src || src.cz) return n;
    try {
      const c = src.id != null ? S.bf.find(b => b.id === src.id) : null; if (!c) return n;
      const nab = rulesOn('c2naban').length;
      if (nab && ev.type === 'enter' && ev.k && (UI.r23evPid == null || UI.r23evPid === MYPID) && S.bf.some(b => b.id === ev.id) && descOk(ev.k, 'wizard', {tok:ev.tok})) n += nab;
      const san = S.bf.filter(b => !b.fd && /if a triggered ability of another shrine you control triggers while you control six or more shrines/i.test(info(b.k)?.o || ''));
      if (san.length && /\bShrine\b/.test(typeOf(c)) && S.bf.filter(b => !b.fd && /\bShrine\b/.test(typeOf(b))).length >= 6) n += san.filter(b => b.id !== c.id).length;
    } catch (e){ console.warn('c2 trigMult', e); }
    return Math.min(n, 8);
  };
}

/* ---------- "becomes the target … for the first time each turn" (Kira's granted trigger) ---------- */
{
  const lc = l24classify;
  l24classify = function(w, cond){ if (/^~ becomes the target of a spell or ability for the first time each turn$/.test(String(cond).toLowerCase().trim())) return {ev:'l24targeted'}; return lc(w, cond); };
  const he = handleEvent;
  handleEvent = function(pid, ev){
    he(pid, ev);
    try { if (S && ev && ev.type === 'qtgt' && ev.dp === MYPID && ev.id != null && S.bf.some(b => b.id === ev.id)){
      const T = turnStr(); S.c2tg = S.c2tg && S.c2tg.t === T ? S.c2tg : {t:T, ids:[]};
      if (!S.c2tg.ids.includes(ev.id)){ S.c2tg.ids.push(ev.id); S.c2tgBy = {...(S.c2tgBy || {}), [ev.id]:pid}; he(MYPID, {...ev, type:'l24targeted'}); } } } catch (e){ console.warn(e); }
  };
}

/* ---------- Benevolent Blessing: protection from the chosen color (the color is published so every client sees it) ---------- */
{
  const COLN = {W:'white', U:'blue', B:'black', R:'red', G:'green'};
  const pf = protFrom; protFrom = function(c){ const out = pf(c); try { if (c && S){ const pid = l24pidOf(c) || MYPID;
    for (const b of boardsAll()) for (const a of b.bf){ const col = a.col || a.c2col; if (a.k && !a.fd && a.att && a.att.id === c.id && a.att.pid === pid && col && COLN[col] && /enchanted creature has protection from the chosen color/i.test(info(a.k)?.o || '') && !out.includes(COLN[col])) out.push(COLN[col]); } } } catch {} return out; };
  const cpe = cardPublicExtra;
  cardPublicExtra = function(c){ const o = cpe(c); if (c && typeof c.col === 'string' && /^[WUBRG]$/.test(c.col)) o.c2col = c.col; return o; };
  const ss = sanitizeState;
  sanitizeState = function(s){ const r = ss(s); try { if (r && s && Array.isArray(s.bf)) r.bf.forEach((c, i) => { const o = s.bf[i]; if (o && typeof o.c2col === 'string' && /^[WUBRG]$/.test(o.c2col)) c.c2col = o.c2col; }); } catch {} return r; };
}

/* ---------- Lifecraft Engine / Conspiracy: chosen creature type (layer 4) ---------- */
{
  const own0 = L24.own;
  L24.own = c => { const out = own0(c); try { const pid = l24pidOf(c); if (pid == null) return out; const base = l24baseType(c);
      for (const s of boardOf(pid)){ if (!s.k || s.fd || !s.ctype) continue; const t = info(s.k)?.o || ''; const ty = l24capW(String(s.ctype).trim());
        if (/Vehicle creatures you control are the chosen creature type in addition to their other types/i.test(t) && /\bVehicle\b/.test(base) && (/\bCreature\b/.test(base) || c.anim === 'crew' || c.animPT)) out.push({addS:[ty], s:cname(s), ts:1});
        if (/Creatures you control are the chosen type\. The same is true/i.test(t) && (/\bCreature\b/.test(base) || c.anim === 'crew' || c.animPT)) out.push({crSub:[ty], s:cname(s), ts:1}); } } catch {} return out; };
  const dk = descOk;
  descOk = function(k, desc, o = {}){
    const r = dk(k, desc, o); if (!S || o.face || o.card || typeof k !== 'string' || k.startsWith('L24|')) return r;
    try { const cs = S.bf.find(b => b.ctype && !b.fd && /Creatures you control are the chosen type\. The same is true/i.test(info(b.k)?.o || '')); if (!cs) return r;
      const a = info(k); if (!a || !/\bCreature\b/.test(a.t || '')) return r;
      if (boardsAll().some(b => b.bf.some(c => c.k === k))) return r;   // on a battlefield: the layer pass decides
      if (!['hand', 'gy', 'lib', 'ex', 'cz'].some(z => (S[z] || []).some(c => c.k === k)) && !(S.stk || []).some(it => it.card && it.card.k === k)) return r;
      const t = (a.t || '').split('—')[0].trim() + ' — ' + l24capW(cs.ctype); return dk(k, desc, {...o, face:{...a, t}}); } catch { return r; }
  };
}

/* ---------- first +1/+1 counters on a permanent this turn (Botanical Brawler) ---------- */
{
  const ct = classifyTrig;
  classifyTrig = function(w, c){ const cc = String(c || '').trim(); let m;
    if (/^one or more \+1\/\+1 counters are put on another permanent you control$/.test(cc)) return {ev:'ctrp', subj:'any', ctl:'you', desc:'', c2first:'ctr', c2other:1};
    return ct(w, c); };
  const sm = subjMatch;
  subjMatch = function(t, src, ev, pid){
    if (t && t.c2first && ev){ const T = turnStr();
      if (t.c2my && !c2Mine()) return false;
      if (t.c2other && src && ev.id === src.id) return false;
      const rec = S.c2ctrT; if (rec && rec.t === T && rec.ids.includes(ev.id)) return false; }
    return sm(t, src, ev, pid); };
  const he = handleEvent;
  handleEvent = function(pid, ev){
    he(pid, ev);
    try { if (S && ev && pid === MYPID && ev.id != null && ev.type === 'ctrp'){ const key = 'c2ctrT'; const T = turnStr();
      if (!S[key] || S[key].t !== T) S[key] = {t:T, ids:[]}; if (!S[key].ids.includes(ev.id)) S[key].ids.push(ev.id); if (S[key].ids.length > 200) S[key].ids.shift(); } } catch {}
  };
}

/* ---------- cards milled this turn (The Master, Transcendent) ---------- */
{
  const ml = mill;
  mill = function(n = 1){ const before = S.lib.slice(0, n); const r = ml(n); try { const T = turnStr(); before.forEach(c => { if (!S.lib.includes(c) && S.gy.includes(c)) c.c2mill = T; }); } catch {} return r; };
  const ep = enginePublic;
  enginePublic = function(){ const o = ep(); try { const T = turnStr(); const ks = S.gy.filter(c => c.c2mill === T).map(c => c.k); if (ks.length) o.c2mill = [T, ks.slice(-40)]; } catch {} return o; };
  const se = sanitizeEngine;
  sanitizeEngine = function(s){ const o = se(s); try { if (Array.isArray(s.c2mill) && Array.isArray(s.c2mill[1])) o.c2mill = [String(s.c2mill[0]).slice(0, 20), s.c2mill[1].filter(k => typeof k === 'string').map(k => k.slice(0, 80)).slice(0, 40)]; } catch {} return o; };
  const tk = takeCard;
  takeCard = function(r, from){ const n0 = S.bf.length; const out = tk(r, from); try { if (r && /c2m=1/.test(String(r.d || '')) && S.bf.length > n0){ const c = S.bf[S.bf.length - 1]; l24addMod(c, {s:'The Master', u:'', crSub:['Mutant'], col:'G', pt:[3, 3]}); log(`${cname(c)} is a green Mutant with base power and toughness 3/3`); commit(); } } catch {} return out; };
}
function c2MyGy(t){ const T = turnStr(); return S.gy.find(g => g.id === t.id) || S.gy.find(g => g.k === t.k && g.c2mill === T) || S.gy.find(g => g.k === t.k); }
function c2MilledNow(t){ const T = turnStr(); if (t.pid === MYPID){ const c = c2MyGy(t); return !!(c && c.c2mill === T); } const o = OPP.get(t.pid); return !!(o && o.c2mill && o.c2mill[0] === T && o.c2mill[1].includes(t.k)); }

RQ_OPS.push('c2mana');
{
  const ao = applyOp;
  applyOp = function(r, from){ if (r && r.op === 'c2mana'){ const col = /^[WUBRGC]$/.test(String(r.d)) ? r.d : 'C'; const n = clamp(+r.n || 0, 0, 99); if (n) addMana([...col.repeat(n)]); log(`added ${n} {${col}} (${r.src})`); commit(); return; } return ao(r, from); };
}

/* ---------- Sewer Nemesis ("the chosen player casts a spell"), Mighty Servant (first crew each turn) ---------- */
{
  const ct = classifyTrig;
  classifyTrig = function(w, c){ const cc = String(c || '').trim();
    if (/^the chosen player casts a spell$/.test(cc)) return {ev:'cast', subj:'any', ctl:'any', desc:'', c2chosen:1};
    if (/^~ becomes crewed for the first time each turn$/.test(cc)) return {ev:'qcrew', subj:'any', ctl:'any', desc:'', qf:(src, ev, pid) => pid === MYPID && src && ev.id === src.id && (ev.nth || 1) === 1};
    return ct(w, c); };
  const pt = pushTrigger;
  pushTrigger = function(src, t, ev, evPid){
    try { if (t && t.c2chosen){ const c = src && src.id != null ? S.bf.find(b => b.id === src.id) : null; const who = c && c.u25player; if (!who || who !== (evPid || MYPID)) return; } } catch {}
    return pt(src, t, ev, evPid); };
}

/* ---------- Tranquil Frillback: pay {G} up to three times, then choose up to that many modes ---------- */
{
  const re0 = runEffects;
  runEffects = async function(txt, ctx){
    const m = String(txt || '').match(/^(?:you may )?pay (\{[WUBRGC]\}) up to (one|two|three|four|\d+) times\. When you pay this cost one or more times, choose up to (?:that many|\w+) —\s*((?:\n?•[^\n]+)+)\s*$/i);
    if (!m) return re0(txt, ctx);
    const opts = m[3].split('\n').map(x => x.trim()).filter(x => x.startsWith('•')).map(x => x.replace(/^•\s*/, '').trim());
    const max = Math.min(wn(m[2].toLowerCase()) || +m[2] || 3, opts.length); const name = ctx.name || '';
    if (UI.dry){ for (const o of opts) await re0(o, ctx); return; }
    const sc = srcCardOf(ctx) || S.bf.find(b => b.k === ctx.k);
    const n = +(await askChoice({title:`${name}: pay ${m[1]} how many times?`, options:Array.from({length:max + 1}, (_, i) => ({label:i ? `${i} time${i > 1 ? 's' : ''} (${m[1].repeat(i)})` : "Don't pay", value:i}))})) || 0;
    if (!n){ log(`${name}: paid nothing`); return; }
    if (!(await payAbilityCost(sc || {id:-1, k:ctx.k, n:1}, m[1].repeat(n)))){ log(`${name}: couldn't pay ${m[1].repeat(n)}`); commit(); return; }
    log(`${name}: paid ${m[1].repeat(n)}`);
    const md = {opts, min:0, max:n, pre:'', post:''}; const pick = await askModes(md, name); if (!pick || !pick.length) return;
    for (const i of pick){ const t = opts[i]; const c2 = {...ctx, tgts:null, ti:0, lastT:null};
      if (targetSpecs(t).length){ c2.tgts = await chooseTargets(t, {pid:MYPID, col:info(ctx.k)?.c, types:sc ? typeOf(sc) : '', id:sc ? sc.id : -1}, name); if (!c2.tgts) continue; }
      await re0(t, c2); }
    commit();
  };
}

/* ---------- Willbreaker: control for as long as you control it ---------- */
{
  const tk = takeCard;
  takeCard = function(r, from){
    const before = new Set(S.bf.map(b => b.id)); const out = tk(r, from);
    try { const p = (S.c2wb || []).find(x => x.pid === from && r.c && x.k === r.c.k); if (p){ S.c2wb.splice(S.c2wb.indexOf(p), 1); const nc = S.bf.find(b => !before.has(b.id) && b.k === p.k); const w = S.bf.find(b => b.id === p.wb);
      if (nc && w) nc.r21by = w.id; else if (nc && !w){ log(`${cname(nc)} goes back (Willbreaker is gone)`); sendBack(nc, 'bf'); } commit(); } } catch (e){ console.warn(e); }
    return out; };
}

/* ---------- a granted "This creature can't be blocked." (Vronos −7) ---------- */
{
  const cb = canBlock;
  canBlock = function(b, a, apid){ const r = cb(b, a, apid); if (r || !a) return r; try { const e = l24eff(a, apid); if (e && (e.ab || []).some(x => /^this creature can't be blocked\.?$/i.test(String(x.t || x).trim()))) return "can't be blocked"; } catch {} return r; };
}

/* ---------- Comet, Stellar Pup: die results and extra loyalty activations ---------- */
{
  const lr = loyaltyReady;
  loyaltyReady = function(c, ab){ const r = lr(c, ab); try { if (r === 'Already used a loyalty ability this turn' && c && c.c2extra && c.c2extra.t === turnStr() && c.c2extra.n > 0){ const v = /X/.test(ab.cost) ? 0 : +ab.cost; if (v < 0 && (c.co || 0) < -v) return `Needs ${-v} loyalty`; c.lu = ''; const r2 = lr(c, ab); c.lu = turnStr(); return r2; } } catch {} return r; };
  const al = activateLoyalty;
  activateLoyalty = async function(c, i){ let used = false; try { if (c && c.lu === turnStr() && c.c2extra && c.c2extra.t === turnStr() && c.c2extra.n > 0){ c.lu = ''; used = true; } } catch {}
    const co0 = c ? c.co : 0; const r = await al(c, i);
    try { if (used){ if (c.lu === turnStr()){ c.c2extra.n--; log(`${cname(c)}: ${c.c2extra.n} extra activation${c.c2extra.n === 1 ? '' : 's'} left this turn`); } else c.lu = turnStr(); } } catch {} return r; };
}
async function c2Comet(ctx, r){
  const name = ctx.name || ''; const c = srcCardOf(ctx); const pw = c && S.bf.includes(c) ? c : null; const chg = d => { if (pw){ pw.co = Math.max(0, (pw.co || 0) + d); log(`${name}: loyalty ${d > 0 ? '+' : ''}${d} → ${pw.co}`); } };
  if (r <= 2){ chg(2); await doSentence('Create two 1/1 green Squirrel creature tokens', ctx); await doSentence('They gain haste until end of turn', ctx); }
  else if (r === 3){ chg(-1); const list = S.gy.filter(x => (+info(x.k)?.mv || 0) <= 2); if (list.length){ const ids = list.length === 1 ? [list[0].id] : await pickCards({title:`${name}: return a card with mana value 2 or less to your hand`, cards:list, min:1, max:1}); (ids || []).forEach(id => moveCard(id, 'hand')); } else log(`${name}: no card with mana value 2 or less in your graveyard`); }
  else if (r <= 5){ const n = pw ? (pw.co || 0) : 0; const opts = [];
    for (const p of players()) opts.push({label:p.me ? `${p.nm} (you)` : p.nm, value:'p|' + p.pid});
    for (const b of boardsAll()) for (const x of b.bf) if (x.k && isCreatureCard(x)) opts.push({label:`${cname(x)}${b.pid === MYPID ? ' (yours)' : ' (' + nameOf(b.pid) + ')'}`, value:'c|' + b.pid + '|' + x.id});
    const v = await askChoice({title:`${name}: deal ${n} damage to a creature or player`, options:opts});
    if (v){ const [kind, pid, id] = String(v).split('|'); const t = kind === 'p' ? {t:'player', pid} : (() => { const x = boardOf(pid).find(b => String(b.id) === id); return x ? {t:'card', pid, id:x.id, k:x.k, nm:cname(x)} : null; })(); if (t && n) dealDamage(t, n, ctx.k, pw); }
    chg(-2); }
  else { chg(1); if (pw){ pw.c2extra = {t:turnStr(), n:2}; log(`${name}: may activate a loyalty ability two more times this turn`); } }
  commit();
}

/* ---------- Out of Time: creatures phase out until it leaves the battlefield ---------- */
RQ_OPS.push('c2oot');
function c2OotOut(spid, sid){ const list = S.bf.filter(c => isCreatureCard(c)); list.forEach(c => { const i = S.bf.indexOf(c); if (i >= 0) S.bf.splice(i, 1); }); (S.c2oot ||= []).push({spid, sid, cards:list}); if (list.length) log(`${list.length} creature${list.length === 1 ? '' : 's'} phased out`); return list.length; }
function c2OotSync(){ if (!S || UI.dry || !(S.c2oot || []).length) return false; let ch = false;
  for (const e of S.c2oot.slice()){ const here = e.spid === MYPID ? S.bf.some(b => b.id === e.sid) : (OPP.has(e.spid) ? (OPP.get(e.spid).bf || []).some(b => b.id === e.sid) : true);
    if (!here){ S.c2oot.splice(S.c2oot.indexOf(e), 1); e.cards.forEach(c => S.bf.push(c)); if (e.cards.length) log(`${e.cards.length} creature${e.cards.length === 1 ? '' : 's'} phased in`); ch = true; } }
  return ch; }
{
  const ao = applyOp;
  applyOp = function(r, from){ if (r && r.op === 'c2oot'){ c2OotOut(from, +r.d || 0); commit(); return; } return ao(r, from); };
  setInterval(() => { try { if (c2OotSync()) commit(); } catch {} }, 1500);
}

/* ---------- Feather: the spell is exiled as it resolves and returns to hand at the next end step ---------- */
{
  const rt = resolveTop;
  resolveTop = async function(it){ try { if (it && it.c2feather) it.exAfter = true; } catch {} return rt(it); };
  const tg = toGrave;
  toGrave = function(c, it){ const r = tg(c, it); try { if (it && it.c2feather && c && S.ex.includes(c)){ S.dly.push({id:rid(6), eff:'C2 feather return.', k:it.c2featherK || c.k, nm:it.c2feather, srcId:c.id}); log(`${it.c2feather}: ${cname(c)} returns to your hand at the beginning of the next end step`); } } catch {} return r; };
}
/* ---------- Don't Make a Sound: "If they do, surveil 2" (the payer tells the caster) ---------- */
RQ_OPS.push('c2paid');
async function c2PaidUnless(){ const d = S.c2dmas; if (!d || Date.now() - d.ts > 120000) return; delete S.c2dmas; await runEffects(d.eff, {k:d.k, name:d.nm, full:d.eff, it:{kind:'ability'}, tgts:null}); commit(); }
{
  const rp = resolvePrompt;
  resolvePrompt = function(p, pay){ const before = S.prm.includes(p); const it = S.stk.find(x => x.sid === p.sid); const r = rp(p, pay);
    try { if (pay && before && p.type === 'unless' && !S.prm.includes(p) && p.from){ if (p.from === MYPID) c2PaidUnless(); else sendRq(p.from, 'c2paid', p.n || 0, it ? it.nm : '', {d:it ? String(it.k).slice(0, 80) : ''}); commit(); } } catch (e){ console.warn(e); }
    return r; };
  const ao = applyOp;
  applyOp = function(r, from){ if (r && r.op === 'c2paid'){ c2PaidUnless(); return; } return ao(r, from); };
}

/* ---------- the card most recently discarded (hand → graveyard) in this resolution ---------- */
{
  const mc = moveCard;
  moveCard = function(id, to, o = {}){ let rec = null; try { if (S && to === 'gy'){ const c = S.hand.find(x => x.id === id); if (c) rec = {id, k:c.k}; } } catch {} const r = mc(id, to, o); try { if (rec && S.gy.some(x => x.id === rec.id)) C2.disc = {...rec, at:Date.now()}; } catch {} return r; };
}
function c2RecentDisc(){ const d = C2.disc; return d && Date.now() - d.at < 15000 ? {id:d.id, k:d.k} : null; }

/* ---------- "Sacrifice one or more <things>" as an activation cost (Radiant Lotus) ---------- */
{
  const pp = payPart;
  payPart = async function(p, c){ const m = String(p).toLowerCase().match(/^sacrifice one or more (.+?)$/);
    if (!m) return pp(p, c);
    const d = sing(m[1]); const list = S.bf.filter(b => !b.fd && descOk(b.k, d, {tok:b.tok}));
    if (!list.length){ toast(`You have no ${m[1]} to sacrifice`); return false; }
    const ids = await pickCards({title:`${cname(c)}: sacrifice one or more ${m[1]}`, cards:list, min:1, max:list.length}); if (!ids || !ids.length) return false;
    let n = 0; ids.forEach(id => { const b = S.bf.find(x => x.id === id); if (b){ sacrificeOne(b); n++; } }); UI.c2sacN = (UI.c2sacN || 0) + n; log(`sacrificed ${n} ${m[1]} for ${cname(c)}`); return true; };
  const aa = activateAbility;
  activateAbility = async function(c, ab){ UI.c2sacN = 0; const n0 = S.stk.length; try { return await aa(c, ab); } finally { try { if (UI.c2sacN){ const it = S.stk.slice(n0).find(x => x.srcId === (c && c.id)); if (it) it.n24sacN = UI.c2sacN; } } catch {} UI.c2sacN = 0; } };
}
/* ---------- "As ~ enters, choose a player" + P/T from that player's graveyard: a provisional choice so it doesn't die while the player chooses ---------- */
{
  const oe = onEnter;
  onEnter = function(c, from, o){ const r = oe(c, from, o); try { if (c && S.bf.includes(c) && !c.u25player && /As ~ enters, choose a player\./i.test(tname(info(c.k)?.o || '', info(c.k)?.n || '')) && /equal to the number of cards in the chosen player's graveyard/i.test(info(c.k)?.o || '')) c.u25player = (opponents()[0] || {}).pid || MYPID; } catch {} return r; };
}

{ const co = countOf; countOf = function(phrase, ctx){ try { if (/^cards in the chosen player's graveyard$/.test(String(phrase || '').trim().toLowerCase())){ const c = ctx && ctx.srcId != null ? S.bf.find(b => b.id === ctx.srcId) : null; const pid = c && c.u25player; if (!pid) return 0; return pid === MYPID ? S.gy.length : ((OPP.get(pid) || {}).gy || []).length; } } catch {} return co(phrase, ctx); }; }

/* ---------- Gollum: remember which players a creature named Gollum dealt combat damage to ---------- */
{
  const he = handleEvent;
  handleEvent = function(pid, ev){ he(pid, ev); try { if (S && ev && ev.type === 'cdmg' && ev.dp && ev.k && /^Gollum, Obsessed Stalker$/.test(info(ev.k)?.n || '')){ S.c2gol = S.c2gol || {}; S.c2gol[ev.dp] = 1; } } catch {} };
}
/* ---------- Tanuki Transplanter: "~ or equipped creature attacks"; Orvar: discarded by an opponent's spell or ability ---------- */
{
  const ct = classifyTrig;
  classifyTrig = function(w, c){ const cc = String(c || '').trim();
    if (/^~ or equipped creature attacks$/.test(cc)) return {ev:'attack', subj:'any', ctl:'you', desc:'', qf:(src, ev, pid) => { if (pid !== MYPID || !src) return false; if (ev.id === src.id) return true; const me = S.bf.find(b => b.id === src.id); return !!(me && me.att && me.att.pid === MYPID && me.att.id === ev.id); }};
    if (/^a spell or ability an opponent controls causes you to discard ~$/.test(cc)) return {ev:'c2orvar', subj:'self', ctl:'you', desc:''};
    return ct(w, c); };
  const acp = addChoicePrompt;
  addChoicePrompt = function(kind, desc, n, from, src){ const k0 = UI.c2oppDisc; if (kind === 'discard' && from && from !== MYPID) UI.c2oppDisc = from; try { return acp(kind, desc, n, from, src); } finally { UI.c2oppDisc = k0; } };
  const fc = finishChoice;
  finishChoice = function(p, ids){ const k0 = UI.c2oppDisc; if (p && p.type === 'discard' && p.from && p.from !== MYPID) UI.c2oppDisc = p.from; try { return fc(p, ids); } finally { UI.c2oppDisc = k0; } };
  const mc = moveCard;
  moveCard = function(id, to, o = {}){ let c = null; try { if (S && to === 'gy' && UI.c2oppDisc) c = S.hand.find(x => x.id === id) || null; } catch {} const r = mc(id, to, o);
    try { if (c && S.gy.includes(c) && !UI.dry){ const t = trigsOf(c.k, false).find(x => x.ev === 'c2orvar'); if (t){ log(`${cname(c)} was discarded by ${nameOf(UI.c2oppDisc)}'s effect`); pushTrigger({k:c.k, id:c.id, fl:false, gone:true}, t, {type:'c2orvar', k:c.k, id:c.id}, UI.c2oppDisc); } } } catch (e){ console.warn(e); }
    return r; };
}

/* ---------- Quandrix, the Proof: instants and sorceries cast from hand have cascade ---------- */
{
  const ctg = castTriggers; castTriggers = function(c, a, it){ const r = ctg(c, a, it);
    try { if (it && it.from === 'hand' && /\b(Instant|Sorcery)\b/.test(a && a.t || info(c.k)?.t || '')){ const mv = it.mv || (a && a.mv) || 0;
      rulesOn('c2handCasc').forEach(x => pushTrig(x.src, 'Exile cards from the top until a nonland card with lower mana value; you may cast it free (cascade).', {k:c.k, cmv:mv})); } } catch (e){ console.warn('c2 cascade', e); }
    return r; };
}

async function doRound26C2Pre(s, l, ctx){
  let m; const name = ctx.name || '';
  // Sanctum of All
  if (/^(?:you may )?search your library and\/or graveyard for an? shrine card and put it onto the battlefield$/.test(l)){
    const list = S.lib.filter(c => /\bShrine\b/.test(info(c.k)?.t || '')).concat(S.gy.filter(c => /\bShrine\b/.test(info(c.k)?.t || '')));
    ctx.c2libSearch = true; if (UI.dry || !list.length){ if (!UI.dry) log(`${name}: no Shrine card found`); return true; }
    const ids = await pickCards({title:`${name}: put a Shrine card onto the battlefield (library or graveyard)`, cards:list, min:0, max:1, noneLabel:'None'});
    const c = ids && ids.length ? list.find(x => x.id === ids[0]) : null;
    if (c){ ctx.c2libSearch = S.lib.includes(c); moveCard(c.id, 'bf'); log(`${name}: put ${cname(c)} onto the battlefield`); }
    commit(); return true; }
  if (/^if you search your library this way, shuffle$/.test(l)){ if (ctx.c2libSearch && !UI.dry) shuffleLib(); return true; }
  // Captain America / Botanical Brawler (the "first time" condition is checked when the ability triggers)
  if (/^if it's the first time \+1\/\+1 counters have been put on that permanent this turn, put a \+1\/\+1 counter on (?:this creature|~)$/.test(l)){
    const c = srcCardOf(ctx); if (c && S.bf.includes(c)){ modCounters(c, 'cp', 1); log(`${name}: +1/+1 counter`); commit(); } return true; }
  // The Master, Transcendent
  if (/^put target creature card in a graveyard that was milled this turn onto the battlefield under your control$/.test(l)){
    const t = c2Tg(ctx).find(x => x.t === 'card' || x.t === 'gy'); if (!t) return true;
    if (!c2MilledNow(t)){ log(`${name}: ${t.nm || 'that card'} wasn't milled this turn — no effect`); ctx.c2master = false; return true; }
    if (t.pid === MYPID){ const c = c2MyGy(t); if (c){ moveCard(c.id, 'bf'); const b = S.bf.find(x => x.id === c.id); if (b){ l24addMod(b, {s:name, u:'', crSub:['Mutant'], col:'G', pt:[3, 3]}); log(`${name}: ${cname(b)} returns as a green 3/3 Mutant`); } } }
    else { sendRq(t.pid, 'jGyTake', 0, name, {d:'c2m=1|' + t.k}); log(`${name}: takes ${t.nm} from ${nameOf(t.pid)}'s graveyard`); }
    ctx.c2master = true; commit(); return true; }
  if (/^it's a green mutant with base power and toughness 3\/3$/.test(l) && ctx.c2master !== undefined) return true;
  // The Pride of Hull Clade
  if ((m = s.match(/^until end of turn, target creature you control gets \+1\/\+0, gains "Whenever (?:this creature|[^"]+?) deals combat damage to a player, draw cards equal to its toughness,?" and can attack as though it didn't have defender$/i))){
    const t = c2Tg(ctx)[0]; const c = t && t.pid === MYPID ? S.bf.find(b => b.id === t.id) : null; if (!c) return true;
    applyTo(t, {op:'pump', src:name, f:{p:1, t:0}}); l24addMod(c, {s:name, u:'e' + turnStr(), ab:['Whenever this creature deals combat damage to a player, draw cards equal to its toughness.']}); c.g23def = turnStr();
    log(`${name}: ${cname(c)} gets +1/+0, draws on combat damage and can attack despite defender this turn`); commit(); return true; }
  if (/^draw cards equal to its toughness$/.test(l)){ const c = srcCardOf(ctx); const n = c ? Math.max(0, (stats(c) || [0, 0])[1]) : 0; if (n) draw(n); log(`${name}: drew ${n}`); commit(); return true; }
  // Blitzball Stadium
  if (/^support x$/.test(l)){ const sc = srcCardOf(ctx); const x = (ctx.it && (ctx.it.x || ctx.it.evX)) || (sc && sc.xv) || 0; if (x) await doSentence(`Support ${x}`, ctx); else log(`${name}: support 0`); return true; }
  if ((m = s.match(/^until end of turn, target creature gains "Whenever (?:this creature|[^"]+?) deals combat damage to a player, draw a card for each kind of counter on it" and it can't be blocked this turn$/i))){
    const t = c2Tg(ctx)[0]; if (!t) return true; const c = l24card(t); if (!c) return true;
    if (t.pid === MYPID){ l24addMod(c, {s:name, u:'e' + turnStr(), ab:['Whenever this creature deals combat damage to a player, draw a card for each kind of counter on it.']}); c.ekw = [...new Set([...(c.ekw || []), 'unblockable'])]; }
    else return false;
    log(`${name}: ${cname(c)} can't be blocked and draws on combat damage this turn`); commit(); return true; }
  if (/^draw a card for each kind of counter on it$/.test(l)){ const c = srcCardOf(ctx); const n = c ? r21aKinds(c).length : 0; if (n) draw(n); log(`${name}: ${n} kind${n === 1 ? '' : 's'} of counter — drew ${n}`); commit(); return true; }
  // Radiant Lotus
  if (/^target player adds three mana of the chosen color for each artifact sacrificed this way$/.test(l)){
    const n = 3 * ((ctx.it && (ctx.it.n24sacN || (ctx.it.n24sacd || []).length)) || (UI.dry ? 1 : 0)); const col = ctx.chosenColor || ctx.color || ctx.col || 'G';
    const t = c2Tg(ctx).find(x => x.t === 'player') || {pid:MYPID};
    if (t.pid === MYPID){ if (n && !UI.dry) addMana([...col.repeat(n)]); log(`${name}: added ${n} {${col}}`); }
    else { sendRq(t.pid, 'c2mana', n, name, {d:col}); log(`${name}: ${nameOf(t.pid)} adds ${n} {${col}}`); }
    commit(); return true; }
  // Sewer Nemesis
  if (/^that player mills a card$/.test(l) && ctx.it && ctx.it.evPid && /whenever the chosen player casts a spell/i.test(info(ctx.k)?.o || '')){
    const pid = ctx.it.evPid; if (pid === MYPID) mill(1); else sendRq(pid, 'mill', 1, name); log(`${name}: ${nameOf(pid)} mills a card`); commit(); return true; }
  // Requiem Monolith
  if ((m = s.match(/^until end of turn, target creature gains "Whenever (?:this creature|[^"]+?) is dealt damage, you draw (?:that many|\d+) cards and lose that much life\.?"(\.? That creature's controller may have .+? deal 1 damage to it)?$/i))){
    const t = c2Tg(ctx)[0]; ctx.c2reqT = t || null; const mod = {ab:['Whenever this creature is dealt damage, you draw that many cards and lose that much life.'], u:'e' + turnStr()};
    if (UI.dry){ for (const q of mod.ab){ const miss = await l24checkQuoted(q.replace(/this creature/g, "~"), ctx); miss.forEach(x => UI.dry.push(x)); } return true; }
    if (t){ l24modTo(t, mod, name); log(`${name}: ${t.nm || 'that creature'} draws and loses life when dealt damage this turn`); }
    if (m[1]) await doSentence("That creature's controller may have this artifact deal 1 damage to it", ctx);
    commit(); return true; }
  if (/^you draw that many cards and lose that much life$/.test(l)){ const n = (ctx.it && (ctx.it.evN || ctx.it.evAmt)) || 0; if (n){ draw(n); S.life -= n; } log(`${name}: drew ${n} and lost ${n} life`); commit(); return true; }
  if (/^that creature's controller may have (?:this artifact|~|.+?) deal 1 damage to it$/.test(l) && ctx.c2reqT !== undefined){
    const t = ctx.c2reqT; if (!t || UI.dry) return true; const sc = srcCardOf(ctx);
    if (t.pid === MYPID){ const c = S.bf.find(b => b.id === t.id); if (c && await askYes(`${name}: have it deal 1 damage to ${cname(c)}?`, 'Deal 1', 'No')) dealDamage(t, 1, ctx.k, sc); }
    else if (await r22ask(t.pid, `${name}: have it deal 1 damage to ${t.nm || 'your creature'}?`, name)) dealDamage(t, 1, ctx.k, sc);
    commit(); return true; }
  // Golden Argosy
  if (/^exile each creature that crewed it this turn$/.test(l)){
    const sc = srcCardOf(ctx); const ids = sc && sc.qCrewT === turnStr() ? (sc.qCrewers || []) : []; const list = ids.map(id => S.bf.find(b => b.id === id)).filter(Boolean);
    list.forEach(c => moveCard(c.id, 'ex', {quiet:true})); ctx.lastT = list.map(c => ({t:'card', pid:MYPID, id:c.id, k:c.k, nm:cname(c)})); ctx.lastEx = list.map(c => c.id);
    log(`${name}: exiled ${list.length ? list.map(cname).join(', ') : 'nothing'}`); commit(); return true; }
  // Mighty Servant of Leuk-o
  if ((m = l.match(/^if it was crewed by exactly two creatures, (.+)$/))){ const sc = srcCardOf(ctx); const n = sc && sc.qCrewT === turnStr() ? (sc.qCrewers || []).length : 0;
    if (n === 2 || UI.dry) await doSentence(cap(s.slice(s.length - m[1].length)), ctx); else log(`${name}: crewed by ${n} creature${n === 1 ? '' : 's'}, not exactly two`); return true; }
  // Vronos
  if (/^up to two other target planeswalkers you control phase out at the beginning of the next end step$/.test(l)){
    const ts = c2Tg(ctx).filter(t => t.pid === MYPID); ts.forEach(t => S.dly.push({id:rid(6), eff:'C2 phase out.', k:ctx.k, nm:name, srcId:t.id}));
    if (ts.length) log(`${name}: ${ts.map(t => t.nm).join(', ')} will phase out at the beginning of the next end step`); commit(); return true; }
  if (/^c2 phase out$/.test(l)){ const c = ctx.srcId != null ? S.bf.find(b => b.id === ctx.srcId) : null; if (c) r23IPhaseOut(single(c)); commit(); return true; }
  if ((m = s.match(/^target artifact you control becomes a 9\/9 construct artifact creature and gains vigilance, indestructible, and "(?:this creature|[^"]+?) can't be blocked\.?"$/i))){
    const t = c2Tg(ctx)[0]; const c = t && t.pid === MYPID ? S.bf.find(b => b.id === t.id) : null; if (!c) return true;
    l24addMod(c, {s:name, u:'', addC:['Artifact', 'Creature'], crSub:['Construct'], pt:[9, 9], kw:['vigilance', 'indestructible'], ab:["This creature can't be blocked."]});
    log(`${name}: ${cname(c)} becomes a 9/9 Construct artifact creature with vigilance, indestructible and can't be blocked`); commit(); return true; }
  // Firkraag
  if (/^if that creature had to attack this combat, you put a \+1\/\+1 counter on (?:~|[a-z ,'\-]+?) and you draw a card$/.test(l)){
    const it = ctx.it || {}; const pid = it.evPid || MYPID; const c = it.evId != null ? boardOf(pid).find(b => b.id === it.evId) : null;
    const had = UI.dry || !!(c && (mustAttack(c) || c.goad || c.c2had === turnStr()));
    if (!had){ log(`${name}: that creature didn't have to attack`); return true; }
    const me = srcCardOf(ctx); if (me && S.bf.includes(me)) modCounters(me, 'cp', 1); draw(1); log(`${name}: +1/+1 counter and drew a card`); commit(); return true; }
  // Willbreaker
  if (/^gain control of that creature for as long as you control (?:~|this creature|[a-z ,'\-]+?)$/.test(l) && ctx.it && (ctx.it.evId != null || UI.dry)){
    if (UI.dry) return true; const it = ctx.it; const pid = it.evDp || it.evPid; const w = srcCardOf(ctx);
    if (!pid || pid === MYPID || !w || !S.bf.includes(w)) return true; const c = boardOf(pid).find(b => b.id === it.evId); if (!c) return true;
    (S.c2wb ||= []).push({wb:w.id, pid, k:c.k}); applyTo({t:'card', pid, id:c.id, k:c.k}, {op:'steal', src:name, f:{}}); log(`${name}: gaining control of ${nameOf(pid)}'s ${cname(c)}`); commit(); return true; }
  // Comet
  if (/^roll a six-sided die$/.test(l) && /^1 or 2 — \[\+2\]/m.test(info(ctx.k)?.o || '') && !ctx.c2roll){
    ctx.c2roll = 1; try { await doSentence(s, ctx); } finally { delete ctx.c2roll; } if (UI.dry || !ctx.roll) return true; await c2Comet(ctx, ctx.roll); return true; }
  // Out of Time
  // engine26z implements "phase out until ~ leaves" (Out of Time / Oubliette) generally: step aside when it is loaded
  if (/^(?:then )?those creatures phase out until (?:~|this enchantment|[a-z ,'\-]+?) leaves the battlefield$/.test(l) && typeof zPhaseOutLocal !== 'function'){
    const sc = srcCardOf(ctx); if (!sc || UI.dry){ ctx.c2ootN = UI.dry ? 2 : 0; return true; }
    let n = c2OotOut(MYPID, sc.id);
    for (const p of opponents()){ const o = OPP.get(p.pid); n += (o && o.bf || []).filter(b => b.k && !b.fd && isCreatureCard(b)).length; sendRq(p.pid, 'c2oot', 0, name, {d:String(sc.id)}); }
    ctx.c2ootN = n; log(`${name}: ${n} creature${n === 1 ? '' : 's'} phase out until it leaves the battlefield`); commit(); return true; }
  if (/^put a time counter on (?:~|this enchantment|[a-z ,'\-]+?) for each creature that phased out this way$/.test(l) && ctx.c2ootN != null){
    const sc = srcCardOf(ctx); if (sc && S.bf.includes(sc) && ctx.c2ootN) addNamed(sc, 'time', ctx.c2ootN); log(`${name}: ${ctx.c2ootN} time counters`); commit(); return true; }
  // Feather
  if (/^exile that card instead of putting it into your graveyard as it resolves$/.test(l)){
    const k = ctx.it && ctx.it.evk; const it = k ? S.stk.filter(x => x.kind === 'spell' && x.card && x.card.k === k).pop() : null;
    if (it){ it.c2feather = name; it.c2featherK = ctx.k; ctx.c2feath = true; log(`${name}: ${it.nm} will be exiled as it resolves`); } else ctx.c2feath = false; commit(); return true; }
  if (/^if you do, return it to your hand at the beginning of the next end step$/.test(l) && ctx.c2feath !== undefined) return true;
  if (/^c2 feather return$/.test(l)){ const c = ctx.srcId != null ? S.ex.find(x => x.id === ctx.srcId) : null; if (c){ moveCard(c.id, 'hand'); log(`${name}: returned ${cname(c)} to hand`); } commit(); return true; }
  // Don't Make a Sound
  if ((m = l.match(/^if they do, (surveil \d+)$/)) && /counter target spell unless its controller pays/i.test(info(ctx.k)?.o || '')){
    S.c2dmas = {ts:Date.now(), eff:cap(m[1]), k:ctx.k, nm:name}; return true; }
  // "When you discard a card this way, …" (The Ancient One): the reflexive part sees the card just discarded
  if ((m = l.match(/^when you discard a card this way, (.+)$/))){
    const c = (ctx.discCards || []).slice(-1)[0] || ctx.g23disc || c2RecentDisc();
    if (c || UI.dry){ const mv = c ? (+info(c.k)?.mv || 0) : 0; ctx.lastMV = mv; await doSentence(cap(s.slice(s.length - m[1].length).replace(/equal to that card's mana value/i, `equal to ${mv}`)), ctx); }
    return true; }
  // Gollum, Obsessed Stalker
  if ((m = l.match(/^each opponent dealt combat damage this game by a creature named (.+?) loses life equal to the amount of life you gained this turn$/))){
    const n = UI.dry ? 1 : lifeT().g; const hit = opponents().filter(p => (S.c2gol || {})[p.pid]);
    if (n) hit.forEach(p => loseLife(p.pid, n, name)); log(`${name}: ${hit.length ? hit.map(p => p.nm).join(', ') + ' lose' + (hit.length === 1 ? 's' : '') + ' ' + n + ' life' : 'no opponent has been dealt combat damage by Gollum'}`); commit(); return true; }
  // Tanuki Transplanter
  if (/^add an amount of \{g\} equal to its power$/.test(l)){ const id = ctx.it && ctx.it.evId; const c = (id != null ? S.bf.find(b => b.id === id) : null) || srcCardOf(ctx); const n = c ? Math.max(0, (stats(c) || [0])[0]) : 0;
    if (n && !UI.dry) addMana(Array(n).fill('G')); log(`${name}: added ${n} {G}`); commit(); return true; }
  // Breath of Fury
  if (/^sacrifice it and attach (?:~|this aura|[a-z ,'\-]+?) to a creature you control$/.test(l) && /when enchanted creature deals combat damage to a player/i.test(info(ctx.k)?.o || '')){
    const a = srcCardOf(ctx); ctx.c2bof = false; if (!a || !a.att || a.att.pid !== MYPID) return true; const h = S.bf.find(b => b.id === a.att.id);
    const others = S.bf.filter(b => b !== h && !b.fd && isCreatureCard(b)); let n = null;
    if (others.length && !UI.dry){ const ids = others.length === 1 ? [others[0].id] : await pickCards({title:`${name}: attach to a creature you control`, cards:others, min:1, max:1}); n = ids && ids.length ? S.bf.find(b => b.id === ids[0]) : null; }
    if (n) a.att = {pid:MYPID, id:n.id};
    if (h){ sacrificeOne(h); log(`${name}: sacrificed ${cname(h)}`); }
    if (n){ ctx.c2bof = true; log(`${name}: attached to ${cname(n)}`); } commit(); return true; }
  if ((m = l.match(/^if you do, (untap all creatures you control and after this phase, there is an additional combat phase)$/)) && ctx.c2bof !== undefined){ if (ctx.c2bof || UI.dry) await doSentence(cap(m[1]), ctx); return true; }
  // Auspicious Starrix
  if (/^exile cards from the top of your library until you exile x permanent cards, where x is the number of times (?:~|this creature|[a-z ,'\-]+?) has mutated$/.test(l)){
    const c = srcCardOf(ctx); const x = UI.dry ? 1 : (c && c.qMutObjs ? c.qMutObjs.length : 0); const got = []; const out = [];
    while (S.lib.length && got.length < x){ const t = S.lib.shift(); S.ex.push(t); out.push(t); if (typesOf(t.k).some(y => /^(artifact|creature|enchantment|land|planeswalker|battle)$/i.test(y))) got.push(t); }
    ctx.c2starrix = got.map(t => t.id); if (out.length) log(`${name}: exiled ${out.map(cname).join(', ')} (${got.length} permanent card${got.length === 1 ? '' : 's'}, X = ${x})`); commit(); return true; }
  if (/^put those permanent cards onto the battlefield$/.test(l) && ctx.c2starrix){ ctx.c2starrix.forEach(id => { if (S.ex.some(c => c.id === id)) moveCard(id, 'bf'); }); commit(); return true; }
  // Narset −2
  if ((m = l.match(/^when you discard a nonland card this way, (.+)$/))){
    const c = (ctx.discCards || []).slice(-1)[0] || ctx.g23disc || c2RecentDisc();
    if (UI.dry || (c && !isLand(c.k))){ const mv = c ? (+info(c.k)?.mv || 0) : 2; ctx.lastMV = mv;
      const rest = s.slice(s.length - m[1].length).replace(/deals damage equal to that card's mana value to/i, `deals ${mv} damage to`);
      await doSentence(cap(rest), ctx); }
    return true; }
  // Kira: counter the spell or ability that targeted it for the first time this turn
  if (/^counter that spell or ability$/.test(l) && ctx.it && (ctx.it.evPid || UI.dry)){
    if (UI.dry) return true; const by = (S.c2tgBy || {})[ctx.it.evId]; if (by) ctx.it.evPid = by; const nm = info(ctx.it.evk)?.n || '';
    const x = stackAll().filter(i => i.pid === ctx.it.evPid && i.tgtNm && nm && i.tgtNm.includes(nm)).pop() || stackAll().filter(i => i.pid === ctx.it.evPid).pop();
    if (!x){ log(`${name}: it already left the stack`); return true; } m24Counter(x, ctx, 0); return true; }
  // Teyo −2
  if (/^until your next turn, each player may attack only the nearest opponent in the last chosen direction and planeswalkers controlled by that opponent$/.test(l)){
    const dir = ctx.chosen === 'right' ? 'right' : 'left'; S.c2teyo = {dir, u:'n' + MYPID + '|' + turnStr(), ts:Date.now()};
    log(`${name}: until your next turn, each player may attack only the nearest opponent to the ${dir}`); commit(); return true; }
  // Enhanced Surveillance
  if ((m = l.match(/^surveil (\d+|x|one|two|three|four)$/)) && !ctx.c2surv){
    const k = rulesOn('c2surv').length; if (!k) return false;
    const n = await numOf(m[1], ctx, 'surveil'); ctx.c2surv = 1; log(`Enhanced Surveillance: looking at ${2 * k} more`);
    try { await doSentence(`Surveil ${n + 2 * k}`, ctx); } finally { delete ctx.c2surv; } return true; }
  // The Ancient One: mill equal to the discarded card's mana value
  if (/^target player mills cards equal to its mana value$/.test(l)){
    const c = (ctx.discCards || []).slice(-1)[0] || c2RecentDisc(); const n = c ? (+info(c.k)?.mv || 0) : 0; const t = c2Tg(ctx).find(x => x.t === 'player');
    if (t && n){ if (t.pid === MYPID) mill(n); else sendRq(t.pid, 'mill', n, name); log(`${name}: ${nameOf(t.pid)} mills ${n}`); } commit(); return true; }
  return false;
}
{
  const ds = doSentence;
  doSentence = async function(s0, ctx){ const s = String(s0).replace(/\.$/, '').trim(); const l = s.toLowerCase();
    if (l && await doRound26C2Pre(s, l, ctx)) return;
    if (/\bflip\b.*\bcoins?\b|\bcoin flip/.test(l)) return c2Flip(() => ds(s0, ctx));
    return ds(s0, ctx); };
}

/* ---------- cooperation with engine26z: "phase out until ~ leaves" puts several creatures under one ref (Out of Time),
   so phasing in must bring back every creature with that ref, not just the first ---------- */
if (typeof zPhaseInLocal === 'function'){
  const zpi = zPhaseInLocal;
  zPhaseInLocal = function(ref, tap){ let n = 0; while (n < 300 && (S.zpoz || []).some(x => x.ref === ref)){ zpi(ref, tap); n++; } if (!n) return zpi(ref, tap); };
}
