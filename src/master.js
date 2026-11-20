/* ===================== master.js: the Master bot (stage 3a) — Very hard + look-ahead search =====================
   Master plays like Very hard, but at the decisions that matter (main-phase casting and sequencing, removal targets, attacks,
   blocks, counterspell responses) it searches: every candidate move is tried in a small abstract model of the game and played
   out 2–3 turns ahead with a fast rollout policy, many times, against sampled opponent hands. The move with the best average
   evaluation wins — but only when it beats Very hard's own move clearly (paired samples, common random numbers); otherwise
   Master keeps Very hard's move. Anything the model can't represent (combo pieces, bombs, activated abilities, odd stack items)
   falls back to Very hard.
   Hidden information: the model is built from botView() (my own state + public state) only. Opponents' hands are hidden: each
   rollout fills them with cards sampled from what any player at the table knows — the card list every player publishes for its
   deck (minus cards already seen), its colours, its hand size. My own library is sampled from my deck list minus the cards I
   can see (never its order).
   Time: default 1.5 s per decision (hard cap 4 s), in 12 ms slices that yield to the page, so 3 Master bots in one tab keep the
   UI responsive. The number of rollouts is fixed (seeded) so results don't depend on machine speed unless the budget runs out.
   botAdvise('master', state) returns Very hard-compatible advice plus alts: the top 3 moves with scores and short reasons. */

const MS = {
  budget:1500, cap:4000, slice:12, rounds:200, minRounds:32, margin:4,
  deckOf:new Map(), cmC:new Map(), cache:new Map(), busy:false, kick:null, last:null, n:0,
  stats:{searches:0, ms:0, maxMs:0, rollouts:0, deviations:0, byPoint:{}, cpu:0, slices:0, maxSlice:0},
  LAND_FRAC:0.38,
};

/* ---------------------------------------------------------------- 1. public deck lists: the card chunks every player publishes */
{
  const om = onMqMessage;
  onMqMessage = function(topic, payload){
    try {
      const parts = String(topic).split('/');
      if (parts[3] === 'c' && parts[4] && payload && payload.length && (typeof MYPID === 'undefined' || parts[4] !== MYPID)){
        const d = JSON.parse(new TextDecoder().decode(payload));
        if (d && Array.isArray(d.cards)){ const set = MS.deckOf.get(parts[4]) || new Set(); d.cards.slice(0, 60).forEach(a => { if (a && a.k && !a.tok) set.add(a.k); }); MS.deckOf.set(parts[4], set); }
      }
    } catch {}
    return om.apply(this, arguments);
  };
}

