/* ===================== botlevels.js: Easy and Intermediate bots (stage 1) =====================
   Every hook gets v = botView() (my own state + public state only) and returns a decision; the driver in bots.js carries it
   out through the normal menus. Shared judgement lives in the BL helpers so stage 2 (Hard / Very hard) can reuse and override. */
const BL = {
  pick:(R, a) => a[Math.floor(R() * a.length)],
  shuf(R, a){ a = a.slice(); for (let i = a.length - 1; i > 0; i--){ const j = Math.floor(R() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; },
  role:k => cardRoles(k) || {roles:new Set(), value:0.2, mv:0, kw:new Set(), produces:new Set(), text:''},
  costN(c, zone){ try { const sc = spellCost(c, zone).cost; return sc.gen + MANA.reduce((s, m) => s + (sc.col[m] || 0), 0) + sc.hyb.length + sc.two.length * 2 + sc.phy.length; } catch { return info(c.k)?.mv || 0; } },
  hasX(c, zone){ try { return !!spellCost(c, zone).cost.x; } catch { return /\{X\}/.test(info(c.k)?.m || ''); } },
  src(c){ const a = info(c.k) || {}; return {pid:MYPID, col:a.c, types:a.t, id:c.id}; },
  // the target candidates a card's spell text would offer, split by whose they are
  cands(c){ const a = info(c.k); if (!a) return []; let out = []; try { for (const sp of targetSpecs(tname(a.o || '', a.n))) out = out.concat(targetCands(sp, BL.src(c)).filter(x => x.ok).map(x => ({...x, spec:sp}))); } catch {} return out; },
  ownerThreat(v, pid){ const o = v.opps.find(x => x.pid === pid); return o ? 1 + botThreat(o) / 20 : 1; },
  // value of a target candidate from my point of view (positive = good to hit with something harmful)
  candValue(v, x){
    if (x.t === 'player') return x.pid === MYPID ? -5 : 2 + BL.ownerThreat(v, x.pid) * 2 + (40 - (v.opps.find(o => o.pid === x.pid)?.life ?? 40)) * 0.05;
    if (x.t === 'gy') return BL.role(x.k).value * 4;
    const c = boardOf(x.pid).find(b => b.id === x.id); return c ? permValue(c, x.pid) * (x.pid === MYPID ? 1 : BL.ownerThreat(v, x.pid)) : 0;
  },
  bestOppTarget(v, c){ const cs = BL.cands(c).filter(x => x.pid !== MYPID && (x.t === 'card' || x.t === 'player')); let best = null, bv = -1; cs.forEach(x => { const s = BL.candValue(v, x); if (s > bv){ bv = s; best = x; } }); return best ? {x:best, v:bv} : null; },
  intentOf(c){ const r = BL.role(c.k); return targetIntent(r.text, (BL.cands(c)[0] || {}).spec?.desc || ''); },
  myCreatures(){ return botCreatures(S.bf, MYPID); },
  boardPower(bf, pid){ return botCreatures(bf, pid).reduce((s, c) => s + Math.max(0, botPT(c, pid)[0]), 0); },
  // can this blocker of mine stop that attacker (rough, from public info)
  canBlockA(b, a, apid){ try { return !canBlock(b, a, apid); } catch { return false; } },
  oppCanBlock(ob, a, opid){
    if (!ob.k || ob.fd || ob.tp) return false; let cr = false; try { cr = isCreatureCard(ob); } catch {} if (!cr) return false;
    const has = (c, w, pid) => botKw(c, w, pid);
    if (BL.role(a.k).kw.has('unblockable') || /can't be blocked/.test(BL.role(a.k).text)) return false;
    if (has(a, 'flying', MYPID) && !has(ob, 'flying', opid) && !has(ob, 'reach', opid)) return false;
    if (has(a, 'shadow', MYPID)) return false;
    if (/~ can't block/.test(BL.role(ob.k).text)) return false;
    return true;
  },
  kills(att, attPid, def, defPid){ const [p] = botPT(att, attPid); const [, t] = botPT(def, defPid); if (botKw(def, 'indestructible', defPid)) return false; return (p > 0 && botKw(att, 'deathtouch', attPid)) || p >= t - (def.dmg || 0); },
  needColors(){ const need = {}; S.hand.forEach(c => { if (isLand(c.k)) return; (info(c.k)?.m || '').replace(/\{([WUBRG])\}/g, (_, x) => { need[x] = (need[x] || 0) + 1; }); }); return need; },
  haveColors(){ const have = new Set(); S.bf.forEach(c => { if (!c.k || c.fd) return; BL.role(c.k).produces.forEach(x => have.add(x)); }); return have; },
  chooseLand(v, smart){
    const lands = botLandsInHand(); if (!lands.length) return null;
    if (!smart) return BL.pick(v.R, lands);
    const need = BL.needColors(), have = BL.haveColors(); const avail = botManaAvail();
    const castNext = S.hand.some(c => !isLand(c.k) && BL.costN(c, 'hand') === avail + 1);
    let best = null, bs = -1e9;
    for (const c of lands){ const r = BL.role(c.k); let s = 0;
      r.produces.forEach(x => { if (need[x]) s += have.has(x) ? 0.5 : 3; });
      if (r.tapped) s += castNext ? -2 : 1;           // play tapped lands on turns we can't use the mana anyway
      if (r.produces.size > 1) s += 0.5;
      if (/sacrifice|return a land/.test(r.text)) s -= 1.5;
      if (s > bs){ bs = s; best = c; } }
    return best;
  },
  pwActs(v){ return S.bf.filter(c => { try { return !c.fd && isPW(c) && loyaltyAbs(c).some(ab => !loyaltyReady(c, ab)) && !botTriedTooOften(c, 'pw'); } catch { return false; } }); },
  // abilities that fetch lands (Evolving Wilds, fetch lands, Myriad Landscape…): use them on my own turn
  fetchActs(){
    const out = [];
    S.bf.forEach(c => { if (c.fd) return; try { abilityList(c).forEach((ab, i) => { if (/search your library for [^.]*\b(?:land|forest|plains|island|swamp|mountain)s?\b[^.]*(?:onto the battlefield|put (?:it|them) onto)/i.test(ab.eff) && !abilityReady(c, ab, false) && !botTriedTooOften(c, 'ab', i)) out.push({how:'ab', c, ab:i, why:'fetch a land'}); }); } catch {} });
    return out;
  },
  equipActs(){
    const out = []; if (!BL.myCreatures().length) return out;
    S.bf.forEach(c => { if (c.fd || c.att) return; try { abilityList(c).forEach((ab, i) => { if (ab.equip && !abilityReady(c, ab, false) && !botTriedTooOften(c, 'ab', i)) out.push({how:'ab', c, ab:i, why:'equip'}); }); } catch {} });
    return out;
  },
  // what a dialog's option text would do (for modes and votes): rough value
  textScore(v, t){
    t = String(t || '').toLowerCase(); let s = 0;
    const oppCr = v.opps.some(o => botCreatures(o.bf, o.pid).length), myCr = BL.myCreatures().length;
    if (/\bdraw/.test(t)) s += 2; if (/destroy|exile|damage|-\d\/-\d/.test(t)) s += oppCr ? 2.5 : 0.5; if (/counter target/.test(t)) s += 1;
    if (/gain \d+ life|you gain/.test(t)) s += 0.6; if (/create|token/.test(t)) s += 1.5; if (/\+1\/\+1|gets \+/.test(t)) s += myCr ? 1.2 : 0;
    if (/search your library/.test(t)) s += 1.5; if (/return .* from your graveyard/.test(t)) s += 1.5; if (/add \{|treasure/.test(t)) s += 1;
    if (/each player sacrifices|each creature|all creatures/.test(t)) s += (BL.boardPower(S.bf, MYPID) < Math.max(0, ...v.opps.map(o => BL.boardPower(o.bf, o.pid)))) ? 2 : -2;
    if (/you lose|sacrifice a|discard/.test(t)) s -= 1;
    return s;
  },
  isBadPick(title){ return /discard|sacrific|bottom|exile|put (?:\w+ )*into (?:your|their|its owner's) graveyard|\bmill|to lose|destroy|return .* to (?:its owner's|their owner's|your) hand/i.test(title) && !/from your graveyard|exile .* you may (?:cast|play)|search/i.test(title); },
  pickValue(c, title){ const r = BL.role(c.k); let v = r.value; const onBf = S.bf.find(b => b.id === c.id);
    if (onBf){ v = permValue(onBf, MYPID) / 10; if (onBf.tok) v -= 0.3; }
    if (/\bland\b/i.test(title) && r.land){ const need = BL.needColors(), have = BL.haveColors(); r.produces.forEach(x => { if (need[x] && !have.has(x)) v += 0.5; }); }
    return v; },
};

/* ---------------------------------------------------------------- Easy: legal moves with light sense */
botLevel('easy', {label:'Easy', ready:true, think:[500, 1200],
  keep(v){ const l = v.me.hand.filter(c => isLand(c.k)).length; return BOT.mullN >= 1 || (l >= 1 && l <= 6); },
  main(v){
    if (!v.landPlayed){ const l = BL.chooseLand(v, false); if (l) return {how:'land', c:l}; }
    const fe = BL.fetchActs(); if (fe.length) return fe[0];
    const cs = botCastable().filter(x => { const r = BL.role(x.c.k);
      if (r.roles.has('counter')) return false;
      if (r.roles.has('removal') && !r.perm && !BL.bestOppTarget(v, x.c)) return false;   // removal only at opponents' things
      return true; });
    if (cs.length && v.R() < 0.85) { const x = BL.pick(v.R, cs); return {how:'cast', c:x.c, zone:x.zone}; }
    const pws = BL.pwActs(v); if (pws.length && v.R() < 0.6) return {how:'pw', c:BL.pick(v.R, pws)};
    return null;
  },
  respond(v){
    const tos = v.stack[v.stack.length - 1];
    if (tos && !tos.mine && tos.kind === 'spell' && v.R() < 0.3){ const ctr = botCastable().filter(x => BL.role(x.c.k).roles.has('counter')); if (ctr.length){ BOT.counterWant = tos.sid; return {how:'cast', c:ctr[0].c, zone:ctr[0].zone, why:'counter'}; } }
    return null;
  },
  attack(v){
    const opts = defOpts().filter(o => o.key.startsWith('p:')); if (!opts.length) return {};
    const sel = {}; S.bf.forEach(c => { if (canAttack(c)) return; if (v.R() < 0.55) sel[c.id] = BL.pick(v.R, opts).key; }); return sel;
  },
  block(v){
    const pn = v.pn; const atts = attackersOnMe(pn); const sel = {};
    BL.myCreatures().forEach(b => { if (b.tap || v.R() >= 0.4) return; const ok = atts.filter(a => BL.canBlockA(b, a, pn.pid)); if (ok.length) sel[b.id] = BL.pick(v.R, ok).id; });
    return sel;
  },
  choice(v, m){
    const opts = (m.options || []).map((o, i) => ({...o, i})).filter(o => !o.disabled); if (!opts.length) return -1;
    if (/command zone/i.test(m.title || '') || opts.some(o => /command zone/i.test(o.label || ''))){ const o = opts.find(o => /command zone|yes/i.test(o.label || '')); if (o) return o.i; }
    if (/what are you countering/i.test(m.title || '')){ const o = opts.find(o => o.value === BOT.counterWant) || opts.find(o => !/ — your /.test(o.label || '')); if (o) return o.i; }
    if (/how do you want to pay/i.test(m.text || '') || /^cast /i.test(m.title || '')){ const o = opts.find(o => o.value === 'normal'); if (o) return o.i; }
    return BL.pick(v.R, opts).i;
  },
  pick(v, m){
    const cards = m.cards || []; const max = Math.min(m.max ?? 1, cards.length), min = Math.min(m.min ?? 0, cards.length);
    const n = BL.isBadPick(m.title) ? min : max; return BL.shuf(v.R, cards).slice(0, n).map(c => c.id);
  },
  target(v, m){
    const sp = m.spec || {n:1}; const intent = targetIntent(botSrcText(m.title), sp.desc);
    const ok = (m.cands || []).map((c, i) => ({c, i})).filter(x => x.c.ok);
    const opp = ok.filter(x => x.c.pid !== MYPID), own = ok.filter(x => x.c.pid === MYPID);
    let pool = intent === 'help' ? (own.length ? own : (sp.upTo ? [] : opp)) : intent === 'harm' ? (opp.length ? opp : (sp.upTo ? [] : own)) : ok;
    return BL.shuf(v.R, pool).slice(0, sp.n || 1).map(x => x.i);
  },
  number(v, m){ if (/choose x/i.test(m.title || '')) return Math.max(0, botManaAvail() - (BOT.lastCast ? BL.costN({k:BOT.lastCast.k, id:BOT.lastCast.id}, 'hand') : 0)); return +m.def || 0; },
  pay(v, cost, why){ return why === 'counter' ? true : v.R() < 0.5; },
  pw(v, m, avail){ return avail.length ? BL.pick(v.R, avail) : -1; },
});

/* ---------------------------------------------------------------- Intermediate: a plan */
botLevel('intermediate', {label:'Intermediate', ready:true, think:[600, 1500],
  keep(v){
    const h = v.me.hand; const lands = h.filter(c => isLand(c.k)).length;
    const rocks = h.filter(c => !isLand(c.k) && BL.role(c.k).roles.has('ramp') && (info(c.k)?.mv || 0) <= 2).length;
    const eff = lands + rocks * 0.5;
    if (BOT.mullN >= 2) return lands >= 1;
    return eff >= 2 && lands <= 5 && lands >= 2 - (rocks ? 1 : 0);
  },
  bottom(v, need){
    const h = v.me.hand.slice(); const lands = h.filter(c => isLand(c.k)); const spells = h.filter(c => !isLand(c.k));
    const keepL = Math.min(lands.length, Math.max(2, Math.min(4, Math.round((h.length - need) * 0.45))));
    const out = []; lands.slice(keepL).forEach(c => out.push(c));
    spells.sort((a, b) => ((info(b.k)?.mv || 0) - (info(a.k)?.mv || 0)) || (BL.role(a.k).value - BL.role(b.k).value)).forEach(c => out.push(c));
    lands.slice(0, keepL).reverse().forEach(c => out.push(c));
    return out.slice(0, need).map(c => c.id);
  },
  // which castable spells are worth casting now, with a score
  plan(v){
    const avail = botManaAvail(); const myVal = BL.myCreatures().reduce((s, c) => s + permValue(c, MYPID), 0);
    const oppVal = v.opps.reduce((s, o) => s + botCreatures(o.bf, o.pid).reduce((t, c) => t + permValue(c, o.pid), 0), 0);
    const early = v.turn <= 12 && S.bf.filter(c => isLand(c.k)).length < 6;
    const out = [];
    for (const x of botCastable()){
      const c = x.c, r = BL.role(c.k), R = r.roles; const cost = BL.costN(c, x.zone);
      if (R.has('counter')) continue;
      const instantOnly = !r.perm && r.instant;
      let s = cost + r.value * 3;
      if (R.has('ramp')) s += early ? 4 : 0.5;
      if (R.has('draw')) s += 1.2;
      if (R.has('tutor')) s += 0.8;
      if (R.has('wipe')){ if (oppVal < myVal * 1.4 + 6) continue; s += 6; }
      const harmful = !r.perm && (R.has('removal') || (BL.cands(c).length && BL.intentOf(c) === 'harm'));
      if (harmful){ const b = BL.bestOppTarget(v, c); if (!b || b.v < (instantOnly ? 7 : 2.5)) continue; s += 2 + b.v / 3; x.want = b.x; }
      if (!r.perm && !harmful && BL.cands(c).length && BL.intentOf(c) === 'help'){ if (!BL.myCreatures().length) continue; if (instantOnly && (R.has('pump') || R.has('protect'))) continue; }
      if ((R.has('aura') || R.has('equipment')) && !BL.myCreatures().length) continue;
      if (instantOnly && !harmful && !R.has('ramp') && (R.has('draw') || R.has('protect') || R.has('pump'))) continue;   // keep it for the opponents' turn
      if (r.creature) s += 0.6 + (r.kw.has('haste') && v.ph === 3 ? 1 : 0);
      if (x.zone === 'cz') s += 1.5;
      if (BL.hasX(c, x.zone)) s += 1;
      if (v.ph === 5 && r.creature && !r.kw.has('haste')) s += 0.3;
      out.push({...x, cost:BL.hasX(c, x.zone) ? Math.max(cost, avail) : cost, s, r});
    }
    // best set of spells that fits the mana (small hands: try every subset)
    const list = out.slice(0, 14); let best = [], bs = 0;
    const N = list.length;
    if (N <= 12){ for (let m = 1; m < (1 << N); m++){ let c = 0, s = 0; for (let i = 0; i < N; i++) if (m & (1 << i)){ c += list[i].cost; s += list[i].s; } if (c <= avail && s > bs){ bs = s; best = list.filter((_, i) => m & (1 << i)); } } }
    else { let left = avail; list.sort((a, b) => b.s / Math.max(1, b.cost) - a.s / Math.max(1, a.cost)).forEach(x => { if (x.cost <= left){ best.push(x); left -= x.cost; } }); }
    if (!best.length && out.length){ const ok = out.filter(x => x.cost <= avail).sort((a, b) => b.s - a.s); if (ok.length) best = [ok[0]]; }
    // order: ramp first (it can pay for more), then removal (clear the way), then the biggest
    best.sort((a, b) => (b.r.roles.has('ramp') - a.r.roles.has('ramp')) || (!!b.want - !!a.want) || (b.cost - a.cost));
    return best;
  },
  main(v){
    // land first — unless a cheap draw spell could find a land and there's none to play anyway
    if (!v.landPlayed){ const l = BL.chooseLand(v, true); if (l) return {how:'land', c:l, why:'land drop'}; }
    const fe = BL.fetchActs(); if (fe.length) return fe[0];
    const p = this.plan(v);
    if (p.length){ const x = p[0]; if (x.want) BOT.want = {k:x.c.k, t:x.want}; return {how:'cast', c:x.c, zone:x.zone, why:x.want ? 'at ' + x.want.nm : x.r.roles.has('ramp') ? 'ramp' : 'curve'}; }
    const pws = BL.pwActs(v); if (pws.length) return {how:'pw', c:pws[0], why:'loyalty'};
    const eq = BL.equipActs(); if (eq.length && botManaAvail() >= 1) return eq[0];
    return null;
  },
  respond(v){
    const tos = v.stack[v.stack.length - 1]; const avail = botManaAvail();
    if (tos && !tos.mine){
      const r = BL.role(tos.k);
      const hitsMe = tos.tgt && JSON.stringify(tos.tgt).includes(MYPID);
      const big = tos.kind === 'spell' && ((tos.mv || 0) >= 4 || r.roles.has('wipe') || r.roles.has('combo') || r.roles.has('wincon') || r.roles.has('tutor') || (hitsMe && r.roles.has('removal')));
      if (big){ const ctr = botCastable().filter(x => BL.role(x.c.k).roles.has('counter')); if (ctr.length){ BOT.counterWant = tos.sid; return {how:'cast', c:ctr[0].c, zone:ctr[0].zone, why:'counter ' + tos.nm}; } }
      // protect my creature from removal
      if (hitsMe && (r.roles.has('removal') || /destroy|exile|damage/.test(String(tos.txt || '').toLowerCase()))){
        const t = (Array.isArray(tos.tgt) ? tos.tgt.flat() : []).find(x => x && x.pid === MYPID && x.t === 'card');
        const pr = botCastable().filter(x => { const R = BL.role(x.c.k).roles; return R.has('protect') && !BL.role(x.c.k).perm; });
        if (t && pr.length){ BOT.want = {k:pr[0].c.k, t:{t:'card', pid:MYPID, id:t.id}}; return {how:'cast', c:pr[0].c, zone:pr[0].zone, why:'protect ' + (t.nm || '')}; }
      }
      return null;
    }
    // empty stack, end of an opponent's turn: use instants I held back
    if (!tos && !v.mine && v.ph === 6){
      for (const x of botCastable()){ const r = BL.role(x.c.k); if (r.perm && !r.instant) continue; if (r.roles.has('counter')) continue;
        if (r.roles.has('removal')){ const b = BL.bestOppTarget(v, x.c); if (b && b.v >= 3){ BOT.want = {k:x.c.k, t:b.x}; return {how:'cast', c:x.c, zone:x.zone, why:'end-step removal'}; } continue; }
        if (r.roles.has('draw') || (r.creature && r.instant) || r.roles.has('ramp')){ if (BL.costN(x.c, x.zone) <= avail) return {how:'cast', c:x.c, zone:x.zone, why:'end-step ' + (r.creature ? 'flash' : 'draw')}; } }
    }
    return null;
  },
  attack(v){
    const opts = defOpts(); const players0 = opts.filter(o => o.key.startsWith('p:')); if (!players0.length) return {};
    const mine = S.bf.filter(c => !canAttack(c));
    if (!mine.length) return {};
    const opp = pid => v.opps.find(o => o.pid === pid) || {pid, life:40, bf:OPP.get(pid)?.bf || []};
    // 1. lethal on one opponent?
    for (const o of players0.map(p => opp(p.pid)).sort((a, b) => a.life - b.life)){
      const blockers = (o.bf || []).filter(b => b.k && !b.fd && !b.tp && (() => { try { return isCreatureCard(b); } catch { return false; } })());
      const dmg = mine.map(c => { const p = Math.max(0, botPT(c, MYPID)[0]) * (botKw(c, 'double strike', MYPID) ? 2 : 1); const blockable = blockers.some(b => BL.oppCanBlock(b, c, o.pid)); return {c, p, blockable}; }).sort((a, b) => b.p - a.p);
      const free = dmg.filter(d => !d.blockable).reduce((s, d) => s + d.p, 0);
      const bl = dmg.filter(d => d.blockable).slice(Math.min(blockers.length, dmg.filter(d => d.blockable).length)).reduce((s, d) => s + d.p, 0);
      if (o.life > 0 && free + bl >= o.life){ const sel = {}; mine.forEach(c => { sel[c.id] = 'p:' + o.pid; }); BOT.lastPlan = 'lethal on ' + o.nm; return sel; }
    }
    // 2. per opponent: which of my creatures can attack them profitably (evasion, safe swings, fair trades, too many attackers to block)
    const isCr = b => { try { return isCreatureCard(b); } catch { return false; } };
    const planFor = o => {
      const B = (o.bf || []).filter(b => b.k && !b.fd && !b.tp && isCr(b));
      const sel = [], risky = [];
      for (const c of mine){
        const [p] = botPT(c, MYPID); if (p <= 0) continue;
        const bl = B.filter(b => BL.oppCanBlock(b, c, o.pid));
        const bad = bl.filter(b => BL.kills(b, o.pid, c, MYPID) && !BL.kills(c, MYPID, b, o.pid));
        const trade = bl.filter(b => BL.kills(b, o.pid, c, MYPID) && BL.kills(c, MYPID, b, o.pid));
        const vc = permValue(c, MYPID);
        if (!bl.length || (!bad.length && !trade.length)) sel.push(c);
        else if (!bad.length && trade.every(b => permValue(b, o.pid) >= vc * 0.8)) sel.push(c);
        else risky.push({c, v:vc});
      }
      // more attackers than they can block: send the cheap ones too; far ahead on life: send everything that outnumbers their blockers
      const nB = B.length;
      const incoming = v.opps.reduce((s, x) => s + BL.boardPower(x.bf, x.pid), 0);
      const safe = incoming * 2 < S.life && S.life > o.life;
      if (safe && sel.length + risky.length > nB) risky.forEach(x => sel.push(x.c));
      else if (sel.length + risky.length >= nB + 2) risky.sort((a, b) => a.v - b.v).forEach(x => { if (x.v <= 7 || sel.length + risky.length >= nB * 2 + 2) sel.push(x.c); });
      const dmg = sel.reduce((s, c) => s + Math.max(0, botPT(c, MYPID)[0]), 0);
      return {o, sel, dmg, s:dmg * 2 + botThreat(o) - Math.max(0, o.life) * 0.1};
    };
    const plans = players0.map(p => planFor(opp(p.pid))).filter(x => x.sel.length).sort((a, b) => b.s - a.s);
    if (!plans.length) return {};
    const best = plans[0];
    // crack-back: keep blockers home if the table could kill me next turn
    const incoming = v.opps.reduce((s, o) => s + BL.boardPower(o.bf, o.pid), 0);
    let atk = best.sel.slice();
    if (incoming >= S.life){
      const stay = mine.filter(c => !botKw(c, 'vigilance', MYPID)).sort((a, b) => botPT(b, MYPID)[1] - botPT(a, MYPID)[1]);
      let left = incoming; const keep = new Set();
      for (const c of stay){ if (left < S.life) break; keep.add(c.id); left -= Math.max(1, ...v.opps.flatMap(o => botCreatures(o.bf, o.pid).map(x => botPT(x, o.pid)[0]))); }
      atk = atk.filter(c => !keep.has(c.id));
    }
    const sel = {}; atk.forEach(c => { sel[c.id] = 'p:' + best.o.pid; });
    BOT.lastPlan = `attack ${atk.length} at ${best.o.nm}`;
    return sel;
  },
  block(v){
    const pn = v.pn; const atts = attackersOnMe(pn).slice(); const apid = pn.pid; const sel = {};
    const free = BL.myCreatures().filter(b => !b.tap);
    const used = new Set();
    let incoming = atts.reduce((s, a) => s + Math.max(0, botPT(a, apid)[0]) * (botKw(a, 'double strike', apid) ? 2 : 1) * Math.max(1, a.n || 1), 0);
    atts.sort((a, b) => botPT(b, apid)[0] - botPT(a, apid)[0]);
    for (const a of atts){
      if (hasMenace(a, apid)) continue;
      const cand = free.filter(b => !used.has(b.id) && BL.canBlockA(b, a, apid));
      if (!cand.length) continue;
      const ap = Math.max(0, botPT(a, apid)[0]);
      // a block that kills it and survives
      let b = cand.filter(b => BL.kills(b, MYPID, a, apid) && !BL.kills(a, apid, b, MYPID)).sort((x, y) => permValue(x, MYPID) - permValue(y, MYPID))[0];
      // a good trade
      if (!b) b = cand.filter(b => BL.kills(b, MYPID, a, apid) && permValue(b, MYPID) <= permValue(a, apid) + 1).sort((x, y) => permValue(x, MYPID) - permValue(y, MYPID))[0];
      // a block where mine survives (nothing dies)
      if (!b) b = cand.filter(b => !BL.kills(a, apid, b, MYPID) && !botKw(a, 'trample', apid)).sort((x, y) => permValue(x, MYPID) - permValue(y, MYPID))[0];
      if (b){ sel[b.id] = a.id; used.add(b.id); incoming -= ap; }
    }
    // chump if the damage left would kill me
    if (incoming >= S.life){
      for (const a of atts.filter(a => !Object.values(sel).includes(a.id) && !hasMenace(a, apid)).sort((x, y) => botPT(y, apid)[0] - botPT(x, apid)[0])){
        if (incoming < S.life) break;
        const b = free.filter(b => !used.has(b.id) && BL.canBlockA(b, a, apid)).sort((x, y) => permValue(x, MYPID) - permValue(y, MYPID))[0];
        if (b){ sel[b.id] = a.id; used.add(b.id); incoming -= Math.max(0, botPT(a, apid)[0]) * (botKw(a, 'trample', apid) ? 0 : 1); }
      }
    }
    return sel;
  },
  choice(v, m){
    const opts = (m.options || []).map((o, i) => ({...o, i})).filter(o => !o.disabled); if (!opts.length) return -1;
    const title = String(m.title || ''); const lab = o => String(o.label || '');
    if (/command zone/i.test(title) || opts.some(o => /command zone/i.test(lab(o)))){ const o = opts.find(o => /command zone|yes/i.test(lab(o))); if (o) return o.i; }
    if (/what are you countering/i.test(title)){ const o = opts.find(o => o.value === BOT.counterWant) || opts.find(o => !/ — your /.test(lab(o))); if (o) return o.i; }
    if (/how do you want to pay/i.test(m.text || '') || /^cast /i.test(title)){ const o = opts.find(o => o.value === 'normal'); if (o) return o.i; }
    const payO = opts.find(o => /^pay\b/i.test(lab(o))), noO = opts.find(o => /^(don'?t|do not|no)\b/i.test(lab(o)));
    if (noO && !payO && (m.options || []).some(o => o.disabled && /^pay\b/i.test(String(o.label || '')))) return noO.i;
    if (payO && noO){ const cost = (lab(payO).match(/\{[^}]+\}(?:\{[^}]+\})*/) || ['{1}'])[0]; return this.pay(v, cost, title) ? payO.i : noO.i; }
    if (/ward/i.test(title) && payO) return payO.i;
    const yes = opts.find(o => o.value === true || /^yes\b/i.test(lab(o))), no = opts.find(o => o.value === false || /^no\b/i.test(lab(o)));
    if (yes && no) return /sacrific|discard|lose \d+ life|pay \d+ life|mill|exile (?:it|~|this)|deals? \d+ damage to you/i.test(title) && !/opponent/i.test(title) ? no.i : yes.i;
    // modes, votes and the rest: score what the option says
    let best = opts[0], bs = -1e9; for (const o of opts){ const s = BL.textScore(v, lab(o)) + (/^(that’s all|choose nothing)/i.test(lab(o)) ? -0.5 : 0); if (s > bs){ bs = s; best = o; } }
    return best.i;
  },
  pick(v, m){
    const cards = (m.cards || []).slice(); const max = Math.min(m.max ?? 1, cards.length), min = Math.min(m.min ?? 0, cards.length); const title = String(m.title || '');
    const bad = BL.isBadPick(title);
    cards.sort((a, b) => BL.pickValue(a, title) - BL.pickValue(b, title));
    return (bad ? cards.slice(0, min) : cards.reverse().slice(0, max)).map(c => c.id);
  },
  target(v, m){
    const sp = m.spec || {n:1}; const n = sp.n || 1;
    const ok = (m.cands || []).map((c, i) => ({c, i})).filter(x => x.c.ok);
    // a target I already decided on when choosing the spell
    const w = BOT.want; if (w && BOT.lastCast && w.k === BOT.lastCast.k){ const hit = ok.find(x => x.c.t === w.t.t && x.c.pid === w.t.pid && (x.c.id === w.t.id || w.t.t === 'player')); if (hit && n === 1){ BOT.want = null; return [hit.i]; } }
    const txt = botSrcText(m.title); let intent = targetIntent(txt, sp.desc);
    if (!intent){ const d = String(sp.desc || ''); intent = /you control|your/.test(d) ? 'help' : 'harm'; }
    if (sp.zone === 'gy'){ const mineFirst = /your graveyard/.test(txt) || intent === 'help'; const pool = ok.filter(x => (x.c.pid === MYPID) === mineFirst); const use = pool.length ? pool : (sp.upTo ? [] : ok);
      return use.sort((a, b) => BL.role(b.c.k).value - BL.role(a.c.k).value).slice(0, n).map(x => x.i); }
    const score = x => BL.candValue(v, x.c);
    if (intent === 'help'){
      const own = ok.filter(x => x.c.pid === MYPID); const use = own.length ? own : (sp.upTo ? [] : ok.filter(x => x.c.t !== 'player'));
      return use.sort((a, b) => (own.length ? score(b) - score(a) : score(a) - score(b))).slice(0, n).map(x => x.i);
    }
    const opp = ok.filter(x => x.c.pid !== MYPID);
    if (opp.length){
      // burn at a player: whoever is lowest when it's lethal, otherwise the biggest threat; creatures by value
      return opp.sort((a, b) => score(b) - score(a)).slice(0, n).map(x => x.i);
    }
    if (sp.upTo) return [];
    return ok.sort((a, b) => score(a) - score(b)).slice(0, n).map(x => x.i);     // forced to hit my own: the least valuable
  },
  number(v, m){
    if (/choose x/i.test(m.title || '')){ const lc = BOT.lastCast; const base = lc ? BL.costN({k:lc.k, id:lc.id}, S.cz.some(c => c.id === lc.id) ? 'cz' : 'hand') : 0; return Math.max(0, botManaAvail() - base); }
    return +m.def || 0;
  },
  pay(v, cost, why){
    let n = 0; try { const pc = parseCost(cost); n = pc.gen + MANA.reduce((s, x) => s + (pc.col[x] || 0), 0); } catch { n = 1; }
    if (why === 'counter') return true;
    const avail = botManaAvail(); if (avail < n) return false;
    if (!v.mine) return true;                                        // on someone else's turn, spare mana is free
    const want = this.plan ? this.plan(v).reduce((s, x) => s + x.cost, 0) : 0;
    return avail - n >= want;
  },
  pw(v, m, avail){
    const c = find(m.id)[2]; if (!c) return avail[0] ?? -1;
    const abs = loyaltyAbs(c); const loy = c.co || 0;
    const cand = avail.map(i => ({i, ab:abs[i], cost:+abs[i].cost || 0}));
    const oppThreat = v.opps.some(o => botCreatures(o.bf, o.pid).some(x => permValue(x, o.pid) >= 6));
    const kill = cand.filter(x => x.cost < 0 && loy + x.cost >= 1 && /destroy|exile|damage|-\d+\/-\d+/i.test(x.ab.eff)).sort((a, b) => b.cost - a.cost)[0];
    if (kill && oppThreat) return kill.i;
    const plus = cand.filter(x => x.cost >= 0).sort((a, b) => b.cost - a.cost)[0]; if (plus) return plus.i;
    const safe = cand.filter(x => loy + x.cost >= 1).sort((a, b) => b.cost - a.cost)[0];
    return safe ? safe.i : -1;
  },
});
