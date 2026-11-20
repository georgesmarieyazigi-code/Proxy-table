/* ===================== Rules engine — round 25 helper S: cross-player protocols ===================== */
// 1. delayed "this turn" / "until your next turn" triggers bound to a creature or a player (temporary emblems)
// 2. the attacker chooses how the defenders' creatures block (Odric, Brutal Hordechief, Master Warcraft)
// 3. join forces: starting with you, each player may pay any amount of mana (each on their own screen)
// 4. votes with any options (Selvala's Stampede and friends)
// 5. "target player's next end step", enchanted opponent's end step
// 6. "for each player, choose … that player controls" (Winnowing, Tragic Arrogance, The Eternal Wanderer…)
const S25 = {ans:{}};
EV_TYPES.push('r25cd');
RQ_OPS.push('r25mayEx', 'r25lifeDraw', 'r25payLife', 'r25noAtk', 'r25ban', 'r25dly', 'r25ans', 'r25blkCtl', 'r25blkSet', 'r25dmgAllX', 'r25pay', 'r25ramp', 'r25keep', 'r25atkSet');

/* ---------- generic cross-client question / answer ---------- */
async function r25remote(pid, op, src, extra, ms = 90000){
  if (UI.dry || !pid || pid === MYPID) return null;
  const ref = rid(6); sendRq(pid, op, 0, src, {ref, ...extra}); commit(); toast(`Waiting for ${nameOf(pid)}…`);
  const a = await waitUntil(() => S25.ans[ref], ms); return a || null;
}
function r25reply(to, r, d){ sendRq(to, 'r25ans', 0, r.src, {ref:r.ref, d:String(d)}); commit(); }