/* ---------------------------------------------------------------- 2. card abstraction */
MS.rng = seed => { let a = (seed >>> 0) || 1; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
MS.hash = s => { s = String(s); let h = 2166136261; for (let i = 0; i < s.length; i++){ h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
MS.NUM = {a:1, an:1, one:1, two:2, three:3, four:4, five:5, six:6, seven:7, x:3, that:2};
MS.cval = (R, p, t, f) => {
  let v = (R.value || 0.2) * 4 + Math.max(0, p) * 1.5 + Math.max(0, t) * 0.5;
  if (f.fly || f.unbl) v += 1.5 + Math.max(0, p) * 0.5; if (f.dt) v += 1.5; if (f.ds) v += Math.max(0, p); if (f.ll) v += 1; if (f.tr) v += 0.5; if (f.inf) v += 2; if (f.ind) v += 1.5; if (f.hex) v += 1;
  return v;
};
// what a card in hand would do, in the model's terms
MS.cm = k => {
  if (MS.cmC.has(k)) return MS.cmC.get(k);
  const R = BL.role(k); const a = info(k) || {}; const t = R.text || ''; const kw = R.kw || new Set(); const roles = R.roles || new Set();
  let kind;
  if (R.land) kind = 'land';
  else if (roles.has('wipe') && !R.creature && !R.pw) kind = 'wipe';
  else if (!R.perm && roles.has('counter')) kind = 'counter';
  else if (!R.perm && roles.has('removal')) kind = 'removal';
  else if (R.creature) kind = 'creature';
  else if (R.pw) kind = 'pw';
  else if (!R.perm && roles.has('ramp') && /(?:^|\n)add \{/.test(t)) kind = 'ritual';
  else if (!R.perm && roles.has('draw')) kind = 'draw';
  else if (roles.has('ramp')) kind = 'ramp';
  else if (R.perm) kind = 'perm';
  else kind = 'spell';
  const f = {fly:kw.has('flying'), reach:kw.has('reach'), fs:kw.has('first strike') || kw.has('double strike'), ds:kw.has('double strike'), tr:kw.has('trample'), dt:kw.has('deathtouch'), ll:kw.has('lifelink'),
    ind:kw.has('indestructible'), inf:kw.has('infect'), men:kw.has('menace'), vig:kw.has('vigilance'), haste:kw.has('haste'), hex:kw.has('hexproof') || kw.has('shroud'), def:kw.has('defender') || /(^|\n)~ can't attack\b/.test(t), unbl:kw.has('unblockable')};
  const dm = t.match(/\bdraws? (a|an|one|two|three|four|five|six|seven|x|\d+) (?:additional )?cards?/);
  const dmg = BH.dmgOf(t);
  const unk = roles.has('bomb') || roles.has('wincon') || roles.has('combo') || (roles.has('combopiece') && !R.creature) || roles.has('tutor') && !R.perm;
  const cm = {k, kind, cost:R.mv || 0, x:/\{X\}/.test(a.m || ''), inst:!!R.instant, p:R.pow | 0, t:R.tou | 0, ...f, val:0, drawN:dm ? (MS.NUM[dm[1]] || +dm[1] || 1) : 0,
    dmg:dmg && !dmg.shrink ? dmg.dmg : 0, shrink:dmg && dmg.shrink ? dmg.dmg : 0, rAny:/target (?:nonland |nonartifact |noncreature )?permanent|creature or planeswalker|any target|target planeswalker|artifact or enchantment|target (?:artifact|enchantment)\b/.test(t),
    bounce:/return target [^.]*to (?:its|their) owner'?s'? hand/.test(t), destroy:/\bdestroy target/.test(t), face:/any target|target (?:player|opponent)|each opponent/.test(t),
    eng:R.perm && !R.creature && !R.land && (roles.has('draw') || roles.has('token')) && /whenever|at the beginning|\{t\}/.test(t), rock:R.perm && !R.creature && roles.has('ramp'),
    unk, mod:!unk && kind !== 'spell', n:a.n || '', cols:a.c || ''};
  if (kind === 'creature' && roles.has('removal') && /\bwhen(?:ever)? ~ enters\b/.test(t)) cm.etb = true;          // Ravenous Chupacabra & co: a body plus removal
  if (kind === 'creature') cm.val = MS.cval(R, cm.p, cm.t, f) + (cm.eng || roles.has('draw') || roles.has('token') ? 1.5 : 0);
  else if (kind === 'pw') cm.val = (R.value || 0.3) * 4 + 6;
  else if (kind === 'perm' || kind === 'ramp') cm.val = (R.value || 0.2) * 4 + (cm.rock ? 1.5 : 0) + (cm.eng ? 2 : 0) + (roles.has('combopiece') ? 3 : 0);
  else cm.val = (R.value || 0.2) * 4;
  if (kind === 'ritual'){ const am = t.match(/(?:^|\n)add ((?:\{[wubrgc]\})+)/); cm.gain = am ? (am[1].match(/\{/g) || []).length : 1; }
  if (kind === 'pw'){ const lm = String(a.loy ?? a.l ?? '').match(/\d+/); cm.loy = lm ? +lm[0] : 3; }
  MS.cmC.set(k, cm); return cm;
};
MS.GEN = null;
MS.generic = () => MS.GEN || (MS.GEN = {
  land:{k:'gen:land', kind:'land', cost:0, val:0.5, mod:true},
  cr:{k:'gen:cr', kind:'creature', cost:3, p:3, t:3, val:7, mod:true},
  rem:{k:'gen:rem', kind:'removal', cost:2, val:2, rAny:false, destroy:true, mod:true},
  draw:{k:'gen:draw', kind:'draw', cost:3, drawN:2, val:1.5, mod:true},
  ctr:{k:'gen:ctr', kind:'counter', cost:2, val:2, mod:true},
});
// attack triggers and static attack pumps on one attacker (the "foresee attack triggers" fix): +P/+T it will have once it attacks
MS.atkPump = (k, nAtt, alone) => {
  const t = BL.role(k).text || ''; let p = 0, q = 0, m;
  if ((m = t.match(/whenever ~ attacks[^.]*?, (?:it|~) gets \+(\d+)\/\+(\d+)/))) { p += +m[1]; q += +m[2]; }
  if ((m = t.match(/whenever ~ attacks, it gets \+x\/\+0[^.]*for each other attacking creature/))) p += Math.max(0, nAtt - 1);
  if (/\bbattle cry\b/.test(t)) p += 0;      // battle cry pumps the others (team part below)
  return [p, q];
};
MS.teamPump = (ks, n) => {           // pumps one attacker gets from its attacking team-mates and from statics on my board
  let p = 0, q = 0, m;
  ks.forEach(t => {
    if (/\bbattle cry\b/.test(t)) p += 1;
    if ((m = t.match(/whenever ~ attacks, (?:other )?(?:attacking )?creatures you control get \+(\d+)\/\+(\d+)/))) { p += +m[1]; q += +m[2]; }
    if ((m = t.match(/(?:^|\n)attacking creatures you control get \+(\d+)\/\+(\d+)/))) { p += +m[1]; q += +m[2]; }
    if ((m = t.match(/whenever (?:a|another) creature you control attacks, it gets \+(\d+)\/\+(\d+)/))) { p += +m[1]; q += +m[2]; }
  });
  return [p, q];
};

/* ---------------------------------------------------------------- 3. snapshot: the bot's view → compact model state */
MS.unitOf = (c, pid) => {
  const m = BH.model(c, pid); const r = BL.role(c.k); const t = r.text || '';
  const kw = w => botKw(c, w, pid);
  let sick = false; if (pid === MYPID){ try { sick = !!c.sk && hasHaste(c) === false; } catch {} } else sick = !!c.sk && !kw('haste');
  return {...m, c:undefined, vig:kw('vigilance'), haste:kw('haste'), def:kw('defender') || /(^|\n)~ can't attack\b/.test(t), unbl:r.kw.has('unblockable') || /(^|\n|\. )~ can't be blocked(\.|$)/m.test(t),
    hex:kw('hexproof') || kw('shroud'), noBlk:/(^|\n)~ can't block\b/.test(t), tap:BH.tapped(c), sick, pw:false, srcK:c.k, txt:t};
};
MS.canB = (B, A) => !B.tap && !B.noBlk && !A.unbl && (!A.fly || B.fly || B.reach);
MS.isSrc = c => { if (!c.k || c.fd) return false; if (isLand(c.k)) return true; const r = BL.role(c.k); return !!(r.roles.has('ramp') && r.perm && /\{t\}[^:\n]*: add\b/.test(r.text)); };
MS.myLibPool = () => {
  const cnt = new Map(); (S.deck && S.deck.main || []).forEach(e => cnt.set(e.k, (cnt.get(e.k) || 0) + (e.q || 1)));
  for (const z of ['hand', 'bf', 'gy', 'ex']) (S[z] || []).forEach(c => { if (c && c.k && cnt.has(c.k)) cnt.set(c.k, cnt.get(c.k) - 1); });
  const out = []; cnt.forEach((n, k) => { for (let i = 0; i < n; i++) out.push(MS.cm(k)); });
  return out.length ? out : null;
};
MS.oppPool = o => {
  const ks = MS.deckOf.get(o.pid); if (!ks || !ks.size) return null;
  const seen = new Set(); (o.bf || []).forEach(c => c.k && seen.add(c.k)); (o.gy || []).forEach(k => seen.add(k)); (OPP.get(o.pid)?.ex || []).forEach(k => seen.add(k)); (o.cz || []).forEach(z => seen.add(z.k || z));
  const lands = [], spells = [];
  ks.forEach(k => { if (seen.has(k) || !info(k)) return; const cm = MS.cm(k); (cm.kind === 'land' ? lands : spells).push(cm); });
  if (!spells.length) return null;
  return {lands:lands.length ? lands : [MS.generic().land], spells};
};
MS.genPool = o => { const g = MS.generic(); const blue = /U/.test(((OPP.get(o.pid)?.cmd || []).map(k => info(k)?.ci || '').join(''))); return {lands:[g.land], spells:[g.cr, g.cr, g.cr, g.rem, g.draw, ...(blue ? [g.ctr] : [g.cr])]}; };
MS.snap = v => {
  const G = {t:0, act:0, st:1, me:0, over:false, P:[]};
  const pn = v.pn;
  const side = (pid, s, mine) => {
    const bf = s.bf || [];
    const P = {pid, me:mine, alive:true, life:s.life, psn:s.psn || 0, hand:[], hn:0, libN:mine ? S.lib.length : (s.libN || 40), cr:[], pws:[], oval:0, eng:0, lands:0, srcs:0, mana:0, open:0, landDrop:false, cz:[], pool:null, nid:1, cmdT:0};
    bf.forEach(c => {
      if (!c.k || c.fd) { if (c.fd) P.oval += 2; return; }
      if (MS.isSrc(c)){ P.srcs++; if (isLand(c.k)) P.lands++; if (!BH.tapped(c)) P.open++; }
      if (BH.isCr(c)) P.cr.push(MS.unitOf(c, pid));
      else if (isPW(c)) P.pws.push({id:c.id, loy:c.co || 0, val:BH.val(c, pid)});
      else if (!isLand(c.k)){ P.oval += BH.val(c, pid); const cm = MS.cm(c.k); if (cm.eng) P.eng++; }
    });
    P.pws.forEach(() => P.eng++);
    return P;
  };
  const me = side(MYPID, {bf:v.me.bf, life:v.me.life, psn:v.me.psn}, true);
  me.hand = v.me.hand.map(c => ({cm:MS.cm(c.k), id:c.id}));
  me.cz = (v.me.cz || []).map(c => ({cm:MS.cm(c.k), id:c.id, tax:(S.tax && S.tax[c.k]) || 0}));
  me.hn = me.hand.length; me.pool = MS.myLibPool() || [MS.generic().land, MS.generic().cr];
  me.mana = botManaAvail(); if (!pn.mine) me.open = me.mana;
  me.landDrop = pn.mine ? !!v.landPlayed : false;
  G.P.push(me);
  v.opps.forEach(o => { if (o.life <= 0) return; const P = side(o.pid, o, false); P.hn = o.hc || 0; P.cz = (o.cz || []).map(z => ({cm:MS.cm(z.k || z), id:0, tax:z.tax || 0})).filter(z => z.cm && z.cm.kind !== 'land');
    P.pool = MS.oppPool(o) || MS.genPool(o); P.mana = pn.pid === o.pid ? P.open : 0; G.P.push(P); });
  G.act = Math.max(0, G.P.findIndex(P => P.pid === pn.pid));
  G.st = pn.ph <= 3 ? 1 : pn.ph === 4 ? 3 : pn.ph === 5 ? 3 : 4;
  return G;
};
MS.clone = G => ({t:G.t, act:G.act, st:G.st, me:G.me, over:G.over, P:G.P.map(P => ({...P, hand:P.hand.slice(), cz:P.cz.map(z => ({...z})), cr:P.cr.map(u => ({...u})), pws:P.pws.map(w => ({...w}))}))});
// fill the hidden hands: opponents get hn cards sampled from their public pool
MS.sample = (P, R) => { const pl = P.pool; if (Array.isArray(pl)) return pl[Math.floor(R() * pl.length)]; return R() < MS.LAND_FRAC ? pl.lands[Math.floor(R() * pl.lands.length)] : pl.spells[Math.floor(R() * pl.spells.length)]; };
MS.determinize = (G, R) => { G.P.forEach(P => { if (P.me) return; P.hand = []; for (let i = 0; i < P.hn; i++) P.hand.push({cm:MS.sample(P, R), id:0}); }); return G; };

/* ---------------------------------------------------------------- 4. forward model */
MS.boardV = P => P.cr.reduce((s, u) => s + u.val, 0) + P.pws.reduce((s, w) => s + w.val + w.loy * 0.5, 0) + P.oval;
MS.power = P => P.cr.reduce((s, u) => s + (u.def ? 0 : u.p * (u.n || 1) * (u.ds ? 2 : 1)), 0);
MS.kill = (G, i) => { const P = G.P[i]; if (!P.alive) return; P.alive = false; P.cr = []; P.pws = [];
  if (!G.P[G.me].alive || G.P.every((Q, j) => j === G.me || !Q.alive)) G.over = true; };
MS.checkDead = G => G.P.forEach((P, i) => { if (P.alive && (P.life <= 0 || P.psn >= 10)) MS.kill(G, i); });
MS.draw = (G, i, R, n) => { const P = G.P[i]; for (let k = 0; k < n; k++){ if (P.libN <= 0){ P.life = 0; break; } P.libN--; P.hand.push({cm:MS.sample(P, R), id:0}); } MS.checkDead(G); };
MS.newUnit = (P, cm) => ({id:'m' + (P.nid++), k:cm.k, p:cm.p | 0, t:Math.max(1, cm.t | 0), dmg:0, fs:!!cm.fs, ds:!!cm.ds, tr:!!cm.tr, dt:!!cm.dt, ll:!!cm.ll, ind:!!cm.ind, inf:!!cm.inf, fly:!!cm.fly, reach:!!cm.reach,
  men:!!cm.men, n:1, cmd:false, val:cm.val, vig:!!cm.vig, haste:!!cm.haste, def:!!cm.def, unbl:!!cm.unbl, hex:!!cm.hex, noBlk:false, tap:false, sick:!cm.haste, pw:false, srcK:cm.k, txt:''});
// the best thing for player i to destroy with this removal (most valuable it can legally kill), across all opponents
MS.remTarget = (G, i, cm) => {
  let best = null, bv = 0;
  G.P.forEach((Q, j) => { if (j === i || !Q.alive) return;
    const w = G.P.length > 2 ? 0.7 + 0.6 * (MS.boardV(Q) + (40 - Q.life) * 0.1) / Math.max(1, ...G.P.map((X, x) => x === i || !X.alive ? 0 : MS.boardV(X) + (40 - X.life) * 0.1)) : 1;
    Q.cr.forEach(u => { if (u.hex) return; if (cm.dmg && u.t - (u.dmg || 0) > cm.dmg) return; if (cm.shrink && u.t > cm.shrink) return; if (cm.destroy && u.ind && !cm.bounce) return;
      const v = (cm.bounce ? u.val * 0.45 : u.val) * w; if (v > bv){ bv = v; best = {j, u}; } });
    if (cm.rAny || cm.dmg) Q.pws.forEach(p => { if (cm.dmg && cm.dmg < p.loy) return; const v = (p.val + 1) * w; if (v > bv){ bv = v; best = {j, pw:p}; } });
  });
  return best ? {...best, v:bv} : null;
};
MS.applyRem = (G, tg, cm) => {
  const Q = G.P[tg.j];
  if (tg.u){ const ix = Q.cr.indexOf(tg.u); if (ix >= 0){ Q.cr.splice(ix, 1); if (cm.bounce){ Q.hand.push({cm:MS.cm(tg.u.srcK) || MS.generic().cr, id:0}); Q.hn = Q.hand.length; } } }
  else if (tg.pw){ const ix = Q.pws.indexOf(tg.pw); if (ix >= 0){ Q.pws.splice(ix, 1); Q.eng = Math.max(0, Q.eng - 1); } }
  else if (tg.face){ Q.life -= cm.dmg; MS.checkDead(G); }
};
// how much the other players would want to counter this spell (from player j's point of view)
MS.impact = (G, i, cm, j) => {
  switch (cm.kind){
    case 'creature': case 'pw': case 'perm': return cm.val + (cm.unk ? 6 : 0);
    case 'wipe': return Math.max(0, MS.boardV(G.P[j]) - MS.boardV(G.P[i]) * 0.5);
    case 'removal': { const tg = MS.remTarget(G, i, cm); return tg && tg.j === j ? tg.v : 0; }
    case 'draw': return 1.5 * cm.drawN;
    case 'ramp': return 2;
    default: return cm.unk ? 8 : 1;
  }
};
MS.tryCounter = (G, i, cm) => {
  for (let j = 0; j < G.P.length; j++){
    const Q = G.P[j]; if (j === i || !Q.alive) continue;
    const ci = Q.hand.findIndex(h => h.cm.kind === 'counter' && h.cm.cost <= Q.open); if (ci < 0) continue;
    if (MS.impact(G, i, cm, j) < 5) continue;
    Q.open -= Q.hand[ci].cm.cost; Q.hand.splice(ci, 1); Q.hn = Q.hand.length; return true;
  }
  return false;
};
// player i casts cm (already removed from hand, mana paid). tgt: forced removal target (root moves); R: rng
MS.resolve = (G, i, cm, R, tgt) => {
  const P = G.P[i];
  switch (cm.kind){
    case 'creature': P.cr.push(MS.newUnit(P, cm)); if (cm.etb){ const tg = tgt || MS.remTarget(G, i, cm); if (tg) MS.applyRem(G, tg, cm); } break;
    case 'pw': P.pws.push({id:'w' + (P.nid++), loy:cm.loy || 3, val:cm.val}); P.eng++; break;
    case 'perm': P.oval += cm.val; if (cm.eng) P.eng++; if (cm.rock) P.srcs++; break;
    case 'ramp': P.srcs++; if (/treasure|untapped/.test(BL.role(cm.k).text || '')) P.mana++; if (BL.role(cm.k).perm) P.oval += cm.val * 0.5; break;
    case 'draw': MS.draw(G, i, R, cm.drawN || 1); break;
    case 'ritual': P.mana += cm.gain || 1; break;
    case 'removal': { const tg = tgt || MS.remTarget(G, i, cm); if (tg) MS.applyRem(G, tg, cm); break; }
    case 'wipe': G.P.forEach(Q => { Q.cr = Q.cr.filter(u => u.ind); }); break;
    default: P.oval += cm.val * 0.4;
  }
};
MS.cast = (G, i, h, R, tgt) => {
  const P = G.P[i]; const cm = h.cm; let cost = (cm.x ? Math.max(cm.cost, P.mana) : cm.cost) + (h.tax || 0);
  P.mana -= cost;
  if (h.cz){ const z = P.cz.find(z => z === h.cz); if (z){ P.cz.splice(P.cz.indexOf(z), 1); z.tax = (z.tax || 0) + 2; P.cmdT = 1; } }
  else { const ix = P.hand.indexOf(h); if (ix >= 0) P.hand.splice(ix, 1); P.hn = P.hand.length; }
  if (!cm.unk && MS.tryCounter(G, i, cm)) return false;
  MS.resolve(G, i, cm, R, tgt); return true;
};
// rollout policy: what a strong-ish player casts this main phase
MS.castScore = (G, i, cm, stage) => {
  const P = G.P[i];
  switch (cm.kind){
    case 'creature': { let s = cm.val + (cm.haste && stage === 1 ? 1.5 : 0) + 1; if (cm.etb){ const tg = MS.remTarget(G, i, cm); s += tg ? tg.v * 0.6 : -2; } return s; }
    case 'pw': return cm.val + 2;
    case 'perm': return cm.val * 0.9 + (cm.rock && P.srcs < 7 ? 2 : 0);
    case 'ramp': return P.srcs < 7 ? 4 : 1;
    case 'draw': return P.libN > 8 ? 1.5 * (cm.drawN || 1) + 0.5 : -5;
    case 'ritual': return P.hand.some(h => h.cm.kind !== 'land' && h.cm.kind !== 'ritual' && h.cm.kind !== 'counter' && h.cm.cost > P.mana && h.cm.cost <= P.mana - cm.cost + (cm.gain || 1)) ? 5 : 0;
    case 'removal': { if (cm.inst && stage === 1) return 0; const tg = MS.remTarget(G, i, cm); return tg && tg.v >= 4 ? 2 + tg.v * 0.6 : 0; }
    case 'wipe': { let theirs = 0; G.P.forEach((Q, j) => { if (j !== i && Q.alive) theirs = Math.max(theirs, Q.cr.reduce((s, u) => s + u.val, 0)); }); const mine = P.cr.reduce((s, u) => s + u.val, 0); return theirs - mine >= 7 ? theirs - mine : 0; }
    case 'counter': return 0;
    default: return cm.unk ? 3 : cm.val * 0.3;
  }
};
MS.mainPol = (G, i, R, stage) => {
  const P = G.P[i]; if (!P.alive || G.over) return;
  if (!P.landDrop){ const li = P.hand.findIndex(h => h.cm.kind === 'land'); if (li >= 0){ P.hand.splice(li, 1); P.hn = P.hand.length; P.lands++; P.srcs++; P.mana++; P.landDrop = true; } }
  const ctr = P.hand.find(h => h.cm.kind === 'counter'); const keep = ctr ? ctr.cm.cost : 0;
  for (let guard = 0; guard < 8 && !G.over; guard++){
    let best = null, bs = 0.5;
    const look = h => { const cm = h.cm; if (cm.kind === 'land' || cm.kind === 'counter') return; const cost = cm.cost + (h.tax || 0); if (cost > P.mana) return;
      let s = MS.castScore(G, i, cm, stage); if (keep && P.mana - cost < keep && s < 6) s = 0; if (s > bs){ bs = s; best = h; } };
    P.hand.forEach(look); P.cz.forEach(z => look({cm:z.cm, tax:z.tax, cz:z}));
    if (!best) break;
    MS.cast(G, i, best, R, null);
  }
};
MS.untap = (G, i) => { const P = G.P[i]; P.cr.forEach(u => { u.tap = false; u.sick = false; u.dmg = 0; }); P.landDrop = false; P.mana = P.srcs; };
// a quick defender: blocks that kill without dying, fair trades, chumps only under lethal pressure
MS.quickBlocks = (atts, D) => {
  const blks = D.cr.filter(u => !u.tap && !u.noBlk); const used = new Set(); const out = new Map();
  let incoming = 0; atts.forEach(A => { incoming += A.p * (A.ds ? 2 : 1); });
  const pressure = D.life - incoming <= 0 ? 2 : D.life - incoming <= 4 ? 1 : 0;
  const order = atts.slice().sort((a, b) => b.p - a.p);
  for (const A of order){
    if (A.men) continue;
    let best = null, bs = 0.15;
    for (const B of blks){ if (used.has(B) || !MS.canB(B, A)) continue;
      const r = BH.fight(A, [B]); const bDead = r.dead.length > 0;
      let s = (r.aDead ? A.val : 0) - (bDead ? B.val : 0) + (pressure ? A.p * (A.ds ? 2 : 1) * (pressure === 2 ? 3 : 0.6) : 0.2);
      if (!r.aDead && bDead && !pressure) s = -1;
      if (s > bs){ bs = s; best = B; } }
    if (best){ used.add(best); out.set(A, [best]); }
  }
  return out;
};
MS.pumpAtts = (P, atts) => {
  if (!atts.length) return atts;
  const team = atts.map(u => u.txt || BL.role(u.srcK).text || '').concat(P.cr.filter(u => !atts.includes(u)).map(u => /attacking creatures you control get/.test(u.txt || '') ? u.txt : ''));
  return atts.map(u => { const [p1, t1] = MS.atkPump(u.srcK, atts.length, atts.length === 1); const others = team.filter((x, ix) => ix !== atts.indexOf(u));
    const [p2, t2] = MS.teamPump(others, atts.length); const ex = atts.length === 1 ? P.cr.reduce((s, x) => s + (/\bexalted\b/.test(x.txt || '') ? 1 : 0), 0) : 0;
    return p1 + p2 + ex || t1 + t2 + ex ? {...u, p:u.p + p1 + p2 + ex, t:u.t + t1 + t2 + ex, base:u} : u; });
};
// rollout attack policy: none / all / only the safe ones, judged by a one-step look (damage, trades, crack-back)
MS.attackPol = (G, i) => {
  const P = G.P[i]; if (!P.alive || G.over) return;
  const ready = P.cr.filter(u => !u.tap && (!u.sick || u.haste) && !u.def && u.p > 0); if (!ready.length) return;
  let j = -1, jl = 1e9; G.P.forEach((Q, x) => { if (x === i || !Q.alive) return; const l = Q.life - (x === G.me ? 0.5 : 0); if (l < jl){ jl = l; j = x; } }); if (j < 0) return;
  const D = G.P[j];
  const theirPow = D.cr.reduce((s, u) => s + (u.def ? 0 : u.p * (u.ds ? 2 : 1)), 0);
  const evalSet = set => {
    const atts = MS.pumpAtts(P, set); const bl = MS.quickBlocks(atts, D);
    let thru = 0, gain = 0; atts.forEach(A => { const b = bl.get(A) || []; const r = BH.fight(A, b); thru += r.thru; if (r.aDead) gain -= A.val; r.dead.forEach(() => { gain += b[0].val; }); });
    if (thru >= D.life) return {s:1000, atts, bl};
    const home = P.cr.filter(u => !set.includes(u) || u.vig);
    const blockAbs = home.length; const sortedTheirs = D.cr.filter(u => !u.def).map(u => u.p * (u.ds ? 2 : 1)).sort((a, b) => b - a);
    const unblocked = sortedTheirs.slice(blockAbs).reduce((s, x) => s + x, 0);
    const crack = P.life - unblocked <= 0 ? -300 : -BH.lifeCost(P.life, unblocked * 0.6, theirPow);
    return {s:gain + BH.lifeCost(D.life, thru, MS.power(P)) * 1.3 + 0.15 * thru + crack * 0.7, atts, bl};
  };
  const safe = ready.filter(u => { const D2 = D.cr.filter(b => !b.tap && MS.canB(b, u)); return !D2.some(b => { const r = BH.fight(u, [b]); return r.aDead && !r.dead.length; }); });
  const opts = [ready, safe]; let best = null, bs = 0;
  for (const set of opts){ if (!set.length) continue; const r = evalSet(set); if (r.s > bs){ bs = r.s; best = r; } }
  if (!best) return;
  best.atts.forEach(A => { const u = A.base || A; if (!u.vig) u.tap = true; });
  const blocks = new Map(); best.bl.forEach((bs2, A) => blocks.set(A, bs2));
  MS.combatTracked(G, i, j, best.atts, blocks, null);
};
MS.endTurn = (G, i) => { const P = G.P[i]; P.open = P.mana; G.P.forEach(Q => Q.cr.forEach(u => { u.dmg = 0; })); P.hn = P.hand.length; };
MS.turnFrom = (G, i, R, st) => {
  const P = G.P[i]; if (!P.alive || G.over) return;
  if (st <= 0){ MS.untap(G, i); MS.draw(G, i, R, 1); for (let e = 0; e < Math.min(3, P.eng || 0); e++) if (R() < 0.5) MS.draw(G, i, R, 1); if (G.over) return; }
  if (st <= 1) MS.mainPol(G, i, R, 1);
  if (st <= 2) MS.attackPol(G, i);
  if (st <= 3) MS.mainPol(G, i, R, 3);
  MS.endTurn(G, i);
};
MS.nextAlive = (G, i) => { for (let k = 1; k <= G.P.length; k++){ const j = (i + k) % G.P.length; if (G.P[j].alive) return j; } return i; };
// play the rest of the current turn (from stage st) and H more turns
MS.rollout = (G, R, st, H) => {
  let i = G.act; MS.turnFrom(G, i, R, st);
  for (let h = 0; h < H && !G.over; h++){ i = MS.nextAlive(G, i); G.t++; G.act = i; MS.turnFrom(G, i, R, 0); }
  return G;
};
MS.lifeV = L => L <= 0 ? -60 : 14 * Math.sqrt(L);
MS.sideV = P => {
  if (!P.alive) return -1000;
  return MS.lifeV(P.life) - P.psn * 3 + MS.boardV(P) + 2.4 * Math.min(P.hand.length || P.hn, 8) + 1.1 * Math.min(P.srcs, 9) + 1.5 * (P.eng || 0) + (P.libN < 5 ? -8 : 0);
};
MS.evalG = (G, horizonT) => {
  const me = G.P[G.me];
  if (!me.alive) return -1000 + (G.t || 0) * 5;
  const others = G.P.filter((P, j) => j !== G.me && P.alive);
  if (!others.length) return 1000 - (G.t || 0) * 5;
  const vs = others.map(MS.sideV); const mx = Math.max(...vs), mean = vs.reduce((s, x) => s + x, 0) / vs.length;
  return MS.sideV(me) - (others.length === 1 ? vs[0] : 0.55 * mx + 0.45 * mean);
};

/* ---------------------------------------------------------------- 5. root decisions: candidates in model form + the real move */
MS.horizon = G => Math.max(3, G.P.filter(P => P.alive).length);
// MAIN: cast one of my spells (with a chosen target for removal), or pass (hold everything for later)
MS.mainCands = (v, a0) => {
  const out = []; const avail = botManaAvail();
  const key = a => a ? `${a.how}:${a.c && a.c.id}:${a.want ? a.want.pid + '/' + (a.want.id ?? 'p') : ''}` : 'pass';
  const add = (a, why) => { const k = key(a); if (out.some(x => x.key === k)) return; out.push({key:k, a, why}); };
  add(a0, 'Very hard');
  if (a0) add(null, 'hold');
  for (const x of botCastable()){
    const cm = MS.cm(x.c.k); if (!cm.mod || cm.kind === 'counter' || cm.kind === 'land') continue;
    const cost = BL.costN(x.c, x.zone); if (cost > avail) continue;
    if (cm.kind === 'removal'){
      const txt = BL.role(x.c.k).text; const cs = BL.cands(x.c).filter(q => q.pid !== MYPID && q.t === 'card').map(q => ({q, s:BH.candValue(v, q, txt, true)})).sort((a, b) => b.s - a.s).slice(0, 3);
      cs.forEach(({q}) => add({how:'cast', c:x.c, zone:x.zone, want:q, why:'at ' + (q.nm || '')}, 'removal'));
    } else if (cm.kind === 'creature' || cm.kind === 'pw' || cm.kind === 'perm' || cm.kind === 'ramp' || cm.kind === 'draw' || cm.kind === 'wipe' || cm.kind === 'ritual') add({how:'cast', c:x.c, zone:x.zone, why:cm.kind}, cm.kind);
    if (out.length >= 9) break;
  }
  return out;
};
MS.applyMain = (G, cand, R) => {
  const a = cand.a; const P = G.P[G.me];
  if (!a) return G.st === 1 ? 2 : 4;              // pass: main 1 → combat; main 2 → end of turn
  let h = P.hand.find(x => x.id === a.c.id);
  if (!h){ const z = P.cz.find(z => z.id === a.c.id); if (z) h = {cm:z.cm, tax:z.tax, cz:z}; }
  if (!h) return G.st;
  let tgt = null;
  if (a.want && h.cm.kind === 'removal'){ const j = G.P.findIndex(Q => Q.pid === a.want.pid); if (j >= 0){ const Q = G.P[j]; const u = Q.cr.find(u => u.id === a.want.id); const w = Q.pws.find(w => w.id === a.want.id);
    tgt = u ? {j, u} : w ? {j, pw:w} : null; if (!tgt){ const c = boardOf(a.want.pid).find(b => b.id === a.want.id); if (c){ const val = BH.val(c, a.want.pid); tgt = {j, perm:val}; } } } }
  const cost = (h.cm.x ? Math.max(h.cm.cost, P.mana) : h.cm.cost) + (h.tax || 0); if (cost > P.mana + 0.5) P.mana = cost;      // the real mana check was done by castCheck
  if (tgt && tgt.perm != null){ MS.cast(G, G.me, h, R, {j:tgt.j, face:false}); G.P[tgt.j].oval = Math.max(0, G.P[tgt.j].oval - tgt.perm); }
  else MS.cast(G, G.me, h, R, tgt);
  return G.st;                                   // keep playing this main phase with the policy
};
// ATTACK: plans {creatureId: defKey}
MS.attackCands = (v, sel0) => {
  const opts = defOpts(); const keys = new Set(opts.map(o => o.key));
  const mine = S.bf.filter(c => BH.isCr(c) && !canAttack(c));
  const out = []; const kk = s => mine.map(c => s[c.id] || '-').join(',');
  const add = (s, why) => { const clean = {}; for (const [id, d] of Object.entries(s)) if (d && keys.has(d)) clean[id] = d; const k = kk(clean); if (out.some(x => x.key === k)) return; out.push({key:k, sel:clean, why}); };
  add(sel0, 'Very hard'); add({}, 'no attack');
  const pls = opts.filter(o => o.key.startsWith('p:'));
  pls.forEach(o => { const s = {}; mine.forEach(c => { s[c.id] = o.key; }); add(s, 'all in at ' + o.label); });
  mine.slice(0, 7).forEach(c => { const s = {...sel0}; if (s[c.id]) delete s[c.id]; else if (pls.length) s[c.id] = (pls.find(o => Object.values(sel0).includes(o.key)) || pls[0]).key; add(s, (sel0[c.id] ? 'keep back ' : 'add ') + cname(c)); });
  // planeswalkers: send the smallest creature that can kill it, or the whole plan
  opts.filter(o => o.key.startsWith('c:')).forEach(o => { const d = parseDef(o.key); const w = (OPP.get(d.pid)?.bf || []).find(c => c.id === d.id); if (!w || !isPW(w)) return; const loy = w.co || 0;
    const ms = mine.map(c => ({c, p:botPT(c, MYPID)[0]})).filter(x => x.p >= loy).sort((a, b) => a.p - b.p);
    if (ms[0]){ const s = {...sel0}; s[ms[0].c.id] = o.key; add(s, 'kill ' + o.label); }
    const s2 = {}; mine.forEach(c => { s2[c.id] = o.key; }); add(s2, 'all at ' + o.label); });
  return out.slice(0, 12);
};
MS.applyAttack = (G, cand) => {
  const P = G.P[G.me];
  const byDef = new Map();
  for (const [id, d] of Object.entries(cand.sel)){ const u = P.cr.find(x => x.id === +id); if (!u) continue; (byDef.get(d) || byDef.set(d, []).get(d)).push(u); }
  for (const [d, us] of byDef){
    const pd = parseDef(d); const j = G.P.findIndex(Q => Q.pid === pd.pid); if (j < 0 || !G.P[j].alive) continue; const D = G.P[j];
    const pw = pd.t === 'card' ? D.pws.find(w => w.id === pd.id) : null;
    const atts = MS.pumpAtts(P, us); us.forEach(u => { if (!u.vig) u.tap = true; });
    const Bs = D.cr.filter(b => !b.tap && !b.noBlk);
    const ctx = {life:D.life, psn:D.psn, cdt:{}, canB:(B, A) => MS.canB(B, A), pumpP:0, press:MS.power(P), pw:pw ? Object.fromEntries(atts.map(A => [A.id, {val:pw.val, loy:pw.loy}])) : null};
    const ck = d; cand.sol = cand.sol || {};
    let plan = cand.sol[ck];
    if (!plan){ let sol; try { sol = BH.solveBlocks(atts, Bs, ctx); } catch { sol = {pick:[]}; }
      plan = cand.sol[ck] = sol.pick.filter(x => x.bl.length).map(x => [x.A.id, x.bl.map(b => b.id)]); }
    const blocks = new Map(); plan.forEach(([aid, bids]) => { const A = atts.find(a => a.id === aid); const bl = bids.map(id => Bs.find(b => b.id === id)).filter(Boolean); if (A && bl.length) blocks.set(A, bl); });
    MS.combatTracked(G, G.me, j, atts, blocks, pw);
  }
  return 3;
};
// combat that also removes the base unit when a pumped copy dies
MS.combatTracked = (G, i, j, atts, blocks, pwT) => {
  const P = G.P[i], D = G.P[j]; let thru = 0, psn = 0; const deadA = new Set(), deadB = new Set();
  atts.forEach(A => { const bl = (blocks.get(A) || []).filter(b => !deadB.has(b)); const r = BH.fight(A, bl);
    if (r.aDead) deadA.add(A.base || A); r.dead.forEach(id => { const b = bl.find(x => x.id === id); if (b) deadB.add(b.base || b); });
    if (A.inf) psn += r.thru; else thru += r.thru; if (r.gainA) P.life += r.gainA; if (r.gainB) D.life += r.gainB; });
  P.cr = P.cr.filter(u => !deadA.has(u)); D.cr = D.cr.filter(u => !deadB.has(u));
  if (pwT){ pwT.loy -= thru + psn; if (pwT.loy <= 0){ D.pws = D.pws.filter(w => w !== pwT); D.eng = Math.max(0, D.eng - 1); } }
  else { D.life -= thru; D.psn += psn; }
  MS.checkDead(G); return {thru, psn};
};
// BLOCK: {myBlockerId: attackerId}
MS.blockCands = (v, sel0) => {
  const pn = v.pn; const atts = attackersOnMe(pn); const mine = BH.myBlockers();
  const legal = (b, a) => { try { return !canBlock(b, a, pn.pid); } catch { return false; } };
  const out = []; const kk = s => Object.entries(s).map(([b, a]) => b + '>' + a).sort().join(',');
  const add = (s, why) => { const k = kk(s); if (out.some(x => x.key === k)) return; out.push({key:k, sel:s, why}); };
  add(sel0, 'Very hard'); add({}, 'no blocks');
  Object.keys(sel0).forEach(b => { const s = {...sel0}; delete s[b]; add(s, 'don\'t block with ' + cname(S.bf.find(c => c.id === +b) || {k:null})); });
  const used = new Set(Object.keys(sel0).map(Number));
  atts.forEach(a => { if (Object.values(sel0).includes(a.id)) return;
    const free = mine.filter(b => !used.has(b.id) && legal(b, a));
    if (!free.length) return;
    const big = free.slice().sort((x, y) => botPT(y, MYPID)[1] - botPT(x, MYPID)[1])[0];
    const cheap = free.slice().sort((x, y) => BH.val(x, MYPID) - BH.val(y, MYPID))[0];
    add({...sel0, [big.id]:a.id}, 'block ' + cname(a) + ' with ' + cname(big));
    if (cheap !== big) add({...sel0, [cheap.id]:a.id}, 'chump ' + cname(a) + ' with ' + cname(cheap)); });
  return out.slice(0, 10);
};
MS.applyBlock = (G, cand, v) => {
  const pn = v.pn; const j = G.P.findIndex(Q => Q.pid === pn.pid); if (j < 0) return 3; const A = G.P[j], P = G.P[G.me];
  const atts = attackersOnMe(pn); const byDef = new Map();
  atts.forEach(a => { const u = A.cr.find(x => x.id === a.id); if (!u) return; const d = parseDef(a.atk); const key = d && d.t === 'card' ? 'w' + d.id : 'p'; (byDef.get(key) || byDef.set(key, []).get(key)).push(u); });
  for (const [key, us] of byDef){
    const blocks = new Map(); us.forEach(u => { const bl = Object.entries(cand.sel).filter(([b, a]) => +a === u.id).map(([b]) => P.cr.find(x => x.id === +b)).filter(Boolean); if (bl.length) blocks.set(u, bl); });
    const pw = key === 'p' ? null : P.pws.find(w => 'w' + w.id === key) || null;
    MS.combatTracked(G, j, G.me, us, blocks, pw);
  }
  return 3;
};
// RESPOND: counter the top spell or let it resolve
MS.respondCands = (v, a0, tos) => {
  const out = [{key:a0 ? 'a0' : 'pass', a:a0, why:'Very hard'}];
  if (a0) out.push({key:'pass', a:null, why:'let it resolve'});
  else { const ctr = botCastable().find(x => BL.role(x.c.k).roles.has('counter') && !BL.role(x.c.k).perm); if (ctr) out.push({key:'ctr', a:{how:'cast', c:ctr.c, zone:ctr.zone, why:'counter ' + tos.nm, counter:true}, why:'counter it'}); }
  return out;
};
MS.applyRespond = (G, cand, tos, st, R) => {
  const P = G.P[G.me]; const a = cand.a; const cm = MS.cm(tos.k);
  const j = G.P.findIndex(Q => Q.pid === tos.pid);
  if (a && BL.role(a.c.k).roles.has('counter')){ const h = P.hand.find(x => x.id === a.c.id); if (h){ P.hand.splice(P.hand.indexOf(h), 1); P.hn = P.hand.length; P.mana -= h.cm.cost; P.open -= h.cm.cost; } return st; }
  if (j < 0) return st;
  let tgt = null;
  if (cm.kind === 'removal'){ const nm = String(tos.tgtNm || ''); const u = P.cr.find(u => nm && nm.includes(info(u.srcK)?.n || '§')); if (u) tgt = {j:G.me, u}; else if (JSON.stringify(tos.tgt || '').includes(MYPID)){ const b = P.cr.slice().sort((x, y) => y.val - x.val)[0]; if (b) tgt = {j:G.me, u:b}; } }
  MS.resolve(G, j, cm, R || MS.rng(7), tgt);
  return st;
};

/* ---------------------------------------------------------------- 6. the search */
MS.key = (point, v) => {
  const bf = b => (b || []).map(c => c.id + (BH.tapped(c) ? 't' : '') + (c.atk ? 'a' : '') + (c.blk != null ? 'b' : '')).join('.');
  return [point, turnStr(), v.ph, ((v.ph === 4 && cbOf(v.pn)) || {}).step || '', v.me.life, v.me.hand.map(c => c.id).join('.'), bf(v.me.bf), v.opps.map(o => o.life + ':' + o.hc + ':' + bf(o.bf)).join('|'), v.stack.map(i => i.sid).join('.'), botManaAvail()].join('#');
};
// run (or continue) a search; returns the job when finished. sync: no yielding (botAdvise)
MS.newJob = (point, v, cands, apply, st, seedKey) => {
  const G0 = MS.snap(v); const H = MS.horizon(G0);
  return {point, cands, apply, st, G0, H, vals:cands.map(() => []), round:0, seed:MS.hash(seedKey), t0:performance.now(), spent:0, done:false};
};
MS.step = (job, until) => {
  const n = job.cands.length;
  while (!job.done){
    if (!job.det){ const R0 = MS.rng(job.seed + job.round * 7919); job.det = MS.determinize(MS.clone(job.G0), R0); job.rs = Math.floor(R0() * 4294967296); job.c = 0; }
    const c = job.c;
    const G = MS.clone(job.det); const R = MS.rng(job.rs);
    try { const st = job.apply(G, job.cands[c], R); if (!G.over) MS.rollout(G, R, st, job.H); } catch (e){ MS.err(e); }
    job.vals[c].push(MS.evalG(G)); MS.stats.rollouts++;
    if (++job.c >= n){
      job.det = null; job.round++;
      if (job.round >= MS.rounds) job.done = true;
      else if (job.round >= MS.minRounds && job.round % 8 === 0 && MS.settled(job)) job.done = true;
    }
    if (performance.now() >= until) break;
  }
};
MS.err = e => { MS.stats.errs = (MS.stats.errs || 0) + 1; if (MS.stats.errs <= 3) try { BOT.errs.push('master model ' + String(e && e.stack || e).slice(0, 240)); } catch {} };
MS.summary = job => {
  const n = job.cands.length; const R = job.round || 1; const base = job.vals[0].slice(0, job.round);
  return job.cands.map((c, i) => { const vs = job.vals[i].slice(0, job.round); const mean = vs.reduce((s, x) => s + x, 0) / Math.max(1, vs.length);
    const d = vs.map((x, r) => x - base[r]); const dm = d.reduce((s, x) => s + x, 0) / Math.max(1, d.length);
    const sd = Math.sqrt(d.reduce((s, x) => s + (x - dm) * (x - dm), 0) / Math.max(1, d.length - 1)) || 0;
    const z = i === 0 ? 0 : sd < 1e-9 ? (Math.abs(dm) < 1e-9 ? 0 : Math.sign(dm) * 9) : dm / (sd / Math.sqrt(Math.max(1, d.length)));
    return {i, cand:c, mean, dm, z, n:vs.length}; });
};
MS.settled = job => { const s = MS.summary(job).slice(1); if (!s.length) return true; return s.every(x => x.z < -2.5 || x.dm < -40) || s.some(x => x.z > 5 && x.dm > 20); };
MS.isPass = c => (c.a === null) || (c.sel && !Object.keys(c.sel).length);
MS.choose = job => {
  const s = MS.summary(job); let best = s[0];
  s.slice(1).forEach(x => { const need = MS.margin; if (x.dm > need && x.z > 3 && (best === s[0] || x.dm > best.dm)) best = x; });
  const ranked = s.slice().sort((a, b) => b.mean - a.mean);
  return {best, ranked, rounds:job.round};
};
MS.runSync = (job, budget) => { const end = job.t0 + Math.min(MS.cap, budget); while (!job.done && performance.now() < end) MS.step(job, Math.min(end, performance.now() + 50)); job.done = true; return MS.finish(job); };
MS.yieldNow = () => new Promise(r => setTimeout(r, 0));
MS.runAsync = async (job, budget) => {
  const end = job.t0 + Math.min(MS.cap, budget);
  while (!job.done && performance.now() < end){
    const s0 = performance.now(); BOT.deciding = true;
    try { MS.step(job, Math.min(end, s0 + MS.slice)); } finally { BOT.deciding = false; }
    const dt = performance.now() - s0; MS.stats.cpu += dt; MS.stats.slices++; MS.stats.maxSlice = Math.max(MS.stats.maxSlice, dt);
    if (!job.done) await MS.yieldNow();
  }
  job.done = true; return MS.finish(job);
};
MS.finish = job => {
  const r = MS.choose(job); const ms = performance.now() - job.t0;
  MS.stats.searches++; MS.stats.ms += ms; MS.stats.maxMs = Math.max(MS.stats.maxMs, ms); if (r.best.i !== 0) MS.stats.deviations++;
  const bp = MS.stats.byPoint[job.point] = MS.stats.byPoint[job.point] || {n:0, ms:0, dev:0}; bp.n++; bp.ms += ms; if (r.best.i !== 0) bp.dev++;
  job.result = {...r, ms}; return job.result;
};
MS.budgetMs = () => { const b = BOT.cfg && Number.isFinite(+BOT.cfg.budget) ? +BOT.cfg.budget : MS.budget; return Math.max(50, Math.min(MS.cap, b)); };
MS.reasonOf = (x, base) => `${x.cand.why}${x.i ? ` (${x.dm >= 0 ? '+' : ''}${x.dm.toFixed(1)} vs Very hard)` : ''}`;
MS.alts = res => res.ranked.slice(0, 3).map(x => ({move:MS.moveText(x.cand), score:+x.mean.toFixed(1), reason:MS.reasonOf(x), vsVeryHard:+x.dm.toFixed(1), z:+x.z.toFixed(1)}));
MS.fixedText = (point, m) => point === 'main' || point === 'respond' ? MS.moveText({a:m || null}) : MS.moveText({sel:m || {}});
MS.moveText = c => c.a !== undefined ? (c.a ? `${c.a.how} ${c.a.c ? cname(c.a.c) : ''}${c.a.want ? ' at ' + (c.a.want.nm || '') : ''}` : 'pass') : c.sel ? (Object.keys(c.sel).length ? Object.entries(c.sel).map(([id, d]) => { const x = S.bf.find(q => q.id === +id) || boardOf(phaseNow().pid).find(q => q.id === +id); return (x ? cname(x) : id) + '→' + (/^p:/.test(String(d)) ? nameOf(String(d).slice(2)) : /^c:/.test(String(d)) ? defLabel(String(d)) : cname(boardOf(phaseNow().pid).find(q => q.id === +d) || {k:null})); }).join(', ') : 'none') : '?';

/* ---------------------------------------------------------------- 7. building a decision (shared by the bot driver and botAdvise) */
MS.VH = () => BOT_LEVELS.veryhard;
MS.prepare = (point, v) => {
  const L = MS.VH();
  if (point === 'main'){
    const a0 = L.main.call(L, v); const want0 = BOT.want, why0 = BH.lastWhy;
    if (!a0 && !botCastable().length) return {fixed:a0, why:why0};
    if (a0 && (a0.how !== 'cast' || !MS.cm(a0.c.k).mod)) return {fixed:a0, want:want0, why:why0};
    if (a0 && want0 && want0.k === a0.c.k) a0.want = want0.t;
    const cands = MS.mainCands(v, a0); if (cands.length < 2) return {fixed:a0, want:want0, why:why0};
    return {cands, apply:(G, c, R) => MS.applyMain(G, c, R), st:v.ph === 5 ? 3 : 1, fixedWhy:why0};
  }
  if (point === 'attack'){
    const sel0 = L.attack.call(L, v) || {}; const why0 = BH.lastWhy;
    if (BH.lastWhy && BH.lastWhy.code === 'attack_lethal') return {fixed:sel0, why:why0};
    const cands = MS.attackCands(v, sel0); if (cands.length < 2) return {fixed:sel0, why:why0};
    return {cands, apply:(G, c) => MS.applyAttack(G, c), st:3, fixedWhy:why0};
  }
  if (point === 'block'){
    const sel0 = L.block.call(L, v) || {}; const why0 = BH.lastWhy;
    const cands = MS.blockCands(v, sel0); if (cands.length < 2) return {fixed:sel0, why:why0};
    return {cands, apply:(G, c) => MS.applyBlock(G, c, v), st:3, fixedWhy:why0};
  }
  if (point === 'respond'){
    const a0 = L.respond.call(L, v); const why0 = BH.lastWhy; const want0 = BOT.want;
    const tos = v.stack[v.stack.length - 1];
    if (!tos || tos.mine || tos.kind !== 'spell' || !tos.k) return {fixed:a0, want:want0, why:why0};
    const cm = MS.cm(tos.k); const ctrOk = botCastable().some(x => BL.role(x.c.k).roles.has('counter') && !BL.role(x.c.k).perm);
    if (!ctrOk || !cm.mod || cm.kind === 'counter' || (VH.stackCombo(v, tos) >= 6)) return {fixed:a0, want:want0, why:why0};
    if (a0 && !BL.role(a0.c.k).roles.has('counter')) return {fixed:a0, want:want0, why:why0};
    const cands = MS.respondCands(v, a0, tos); if (cands.length < 2) return {fixed:a0, want:want0, why:why0};
    const st = v.ph <= 3 ? 1 : v.ph === 4 ? 3 : v.ph === 5 ? 3 : 4;
    return {cands, apply:(G, c, R) => MS.applyRespond(G, c, tos, st, R), st, fixedWhy:why0, tos};
  }
  return null;
};
// the real move from a search result
MS.realMove = (point, d, res) => {
  const c = res.best.cand;
  if (point === 'main' || point === 'respond'){
    const a = c.a; if (!a) return {move:null};
    const card = S.hand.find(x => x.id === a.c.id) || S.cz.find(x => x.id === a.c.id); if (!card) return null;
    return {move:{...a, c:card}, want:a.want ? {k:card.k, t:a.want} : null, counter:BL.role(card.k).roles.has('counter')};
  }
  return {move:c.sel};
};
MS.whyOf = (point, res) => { const b = res.best; return b.i === 0 ? {code:'master_' + (point === 'main' ? 'agrees' : point + '_agrees'), detail:`${res.rounds}×${res.ranked.length} rollouts; ` + MS.reasonOf(b)} : {code:'master_search', detail:MS.reasonOf(b) + `; ${res.rounds} samples`}; };


/* ---------------------------------------------------------------- 7b. mulligans: Monte Carlo "goldfish" of my first turns
   Keep or mulligan, and which cards go to the bottom, by playing my first 4 turns alone many times with draws sampled from my deck list
   minus my hand (never the library order). Score: mana actually used each turn, missed land drops, castable cards left. */
MS.gfCard = k => { const cm = MS.cm(k); const R = BL.role(k); const pips = new Set((String(info(k)?.m || '').match(/\{([WUBRG])\}/g) || []).map(x => x[1]));
  return {land:cm.kind === 'land', cost:cm.cost, pips, prod:R.produces || new Set(), rock:cm.kind === 'ramp' && cm.cost <= 3, tapped:!!R.tapped, val:R.value || 0.2, inst:!!R.instant && !R.creature}; };
MS.goldfish = (hand, pool, R, onPlay, turns = 4) => {
  const h = hand.slice(); let lands = 0, rocks = 0, sc = 0; const cols = new Set();
  for (let t = 1; t <= turns; t++){
    if (t > 1 || !onPlay) h.push(pool[Math.floor(R() * pool.length)]);
    const li = h.findIndex(c => c.land); let fresh = 0;
    if (li >= 0){ const L = h.splice(li, 1)[0]; lands++; L.prod.forEach(x => cols.add(x)); if (L.tapped) fresh = 1; } else if (t <= 4) sc -= t <= 3 ? 2.5 : 1;
    let mana = lands + rocks - fresh; let spent = 0;
    const ok = c => !c.land && c.cost <= mana - spent && [...c.pips].every(x => cols.has(x) || rocks > 0);
    for (let g = 0; g < 6; g++){ let bi = -1, bc = -1; h.forEach((c, i) => { if (ok(c) && !c.inst && (c.rock ? c.cost + 2 : c.cost) > bc){ bc = c.rock ? c.cost + 2 : c.cost; bi = i; } }); if (bi < 0) break;
      const c = h.splice(bi, 1)[0]; spent += c.cost; if (c.rock){ rocks++; } }
    // instants are used on the opponent's turn with the mana left over (counters, removal held up)
    { const ii = h.findIndex(c => c.inst && ok(c)); if (ii >= 0 && R() < 0.6){ spent += h[ii].cost; h.splice(ii, 1); } }
    sc += Math.min(spent, t + 1);
  }
  const live = h.filter(c => !c.land && c.cost <= lands + rocks + 2).length; sc += 0.6 * Math.min(live, 4) + 0.3 * Math.min(h.filter(c => c.land).length, 2);
  return sc;
};
MS.myDeckPool = () => { const out = []; (S.deck && S.deck.main || []).forEach(e => { const g = MS.gfCard(e.k); for (let i = 0; i < (e.q || 1); i++) out.push(g); }); return out; };
MS.mullEval = (v, N = 300) => {
  const hand = v.me.hand.map(c => MS.gfCard(c.k)); const all = MS.myDeckPool(); if (all.length < 20) return null;
  const pool = all.slice(); hand.forEach(g => { const i = pool.indexOf(g); if (i >= 0) pool.splice(i, 1); });
  const F = FMT[S.fmt] || {}; const onPlay = !F.firstDraw && (() => { try { const t = currentTurn(); return !t[1] || t[1] === MYPID; } catch { return false; } })();
  const R = MS.rng(MS.hash('mull' + (BOT.cfg && BOT.cfg.seed || 0) + ':' + v.me.hand.map(c => c.k).join(',')));
  const owe = Math.max(0, (S.mull || 0) + 1 - (F.freeMull ? 1 : 0)); const k2 = 7 - owe;
  let keep = 0; for (let i = 0; i < N; i++) keep += MS.goldfish(hand, pool, R, onPlay);
  let mull = 0;
  for (let i = 0; i < N; i++){ const d = all.slice(); const h7 = []; for (let j = 0; j < 7; j++) h7.push(d.splice(Math.floor(R() * d.length), 1)[0]);
    const keepN = MS.bestBottom(h7, k2); mull += MS.goldfish(keepN, d, R, onPlay); }
  return {keep:keep / N, mull:mull / N};
};
// which cards to keep when n must stay: cheap heuristic (lands ~ 40%, then cheapest spells)
MS.bestBottom = (h, n) => { if (h.length <= n) return h; const lands = h.filter(c => c.land), sp = h.filter(c => !c.land).sort((a, b) => a.cost - b.cost);
  const wantL = Math.max(2, Math.min(lands.length, Math.round(n * 0.42))); return lands.slice(0, wantL).concat(sp).slice(0, n).concat(lands.slice(wantL)).slice(0, n); };
MS.keep = function(v){
  const base = MS.VH().keep.call(MS.VH(), v);
  try {
    if ((S.mull || 0) >= 2) return base;
    const e = MS.mullEval(v); if (!e) return base;
    // only clear disagreements override Very hard (the goldfish undervalues reactive control hands)
    const keep = base ? !(e.mull - e.keep > 1.5) : (e.keep - e.mull > 1.5);
    BH.why(keep ? 'keep' : 'mulligan', `goldfish ${e.keep.toFixed(2)} kept vs ${e.mull.toFixed(2)} after a mulligan${keep !== base ? ' (Very hard: ' + (base ? 'keep' : 'mulligan') + ')' : ''}`);
    return keep;
  } catch (e){ return base; }
};
/* ---------------------------------------------------------------- 8. the Master level */
MS.decide = function(point, v){
  const L = MS.VH();
  const key = MS.key(point, v);
  // the bot driver: results come from the async search started by the botDecide wrapper
  if (!BH.advising && BOTMODE && BOT.L && BOT.L.id === 'master'){
    const hit = MS.cache.get(key);
    if (hit){ MS.cache.delete(key); return MS.apply(point, hit); }
    if (MS.allowSearch(point)){ MS.kick = {point, key}; }
    return L[point].call(L, v);                       // not searched (or the search starts next tick): Very hard
  }
  // botAdvise / a page without the driver: a short synchronous search
  const d = MS.prepare(point, v);
  if (!d) return L[point].call(L, v);
  if (!d.cands){ MS.last = {point, alts:[{move:MS.fixedText(point, d.fixed), score:0, reason:'Very hard (one sensible move, no search needed)'}]}; if (d.want) BOT.want = d.want; if (d.why) BH.lastWhy = d.why; return d.fixed; }
  const job = MS.newJob(point, v, d.cands, d.apply, d.st, MS.advSeed != null ? 'seed:' + MS.advSeed : key);
  const res = MS.runSync(job, MS.advBudget || 300);
  MS.last = {point, alts:MS.alts(res), res};
  const rm = MS.realMove(point, d, res); if (!rm) return L[point].call(L, v);
  BOT.want = rm.want || null; BH.lastWhy = MS.whyOf(point, res);
  return rm.move;
};
MS.apply = (point, hit) => {
  if (!hit.ok) return hit.move;
  if (hit.want) BOT.want = hit.want; else if (point === 'main' || point === 'respond') BOT.want = null;
  if (hit.counter && hit.counterSid) BOT.counterWant = hit.counterSid;
  BH.lastWhy = hit.why || BH.lastWhy;
  if (point === 'main' || point === 'respond'){
    const m = hit.move; if (!m) return null;
    const card = S.hand.find(x => x.id === m.c.id) || S.cz.find(x => x.id === m.c.id); if (!card) return MS.VH()[point].call(MS.VH(), botView());
    return {...m, c:card};
  }
  return hit.move;
};
MS.perTurn = {};
MS.allowSearch = point => { const k = turnStr() + ':' + point; MS.perTurn[k] = (MS.perTurn[k] || 0) + 1; return MS.perTurn[k] <= (point === 'main' ? 16 : 6); };
MS.startAsync = async kick => {
  if (MS.busy) return; MS.busy = true; MS.busyT = performance.now();
  const t0 = performance.now(); MS.trace = (MS.trace || []).slice(-20); MS.trace.push(turnStr() + ' ' + kick.point + ' start');
  try {
    const v = botView(); const key = MS.key(kick.point, v);
    let d; BOT.deciding = true; try { d = MS.prepare(kick.point, v); } finally { BOT.deciding = false; }
    if (!d){ MS.cache.set(key, {ok:false, move:MS.VH()[kick.point].call(MS.VH(), v)}); return; }
    if (!d.cands){ MS.cache.set(key, {ok:true, move:d.fixed, want:d.want || null, why:d.why}); return; }
    const job = MS.newJob(kick.point, v, d.cands, d.apply, d.st, key + ':' + (BOT.cfg && BOT.cfg.seed || 0));
    const res = await MS.runAsync(job, MS.budgetMs());
    const rm = MS.realMove(kick.point, d, res);
    MS.last = {point:kick.point, alts:MS.alts(res), res};
    if (!rm){ MS.cache.set(key, {ok:true, move:d.cands[0].a !== undefined ? d.cands[0].a : d.cands[0].sel, why:d.fixedWhy}); return; }
    const tos = d.tos; MS.cache.set(key, {ok:true, move:rm.move, want:rm.want, why:MS.whyOf(kick.point, res), counter:!!rm.counter, counterSid:tos ? tos.sid : null});
    if (res.best.i !== 0 || MS.verbose) try { botAct(`master ${kick.point}: ${res.best.i ? 'chose' : 'kept'} ${MS.moveText(res.best.cand)} [${MS.reasonOf(res.best)}] over ${res.best.i ? 'Very hard\'s ' + MS.moveText(d.cands[0]) : res.ranked.length - 1 + ' alternatives'} (${res.rounds} samples, ${Math.round(res.ms)} ms) | ${MS.summary(job).map(x => MS.moveText(x.cand) + ' ' + x.mean.toFixed(1) + '/' + x.z.toFixed(1)).join(' ; ')}`); } catch {}
  } catch (e){ BOT.errs.push('master ' + String(e && e.stack || e).slice(0, 240)); }
  finally { MS.busy = false; try { MS.trace.push(turnStr() + ' ' + kick.point + ' end ' + Math.round(performance.now() - t0)); } catch {} if (MS.cache.size > 40) MS.cache.delete(MS.cache.keys().next().value); MS.lastMs = performance.now() - t0; }
};

const MASTER = {...BOT_LEVELS.veryhard, id:'master', label:'Master (beta)', ready:true, think:[600, 1500], vh:true, master:true,
  keep(v){ return MS.keep(v); },
  main(v){ return MS.decide('main', v); },
  attack(v){ return MS.decide('attack', v); },
  block(v){ return MS.decide('block', v); },
  respond(v){ const tos = v.stack[v.stack.length - 1]; if (!tos || tos.mine || tos.kind !== 'spell') return MS.VH().respond.call(MS.VH(), v); return MS.decide('respond', v); },
};
botLevel('master', MASTER);

/* ---------------------------------------------------------------- 9. driver glue (bot frames only) */
if (BOTMODE){
  const bb = botBoot;
  botBoot = async function(cfg){ if (cfg && cfg.level === 'master'){ UI.stops.opp.end = true; UI.stops.opp.combat = true; } return bb.apply(this, arguments); };
  const bd = botDecide;
  botDecide = function(){
    if (!BOT.L || BOT.L.id !== 'master') return bd.apply(this, arguments);
    if (MS.busy){                                                  // a search is running: wait for its answer
      if (performance.now() - MS.busyT < MS.cap + 3000) return null;
      MS.busy = false; MS.stats.watchdog = (MS.stats.watchdog || 0) + 1; BOT.errs.push('master watchdog: search did not finish');   // never stall the table
    }
    // attacks and blocks are decided inside the plan's run(): search first
    try {
      const pn = phaseNow();
      if (pn.n > 0 && !UI.modal && !S.prm.length && pn.ph === 4){
        const cb = cbOf(pn);
        let point = null;
        if (pn.mine && cb && cb.step === 'atk') point = 'attack';
        else if (!pn.mine && cb && cb.step === 'blk' && attackersOnMe(pn).length && (S.bd || '') !== cbKey(pn, cb)) point = 'block';
        if (point){ const v = botView(); const key = MS.key(point, v); if (!MS.cache.has(key) && MS.allowSearch(point)){ MS.startAsync({point, key}); return null; } }
      }
    } catch (e){ BOT.errs.push('master pre ' + e.message); }
    MS.kick = null;
    const plan = bd.apply(this, arguments);
    if (MS.kick){ const k = MS.kick; MS.kick = null; MS.startAsync(k); return MS.guard(null, bd); }
    return MS.guard(plan, bd);
  };
}

// progress guard: if Master has produced no action for 8 s in a window where it must act (my main phase, empty stack, no dialog),
// it decides that one step as Very hard. Insurance against any search/cache mismatch: a bot must never hold up the table.
MS.guard = (plan, bd) => {
  if (plan){ MS.idleT = 0; return plan; }
  try {
    const pn = phaseNow();
    if (!(pn.mine && (pn.ph === 3 || pn.ph === 5) && !stackAll().length && !UI.modal && !S.prm.length && !UI.casting && !UI.resolving && !(S.lost || S.j18out))){ MS.idleT = 0; return null; }
    const now = performance.now(); if (!MS.idleT){ MS.idleT = now; return null; }
    if (now - MS.idleT < 8000) return null;
    MS.idleT = 0; MS.stats.guard = (MS.stats.guard || 0) + 1; botAct('master: no decision for 8 s, playing this step as Very hard');
    const L0 = BOT.L; BOT.L = MS.VH(); try { return bd(); } finally { BOT.L = L0; }
  } catch (e){ return null; }
};

/* ---------------------------------------------------------------- 10. botAdvise('master', …): Very hard-shaped advice + the top 3 alternatives */
{
  const ba = botAdvise;
  botAdvise = function(level, state = {}){
    if (level !== 'master') return ba.apply(this, arguments);
    MS.last = null; const keep = MS.advBudget, keepSeed = MS.advSeed; MS.advBudget = Math.max(50, Math.min(MS.cap, +state.budget || 300)); MS.advSeed = state.seed != null ? state.seed : null;
    const cacheKeep = MS.cache; MS.cache = new Map(); const kick = MS.kick;
    try {
      const r = ba.call(this, 'master', state);
      try { if (r.move && Array.isArray(r.move.attacks)) r.move.attacks.forEach(a => { if (/^c:/.test(String(a.at))) a.atName = defLabel(String(a.at)); }); } catch {}
      return {...r, alts:MS.last && MS.last.alts || [], search:MS.last && MS.last.res ? {rounds:MS.last.res.rounds, ms:Math.round(MS.last.res.ms), candidates:MS.last.res.ranked.length} : null};
    } finally { MS.advBudget = keep; MS.advSeed = keepSeed; MS.cache = cacheKeep; MS.kick = kick; }
  };
}

/* ---------------------------------------------------------------- 11. host side: optional per-game search budget for Master bots (tests, lobby) */
if (!BOTMODE){
  const bs = botSpawn;
  botSpawn = function(cfg){ if (cfg && cfg.level === 'master' && MS.hostBudget != null && cfg.budget == null) cfg = {...cfg, budget:MS.hostBudget}; return bs.call(this, cfg); };
}