/* =================== 1. delayed triggers as temporary emblems =================== */
// the emblem's text is a normal trigger line; binding (creature ids / a player) lives on the emblem
function r25Bound(src){ const c = S.bf.find(b => b.id === src.id); return c && c.r25 ? c.r25 : null; }
function r25Classify(c){
  let m;
  const T = (ev, qf, extra = {}) => ({ev, subj:'any', ctl:'any', desc:'', qf, ...extra});
  const hit = (s, ev, pid) => { const b = r25Bound(s); return !!(b && (b.ids || []).some(x => x.id === ev.id && x.pid === pid)); };
  if ((m = c.match(/^(?:that creature|either of those creatures|those creatures|it|this creature) deals combat damage(?: to (a player or planeswalker|a player|an opponent))?$/))){
    const to = m[1] || '';
    // ev.x: 1 = a player, 2 = a planeswalker, 3 = a creature (events only carry a few numeric fields across clients)
    return T('r25cd', (s, ev, pid) => hit(s, ev, pid) && (!to || (to === 'a player or planeswalker' ? ev.x === 1 || ev.x === 2 : ev.x === 1 && (to !== 'an opponent' || ev.dp !== MYPID))));
  }
  if (/^(?:that creature|it) is dealt damage$/.test(c)) return T('qcdealt', hit);
  if (/^(?:that creature|it) deals damage$/.test(c)) return T('dmg', hit);
  // every card put into an opponent's graveyard (24q's batched zone-change event; one trigger per card)
  if (/^a card is put into an opponent's graveyard from anywhere$/.test(c)) return T('qtogy', (s, ev, pid) => pid !== MYPID && (ev.amt || 0) > 0, {qper:ev => ev.amt || 1});
  if (/^a creature you control deals combat damage to that player$/.test(c)) return T('cdmg', (s, ev, pid) => { const b = r25Bound(s); return pid === MYPID && !!b && !!ev.dp && ev.dp === b.pid; });
  return null;
}
{
  const tg = trigsOf;
  trigsOf = function(k, fl){
    if (!String(k || '').startsWith('r25:')) return tg(k, fl);
    const f = info(k); if (!f) return [];
    const out = [];
    const line = String(f.o || '').trim(); const cond = String(f.r25c || '').toLowerCase().trim();
    if (cond && line.toLowerCase().startsWith('whenever ' + cond + ', ')){
      const cl = r25Classify(cond) || classifyTrig('whenever', cond);
      if (cl) out.push({...cl, eff:line.slice(('whenever ' + cond + ', ').length).trim(), raw:line});
    }
    return out;
  };
}
function r25Delay(ctx, cond, eff, exp, bind){
  const nm = ctx.name || 'Delayed trigger';
  const text = `Whenever ${cond}, ${eff.replace(/\.?$/, '.')}`;
  const k = 'r25:' + norm(nm + '|' + text).slice(0, 90);
  if (!DICT.has(k)) DICT.set(k, {k, n:nm, m:'', t:'Emblem', o:text, p:'', img:'', c:'', back:null, toks:[], tok:true, cc:false, lay:'emblem', full:'', set:'', cn:'', pr:'', art:'', mv:0, ci:'', kw:[], r25c:cond});
  if (!trigsOf(k, false).length) return false;
  if (UI.dry) return true;
  const c = {id:S.nid++, k, tok:true, emb:true, n:1, r25:{...(bind || {}), exp, t:turnStr()}};
  place(c); S.bf.push(c);
  const until = exp === 'eot' ? 'this turn' : exp === 'next' ? 'until your next turn' : 'until the end of your next turn';
  log(`${nm}: ${until}, whenever ${cond}, ${short(eff, 80)}`); commit(); return true;
}
// expiry
{
  const tc = turnChanged;
  turnChanged = function(){
    const r = tc.apply(this, arguments);
    try {
      const now = turnStr(); const mine = currentTurn()[1] === MYPID;
      const drop = S.bf.filter(c => c.r25 && c.r25.exp && (
        (c.r25.exp === 'eot' && c.r25.t !== now) ||
        (c.r25.exp === 'next' && mine && c.r25.t !== now) ||
        (c.r25.exp === 'eonext' && c.r25.seen && c.r25.seen !== now)));
      S.bf.filter(c => c.r25 && c.r25.exp === 'eonext' && mine && c.r25.t !== now && !c.r25.seen).forEach(c => { c.r25.seen = now; });
      if (drop.length){ S.bf = S.bf.filter(c => !drop.includes(c)); drop.forEach(c => log(`${info(c.k)?.n || 'delayed trigger'}: effect ends`)); commit(); }
    } catch (e){ console.warn(e); }
    return r;
  };
}
// combat damage by a creature to anything (player, planeswalker, creature)
{
  const ad = attackerDamage;
  attackerDamage = async function(...a){ UI.r25cmb = (UI.r25cmb || 0) + 1; try { return await ad.apply(this, a); } finally { UI.r25cmb--; } };
  const dt = defenderTick;
  defenderTick = function(...a){ UI.r25cmb = (UI.r25cmb || 0) + 1; try { return dt.apply(this, a); } finally { UI.r25cmb--; } };
  const dd = dealDamage;
  dealDamage = function(t, n, srcK, srcCard, extra){
    const r = dd.apply(this, arguments);
    try {
      if (S && !UI.dry && UI.r25cmb > 0 && n > 0 && srcCard && srcCard.id != null && S.bf.includes(srcCard) && isCreatureCard(srcCard) && t){
        let tt = 'c', dp = '';
        if (t.t === 'player'){ tt = 'p'; dp = t.pid; }
        else { const tc = boardOf(t.pid).find(b => b.id === t.id); if (tc && /Planeswalker/.test(info(tc.k)?.t || '')) tt = 'pw'; dp = tt === 'pw' ? t.pid : ''; }
        emit({type:'r25cd', k:srcK || srcCard.k, id:srcCard.id, dp, x:tt === 'p' ? 1 : tt === 'pw' ? 2 : 3, amt:n, cnt:1});
      }
    } catch (e){ console.warn(e); }
    return r;
  };
}

/* =================== 2. a player chooses how creatures block (and attack) =================== */
// The controller (S.r25ctl = {t, must, atk}) tells everyone with r25blkCtl. Defenders stop declaring their own blocks; at the
// declare blockers step the controller's client asks, creature by creature, and sends each defender its block list (r25blkSet).
// Each defender re-checks legality on its own client (canBlock) and declares those blocks.
function r25Ctl(){ return S.r25ctl && S.r25ctl.t === turnStr() ? S.r25ctl : null; }
function r25CtlBy(){ const c = S.r25ctlBy; return c && c.t === turnStr() && c.pid !== MYPID ? c : null; }
function r25SendCtl(must, atk){
  const t = turnStr(); const prev = r25Ctl() || {};
  S.r25ctl = {t, must:!!(must || prev.must), atk:!!(atk || prev.atk)};
  opponents().forEach(p => sendRq(p.pid, 'r25blkCtl', (S.r25ctl.must ? 1 : 0) + (S.r25ctl.atk ? 2 : 0), 'block control', {d:t}));
  commit();
}
function r25Board(pid){ return pid === MYPID ? S.bf : (OPP.get(pid)?.bf || []); }
async function r25ChooseBlocks(pn){
  const ctl = r25Ctl(); if (!ctl) return;
  const atts = r25Board(pn.pid).filter(c => c.atk && c.k); if (!atts.length) return;
  const plan = {};
  const defs = [...new Set(atts.map(a => { const d = parseDef(a.atk); return d ? attackTargetProtector(d) : null; }).filter(Boolean))];
  for (const pid of defs){
    if (pid === pn.pid || (pid !== MYPID && !isLive(pid))) continue;
    const on = atts.filter(a => { const d = parseDef(a.atk); return d && attackTargetProtector(d) === pid; });
    const theirs = r25Board(pid).filter(b => b.k && !b.fd && isCreatureCard(b) && !b.tap);
    plan[pid] = [];
    for (const b of theirs){
      const opts = on.filter(a => !(kwOf(a, 'flying', pn.pid) && !kwOf(b, 'flying', pid) && !kwOf(b, 'reach', pid)) && !(pid === MYPID && canBlock(b, a, pn.pid)));
      if (!opts.length) continue;
      const choices = opts.map(a => ({label:`Block ${info(a.k)?.n || 'attacker'}`, value:String(a.id)}));
      if (!ctl.must) choices.push({label:'Doesn\'t block', value:''});
      const v = await askChoice({title:`You choose how ${pid === MYPID ? 'your' : nameOf(pid) + "'s"} ${info(b.k)?.n || 'creature'} blocks`, options:choices});
      const aid = v ? +v : (ctl.must ? opts[0].id : null);
      if (aid != null) plan[pid].push([b.id, aid]);
    }
  }
  for (const [pid, list] of Object.entries(plan)){
    if (pid === MYPID) r25ApplyBlocks(list, MYPID, pn.pid);
    else r25SendPairs(pid, 'r25blkSet', list, 'block control');
    log(`chose ${pid === MYPID ? 'their own' : nameOf(pid) + "'s"} blocks: ${list.length ? list.map(([b, a]) => `${info(r25Board(pid).find(x => x.id === b)?.k)?.n} → ${info(atts.find(x => x.id === a)?.k)?.n}`).join(', ') : 'no blocks'}`);
  }
  commit();
}
// lists of id pairs travel in chunks (a request's text field holds 80 characters); n = the total number of pairs
function r25SendPairs(pid, op, list, src){
  const parts = list.map(([a, b]) => `${a}:${b}`); const chunks = []; let cur = '';
  for (const p of parts){ if (cur && (cur + ',' + p).length > 78){ chunks.push(cur); cur = p; } else cur = cur ? cur + ',' + p : p; }
  chunks.push(cur);
  chunks.forEach((c, i) => sendRq(pid, op, list.length, src, {d:c, tid:i}));
}
function r25GotPairs(r, from){
  const key = from + '|' + r.op; S25.buf = S25.buf || {}; const b = S25.buf[key] = (S25.buf[key] && S25.buf[key].n === r.n && S25.buf[key].at > Date.now() - 20000) ? S25.buf[key] : {n:r.n, at:Date.now(), got:{}};
  b.got[r.tid || 0] = String(r.d || ''); const pairs = Object.values(b.got).join(',').split(',').filter(Boolean).map(x => { const i = x.indexOf(':'); return [x.slice(0, i), x.slice(i + 1)]; });
  if (pairs.length < (r.n || 0)) return null; delete S25.buf[key]; return pairs;
}
function r25ApplyBlocks(list, from, apid){
  const pn = phaseNow(); const cb = cbOf(pn); const atts = r25Board(apid || pn.pid);
  const ok = [];
  for (const [bid, aid] of list){ const b = S.bf.find(x => x.id === bid); const a = atts.find(x => x.id === aid); if (!b || !a) continue; if (canBlock(b, a, apid || pn.pid)) continue; ok.push([b, a]); }
  const cnt = {}; ok.forEach(([, a]) => { cnt[a.id] = (cnt[a.id] || 0) + 1; });
  const done = ok.filter(([, a]) => !(cnt[a.id] === 1 && hasMenace(a, apid || pn.pid) && (a.n || 1) === 1));
  done.forEach(([b, a]) => { b.blk = a.id; emit({type:'block', k:b.k, id:b.id}); });
  const who = from === MYPID ? 'chosen by themselves' : `chosen by ${nameOf(from)}`;
  log(done.length ? `blocks (${who}): ${done.map(([b, a]) => `${cname(b)} → ${info(a.k)?.n}`).join(', ')}` : `does not block (${who})`);
  if (cb) S.bd = cbKey(pn, cb); UI.blkSel = {}; commit();
}
// attacks chosen by another player (Master Warcraft cast on an opponent's turn)
async function r25ChooseAttacks(pn){
  const theirs = r25Board(pn.pid).filter(c => c.k && !c.fd && isCreatureCard(c) && !c.tap);
  const foes = players().filter(p => p.pid !== pn.pid);
  const list = [];
  for (const c of theirs){
    const v = await askChoice({title:`You choose whether ${nameOf(pn.pid)}'s ${info(c.k)?.n || 'creature'} attacks`, options:foes.map(p => ({label:`Attack ${p.me ? 'you' : p.nm}`, value:'p:' + p.pid})).concat([{label:'Doesn\'t attack', value:''}])});
    if (v) list.push([c.id, v]);
  }
  r25SendPairs(pn.pid, 'r25atkSet', list.map(([id, def]) => [id, def]), 'attack control'); log(`chose ${nameOf(pn.pid)}'s attackers (${list.length})`); commit();
}
function r25Suppressed(){ return !!r25CtlBy() || !!(r25Ctl() && !phaseNow().mine); }
{
  const ao = applyOp;
  applyOp = function(r, from){
    if (r.op === 'r25ans'){ S25.ans[r.ref] = String(r.d ?? ''); return; }
    if (r.op === 'r25blkCtl'){ S.r25ctlBy = {t:String(r.d || turnStr()), pid:from, must:!!(r.n & 1), atk:!!(r.n & 2)}; log(`${nameOf(from)} chooses which creatures ${r.n & 2 ? 'attack and ' : ''}block this turn`); commit(); return; }
    if (r.op === 'r25blkSet'){ const list = r25GotPairs(r, from); if (list) r25ApplyBlocks(list.map(([b, a]) => [+b, +a]), from, phaseNow().pid); return; }
    if (r.op === 'r25atkSet'){ const list0 = r25GotPairs(r, from); if (!list0) return; const list = list0.map(([id, def]) => [+id, def]); const pn = phaseNow(); if (!pn.mine || !S.cb || S.cb.step !== 'atk') return;
      UI.atkSel = {}; list.forEach(([id, def]) => { const c = S.bf.find(x => x.id === id); if (c && !canAttack(c)) UI.atkSel[id] = def; }); UI.r25atkOk = 1; try { declareAttackers(); } finally { UI.r25atkOk = 0; } return; }
    return ao(r, from);
  };
}
{
  // defenders don't declare their own blocks while another player chooses them
  const cfb = confirmBlocks;
  confirmBlocks = function(auto, ...a){ if (r25Suppressed()) return; return cfb.call(this, auto, ...a); };
  const mab = maybeAutoBlock;
  maybeAutoBlock = function(pn){ if (r25Suppressed()) return; return mab(pn); };
  const da = declareAttackers;
  declareAttackers = function(...a){ const by = r25CtlBy(); if (by && by.atk && !UI.r25atkOk){ toast(`${nameOf(by.pid)} chooses which creatures attack this turn`); return; } return da.apply(this, a); };
  const ct = combatTick;
  combatTick = function(){
    const r = ct.apply(this, arguments);
    try {
      const pn = phaseNow(); const cb = cbOf(pn); const c = r25Ctl();
      if (c && cb && !UI.dry){
        const key = cbKey(pn, cb);
        if (cb.step === 'blk' && S.r25done !== key){ S.r25done = key; commit(); r25ChooseBlocks(pn).catch(e => console.warn(e)); }
        if (c.atk && !pn.mine && cb.step === 'atk' && S.r25adone !== key){ S.r25adone = key; commit(); r25ChooseAttacks(pn).catch(e => console.warn(e)); }
      }
      // waiting defender: the controller's player left — fall back to normal blocking
      const by = r25CtlBy(); if (by && !isLive(by.pid)) S.r25ctlBy = null;
    } catch (e){ console.warn(e); }
    return r;
  };
}

/* =================== 3. join forces: each player may pay any amount of mana =================== */
function r25MaxPay(){ let max = 0; for (let n = 1; n <= 30; n++){ if (payPlan(parseCost(`{${n}}`), S.pool).err) break; max = n; } return max; }
async function r25PayAny(title){
  const max = r25MaxPay(); if (!max) return 0;
  const v = await askChoice({title:`${title} (up to ${max})`, options:Array.from({length:max + 1}, (_, i) => ({label:i ? `Pay {${i}}` : 'Pay nothing', value:String(i)}))});
  const n = +(v || 0); if (!n) return 0;
  const plan = payPlan(parseCost(`{${n}}`), S.pool); if (plan.err) return 0; S.pool = plan.pool; commit(); return n;
}
function r25Order(){ const ps = players(); const i = ps.findIndex(p => p.pid === MYPID); return ps.slice(i).concat(ps.slice(0, i)); }

/* =================== effects =================== */
async function doRound25SPre(s, l, ctx){
  let m; const name = ctx.name;
  const full = String(ctx.full || '').toLowerCase();
  const sOrig = String(s).replace(/\.$/, '');
  const effOf = (cut) => sOrig.slice(sOrig.length - cut.length);
  const bindT = () => { const g = (ctx.lastT || []).filter(t => t.t === 'card'); return g.map(t => ({pid:t.pid || MYPID, id:t.id})); };

  // ---- 1. delayed triggers bound to the creature(s) just chosen
  if ((m = l.match(/^whenever (that creature|either of those creatures|it) (deals combat damage(?: to (?:a player or planeswalker|a player|an opponent))?|is dealt damage|deals damage) this turn, (.+)$/))){
    const ids = bindT(); if (!ids.length && !UI.dry) return true;
    return r25Delay(ctx, `${m[1]} ${m[2]}`, effOf(m[3]), 'eot', {ids});
  }
  if ((m = l.match(/^until your next turn, whenever (either of those creatures|that creature|those creatures) (deals combat damage(?: to (?:a player or planeswalker|a player|an opponent))?|deals damage), (.+)$/))){
    const ids = bindT(); if (!ids.length && !UI.dry) return true;
    return r25Delay(ctx, `${m[1]} ${m[2]}`, effOf(m[3]), 'next', {ids});
  }
  // bound to a player
  if (/^choose target opponent$/.test(l)){ const t = nextTargets(ctx).find(x => x.t === 'player'); let pid = t && t.pid; if (!pid && !UI.dry) pid = await choosePlayer(`${name}: choose target opponent`, true); ctx.r25pid = pid || null; if (pid) log(`${name}: chose ${nameOf(pid)}`); return true; }
  if ((m = l.match(/^whenever a creature you control deals combat damage to (?:that|target) player this turn, (.+)$/))){
    let pid = ctx.r25pid; if (!pid){ const t = nextTargets(ctx).find(x => x.t === 'player'); pid = t && t.pid; }
    if (!pid && !UI.dry) return true;
    return r25Delay(ctx, 'a creature you control deals combat damage to that player', effOf(m[1]), 'eot', {pid});
  }
  // unbound: "until end of turn, whenever …" / "whenever … this turn" / "until the end of your next turn, whenever …" / "until your next turn, whenever …"
  for (const [re, exp] of [[/^until end of turn, whenever (.+)$/, 'eot'], [/^until the end of your next turn, whenever (.+)$/, 'eonext'], [/^until your next turn, whenever (.+)$/, 'next'], [/^whenever (.+)$/, 'eot']]){
    if (!(m = l.match(re))) continue;
    const rest = m[1]; let i = rest.indexOf(', ');
    while (i > 0){
      let cond = rest.slice(0, i); const eff = rest.slice(i + 2);
      if (exp === 'eot' && re.source === '^whenever (.+)$'){ if (!/ this turn$/.test(cond)){ i = rest.indexOf(', ', i + 2); continue; } cond = cond.replace(/ this turn$/, ''); }
      if (!/^(that|those|either|it)\b/.test(cond) && await r25DelayTry(ctx, cond, effOf(eff), exp)) return true;
      i = rest.indexOf(', ', i + 2);
    }
    break;
  }
  // Arcbond's delayed trigger effect
  if (/^it deals that much damage to each other creature and each player$/.test(l) && String(ctx.k || '').startsWith('r25:')){
    const n = (ctx.it && ctx.it.evN) || 0; const pid = ctx.it && ctx.it.evPid; const id = ctx.it && ctx.it.evId; if (!n) return true;
    const k = (boardOf(pid || MYPID).find(b => b.id === id) || {}).k || ctx.k;
    S.bf.filter(c => isCreatureCard(c) && !c.fd && !(pid === MYPID && c.id === id)).forEach(c => dealDamage({t:'card', pid:MYPID, id:c.id, k:c.k}, n, k, null));
    dealDamage({t:'player', pid:MYPID}, n, k, null);
    opponents().forEach(p => { sendRq(p.pid, 'r25dmgAllX', n, name, {d:p.pid === pid ? String(id) : ''}); sendRq(p.pid, 'pdmg', n, name, {f:{}}); });
    log(`${name}: ${n} damage to each other creature and each player`); commit(); return true;
  }
  if (/^choose up to (?:one|two|three) target creatures?$/.test(l) && /until your next turn, whenever (?:either of those creatures|that creature)/.test(full)){ nextTargets(ctx); return true; }
  if (/^cast ~ only before attackers are declared$/.test(l)) return true; // enforced in castCheck below
  // one-shot: "when you next cast a creature spell this turn, …" (Vivien, Monsters' Advocate)
  if ((m = l.match(/^when you next cast an? (creature|instant or sorcery|noncreature) spell this turn, (.+)$/))){
    return r25Delay(ctx, `you cast a ${m[1]} spell`, effOf(m[2]), 'eot', {once:1});
  }
  if (/^search your library for a creature card with lesser mana value, put it onto the battlefield, then shuffle$/.test(l) && ctx.it && ctx.it.evk){
    const mv = info(ctx.it.evk)?.mv || 0; if (mv < 1){ log(`${name}: nothing has lesser mana value than ${mv}`); return true; }
    await searchLibrary(`a creature card with mana value ${mv - 1} or less`, 'put it onto the battlefield, then shuffle', ctx); commit(); return true;
  }
  // ---- 2. block / attack control
  if (/^you choose which creatures block this (?:combat|turn) and how those creatures block$/.test(l)){ if (!UI.dry){ r25SendCtl(false, false); log(`${name}: ${nameOf(MYPID)} chooses which creatures block and how`); } return true; }
  if (/^creatures your opponents control block this turn if able, and you choose how those creatures block$/.test(l)){ if (!UI.dry){ r25SendCtl(true, false); log(`${name}: opponents' creatures block this turn if able, and ${nameOf(MYPID)} chooses how`); } return true; }
  if (/^you choose which creatures attack this turn$/.test(l)){ if (!UI.dry && !phaseNow().mine){ r25SendCtl(false, true); log(`${name}: ${nameOf(MYPID)} chooses which creatures attack this turn`); } return true; }

  // ---- 3. join forces
  if (/^(?:join forces — )?starting with you, each player may pay any amount of mana$/.test(l)){
    let total = 0; const parts = [];
    if (UI.dry){ ctx.r25jf = 0; return true; }
    for (const p of r25Order()){
      let n = 0;
      if (p.pid === MYPID) n = await r25PayAny(`${name}: join forces — pay any amount of mana`);
      else if (isLive(p.pid)){ const a = await r25remote(p.pid, 'r25pay', name, {}); n = Math.max(0, +(a || 0) || 0); }
      total += n; parts.push(`${p.me ? nameOf(MYPID) : p.nm} ${n}`);
    }
    ctx.r25jf = total; log(`${name}: join forces — ${parts.join(', ')} → ${total} mana`); commit(); return true;
  }
  if (/^each player draws x cards, where x is the total amount of mana paid this way$/.test(l)){ const n = ctx.r25jf || 0; if (n && !UI.dry){ draw(n); opponents().forEach(p => sendRq(p.pid, 'draw', n, name)); log(`${name}: each player draws ${n}`); } commit(); return true; }
  if (/^each player searches their library for up to x basic land cards, where x is the total amount of mana paid this way, puts them onto the battlefield tapped(?:, then shuffles)?$/.test(l)){
    const n = ctx.r25jf || 0; if (!n || UI.dry) return true;
    opponents().forEach(p => sendRq(p.pid, 'r25ramp', n, name));
    await searchLibrary(`up to ${n} basic land`, 'put them onto the battlefield tapped, then shuffle', ctx); commit(); return true;
  }

  // ---- 4. votes: Council's dilemma results (Selvala's Stampede)
  if ((m = l.match(/^reveal cards from the top of your library until you reveal a creature card for each (\w+) vote$/))){
    const n = UI.dry ? 1 : ((ctx.votes || {})[m[1]] || 0); const got = []; const rest = [];
    while (got.length < n && S.lib.length){ const c = S.lib[0]; if (isCreatureCard(c)) got.push(c); else rest.push(c); S.lib.shift(); S.ex.push(c); }
    log(`${name}: revealed ${got.length + rest.length} cards — ${got.length ? got.map(cname).join(', ') : 'no creatures'}`);
    ctx.r25rev = {got:got.map(c => c.id), rest:rest.map(c => c.id)}; commit(); return true;
  }
  if (/^put those creature cards onto the battlefield, then shuffle the rest into your library$/.test(l) && ctx.r25rev || /^put those creature cards onto the battlefield$/.test(l) && ctx.r25rev){
    ctx.r25rev.got.forEach(id => moveCard(id, 'bf'));
    if (/shuffle/.test(l) || /then shuffle the rest into your library/.test(full)){ ctx.r25rev.rest.forEach(id => { const i = S.ex.findIndex(c => c.id === id); if (i >= 0) S.lib.push(S.ex.splice(i, 1)[0]); }); shuffle(S.lib); ctx.r25shuf = 1; }
    commit(); return true;
  }
  if (/^shuffle the rest into your library$/.test(l) && ctx.r25rev){ if (!ctx.r25shuf){ ctx.r25rev.rest.forEach(id => { const i = S.ex.findIndex(c => c.id === id); if (i >= 0) S.lib.push(S.ex.splice(i, 1)[0]); }); shuffle(S.lib); } commit(); return true; }
  if ((m = l.match(/^you may put a permanent card from your hand onto the battlefield for each (\w+) vote$/))){
    const n = UI.dry ? 0 : ((ctx.votes || {})[m[1]] || 0);
    for (let i = 0; i < n; i++){ const list = S.hand.filter(c => isPermType(info(c.k)?.t)); if (!list.length) break; const ids = await pickCards({title:`${name}: put a permanent card from your hand onto the battlefield (${i + 1} of ${n})`, cards:list, min:0, max:1}); if (!ids || !ids[0]) break; moveCard(ids[0], 'bf'); }
    commit(); return true;
  }

  // ---- 5. end steps of a particular player
  if (/^you and that player each draw a card$/.test(l)){ const pid = (ctx.it && ctx.it.evPid) || (srcCardOf(ctx)?.att || {}).pid; if (!UI.dry){ draw(1); if (pid && pid !== MYPID) sendRq(pid, 'draw', 1, name); } commit(); return true; }
  if ((m = l.match(/^at the beginning of (?:that|target) player's next end step, (you draw a card if they didn't attack you that turn)$/))){
    const pid = ctx.r25pid || ctx.chosenPid || (ctx.lastT || []).find(t => t.t === 'player')?.pid;
    if (UI.dry) return true; if (!pid) return true;
    const eff = /otherwise, (.+?)\.?$/i.exec(String(ctx.full || '').split('\n').find(x => /that player's next end step/i.test(x)) || '');
    S.dly.push({id:rid(6), eff:'You draw a card if they didn\'t attack you that turn.' + (eff ? ' Otherwise, ' + eff[1] + '.' : ''), k:ctx.k, nm:name, srcId:ctx.srcId, op:'r25end', r25pid:pid});
    log(`${name}: at ${nameOf(pid)}'s next end step, draw a card if they didn't attack ${nameOf(MYPID)} that turn`); ctx.r25far = 1; commit(); return true;
  }
  if (/^otherwise, create three 1\/1 white human soldier creature tokens$/.test(l) && ctx.r25far) return true;
  if (/^you draw a card if they didn't attack you that turn$/.test(l)){ const pid = ctx.it && ctx.it.r25pid; const att = pid && (S.r25atkMe || {})[pid] === turnStr(); ctx.r25other = !!att; if (!att && !UI.dry) draw(1); if (!UI.dry) log(`${name}: ${nameOf(pid)} ${att ? 'attacked' : "didn't attack"} ${nameOf(MYPID)} this turn`); commit(); return true; }
  if ((m = l.match(/^otherwise, (create .+)$/)) && ctx.it && ctx.it.dop === 'r25end'){ if (ctx.r25other) await createFromText(cap(effOf(m[1])), ctx); return true; }
  if (/^choose an opponent$/.test(l) && /that player's next end step/.test(full)){ const pid = UI.dry ? null : await choosePlayer(`${name}: choose an opponent`, true); ctx.r25pid = pid; if (pid) log(`${name}: chose ${nameOf(pid)}`); return true; }
  // The Eternal Wanderer: return at the beginning of that player's (the owner's) next end step
  if (/^return that card to the battlefield under its owner's control at the beginning of (?:that|target) player's next end step$/.test(l)){
    const t = (ctx.lastT || []).find(x => x.t === 'card'); if (!t || UI.dry) return true;
    if (!t.pid || t.pid === MYPID){ S.dly.push({id:rid(6), eff:'(delayed) return to bf', k:ctx.k, nm:name, srcId:t.id, op:'r16ret', where:'bf', r25pid:MYPID}); }
    else sendRq(t.pid, 'r25dly', 0, name, {tid:t.id, d:String(ctx.k || '').slice(0, 80)});   // ids above 999 don't fit n; k isn't a request field
    log(`${name}: ${t.nm || 'that card'} returns at the beginning of ${nameOf(t.pid || MYPID)}'s next end step`); commit(); return true;
  }

  // ---- 6. for each player, (you) choose … that player controls; then each player sacrifices the rest
  if ((m = l.match(/^for each player, (?:you )?choose (a creature|from among the permanents (?:that|target) player controls an artifact, a creature, an enchantment, and a planeswalker)(?: (?:that|target) player controls)?$/))){
    const types = /^from among/.test(m[1]); ctx.r25keep = {};
    if (UI.dry) return true;
    for (const p of players()){
      const board = r25Board(p.pid).filter(c => c.k && !c.fd && !c.emb);
      const keep = [];
      if (types){
        for (const ty of ['Artifact', 'Creature', 'Enchantment', 'Planeswalker']){
          const of = board.filter(c => new RegExp('\\b' + ty + '\\b').test(info(c.k)?.t || '') && !keep.includes(c.id)); if (!of.length) continue;
          const ids = of.length === 1 ? [of[0].id] : await pickCards({title:`${name}: choose ${p.me ? 'your' : p.nm + "'s"} ${ty.toLowerCase()} to keep`, cards:of, min:1, max:1});
          keep.push((ids || [of[0].id])[0]);
        }
      } else {
        const of = board.filter(c => isCreatureCard(c)); if (of.length){ const ids = of.length === 1 ? [of[0].id] : await pickCards({title:`${name}: choose ${p.me ? 'your' : p.nm + "'s"} creature`, cards:of, min:1, max:1}); keep.push((ids || [of[0].id])[0]); }
      }
      ctx.r25keep[p.pid] = keep;
    }
    log(`${name}: chose for each player`); commit(); return true;
  }
  if ((m = l.match(/^(?:then )?each player sacrifices all (other creatures they control that don't share a creature type with the chosen creature they control|creatures they control not chosen this way|other nonland permanents they control)$/)) && (ctx.r25keep || UI.dry)){
    if (UI.dry) return true;
    const mode = /share a creature type/.test(m[1]) ? 'share' : /nonland/.test(m[1]) ? 'nonland' : 'cr';
    for (const p of players()){ const keep = ctx.r25keep[p.pid] || []; if (p.pid === MYPID) r25Keep(keep, mode, name); else if (isLive(p.pid)) sendRq(p.pid, 'r25keep', keep.length, name, {d:`${mode}|${keep.join(',')}`}); }
    commit(); return true;
  }
  // ---- 6b. graveyards of each player / each opponent (Breach the Multiverse, Sepulchral Primordial)
  if ((m = l.match(/^for each (player|opponent), (?:you may )?(choose a creature or planeswalker card in|put up to one target creature card from) (?:that|target) player's graveyard(?: onto the battlefield under your control)?$/))){
    const each = m[1] === 'player' ? players() : opponents(); const put = /^put/.test(m[2]); const d = put ? 'creature' : 'creature or planeswalker';
    ctx.r25gy = []; if (UI.dry) return true;
    if (/mills? (?:ten|\w+) cards/.test(full)) await waitUntil(() => false, 1500).catch(() => {}); // let the other players' mills arrive
    for (const p of each){
      const list = p.pid === MYPID ? S.gy.filter(c => descOk(c.k, d)) : (OPP.get(p.pid)?.gy || []).map((k, i) => ({id:-5000 - i, k})).filter(c => c.k && descOk(c.k, d));
      if (!list.length) continue;
      const ids = await pickCards({title:`${name}: ${put ? 'up to one creature card' : 'a creature or planeswalker card'} from ${p.me ? 'your' : p.nm + "'s"} graveyard`, cards:list, min:put ? 0 : 1, max:1, noneLabel:put ? 'None' : undefined});
      const c = list.find(x => x.id === (ids || [])[0]); if (c) ctx.r25gy.push({pid:p.pid, id:c.id, k:c.k});
    }
    if (put){ r25TakeGy(ctx.r25gy, name); ctx.r25gy = null; }
    commit(); return true;
  }
  if (/^put those cards onto the battlefield under your control$/.test(l) && ctx.r25gy){ r25TakeGy(ctx.r25gy, name); commit(); return true; }
  // ---- 6c. Disorienting Choice: each chosen permanent's controller may exile it
  if (/^for each opponent, choose up to one target artifact or enchantment (?:that|target) player controls$/.test(l)){
    ctx.r25dc = []; if (UI.dry) return true;
    for (const p of opponents()){ const list = (OPP.get(p.pid)?.bf || []).filter(c => c.k && !c.fd && /\b(Artifact|Enchantment)\b/.test(info(c.k)?.t || '')); if (!list.length) continue;
      const ids = await pickCards({title:`${name}: up to one artifact or enchantment ${p.nm} controls`, cards:list, min:0, max:1, noneLabel:'None'}); const c = list.find(x => x.id === (ids || [])[0]); if (c) ctx.r25dc.push({pid:p.pid, id:c.id, k:c.k}); }
    log(`${name}: chose ${ctx.r25dc.map(x => `${nameOf(x.pid)}'s ${info(x.k)?.n}`).join(', ') || 'nothing'}`); commit(); return true;
  }
  if (/^for each permanent chosen this way, its controller may exile it$/.test(l) && ctx.r25dc){
    let left = 0; if (UI.dry){ ctx.r25left = 1; return true; }
    for (const x of ctx.r25dc){ const a = await r25remote(x.pid, 'r25mayEx', name, {tid:x.id}); if (a !== '1') left++; }
    ctx.r25left = left; log(`${name}: ${left} chosen permanent${left === 1 ? '' : 's'} stayed on the battlefield`); commit(); return true;
  }
  if ((m = l.match(/^then if one or more of the chosen permanents are still on the battlefield, you search your library for up to (?:that many|\d+) land cards, put them onto the battlefield tapped(?:, then shuffle)?$/)) && ctx.r25left != null){
    const n = ctx.r25left; if (n && !UI.dry) await searchLibrary(`up to ${n} land`, 'put them onto the battlefield tapped, then shuffle', ctx); ctx.r25dcDone = 1; commit(); return true;
  }
  if (/^shuffle$/.test(l) && ctx.r25dcDone) return true;
  // ---- 6d. Mythos of Snapdax: with {B}{R} spent, the caster chooses for each player
  if (/^each player chooses an artifact, a creature, an enchantment, and a planeswalker from among the nonland permanents they control$/.test(l) && /you choose the permanents for each player instead/.test(full)){
    const sp = typeof n24spFor === 'function' ? n24spFor(ctx) : null; const br = !!(sp && sp.col && sp.col.B > 0 && sp.col.R > 0);
    if (!br || UI.dry) return false;
    ctx.r25myth = 1; log(`${name}: {B}{R} was spent — ${nameOf(MYPID)} chooses the permanents for each player`);
    await doRound25SPre('For each player, choose from among the permanents that player controls an artifact, a creature, an enchantment, and a planeswalker', 'for each player, choose from among the permanents that player controls an artifact, a creature, an enchantment, and a planeswalker', ctx);
    await doRound25SPre('Each player sacrifices all other nonland permanents they control', 'each player sacrifices all other nonland permanents they control', ctx);
    return true;
  }
  if (/^sacrifices the rest$/.test(l) && ctx.r25myth) return true;
  if (/^you choose the permanents for each player instead$/.test(l)) return true; // decided on the first sentence (needs {B}{R} spent)
  // ---- 7. "target opponent may have you draw …; if the player doesn't, …" (Combustible Gearhulk, Palantír of Orthanc)
  if ((m = l.match(/^(?:then )?target opponent may have you draw (a|one|two|three|four) cards?$/))){
    const n = wn(m[1]) || 1; let pid = (nextTargets(ctx).find(t => t.t === 'player') || {}).pid;
    if (!pid && !UI.dry) pid = await choosePlayer(`${name}: target opponent`, true);
    const yes = pid ? await r22ask(pid, `let ${nameOf(MYPID)} draw ${n} card${n === 1 ? '' : 's'}? If you don't, something worse happens (${short(full, 60)})`, name) : false;
    ctx.r25opp = {pid, yes}; ctx.oppPaid = yes;
    if (yes){ draw(n); log(`${name}: ${nameOf(pid)} lets ${nameOf(MYPID)} draw ${n}`); } else if (pid) log(`${name}: ${nameOf(pid)} refuses`);
    commit(); return true;
  }
  if ((m = l.match(/^you mill (a|one|two|three|four|five|x) cards?(?:, where x is the number of (\w+) counters on ~)?(?:, and (?:that|target) player loses life equal to the total mana value of those cards)?$/)) && ctx.r25opp){
    const c0 = srcCardOf(ctx); const n = m[1] === 'x' ? ((c0 && (c0.nc || {})[m[2]]) || 0) : (wn(m[1]) || 1);
    const before = new Set(S.gy.map(c => c.id)); if (n) mill(n);
    const mv = S.gy.filter(c => !before.has(c.id)).reduce((a, c) => a + (info(c.k)?.mv || 0), 0); ctx.r25mv = mv;
    if (/loses life equal/.test(l) && ctx.r25opp.pid && mv) loseLife(ctx.r25opp.pid, mv, name);
    commit(); return true;
  }
  if (/^~ deals damage to (?:that|target) player equal to the total mana value of those cards$/.test(l) && ctx.r25opp){ const pid = ctx.r25opp.pid; if (pid && ctx.r25mv) dealDamage({t:'player', pid}, ctx.r25mv, ctx.k, srcCardOf(ctx)); commit(); return true; }

  // ---- 8. "its controller may pay N life. If they do, they draw a card" (Gix) / "they may pay N life. If they don't, …" (Meathook Massacre II)
  if ((m = l.match(/^its controller may pay (\d+) life$/)) && /if they do, they draw a card/.test(full)){
    const pid = (ctx.it && ctx.it.evPid) || MYPID; const n = +m[1]; ctx.r25gix = 1; if (UI.dry) return true;
    if (pid === MYPID){ if (await askYes(`${name}: pay ${n} life to draw a card?`, 'Pay', "Don't")){ loseLife(MYPID, n, name); draw(1); } }
    else sendRq(pid, 'r25lifeDraw', n, name);
    commit(); return true;
  }
  if (/^if they do, they draw a card$/.test(l) && ctx.r25gix) return true;
  if ((m = l.match(/^they may pay (\d+) life$/))){
    const pid = ctx.it && ctx.it.evPid; const n = +m[1];
    if (UI.dry || !pid){ ctx.oppPaid = false; return true; }
    if (pid === MYPID){ ctx.oppPaid = await askYes(`${name}: pay ${n} life?`, 'Pay', "Don't"); if (ctx.oppPaid) loseLife(MYPID, n, name); }
    else { const a = await r25remote(pid, 'r25payLife', name, {d:String(n)}); ctx.oppPaid = a === '1'; log(`${name}: ${nameOf(pid)} ${ctx.oppPaid ? 'paid' : "didn't pay"} ${n} life`); }
    commit(); return true;
  }
  if (/^return that card (?:to the battlefield )?under your control with a finality counter on it$/.test(l)){
    const id = ctx.it && ctx.it.evId; const pid = (ctx.it && ctx.it.evPid) || MYPID; const k = ctx.it && ctx.it.evk; if (UI.dry || id == null) return true;
    if (pid === MYPID){ if (S.gy.some(c => c.id === id)){ moveCard(id, 'bf'); const c = S.bf.find(b => b.id === id); if (c) addNamed(c, 'finality', 1); } }
    else if (k){ S.r25take = (S.r25take || []).concat({k, fin:1}); sendRq(pid, 'gytake', 0, name, {d:k}); }
    commit(); return true;
  }
  // Grave Betrayal: at the next end step, take it from its owner's graveyard with a +1/+1 counter, as a black Zombie
  if (/^return it to the battlefield under your control with an additional \+1\/\+1 counter on it at the beginning of the next end step$/.test(l)){
    const it = ctx.it || {}; if (UI.dry || it.evId == null) return true;
    S.dly.push({id:rid(6), eff:'Return that creature card to the battlefield under your control with an additional +1/+1 counter on it. It is a black Zombie.', k:ctx.k, nm:name, srcId:ctx.srcId, op:'r25gb', r25k:it.evk, r25from:it.evPid || MYPID, r25id:it.evId});
    log(`${name}: ${info(it.evk)?.n || 'it'} returns under ${nameOf(MYPID)}'s control at the beginning of the next end step`); commit(); return true;
  }
  if (/^that creature is a black zombie in addition to its other colors and types$/.test(l) && /at the beginning of the next end step/.test(full)) return true; // applied when it returns (r25gb)
  // Gift of Immortality
  if (/^return that card to the battlefield under its owner's control$/.test(l) && /return ~ to the battlefield attached to that creature at the beginning of the next end step/.test(full)){
    const it = ctx.it || {}; if (UI.dry || it.evId == null) return true; const pid = it.evPid || MYPID;
    if (pid === MYPID){ if (S.gy.some(c => c.id === it.evId)) moveCard(it.evId, 'bf'); } else sendRq(pid, 'gyToBf', 0, name, {d:it.evk});
    commit(); return true;
  }
  if (/^return ~ to the battlefield attached to that creature at the beginning of the next end step$/.test(l)){
    const it = ctx.it || {}; if (UI.dry || it.evId == null) return true;
    S.dly.push({id:rid(6), eff:`Return ${name} to the battlefield attached to that creature.`, k:ctx.k, nm:name, srcId:ctx.srcId, op:'r25gift', r25att:{pid:it.evPid || MYPID, id:it.evId}});
    log(`${name}: returns attached to ${info(it.evk)?.n || 'that creature'} at the beginning of the next end step`); commit(); return true;
  }

  // ---- 9. Champions of Minas Tirith: pay {X} or can't attack you this combat
  if (/^if you're the monarch, that opponent may pay \{x\}, where x is the number of cards in their hand$/.test(l)){
    const pid = ctx.it && ctx.it.evPid; if (UI.dry){ ctx.oppPaid = false; return true; }
    if (holderOf('mon') !== MYPID || !pid || pid === MYPID){ ctx.oppPaid = true; return true; }
    const x = OPP.get(pid)?.hc || 0; ctx.oppPaid = x === 0 ? true : await askOpponentPay(pid, `{${x}}`, name); ctx.r25cpid = pid; commit(); return true;
  }
  if (/^(?:if they don't, )?they can't attack you this combat$/.test(l)){
    const pid = ctx.r25cpid || (ctx.it && ctx.it.evPid); if (UI.dry || !pid || pid === MYPID) return true;
    if (/^if they don't/.test(l) && ctx.oppPaid) return true;
    sendRq(pid, 'r25noAtk', 0, name, {d:turnStr()}); log(`${name}: ${nameOf(pid)} can't attack ${nameOf(MYPID)} this combat`); commit(); return true;
  }

  // ---- 10. restrictions on another player until your next turn
  if (/^that creature's owner can't cast spells with the same name as that creature until your next turn$/.test(l)){
    const t = (ctx.lastT || []).find(x => x.t === 'card'); if (!t || UI.dry) return true; const nm = info(t.k)?.n; if (!nm) return true;
    const ban = {kind:'name', n:nm, by:MYPID, t:turnStr(), src:name};
    if (!t.pid || t.pid === MYPID) S.r25bans = (S.r25bans || []).concat(ban); else sendRq(t.pid, 'r25ban', 0, name, {d:`name|${ban.t}|${nm}`.slice(0, 80)});
    log(`${name}: ${nameOf(t.pid || MYPID)} can't cast spells named ${nm} until ${nameOf(MYPID)}'s next turn`); commit(); return true;
  }
  if (/^until your next turn, your opponents can't cast spells from anywhere other than their hands$/.test(l)){
    if (UI.dry) return true; const ban = {kind:'nonhand', by:MYPID, t:turnStr(), src:name};
    opponents().forEach(p => sendRq(p.pid, 'r25ban', 0, name, {d:`nonhand|${ban.t}|`})); log(`${name}: until ${nameOf(MYPID)}'s next turn, opponents can cast spells only from their hands`); commit(); return true;
  }
  return false;
}
async function r25DelayTry(ctx, cond, eff, exp){
  const c = cond.toLowerCase().trim(); if (/\b(that|those) (creature|player|permanent)s?\b/.test(c)) return false;
  // The generic delayed trigger is a free-standing emblem: it can't see the resolving source's own context. Decline effects that need it
  // ("that much" = the event's amount, "other than ~" = the source object, "the exiled card" / "exiled with ~" = a linked object, rule 607),
  // so the source's own handler in an earlier file runs (Vizkopa Guildmage, Massacre Girl, Surge to Victory) or the line is flagged honestly.
  { const e = String(eff || '').split(String(ctx && ctx.name || '\u0000')).join('~'); if (/\bthat much\b|\bother than (?:~|this creature)|\bthe exiled card\b|\bexiled with ~/i.test(e)) return false; }
  if (!classifyTrig('whenever', c) && !r25Classify(c)) return false;
  return r25Delay(ctx, c, eff, exp, {});
}
{
  const ao = applyOp;
  applyOp = function(r, from){
    if (r.op === 'r25pay'){ (async () => { const n = await r25PayAny(`${r.src}: join forces — pay any amount of mana (${nameOf(from)} asks)`); log(`paid ${n} mana (${r.src})`); r25reply(from, r, n); })(); return; }
    if (r.op === 'r25ramp'){ (async () => { await searchLibrary(`up to ${r.n} basic land`, 'put them onto the battlefield tapped, then shuffle', {name:r.src}); commit(); })(); return; }
    if (r.op === 'r25keep'){ const [mode, ids] = String(r.d || '').split('|'); r25Keep(String(ids || '').split(',').filter(Boolean).map(Number), mode || 'cr', r.src); return; }
    if (r.op === 'r25dly'){ S.dly.push({id:rid(6), eff:'(delayed) return to bf', k:r.d || r.k || null, nm:r.src, srcId:r.tid != null ? r.tid : r.n, op:'r16ret', where:'bf', r25pid:MYPID}); log(`${r.src}: that card returns at the beginning of your next end step`); commit(); return; }
    if (r.op === 'r25mayEx'){ (async () => { const c = S.bf.find(b => b.id === r.tid); let yes = false; if (c){ yes = await askYes(`${r.src}: exile your ${cname(c)}? (If you don't, ${nameOf(from)} may search for a land)`, 'Exile it', 'Keep it'); if (yes){ moveCard(c.id, 'ex'); log(`exiled ${cname(c)} (${r.src})`); } } r25reply(from, r, yes ? 1 : 0); })(); return; }
    if (r.op === 'r25lifeDraw'){ (async () => { if (await askYes(`${r.src}: pay ${r.n} life to draw a card?`, 'Pay', "Don't")){ loseLife(MYPID, r.n, r.src); draw(1); log(`paid ${r.n} life and drew a card (${r.src})`); } commit(); })(); return; }
    if (r.op === 'r25payLife'){ (async () => { const n = +r.d || 0; const yes = await askYes(`${r.src}: pay ${n} life? (${nameOf(from)}'s effect — if you don't, they take your creature card)`, 'Pay', "Don't"); if (yes){ loseLife(MYPID, n, r.src); } r25reply(from, r, yes ? 1 : 0); })(); return; }
    if (r.op === 'r25noAtk'){ S.r25noAtk = {t:String(r.d || turnStr()), pids:[...new Set([...(S.r25noAtk && S.r25noAtk.t === r.d ? S.r25noAtk.pids : []), from])]}; log(`can't attack ${nameOf(from)} this combat (${r.src})`); commit(); return; }
    if (r.op === 'r25ban'){ const [kind, t, ...nn] = String(r.d || '').split('|'); const b = kind ? {kind, t, n:nn.join('|'), by:from, src:r.src} : null; if (b){ S.r25bans = (S.r25bans || []).concat(b); log(b.kind === 'name' ? `can't cast spells named ${b.n} until ${nameOf(from)}'s next turn (${r.src})` : `can't cast spells from anywhere other than your hand until ${nameOf(from)}'s next turn (${r.src})`); commit(); } return; }
    if (r.op === 'give' && r.c && (S.r25take || []).some(x => x.k === r.c.k)){
      const i = S.r25take.findIndex(x => x.k === r.c.k); const tk = S.r25take.splice(i, 1)[0]; const n0 = S.bf.length; const res = ao(r, from);
      const c = S.bf.slice(n0).find(b => b.k === r.c.k) || S.bf.slice().reverse().find(b => b.k === r.c.k);
      if (c){ if (tk.fin) addNamed(c, 'finality', 1); if (tk.cp) modCounters(c, 'cp', tk.cp); if (tk.zombie && typeof g23derive === 'function'){ c.origK = c.k; c.k = g23derive(c.k, {addType:'Zombie', col:'B'}); } }
      commit(); return res;
    }
    if (r.op === 'r25dmgAllX'){ const ex = r.d ? +r.d : null; S.bf.filter(c => isCreatureCard(c) && !c.fd && c.id !== ex).forEach(c => damageCard(c, r.n, r.f || {})); commit(); return; }
    return ao(r, from);
  };
}
{
  const ds = doSentence;
  doSentence = async function(s0, ctx){ const s = String(s0).replace(/\.$/, '').trim(); const l = s.toLowerCase(); if (l && await doRound25SPre(s, l, ctx)) return; return ds(s0, ctx); };
}

function r25Keep(keep, mode, src){
  const pool = S.bf.filter(c => !c.fd && !c.emb && (mode === 'nonland' ? isPermType(info(c.k)?.t) && !isLand(c) : isCreatureCard(c)));
  let gone;
  if (mode === 'share'){ const ch = S.bf.find(c => c.id === keep[0]); const types = ch ? r25Subtypes(ch) : []; gone = pool.filter(c => c.id !== keep[0] && !r25Subtypes(c).some(t => types.includes(t))); }
  else gone = pool.filter(c => !keep.includes(c.id));
  gone.forEach(c => { const n = c.n || 1; for (let i = 0; i < n; i++) if (S.bf.includes(c)) sacrificeOne(c); });
  log(`${src}: sacrificed ${gone.length} permanent${gone.length === 1 ? '' : 's'}`); commit();
}
function r25Subtypes(c){ const t = typeOf(c) || info(c.k)?.t || ''; const i = t.indexOf('—'); if (/Changeling/i.test(info(c.k)?.o || '')) return ['*all*']; return i < 0 ? [] : t.slice(i + 1).trim().split(/\s+/); }

/* ---------- step hooks: "that player's next end step", enchanted opponent's end step, who attacked me ---------- */
{
  const fs = fireSteps;
  fireSteps = function(step, activePid){
    let held = [];
    try { if (step === 'end' && S && S.dly.length){ held = S.dly.filter(d => d.r25pid && d.r25pid !== activePid); S.dly = S.dly.filter(d => !held.includes(d)); } } catch {}
    try { return fs(step, activePid); } finally { if (held.length) S.dly.push(...held); }
  };
  const ct = classifyTrig;
  classifyTrig = function(w, c){
    if (w === 'at' && /^the beginning of enchanted opponent's end step$/.test(c)) return {ev:'step', step:'end', whose:'each', p24ench:true};
    return ct(w, c);
  };
  const he = handleEvent;
  handleEvent = function(pid, ev){
    try { if (ev && ev.type === 'attack' && pid !== MYPID && ev.dp === MYPID){ S.r25atkMe = S.r25atkMe || {}; S.r25atkMe[pid] = turnStr(); } } catch {}
    return he(pid, ev);
  };
}

// Master Warcraft: cast only before attackers are declared
{
  const cc = castCheck;
  castCheck = function(c, zone){
    try { const a = c && info(c.k); if (a && /cast (?:~|this spell) only before attackers are declared/i.test(tname(a.o || '', a.n))){
      const pn = phaseNow(); const cb = cbOf(pn);
      if (pn.ph > 4 || (pn.ph === 4 && cb && !['begin', 'atk'].includes(cb.step))) return {ok:false, why:'Only before attackers are declared'}; } } catch {}
    return cc(c, zone);
  };
}

// delayed triggers resolving (Grave Betrayal, Gift of Immortality)
{
  const rt = resolveTop;
  resolveTop = async function(it, ...a){
    if (it && (it.dop === 'r25gb' || it.dop === 'r25gift')){
      try {
        if (it.dop === 'r25gb'){
          if (it.r25from === MYPID){ if (S.gy.some(c => c.id === it.r25id)){ moveCard(it.r25id, 'bf'); const c = S.bf.find(b => b.id === it.r25id); if (c){ modCounters(c, 'cp', 1); if (typeof g23derive === 'function'){ c.origK = c.k; c.k = g23derive(c.k, {addType:'Zombie', col:'B'}); } } } }
          else if (it.r25k){ S.r25take = (S.r25take || []).concat({k:it.r25k, cp:1, zombie:1}); sendRq(it.r25from, 'gytake', 0, it.nm, {d:it.r25k}); }
          log(`${it.nm}: returns ${info(it.r25k)?.n || 'the creature'} under ${nameOf(MYPID)}'s control`);
        } else {
          const at = it.r25att || {}; const host = boardOf(at.pid || MYPID).find(b => b.id === at.id);
          if (host && S.gy.some(c => c.id === it.srcId)){ moveCard(it.srcId, 'bf', {quiet:true}); const c = S.bf.find(b => b.id === it.srcId); if (c){ c.att = {pid:at.pid || MYPID, id:at.id}; log(`${it.nm} returned attached to ${info(host.k)?.n}`); } }
          else log(`${it.nm}: that creature isn't on the battlefield — it stays in the graveyard`);
        }
      } catch (e){ console.warn(e); }
      S.stk = S.stk.filter(x => x !== it); commit(); return;
    }
    return rt(it, ...a);
  };
}
// can't attack a player this combat (Champions of Minas Tirith)
{
  const dO = defOpts;
  defOpts = function(){ const out = dO(); try { const b = S.r25noAtk; if (b && b.t === turnStr() && b.pids.length) return out.filter(o => !(o.key.startsWith('p:') && b.pids.includes(o.pid))); } catch {} return out; };
}
// spells another player forbade until their next turn (Reflector Mage, Avatar's Wrath)
function r25BanLive(b){ const [n, pid] = currentTurn(); return !(pid === b.by && turnStr() !== b.t); }
{
  const cc = castCheck;
  castCheck = function(c, zone){
    try { if (S && S.r25bans && S.r25bans.length && c && !isLand(c.k)){
      S.r25bans = S.r25bans.filter(r25BanLive);
      for (const b of S.r25bans){
        if (b.kind === 'name' && norm(info(c.k)?.n || '') === norm(b.n)) return {ok:false, why:`${b.src}: you can't cast spells named ${b.n} until ${nameOf(b.by)}'s next turn`};
        if (b.kind === 'nonhand' && zone && zone !== 'hand') return {ok:false, why:`${b.src}: you can only cast spells from your hand until ${nameOf(b.by)}'s next turn`};
      } } } catch {}
    return cc(c, zone);
  };
}

function r25TakeGy(list, src){
  for (const x of list || []){
    if (x.pid === MYPID){ if (S.gy.some(c => c.id === x.id)) moveCard(x.id, 'bf'); }
    else { sendRq(x.pid, 'gytake', 0, src, {d:x.k}); log(`takes ${info(x.k)?.n} from ${nameOf(x.pid)}'s graveyard`); }
  }
}

// one-shot delayed triggers disappear once they trigger
{
  const pt = pushTrigger;
  pushTrigger = function(src, t, ev, evPid){
    const n0 = S ? S.stk.length : 0; const r = pt(src, t, ev, evPid);
    try { if (S && S.stk.length > n0 && src){ const c = S.bf.find(b => b.id === src.id); if (c && c.r25 && c.r25.once){ S.bf = S.bf.filter(b => b !== c); commit(); } } } catch {}
    return r;
  };
}
