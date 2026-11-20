/* ===================== botlevels2.js: Hard and Very hard bots (stage 2a) + botAdvise() for the trainer =====================
   Same contract as botlevels.js: every hook gets v = botView() (my own state + public state) and returns a decision.
   BH  = shared "hard" judgement: a combat simulator (first/double strike, trample, deathtouch, lifelink, indestructible, menace,
         flying/reach, multi-blocks, marked damage, pump risk), a block solver, an attack planner that looks one turn ahead
         (crack-back), mana/sequencing helpers, scry/surveil, activated abilities, impact-based targeting.
   VH  = Very hard additions: per-opponent threat assessment, political attack/target weights, combo recognition (COMBOS in
         cardroles.js), holding removal for real threats, wipes when behind, no overextending.
   botAdvise(level, state) runs any level's hooks on THIS page (a bot frame or a person's own page) and returns
         {level, point, move, reason, detail}: what that level would do now, with a short machine-readable reason. */

const BH = {
  DEAD:1000, WIN:5000, CAP:4000, AGG:1.6, CRACK:0.6,
  lastWhy:null, advising:false, keep:new Set(),
  why(code, detail){ BH.lastWhy = {code, detail:detail == null ? '' : String(detail).slice(0, 120)}; return code; },
  libLow(){ return S.lib.length <= 10; },
  isCr(c){ if (!c || c.emb) return false; if (c.fd) return !!c.fdc; if (!c.k) return false; try { return !!isCreatureCard(c); } catch { return !!BL.role(c.k).creature; } },
  tapped(c){ return !!(c.tap || c.tp) || ((c.n || 1) > 1 && (c.tn || 0) >= (c.n || 1)); },
  text(c){ return c && c.k ? BL.role(c.k).text : ''; },
  opp(v, pid){ return v.opps.find(o => o.pid === pid) || null; },
  untappedLands(o){ return (o.bf || []).filter(c => c.k && !c.fd && isLand(c.k) && !BH.tapped(c)).length; },
  lands(bf){ return (bf || []).filter(c => c.k && !c.fd && isLand(c.k)).length; },
  val(c, pid){ let v = 1; try { v = permValue(c, pid); } catch {} return Math.max(0.5, v) * Math.max(1, Math.min(c.n || 1, 6)); },
  // ---- creature model for the simulator
  model(c, pid){
    const [p, t] = botPT(c, pid); const k = w => botKw(c, w, pid); const o = BH.text(c);
    return {c, id:c.id, pid, k:c.k, p:Math.max(0, p | 0), t:t | 0, dmg:c.dmg || 0, fs:k('first strike') || k('double strike'), ds:k('double strike'), tr:k('trample'), dt:k('deathtouch'),
      ll:k('lifelink'), ind:k('indestructible'), inf:k('infect'), fly:k('flying'), reach:k('reach'), men:k('menace') || /can't be blocked except by two or more/.test(o),
      n:Math.max(1, c.n || 1), cmd:!!c.cmd, val:BH.val(c, pid)};
  },
  pumped(m, p, t){ return {...m, p:m.p + p, t:m.t + t}; },
  // ---- one attacker against its blockers (in the order the attacker would assign damage)
  fight(A, Bs){
    if (!Bs.length){ const hits = A.ds ? 2 : 1; const d = A.p * A.n * hits; return {aDead:false, dead:[], thru:d, gainA:A.ll ? d : 0, gainB:0}; }
    const a = {...A, d:A.dmg, dtd:false, dead:false};
    const bs = Bs.map(b => ({...b, d:b.dmg, dtd:false, dead:false}))
      .sort((x, y) => ((a.dt || a.p >= y.t - y.dmg) ? y.val : -1) - ((a.dt || a.p >= x.t - x.dmg) ? x.val : -1));
    let thru = A.n > 1 ? A.p * (A.n - 1) : 0, gainA = 0, gainB = 0;
    const anyFs = a.fs || bs.some(b => b.fs);
    for (const step of ['fs', 'reg']){
      if (step === 'fs' && !anyFs) continue;
      const strikes = x => step === 'fs' ? x.fs : (!x.fs || x.ds);
      const toB = new Map(); const hitA = [];
      if (!a.dead && strikes(a) && a.p > 0){
        let left = a.p; const live = bs.filter(b => !b.dead);
        if (!live.length){ if (a.tr) thru += left; }
        else { live.forEach((b, i) => { const need = a.dt ? 1 : Math.max(1, b.t - b.d); const n = (i === live.length - 1 && !a.tr) ? left : Math.min(left, need); if (n > 0) toB.set(b, n); left -= n; });
          if (a.tr && left > 0) thru += left; }
        if (a.ll) gainA += a.p;
      }
      bs.forEach(b => { if (!b.dead && strikes(b) && b.p > 0){ hitA.push(b); if (b.ll) gainB += b.p; } });
      toB.forEach((n, b) => { b.d += n; if (a.dt) b.dtd = true; });
      hitA.forEach(b => { a.d += b.p; if (b.dt) a.dtd = true; });
      bs.forEach(b => { if (!b.dead && !b.ind && (b.d >= b.t || b.dtd)) b.dead = true; });
      if (!a.dead && !a.ind && (a.d >= a.t || a.dtd)) a.dead = true;
    }
    return {aDead:a.dead, dead:bs.filter(b => b.dead).map(b => b.id), thru, gainA, gainB};
  },
  // value of a block option for the DEFENDER (positive = good for the defender); pumpP: chance the attacker gets +2/+2 after blocks
  optEval(A, Bs, pumpP){
    const ev = A2 => { const r = BH.fight(A2, Bs); return {r, d:(r.aDead ? A.val : 0) - Bs.filter(b => r.dead.includes(b.id)).reduce((s, b) => s + b.val, 0)}; };
    const base = ev(A); let d = base.d;
    if (pumpP > 0 && Bs.length){ const p = ev(BH.pumped(A, 2, 2)); d = (1 - pumpP) * d + pumpP * p.d; }
    return {d, thru:base.r.thru, aDead:base.r.aDead, dead:base.r.dead};
  },
  // how bad it is to go from L life to L-d (convex: the last points matter most)
  // P = the power the other side keeps pointing at me: being under 2-3 turns from death costs extra
  lifeCost(L, d, P = 0){ if (d <= 0) return 0; if (L - d <= 0) return BH.DEAD; let s = 0; for (let i = 0; i < d; i++){ s += 0.15 + 12 / Math.pow(L - i + 1, 1.5); }
    if (P > 0){ const g = x => Math.max(0, P / Math.max(1, x) - 0.4); s += 15 * (g(L - d) - g(L)); } return s; },
  power(bf, pid){ return (bf || []).filter(c => BH.isCr(c)).reduce((s, c) => s + Math.max(0, botPT(c, pid)[0]) * Math.max(1, c.n || 1), 0); },
  psnCost(P, d){ if (d <= 0) return 0; if (P + d >= 10) return BH.DEAD; let s = 0; for (let i = 0; i < d; i++) s += 1.2 + 6 / (10 - P - i + 1); return s; },
  // ---- the defender's best blocks. atts/blks: models. ctx: {life, psn, cdt:{cmdKey:dmg}, canB(B, A), pumpP, pw:{attId:{val, loy}}}
  // returns {pick:[{A, bl:[B…], d, thru}], s (defender score), d, thru, lethal}
  solveBlocks(atts, blks, ctx){
    const per = atts.map(A => {
      const pw = ctx.pw && ctx.pw[A.id];
      const fix = o => { if (pw){ o.d -= o.thru >= pw.loy ? pw.val : o.thru * 0.4; o.thru = 0; } return o; };
      const legal = blks.filter(B => { try { return ctx.canB(B, A); } catch { return false; } });
      const opts = [fix({bl:[], ...BH.optEval(A, [], 0)})];
      const singles = A.men ? [] : legal.map(B => fix({bl:[B], ...BH.optEval(A, [B], ctx.pumpP || 0)}));
      const doubles = [];
      if (legal.length >= 2 && (A.men || !singles.some(o => o.aDead))){
        const L2 = legal.slice().sort((x, y) => (y.p + y.t) - (x.p + x.t)).slice(0, 6);
        for (let i = 0; i < L2.length; i++) for (let j = i + 1; j < L2.length; j++) doubles.push(fix({bl:[L2[i], L2[j]], ...BH.optEval(A, [L2[i], L2[j]], ctx.pumpP || 0)}));
      }
      const rest = singles.concat(doubles).sort((x, y) => y.d - x.d);
      const keep = rest.slice(0, 4);
      const chump = singles.slice().sort((x, y) => x.bl[0].val - y.bl[0].val)[0];       // cheapest way to stop the damage
      if (chump && !keep.includes(chump)) keep.push(chump);
      const dchump = doubles.slice().sort((x, y) => (x.bl[0].val + x.bl[1].val) - (y.bl[0].val + y.bl[1].val))[0];
      if (A.men && dchump && !keep.includes(dchump)) keep.push(dchump);
      return opts.concat(keep);
    });
    const leaf = pick => {
      let d = 0, thru = 0, psn = 0; const cmd = {};
      pick.forEach((o, i) => { const A = atts[i]; d += o.d; if (A.inf) psn += o.thru; else thru += o.thru; if (A.cmd && o.thru) cmd[A.k] = (cmd[A.k] || 0) + o.thru; });
      let lethal = ctx.life - thru <= 0 || (ctx.psn || 0) + psn >= 10;
      for (const k in cmd) if (((ctx.cdt || {})[k] || 0) + cmd[k] >= 21) lethal = true;
      const s = d - (lethal ? BH.DEAD : BH.lifeCost(ctx.life, thru, ctx.press || 0) + BH.psnCost(ctx.psn || 0, psn));
      return {s, d, thru, psn, lethal};
    };
    // greedy start, then a bounded exhaustive search
    const order = atts.map((A, i) => i).sort((i, j) => atts[j].p * atts[j].n - atts[i].p * atts[i].n);
    const used = new Set(); const g = [];
    order.forEach(i => { const o = per[i].filter(o => !o.bl.some(b => used.has(b.id))).sort((x, y) => (y.d - BH.lifeCost(ctx.life, y.thru, ctx.press || 0)) - (x.d - BH.lifeCost(ctx.life, x.thru, ctx.press || 0)))[0] || per[i][0]; g[i] = o; o.bl.forEach(b => used.add(b.id)); });
    let best = {pick:g.slice(), ...leaf(g)};
    let nodes = 0; const cur = []; used.clear();
    const dfs = k => {
      if (++nodes > BH.CAP) return;
      if (k === order.length){ const r = leaf(cur); if (r.s > best.s) best = {pick:cur.slice(), ...r}; return; }
      const i = order[k];
      for (const o of per[i]){ if (o.bl.some(b => used.has(b.id))) continue; o.bl.forEach(b => used.add(b.id)); cur[i] = o; dfs(k + 1); o.bl.forEach(b => used.delete(b.id)); }
    };
    if (atts.length) dfs(0);
    best.pick = best.pick.map((o, i) => ({A:atts[i], bl:o.bl, d:o.d, thru:o.thru, aDead:o.aDead, dead:o.dead}));
    return best;
  },
  // can opponent's creature B (controlled by bpid) block my attacker A (public information; mirrors combat.js canBlock with the right owners)
  canBlockX(b, bpid, a, apid){
    if (!BH.isCr(b) || BH.tapped(b)) return false;
    const bt = BH.text(b), at = BH.text(a);
    if (/(^|\n)~ can't block\b/.test(bt) || /can block only creatures with flying/.test(bt) && !botKw(a, 'flying', apid)) return false;
    if (/(^|\n|\. )~ can't be blocked(\.|$| this turn)/m.test(at) || BL.role(a.k).kw.has('unblockable')) return false;
    if (botKw(a, 'flying', apid) && !botKw(b, 'flying', bpid) && !botKw(b, 'reach', bpid)) return false;
    if (botKw(a, 'shadow', apid) || (botKw(a, 'horsemanship', apid) && !botKw(b, 'horsemanship', bpid))) return false;
    const ac = info(a.k)?.c || '', bc = b.k ? info(b.k)?.c || '' : '';
    if (botKw(a, 'intimidate', apid) && !/Artifact/.test(info(b.k)?.t || '') && ![...ac].some(x => bc.includes(x))) return false;
    if (botKw(a, 'fear', apid) && !/Artifact/.test(info(b.k)?.t || '') && !bc.includes('B')) return false;
    if (/\bskulk\b/.test(at)){ const pa = botPT(a, apid)[0], pb = botPT(b, bpid)[0]; if (pb > pa) return false; }
    const lw = at.match(/^(?:[a-z ]+, )*(plains|island|swamp|mountain|forest)walk/m);
    if (lw && boardOf(bpid).some(l => l.k && new RegExp('\\b' + lw[1] + '\\b', 'i').test(info(l.k)?.t || ''))) return false;
    try { if (b.k && protects(a, {col:bc, types:info(b.k)?.t || ''})) return false; } catch {}
    const pm = at.match(/~ can't be blocked by creatures with power (\d+) or less/); if (pm && botPT(b, bpid)[0] <= +pm[1]) return false;
    return true;
  },
  canAttackNext(c, pid){ if (!BH.isCr(c)) return false; if (botKw(c, 'defender', pid)) return false; if (/(^|\n)~ can't attack\b/.test(BH.text(c))) return false; return true; },
  // chance an opponent has a combat trick ready (public: open mana, cards in hand)
  trickP(o){ if (!o) return 0; const open = BH.untappedLands(o), hc = o.hc || 0; return open >= 1 && hc >= 1 ? Math.min(0.35, 0.07 * open + 0.04 * hc) : 0; },
  cdtFrom(o){ const m = {}; (OPP.get(o.pid)?.cdt || []).forEach(r => { if (Array.isArray(r) && r[0] === MYPID) m[r[1]] = (m[r[1]] || 0) + (r[2] || 0); }); return m; },
  myCdt(apid){ const m = {}; for (const key in (S.cdt || {})){ const i = key.indexOf('|'); if (key.slice(0, i) === apid) m[key.slice(i + 1)] = S.cdt[key]; } return m; },
  myBlockers(excl){ return S.bf.filter(c => BH.isCr(c) && !BH.tapped(c) && !(excl && excl.has(c.id))); },
  oppCreatures(o){ return (o.bf || []).filter(c => BH.isCr(c)); },
  // ---- my attack: plan = {creatureId: pid|null}. Score from my point of view (incl. crack-back next turn).
  attackEval(v, M, plan, cache, tw){
    const key = M.map(m => plan[m.id] || '-').join(','); if (cache.has(key)) return cache.get(key);
    let score = 0; const dead = new Set(); const killed = new Map();
    const live = v.opps.filter(o => o.life > 0);
    for (const o of live){
      const As = M.filter(m => plan[m.id] === o.pid); if (!As.length) continue;
      const Bs = BH.oppCreatures(o).filter(c => !BH.tapped(c)).map(c => BH.model(c, o.pid));
      const myP = BH.power(S.bf, MYPID);
      const sol = BH.solveBlocks(As, Bs, {life:o.life, psn:o.psn || 0, cdt:BH.cdtFrom(o), canB:(B, A) => BH.canBlockX(B.c, o.pid, A.c, MYPID), pumpP:0, press:myP});
      let mine = -sol.d;
      const pp = BH.trickP(o);
      if (pp > 0){ let alt = 0; sol.pick.forEach(x => { if (!x.bl.length) return; const r = BH.optEval(x.A, x.bl.map(b => BH.pumped(b, 2, 2)), 0); alt += -r.d; }); const base = sol.pick.reduce((s, x) => s - (x.bl.length ? x.d : 0), 0); mine += pp * (alt - base); }
      const w = tw ? tw(o) : 1; const agg = (BOT.L && BOT.L.agg) || BH.AGG;
      const dmgV = (lethal, thru, psn) => lethal ? (live.length <= 1 ? BH.WIN : 80 + 20 * w) : agg * (BH.lifeCost(o.life, thru, myP) + 0.15 * (thru + psn) + BH.psnCost(o.psn || 0, psn)) * w;
      const vBlock = mine + dmgV(sol.lethal, sol.thru, sol.psn || 0);
      // how this opponent really blocks (seen in earlier combats): a player who rarely blocks gets hit more
      const r = BH.blockRate(o.pid);
      let val = vBlock;
      if (r < 0.95){ let thru = 0, psn = 0; As.forEach(A => { const t = BH.fight(A, []).thru; if (A.inf) psn += t; else thru += t; });
        const leth = o.life - thru <= 0 || (o.psn || 0) + psn >= 10; val = r * vBlock + (1 - r) * dmgV(leth, thru, psn); }
      if (r >= 0.5) sol.pick.forEach(x => { if (x.aDead) dead.add(x.A.id); (x.dead || []).forEach(id => killed.set(o.pid + ':' + id, 1)); });
      score += val;
    }
    // crack-back: everyone I didn't kill swings at me next turn into what I kept home
    const home = M.filter(m => !plan[m.id] || (botKw(m.c, 'vigilance', MYPID) && !dead.has(m.id))).map(m => m.id);
    const homeSet = new Set(home);
    const myB = BH.myBlockers().filter(c => homeSet.has(c.id) || !M.some(m => m.id === c.id)).map(c => BH.model(c, MYPID));
    const lethalWin = score >= BH.WIN;
    if (!lethalWin){
      const cr = [];
      for (const o of live){
        const As = BH.oppCreatures(o).filter(c => !killed.has(o.pid + ':' + c.id) && BH.canAttackNext(c, o.pid)).map(c => BH.model(c, o.pid)); if (!As.length) continue;
        const ctx = {life:S.life, psn:S.psn || 0, cdt:BH.myCdt(o.pid), canB:(B, A) => !canBlock(B.c, A.c, o.pid), pumpP:BH.trickP(o), press:BH.power(o.bf, o.pid)};
        let sol = BH.solveBlocks(As, myB, ctx);
        // they don't send creatures that would just die into my blocks
        const bad = new Set(sol.pick.filter(x => x.aDead && !(x.dead || []).length).map(x => x.A.id));
        if (bad.size){ const As2 = As.filter(m => !bad.has(m.id)); sol = As2.length ? BH.solveBlocks(As2, myB, ctx) : {s:0, lethal:false}; }
        cr.push(sol.lethal ? -BH.DEAD : Math.min(0, sol.s));
      }
      cr.sort((a, b) => a - b);
      const multi = live.length > 1;
      score += cr.reduce((s, x, i) => s + (i === 0 ? x : x * 0.3), 0) * ((BOT.L && BOT.L.crack) || BH.CRACK);
    }
    cache.set(key, score); return score;
  },
  obs:{},
  blockRate(pid){ const o = BH.obs[pid]; if (!o) return 1; return Math.min(1, (o.blocked + 1.5) / (o.expected + 1.5)); },
  // after my attack, compare the blocks I predicted with the blocks that player really made (public: their creatures' blk)
  observe(){
    const pa = BH.pendingAtk; if (!pa || !S) return; const pn = phaseNow();
    if (!pn.mine || turnStr() !== pa.t){ BH.pendingAtk = null; return; }
    const cb = S.cb; if (!cb || !['blkd', 'fs', 'dmg'].includes(cb.step)) return;
    for (const [pid, exp] of Object.entries(pa.exp)){ const o = OPP.get(pid); if (!o) continue; const got = new Set((o.bf || []).filter(c => c.blk != null).map(c => c.blk)).size;
      const rec = BH.obs[pid] = BH.obs[pid] || {blocked:0, expected:0}; rec.expected += exp; rec.blocked += Math.min(exp + 1, got); }
    BH.pendingAtk = null;
  },
  planAttack(v, tw){
    const opts = defOpts().filter(o => o.key.startsWith('p:')); if (!opts.length) return {sel:{}, s:0};
    const pids = opts.map(o => o.pid).filter(pid => v.opps.some(o => o.pid === pid && o.life > 0));
    const mine = S.bf.filter(c => BH.isCr(c) && !canAttack(c));
    if (!mine.length || !pids.length) return {sel:{}, s:0};
    const M = mine.map(c => BH.model(c, MYPID)).slice(0, 14);
    const cache = new Map(); const ev = p => BH.attackEval(v, M, p, cache, tw);
    const starts = [{}];
    pids.forEach(pid => { const p = {}; M.forEach(m => { p[m.id] = pid; }); starts.push(p); });
    try { const im = BOT_LEVELS.intermediate.attack.call(BOT_LEVELS.intermediate, v) || {}; const p = {}; for (const [id, d] of Object.entries(im)) if (String(d).startsWith('p:')) p[id] = String(d).slice(2); starts.push(p); } catch {}
    let best = null, bs = -1e9;
    for (const st of starts){
      let cur = {...st}, cs = ev(cur);
      for (let pass = 0; pass < 4; pass++){
        let imp = false;
        for (const m of M){
          for (const ch of [null, ...pids]){ if ((cur[m.id] || null) === ch) continue; const nx = {...cur}; if (ch) nx[m.id] = ch; else delete nx[m.id]; const s = ev(nx); if (s > cs + 0.05){ cur = nx; cs = s; imp = true; } }
        }
        if (!imp) break;
      }
      if (cs > bs){ bs = cs; best = cur; }
    }
    const sel = {}; for (const [id, pid] of Object.entries(best || {})) if (pid) sel[id] = 'p:' + pid;
    return {sel, s:bs, base:ev({})};
  },
  // ---- what a spell or ability would do to a target: does it kill it?
  dmgOf(text){ const t = String(text || '').toLowerCase(); let m = t.match(/deals? (\d+) damage/); if (m) return {dmg:+m[1]}; m = t.match(/gets? -(\d+)\/-(\d+)/); if (m) return {dmg:+m[2], shrink:true}; return null; },
  impact(c, pid){
    if (!c) return 0; let v = 0; try { v = permValue(c, pid); } catch {}
    if (!c.k) return v;
    const r = BL.role(c.k);
    if (r.roles.has('combopiece')) v += 5; if (r.roles.has('bomb')) v += 4;
    if (BH.isCr(c) && pid !== MYPID){ const [p] = botPT(c, pid); v += Math.max(0, p) * 0.4; }
    if (!r.creature && !r.land && (r.roles.has('draw') || r.roles.has('ramp')) && /whenever|at the beginning|\{t\}/.test(r.text)) v += 1.5;
    if (/whenever (?:a|another|one or more) [^.]*(?:enters|dies|you cast)/.test(r.text)) v += 1;
    if (/(?:other )?(?:creatures|\w+s) you control get \+|put a \+1\/\+1 counter on each|creatures you control have/.test(r.text)) v += 3;      // lords and team pumps
    if (/at the beginning of [^.]*create|whenever [^.]*create/.test(r.text)) v += 1.5;                                                          // token engines
    if (c.tok && !BH.isCr(c)) v *= 0.6;
    return v;
  },
  // ---- casting: which spells are worth casting now, best set within mana
  castList(v, o = {}){
    const avail = botManaAvail() - (o.reserve || 0);
    const myVal = BL.myCreatures().reduce((s, c) => s + permValue(c, MYPID), 0);
    const oppVals = v.opps.map(op => botCreatures(op.bf, op.pid).reduce((t, c) => t + permValue(c, op.pid), 0));
    const oppVal = oppVals.reduce((s, x) => s + x, 0), oppMax = Math.max(0, ...oppVals);
    const early = S.bf.filter(c => isLand(c.k)).length < 6;
    const pre = v.ph === 3 && S.bf.some(c => BH.isCr(c) && !canAttack(c));
    const out = [];
    for (const x of botCastable()){
      const c = x.c, r = BL.role(c.k), R = r.roles; const cost = BL.costN(c, x.zone);
      if (R.has('counter') && !r.perm) continue;
      if (r.perm && /\byou lose the game\b/.test(r.text) && !/can't lose the game/.test(r.text)) continue;     // e.g. Archfiend of the Dross: not a race I can afford
      const instantOnly = !r.perm && r.instant;
      let s = cost + r.value * 3, why = 'curve';
      if (R.has('ramp')){ s += early ? 4 : 0.5; why = 'ramp'; }
      if (R.has('draw')){ s += 1.5; if (why === 'curve') why = 'draw'; if (BH.libLow() && !r.creature) continue; }
      if (R.has('tutor')) s += 0.8;
      if (R.has('wipe') && !r.creature && !r.perm){
        const behind = o.vh ? (oppMax - myVal >= 6 || oppVal > myVal * 1.6 + 6) : (oppVal >= myVal * 1.4 + 6);
        if (!behind) continue; s += 7; why = 'wipe_behind';
      }
      const harmful = !r.perm && (R.has('removal') || (BL.cands(c).length && BL.intentOf(c) === 'harm'));
      if (harmful){
        const b = BH.bestTarget(v, c, o.vh); const th = o.removalTh != null ? Math.max(o.removalTh, instantOnly ? 4.5 : 0) : (instantOnly ? 4.5 : 2.5);
        if (!b || b.v < th) continue;
        s += 2 + b.v / 3; x.want = b.x; why = 'removal';
        if (pre && b.x.t === 'card' && BH.isCr(boardOf(b.x.pid).find(q => q.id === b.x.id)) ) { s += 1; why = 'precombat_removal'; }
      }
      if (!r.perm && !harmful && BL.cands(c).length && BL.intentOf(c) === 'help'){ if (!BL.myCreatures().length) continue; if (instantOnly && (R.has('pump') || R.has('protect'))) continue; }
      if ((R.has('aura') || R.has('equipment')) && !BL.myCreatures().length) continue;
      if (instantOnly && !harmful && !R.has('ramp') && (R.has('draw') || R.has('protect') || R.has('pump'))) continue;   // instant-speed: on their turn
      if (r.creature){ s += 0.6; if (r.kw.has('haste') && v.ph === 3){ s += 1; why = 'haste'; } }
      // a step ahead: creatures that don't change this combat wait for main phase 2 (information + trick mana)
      // (only plain creatures wait: anything with an enters / whenever / static effect on my team is cast first)
      if (pre && !o.noDefer && r.creature && !r.kw.has('haste')){
        const busy = /\benters\b|\bwhenever\b|you control|\beach\b|\bchosen\b|\bother\b/.test(r.text);
        if (!busy) continue;
      }
      if (x.zone === 'cz') s += 1.5;
      if (BL.hasX(c, x.zone)) s += 1;
      if (o.vh) s += VH.castAdj(v, x, r, myVal, oppMax);
      out.push({...x, cost:BL.hasX(c, x.zone) ? Math.max(cost, avail) : cost, s, r, why});
    }
    if (o.vh) VH.trimOverextend(v, out, myVal, oppMax);
    const list = out.filter(x => x.s > -50).slice(0, 14); let best = [], bs = 0; const N = list.length;
    if (N <= 12){ for (let m = 1; m < (1 << N); m++){ let c = 0, s = 0; for (let i = 0; i < N; i++) if (m & (1 << i)){ c += list[i].cost; s += list[i].s; } if (c <= avail && s > bs){ bs = s; best = list.filter((_, i) => m & (1 << i)); } } }
    else { let left = avail; list.sort((a, b) => b.s / Math.max(1, b.cost) - a.s / Math.max(1, a.cost)).forEach(x => { if (x.cost <= left){ best.push(x); left -= x.cost; } }); }
    best.sort((a, b) => (b.r.roles.has('ramp') - a.r.roles.has('ramp')) || (!!b.want - !!a.want) || (b.r.roles.has('draw') - a.r.roles.has('draw')) || (b.cost - a.cost));
    best.total = bs;
    return best;
  },
  // instant-speed cards I'd like to keep mana for: counters, instant removal, protection, flash
  held(v){
    return botCastable().filter(x => { const r = BL.role(x.c.k); return (r.instant || !r.perm && r.instant) && (r.roles.has('counter') || r.roles.has('removal') || r.roles.has('protect')); })
      .map(x => ({...x, cost:BL.costN(x.c, x.zone), r:BL.role(x.c.k)}));
  },
  heldInHand(){ return S.hand.filter(c => { const r = BL.role(c.k); return !isLand(c.k) && r.instant && (r.roles.has('counter') || r.roles.has('removal') || r.roles.has('protect')); }); },
  // colours I want left untapped (auto-pay taps other sources first)
  setKeep(){ const k = new Set(); BH.heldInHand().forEach(c => (info(c.k)?.m || '').replace(/\{([WUBRG])\}/g, (_, x) => { k.add(x); })); BH.keep = k; },
  // best opposing target for a harmful card, by impact (kills only count when the damage is enough)
  bestTarget(v, c, vh){
    const cs = BL.cands(c).filter(x => x.pid !== MYPID && (x.t === 'card' || x.t === 'player'));
    const txt = BL.role(c.k).text; let best = null, bv = -1;
    cs.forEach(x => { const s = BH.candValue(v, x, txt, vh); if (s > bv){ bv = s; best = x; } });
    return best ? {x:best, v:bv} : null;
  },
  candValue(v, x, txt, vh){
    const d = BH.dmgOf(txt);
    const ow = vh ? VH.ownerW(v, x.pid) : BL.ownerThreat(v, x.pid);
    if (x.t === 'player'){
      if (x.pid === MYPID) return -5;
      const o = BH.opp(v, x.pid); if (!o) return 0;
      if (d && !d.shrink && d.dmg >= o.life) return 200;
      return (d && !d.shrink ? 1 + d.dmg * 0.4 : 2) * ow + (40 - o.life) * 0.04;
    }
    if (x.t === 'gy') return BL.role(x.k).value * 4;
    const c = boardOf(x.pid).find(b => b.id === x.id); if (!c) return 0;
    let val = BH.impact(c, x.pid);
    if (d && BH.isCr(c)){ const [, t] = botPT(c, x.pid); const kills = d.dmg >= t - (c.dmg || 0) && !(botKw(c, 'indestructible', x.pid) && !d.shrink); if (!kills) val *= 0.15; }
    if (d && !d.shrink && !BH.isCr(c) && isPW(c)){ if (d.dmg < (c.co || 0)) val *= 0.4; }
    if (/\bdestroy\b/.test(txt) && botKw(c, 'indestructible', x.pid)) val *= 0.05;
    if (vh && c.tok) val *= 0.6;
    return x.pid === MYPID ? -val : val * ow;
  },
  // cheap card draw / selection I'd rather cast before choosing which land to play
  cantrip(v){
    const lands = botLandsInHand(); const avail = botManaAvail();
    const kinds = new Set(lands.map(c => { const r = BL.role(c.k); return [...r.produces].sort().join('') + (r.tapped ? 't' : ''); }));
    const cands = botCastable().filter(x => { const r = BL.role(x.c.k); if (r.perm || r.roles.has('counter')) return false;
      return (r.roles.has('draw') || /\bscry \d|\bsurveil \d|look at the top/.test(r.text)) && !/additional cost|discard|sacrifice/.test(r.text) && BL.costN(x.c, x.zone) <= Math.min(avail, 3) && !BL.cands(x.c).length; });
    if (!cands.length) return null;
    if (lands.length && kinds.size < 2) return null;            // nothing to learn: the land drop is the same either way
    return cands.sort((a, b) => BL.costN(a.c, a.zone) - BL.costN(b.c, b.zone))[0];
  },
  landfall(){ return S.bf.some(c => c.k && /\blandfall\b|whenever a land (?:you control )?enters|whenever one or more lands (?:you control )?enter/.test(BL.role(c.k).text)); },
  // generic activated abilities (not mana, loyalty, equip or fetch): {how:'ab', c, ab, s}
  abActs(v, o = {}){
    const out = []; const life = S.life; const handN = S.hand.length;
    for (const c of S.bf){ if (c.fd || !c.k) continue; let abs = []; try { abs = abilityList(c); } catch {}
      abs.forEach((ab, i) => {
        if (ab.equip || botTriedTooOften(c, 'ab', i)) return;
        const e = String(ab.eff).toLowerCase(), cost = String(ab.cost).toLowerCase();
        if (/search your library for [^.]*\b(?:land|forest|plains|island|swamp|mountain)/.test(e)) return;
        if (o.instant && ab.sorc) return;
        let why = ''; try { why = abilityReady(c, ab, false); } catch { why = 'x'; } if (why) return;
        let s = 0;
        if (/\bdraws? (?:a|one|two|\w+) cards?/.test(e) && !/each player|target player draws/.test(e)) s += BH.libLow() ? -8 : 3;
        if (/\bcreate\b[^.]*token/.test(e)) s += 2;
        if (/deals? \d+ damage to (?:any target|each opponent|target (?:player|opponent))/.test(e)) s += 2;
        if (/(?:each opponent|target opponent|target player) loses \d+ life/.test(e)) s += 1.5;
        if (/put (?:a|an|\w+) \+1\/\+1 counters? on/.test(e)) s += 1.5;
        if (/\bscry \d|\bsurveil \d/.test(e)) s += 0.8;
        if (/return [^.]*from your graveyard to your hand/.test(e)) s += 2;
        if (/you gain \d+ life/.test(e)) s += life < 10 ? 1.5 : 0.3;
        if (/proliferate/.test(e)) s += 1;
        if (/destroy target|exile target/.test(e)) s += v.opps.some(op => (op.bf || []).some(q => q.k && !isLand(q.k))) ? 2.5 : -5;
        if (/counter target|until end of turn|gets \+|gains? |becomes? a|untap|tap target|regenerate|phase/.test(e) && s < 1) s -= 3;   // combat / response tools
        if (!s) return;
        if (/sacrifice (?:~|this)/.test(cost)) s -= c.tok ? 0.3 : 1.5;
        else if (/sacrifice (?:a|an|another|two)/.test(cost)) s -= BL.myCreatures().some(x => x.tok) ? 1 : 4;
        if (/discard/.test(cost)) s -= handN >= 5 ? 0.5 : 3;
        const lm = cost.match(/pay (\d+) life/); if (lm) s -= life > 15 ? +lm[1] * 0.2 : 5;
        if (/exile [^,]*from your graveyard/.test(cost)) s -= 0.3;
        if (/\{t\}/.test(cost) && BH.isCr(c) && v.mine) s -= 0.6;
        if (s > 1.4) out.push({how:'ab', c, ab:i, s, why:'ability ' + short(ab.eff, 30)});
      }); }
    return out.sort((a, b) => b.s - a.s);
  },
  // scry / surveil: keep what helps the next draws, bottom (or bin) the rest. Returns [{id, to}] in click order (the last "lib" ends on top).
  zonePlan(v, m){
    const dests = m.dests || []; const off = dests.includes('libb') ? 'libb' : dests.includes('gy') ? 'gy' : null; if (!off || !dests.includes('lib')) return null;
    const landsBf = BH.lands(S.bf), landsHand = S.hand.filter(c => isLand(c.k)).length;
    const avail = botManaAvail();
    const sc = c => { const r = BL.role(c.k); if (r.land){ if (landsBf + landsHand < 4) return 2; if (landsBf + landsHand < 6 && landsHand === 0) return 0.5; return -1.5; }
      let s = r.value; const mv = info(c.k)?.mv || 0;
      if (mv <= landsBf + landsHand + 1) s += 0.8; else if (mv > landsBf + landsHand + 3) s -= 1.2;
      if (r.roles.has('removal') && v.opps.some(o => botCreatures(o.bf, o.pid).length)) s += 0.5;
      if (r.roles.has('wipe') || r.roles.has('combopiece') || r.roles.has('bomb')) s += 0.6;
      if (avail >= 6 && mv <= 2 && !r.roles.has('draw') && !r.roles.has('removal')) s -= 0.4;
      return s - 0.45; };
    const cards = (m.ids || []).map(id => find(id)[2]).filter(c => c && c.k);
    const keep = cards.filter(c => sc(c) > 0).sort((a, b) => sc(a) - sc(b));
    const out = cards.filter(c => !keep.includes(c)).map(c => ({id:c.id, to:off}));
    keep.forEach(c => out.push({id:c.id, to:'lib'}));
    return out;
  },
  // how dangerous a spell on the stack is to me
  spellThreat(v, tos, vh){
    if (!tos || tos.kind !== 'spell' || !tos.k) return 0;
    const r = BL.role(tos.k); let t = r.value * 4 + (tos.mv || 0) * 0.5;
    if (r.creature) t += (r.pow + r.tou) / 2.5 + r.kw.size * 0.3;
    const myVal = BL.myCreatures().reduce((s, c) => s + permValue(c, MYPID), 0);
    const theirs = BL.boardPower((OPP.get(tos.pid) || {}).bf || [], tos.pid);
    if (r.roles.has('wipe')) t += myVal > theirs * 2 + 4 ? 8 : -2;
    if (r.roles.has('combo') || r.roles.has('wincon')) t += 6;
    if (r.roles.has('bomb')) t += 6;
    if (r.roles.has('tutor')) t += 2.5;
    if (r.roles.has('draw')) t += 1;
    if (r.pw) t += 3;
    const tg = JSON.stringify(tos.tgt || '');
    if (tg.includes(MYPID)){ const ts = (Array.isArray(tos.tgt) ? tos.tgt.flat() : []).filter(x => x && x.pid === MYPID && x.t === 'card');
      ts.forEach(x => { const c = S.bf.find(b => b.id === x.id); if (c) t += BH.impact(c, MYPID) * 0.8; }); }
    else if (vh && tos.tgt && r.roles.has('removal')) t *= 0.35;     // it hits someone else's thing: let them fight
    if (vh) t += VH.stackCombo(v, tos);
    return t;
  },
  abCostN(c, i){ try { const cm = costMana(abilityList(c)[i].cost); return cm ? cm.gen + MANA.reduce((s, x) => s + (cm.col[x] || 0), 0) : 0; } catch { return 0; } },
  pumpOf(c){ const m = BL.role(c.k).text.match(/target creature (?:you control )?gets \+(\d+)\/\+(\d+)/); return m ? [+m[1], +m[2]] : /target creature (?:you control )?gains indestructible/.test(BL.role(c.k).text) ? [0, 99] : null; },
};

/* ---------------------------------------------------------------- Very hard: multiplayer judgement */
const VH = {
  grudge:{},
  names(o){ const out = []; (o.bf || []).forEach(c => { if (c.k) out.push(info(c.k)?.n); }); (o.gy || []).forEach(k => out.push(info(k)?.n)); (o.cz || []).forEach(z => out.push(info(z.k || z)?.n)); return out.filter(Boolean); },
  combo(o){ return comboRisk(VH.names(o)); },
  threat(v, o){
    let t = 0;
    (o.bf || []).forEach(c => { if (!c.k && !c.fd) return; if (c.k && isLand(c.k)){ t += 0.5; return; } t += BH.impact(c, o.pid) * 0.6; });
    t += (o.hc || 0) * 1.1 + Math.max(0, o.life) * 0.06;
    const cr = VH.combo(o); t += cr.score * ((o.hc || 0) > 0 ? 1.2 : 0.6);
    t += (VH.grudge[o.pid] || 0) * 0.25;
    (S.cdt ? Object.entries(S.cdt) : []).forEach(([key, n]) => { if (key.startsWith(o.pid + '|')) t += n * 0.3; });
    return t;
  },
  threats(v){ const m = new Map(); v.opps.forEach(o => m.set(o.pid, VH.threat(v, o))); return m; },
  ownerW(v, pid){ if (pid === MYPID) return 1; const th = VH.threats(v); const mx = Math.max(1, ...th.values()); return 0.55 + 0.9 * (th.get(pid) || 0) / mx; },
  tw(v){ const th = VH.threats(v); const mx = Math.max(1, ...th.values()); return o => 0.6 + 0.8 * (th.get(o.pid) || 0) / mx; },
  // a spell that completes (or nearly completes) a known combo for its caster
  stackCombo(v, tos){
    const o = BH.opp(v, tos.pid); if (!o) return 0; const nm = info(tos.k)?.n; if (!nm) return 0;
    const g = comboInfo(nm); if (!g.length) return 0;
    const have = new Set(VH.names(o).map(comboBase)); let best = 0;
    g.forEach(combo => { const miss = combo.filter(x => x !== comboBase(nm) && !have.has(x)).length; best = Math.max(best, miss === 0 ? 30 : miss === 1 ? 6 : 1); });
    return best;
  },
  // Very hard's adjustments to a castable spell's score
  castAdj(v, x, r, myVal, oppMax){
    let s = 0;
    if (r.roles.has('draw')) s += 0.8;                                // card advantage
    if (r.creature && myVal > oppMax * 1.5 + 8) s -= 2;                // ahead on board: don't feed a wipe
    if (r.roles.has('combopiece')) s += 1;
    return s;
  },
  trimOverextend(v, out, myVal, oppMax){
    const wipeRisk = v.opps.some(o => (o.hc || 0) >= 3 && BH.lands(o.bf) >= 4);
    if (!wipeRisk || myVal < oppMax * 1.5 + 8) return;
    const crs = out.filter(x => x.r.creature).sort((a, b) => b.s - a.s);
    crs.slice(1).forEach(x => { x.s = -99; });                        // one more creature a turn at most
    if (crs.length && S.hand.filter(c => BL.role(c.k).creature).length <= 1) crs[0].s = -99;   // keep a creature in hand to rebuild
    BH.why('hold_creature', 'ahead on board, opponents could wipe');
  },
  removalTh(v){
    const incoming = v.opps.reduce((s, o) => s + BL.boardPower(o.bf, o.pid), 0);
    if (incoming >= S.life * 0.6) return 3;                            // under pressure: use it
    const big = v.opps.some(o => VH.combo(o).score >= 5);
    return big ? 6 : 6.5;
  },
};

/* ---------------------------------------------------------------- the Hard level */
const HARD = {label:'Hard (beta)', ready:true, think:[600, 1500], keepOpen:true,
  keep(v){
    const h = v.me.hand; const lands = h.filter(c => isLand(c.k));
    if (!BOT_LEVELS.intermediate.keep.call(this, v)){ BH.why('mulligan', `${lands.length} lands`); return false; }
    const cols = new Set(); lands.forEach(c => BL.role(c.k).produces.forEach(x => cols.add(x)));
    const cheap = h.filter(c => !isLand(c.k) && (info(c.k)?.mv || 0) <= Math.max(3, lands.length + 1));
    const playable = cheap.filter(c => [...String(info(c.k)?.m || '').matchAll(/\{([WUBRG])\}/g)].every(m => cols.has(m[1]))).length;
    const ok = (BOT.mullN || 0) >= 1 || playable >= 1 || lands.length >= 4;
    BH.why(ok ? 'keep' : 'mulligan', `${lands.length} lands, ${playable} early plays`); return ok;
  },
  bottom(v, need){ return BOT_LEVELS.intermediate.bottom.call(this, v, need); },
  opts(v){ return {}; },
  main(v){
    BH.setKeep(); BOT.holdNote = null;
    const o = this.opts(v);
    // 1. sequencing: a cheap cantrip first when it could change which land I play, or when I have none
    if (!v.landPlayed){
      const lands = botLandsInHand();
      const ct = BH.cantrip(v);
      if (ct){ BH.why(lands.length ? 'cantrip_first' : 'dig_for_land', cname(ct.c)); return {how:'cast', c:ct.c, zone:ct.zone, why:lands.length ? 'cantrip before land' : 'dig for a land'}; }
      if (lands.length){ const l = BL.chooseLand(v, true); BH.why('land_first', cname(l)); return {how:'land', c:l, why:'land drop'}; }
    }
    // 2. fetch lands: now when the mana or landfall matters, otherwise at the end of an opponent's turn
    const fe = BL.fetchActs();
    if (fe.length){ const want = BH.castList(v, {...o, noDefer:true}).reduce((s, x) => s + x.cost, 0); if (BH.landfall() || want >= botManaAvail() || v.turn <= 2){ BH.why('fetch', 'need the mana now'); return fe[0]; } }
    // 3. spells, keeping mana for a held counterspell / instant removal when that's worth more
    const full = BH.castList(v, o);
    const held = BH.held(v).filter(x => x.r.roles.has('counter'));
    let p = full;
    if (held.length && v.opps.some(op => (op.hc || 0) >= 2)){
      const reserve = Math.min(...held.map(x => x.cost));
      const kept = BH.castList(v, {...o, reserve});
      const holdV = held.some(x => x.r.roles.has('counter')) ? 5 : 3;
      if ((kept.total || 0) + holdV >= (full.total || 0)) p = kept;
      if (p === kept && full.length > kept.length) BOT.holdNote = cname(held[0].c);
    }
    if (p.length){ const x = p[0]; if (x.want) BOT.want = {k:x.c.k, t:x.want}; BH.why(x.why, cname(x.c) + (x.want ? ' at ' + (x.want.nm || '') : ''));
      return {how:'cast', c:x.c, zone:x.zone, why:x.want ? 'at ' + x.want.nm : x.why}; }
    // 4. planeswalkers, equipment, other activated abilities
    const pws = BL.pwActs(v); if (pws.length){ BH.why('loyalty', cname(pws[0])); return {how:'pw', c:pws[0], why:'loyalty'}; }
    const eq = BL.equipActs(); if (eq.length && botManaAvail() >= 1 && v.ph === 3){ BH.why('equip', cname(eq[0].c)); return eq[0]; }
    if (v.ph === 5 || !S.bf.some(c => BH.isCr(c) && !canAttack(c))){
      const reserve = BH.held(v).length ? Math.min(...BH.held(v).map(x => x.cost)) : 0;
      const ab = BH.abActs(v).find(a => botManaAvail() - BH.abCostN(a.c, a.ab) >= reserve || a.s >= 3);
      if (ab){ BH.why('ability', short(abilityList(ab.c)[ab.ab].eff, 40)); return ab; }
    }
    if (v.ph === 5 && fe.length && !UI.stops.opp.end){ BH.why('fetch', 'no later window'); return fe[0]; }
    if (!BH.advising && BOTMODE && v.ph === 5) try { const cs = botCastable(); if (cs.length) botAct(`main2 idle: avail ${botManaAvail()}, castable ${cs.map(x => cname(x.c) + '(' + BL.costN(x.c, x.zone) + ')').join(', ')}`); } catch {}
    if (BOT.holdNote){ BH.why('hold_counter', BOT.holdNote); BOT.holdNote = null; return null; }
    BH.why('nothing', ''); return null;
  },
  respond(v){
    const vh = !!this.vh; const tos = v.stack[v.stack.length - 1]; const avail = botManaAvail();
    if (tos && !tos.mine){
      const t = BH.spellThreat(v, tos, vh);
      const ctr = botCastable().filter(x => BL.role(x.c.k).roles.has('counter') && !BL.role(x.c.k).perm);
      const th = (vh ? 6 : 6.5) - (ctr.length >= 2 ? 1 : 0);
      if (ctr.length && t >= th){ BOT.counterWant = tos.sid; BH.why(VH.stackCombo && vh && VH.stackCombo(v, tos) >= 6 ? 'combo_stop' : 'counter_threat', tos.nm + ' (' + t.toFixed(1) + ')');
        return {how:'cast', c:ctr[0].c, zone:ctr[0].zone, why:'counter ' + tos.nm}; }
      const hitsMe = tos.tgt && JSON.stringify(tos.tgt).includes(MYPID);
      if (hitsMe && /destroy|exile|damage|-\d+\/-\d+|return target/.test(String(tos.txt || '').toLowerCase())){
        const tg = (Array.isArray(tos.tgt) ? tos.tgt.flat() : []).find(x => x && x.pid === MYPID && x.t === 'card');
        const c = tg && S.bf.find(b => b.id === tg.id);
        const pr = botCastable().filter(x => { const r = BL.role(x.c.k); return r.roles.has('protect') && !r.perm; });
        if (c && pr.length && BH.impact(c, MYPID) >= 4){ BOT.want = {k:pr[0].c.k, t:{t:'card', pid:MYPID, id:c.id}}; BH.why('protect', cname(c)); return {how:'cast', c:pr[0].c, zone:pr[0].zone, why:'protect ' + cname(c)}; }
      }
      return null;
    }
    if (tos) return null;
    if (!v.mine && v.ph === 4){
      const cb = cbOf(v.pn); const step = cb && cb.step;
      // attackers declared: instant removal on the attacker that hurts me most
      if (step === 'atkd'){
        const atts = attackersOnMe(v.pn); if (!atts.length) return null;
        const inc = atts.reduce((s, a) => s + Math.max(0, botPT(a, v.pn.pid)[0]), 0);
        const rem = botCastable().filter(x => { const r = BL.role(x.c.k); return !r.perm && r.instant && r.roles.has('removal'); });
        for (const x of rem){ const cs = BL.cands(x.c).filter(q => q.t === 'card' && q.pid === v.pn.pid && atts.some(a => a.id === q.id)); if (!cs.length) continue;
          const txt = BL.role(x.c.k).text; const best = cs.map(q => ({q, s:BH.candValue(v, q, txt, vh)})).sort((a, b) => b.s - a.s)[0];
          if (best && best.s >= (inc >= S.life * 0.5 ? 2 : 6)){ BOT.want = {k:x.c.k, t:best.q}; BH.why('kill_attacker', best.q.nm); return {how:'cast', c:x.c, zone:x.zone, why:'kill attacker ' + (best.q.nm || '')}; } }
      }
      // blocks declared: a pump / protection trick that wins a fight for one of my blockers
      if (step === 'blkd'){
        const tricks = botCastable().filter(x => { const r = BL.role(x.c.k); return !r.perm && r.instant && BH.pumpOf(x.c); });
        for (const x of tricks){ const [pp, pt] = BH.pumpOf(x.c);
          for (const b of S.bf.filter(c => c.blk != null)){ const a = boardOf(v.pn.pid).find(q => q.id === b.blk); if (!a) continue;
            const A = BH.model(a, v.pn.pid), B = BH.model(b, MYPID); const r0 = BH.fight(A, [B]), r1 = BH.fight(A, [BH.pumped(B, pp, pt)]);
            const gain = (r1.aDead && !r0.aDead ? A.val : 0) + (r0.dead.length && !r1.dead.length ? B.val : 0);
            if (gain >= 3 && BL.cands(x.c).some(q => q.pid === MYPID && q.id === b.id)){ BOT.want = {k:x.c.k, t:{t:'card', pid:MYPID, id:b.id}}; BH.why('combat_trick', cname(b) + ' vs ' + cname(a)); return {how:'cast', c:x.c, zone:x.zone, why:'trick on ' + cname(b)}; } } }
      }
      return null;
    }
    // end of an opponent's turn: instant removal, flash, draw, instant-speed abilities, fetches
    if (!v.mine && v.ph === 6){
      const th = vh ? VH.removalTh(v) : 3;
      for (const x of botCastable()){ const r = BL.role(x.c.k); if (r.perm && !r.instant) continue; if (r.roles.has('counter') && !r.perm) continue;
        if (!r.perm && r.roles.has('removal')){ const b = BH.bestTarget(v, x.c, vh); if (b && b.v >= th){ BOT.want = {k:x.c.k, t:b.x}; BH.why('end_step_removal', b.x.nm); return {how:'cast', c:x.c, zone:x.zone, why:'end-step removal'}; } continue; }
        if (r.roles.has('draw') || (r.creature && r.instant) || r.roles.has('ramp')){ if (BL.costN(x.c, x.zone) <= avail){ BH.why(r.creature ? 'flash' : 'end_step_draw', cname(x.c)); return {how:'cast', c:x.c, zone:x.zone, why:'end-step ' + (r.creature ? 'flash' : 'draw')}; } } }
      const fe = BL.fetchActs(); if (fe.length){ BH.why('fetch', 'end of turn'); return fe[0]; }
      const ab = BH.abActs(v, {instant:true})[0]; if (ab){ BH.why('ability', short(abilityList(ab.c)[ab.ab].eff, 40)); return ab; }
    }
    return null;
  },
  attack(v){
    const tw = this.vh ? VH.tw(v) : null;
    const r = BH.planAttack(v, tw);
    const n = Object.keys(r.sel).length;
    if (!BH.advising && n){ const exp = {}; try { const M = Object.keys(r.sel).map(id => S.bf.find(c => c.id === +id)).filter(Boolean);
        v.opps.forEach(o => { const As = M.filter(c => r.sel[c.id] === 'p:' + o.pid).map(c => BH.model(c, MYPID)); if (!As.length) return;
          const Bs = BH.oppCreatures(o).filter(c => !BH.tapped(c)).map(c => BH.model(c, o.pid));
          const sol = BH.solveBlocks(As, Bs, {life:o.life, psn:o.psn || 0, cdt:BH.cdtFrom(o), canB:(B, A) => BH.canBlockX(B.c, o.pid, A.c, MYPID), pumpP:0, press:BH.power(S.bf, MYPID)});
          exp[o.pid] = sol.pick.filter(x => x.bl.length).length; }); } catch {}
      if (Object.values(exp).some(x => x > 0)) BH.pendingAtk = {t:turnStr(), exp}; }
    BOT.lastPlan = n ? `attack ${n} (${r.s.toFixed(1)} vs ${(r.base || 0).toFixed(1)})` : 'no attack';
    BH.why(r.s >= BH.WIN ? 'attack_lethal' : r.s >= 80 && n ? 'attack_eliminate' : n ? 'attack_value' : 'no_attack', BOT.lastPlan);
    if (!BH.advising && BOTMODE) try { botAct('plan: ' + BOT.lastPlan + ' | mine ' + S.bf.filter(c => BH.isCr(c) && !canAttack(c)).map(c => cname(c) + ' ' + botPT(c, MYPID).join('/')).join(', ') + ' | theirs ' + v.opps.map(o => BH.oppCreatures(o).map(c => (c.k ? info(c.k).n : '?') + ' ' + botPT(c, o.pid).join('/') + (BH.tapped(c) ? 'T' : '')).join(', ')).join(' ; ') + ` | life ${S.life} vs ${v.opps.map(o => o.life).join(',')}`); } catch {}
    return r.sel;
  },
  block(v){
    const pn = v.pn; const apid = pn.pid; const atts = attackersOnMe(pn);
    const A = atts.map(c => BH.model(c, apid)); const B = BH.myBlockers().map(c => BH.model(c, MYPID));
    const o = BH.opp(v, apid);
    if (this.vh && !BH.advising){ VH.grudge[apid] = (VH.grudge[apid] || 0) + A.reduce((s, m) => s + m.p, 0); }
    const pw = {}; atts.forEach(a => { const d = parseDef(a.atk); if (d && d.t === 'card'){ const c = S.bf.find(x => x.id === d.id); if (c) pw[a.id] = {val:BH.val(c, MYPID), loy:c.co || 0}; } });
    const press = v.opps.map(op => BH.power(op.bf, op.pid)).sort((a, b) => b - a).reduce((s, x, i) => s + (i ? x * 0.3 : x), 0);
    const sol = BH.solveBlocks(A, B, {life:S.life, psn:S.psn || 0, cdt:BH.myCdt(apid), canB:(b, a) => !canBlock(b.c, a.c, apid), pumpP:BH.trickP(o), pw, press});
    if (!BH.advising && BOTMODE) try { botAct('blocks vs ' + A.map(m => cname(m.c) + ' ' + m.p + '/' + m.t).join(', ') + ' with ' + B.map(m => cname(m.c) + ' ' + m.p + '/' + m.t).join(', ') + ' → ' + sol.pick.filter(x => x.bl.length).map(x => x.bl.map(b => cname(b.c)).join('+') + '→' + cname(x.A.c)).join(', ') + ` (life ${S.life}, take ${sol.thru})`); } catch {}
    const sel = {}; let chump = 0, kills = 0;
    sol.pick.forEach(x => x.bl.forEach(b => { sel[b.id] = x.A.id; })); sol.pick.forEach(x => { if (x.bl.length && !x.aDead && (x.dead || []).length === x.bl.length) chump++; if (x.aDead) kills++; });
    BH.why(!Object.keys(sel).length ? 'no_block' : chump ? 'chump_needed' : kills ? 'block_value' : 'block_safe', `${Object.keys(sel).length} blockers, take ${sol.thru}${sol.lethal ? ' (lethal anyway)' : ''}`);
    return sel;
  },
  choice(v, m){
    const opts = (m.options || []).map((o, i) => ({...o, i})).filter(o => !o.disabled); if (!opts.length) return -1;
    const title = String(m.title || ''); const lab = o => String(o.label || '');
    const yes = opts.find(o => o.value === true || /^yes\b/i.test(lab(o))), no = opts.find(o => o.value === false || /^no\b/i.test(lab(o)));
    const modal = !(yes && no) && !opts.some(o => /^pay\b|command zone/i.test(lab(o))) && !/countering|how do you want to pay|^cast /i.test(title + ' ' + (m.text || ''));
    if (yes && no && /\bdraw/i.test(title) && BH.libLow()){ BH.why('decline', 'library is low'); return no.i; }
    if (!modal || opts.length < 2) return BOT_LEVELS.intermediate.choice.call(this, v, m);
    // modes and votes: score what each option would do, in context
    const vote = /\bvote\b/i.test(title);
    if (vote && this.vh){ const th = VH.threats(v); let best = null, bs = -1e9; opts.forEach(o => { const p = players().find(p => p.nm === lab(o)); const s = p ? (p.pid === MYPID ? -5 : (th.get(p.pid) || 0)) : BH.textScore(v, lab(o)); if (s > bs){ bs = s; best = o; } });
      const harm = /exile|destroy|sacrifice|lose|damage/i.test(title); if (best){ BH.why('vote_leader', lab(best)); return harm ? best.i : opts.find(o => o !== best && !/\bme\b/.test(lab(o)))?.i ?? best.i; } }
    let best = opts[0], bs = -1e9; for (const o of opts){ const s = BH.textScore(v, lab(o)) + (/^(that’s all|choose nothing)/i.test(lab(o)) ? -0.5 : 0); if (s > bs){ bs = s; best = o; } }
    BH.why('mode', lab(best)); return best.i;
  },
  pick(v, m){
    const title = String(m.title || '');
    if (BL.isBadPick(title) && /discard/i.test(title)){
      const cards = (m.cards || []).slice(); const min = Math.min(m.min ?? 0, cards.length);
      const landsBf = BH.lands(S.bf); const handLands = cards.filter(c => isLand(c.k)).length;
      const keepV = c => { const r = BL.role(c.k); if (r.land) return landsBf + handLands <= 4 ? 2 : landsBf >= 6 ? -1 : 0.4; const mv = info(c.k)?.mv || 0; return r.value * 2 + (mv <= landsBf + 1 ? 0.6 : mv > landsBf + 3 ? -0.6 : 0); };
      BH.why('discard_worst', ''); return cards.sort((a, b) => keepV(a) - keepV(b)).slice(0, min).map(c => c.id);
    }
    return BOT_LEVELS.intermediate.pick.call(this, v, m);
  },
  target(v, m){
    const sp = m.spec || {n:1}; const n = sp.n || 1;
    const ok = (m.cands || []).map((c, i) => ({c, i})).filter(x => x.c.ok);
    const w = BOT.want; if (w && BOT.lastCast && w.k === BOT.lastCast.k){ const hit = ok.find(x => x.c.t === w.t.t && x.c.pid === w.t.pid && (x.c.id === w.t.id || w.t.t === 'player')); if (hit && n === 1){ BOT.want = null; BH.why('planned_target', hit.c.nm || ''); return [hit.i]; } }
    const txt = botSrcText(m.title); let intent = targetIntent(txt, sp.desc);
    if (!intent){ const d = String(sp.desc || ''); intent = /you control|your/.test(d) ? 'help' : 'harm'; }
    if (sp.zone === 'gy' || intent === 'help') return BOT_LEVELS.intermediate.target.call(this, v, m);
    const score = x => BH.candValue(v, x.c, txt, !!this.vh);
    const opp = ok.filter(x => x.c.pid !== MYPID);
    if (opp.length){ const r = opp.sort((a, b) => score(b) - score(a)).slice(0, n); BH.why('target_impact', r.map(x => x.c.nm || x.c.t).join(', ')); return r.map(x => x.i); }
    if (sp.upTo) return [];
    return ok.sort((a, b) => BH.impact(boardOf(a.c.pid).find(q => q.id === a.c.id), MYPID) - BH.impact(boardOf(b.c.pid).find(q => q.id === b.c.id), MYPID)).slice(0, n).map(x => x.i);
  },
  number(v, m){ return BOT_LEVELS.intermediate.number.call(this, v, m); },
  pay(v, cost, why){
    let n = 0; try { const pc = parseCost(cost); n = pc.gen + MANA.reduce((s, x) => s + (pc.col[x] || 0), 0); } catch { n = 1; }
    if (why === 'counter'){ BH.why('pay', 'keep my spell'); return true; }
    const avail = botManaAvail(); if (avail < n){ BH.why('decline', 'not enough mana'); return false; }
    const reserve = BH.held(v).length ? Math.min(...BH.held(v).map(x => x.cost)) : 0;
    if (!v.mine){ const ok = avail - n >= reserve; BH.why(ok ? 'pay' : 'decline', ok ? 'spare mana' : 'keeping mana for an instant'); return ok; }
    const want = BH.castList(v, {noDefer:true}).reduce((s, x) => s + x.cost, 0);
    const ok = avail - n >= want; BH.why(ok ? 'pay' : 'decline', ok ? 'spare mana' : 'mana needed for my turn'); return ok;
  },
  pw(v, m, avail){
    const c = find(m.id)[2]; if (!c) return avail[0] ?? -1;
    const abs = loyaltyAbs(c); const loy = c.co || 0;
    const oppPow = Math.max(0, ...v.opps.map(o => BL.boardPower(o.bf, o.pid)));
    let best = -1, bs = -1e9;
    avail.forEach(i => { const ab = abs[i]; const cost = +ab.cost || 0; const e = String(ab.eff).toLowerCase(); const after = loy + cost;
      if (after < 0) return;
      let s = BH.textScore(v, e) + cost * 0.35;
      if (BH.libLow() && /(?:exile|put|reveal) the top|mills?\b|draws?\b/.test(e) && !/target (?:player|opponent)|each opponent/.test(e)) s -= 8;   // my library is nearly empty
      if (cost <= -6 && after >= 0) s += 8;                                              // the ultimate
      if (after === 0) s -= 4; if (after > 0 && oppPow >= after + 2 && cost > 0) s -= 1;   // it will die anyway: cash in
      if (/destroy|exile|damage|-\d+\/-\d+/.test(e) && cost < 0){ const b = v.opps.flatMap(o => (o.bf || []).filter(q => q.k && !isLand(q.k)).map(q => BH.impact(q, o.pid))).sort((a, b) => b - a)[0] || 0; s += b >= 5 ? b / 2 : -4; }
      if (s > bs){ bs = s; best = i; } });
    BH.why('loyalty', best >= 0 ? short(abs[best].eff, 40) : 'none'); return best;
  },
  zone(v, m){ const p = BH.zonePlan(v, m); BH.why('scry', p ? p.map(x => x.to).join(',') : 'keep'); return p; },
};
BH.textScore = function(v, t){
  t = String(t || '').toLowerCase(); let s = BL.textScore(v, t);
  const oppHas = re => v.opps.some(o => (o.bf || []).some(c => c.k && re.test(info(c.k)?.t || '')));
  if (/(destroy|exile)[^.]*\bartifact/.test(t) && !/creature/.test(t)) s += oppHas(/Artifact/) ? 1 : -2.5;
  if (/(destroy|exile)[^.]*\benchantment/.test(t) && !/creature/.test(t)) s += oppHas(/Enchantment/) ? 1 : -2.5;
  if (/(destroy|exile|damage)[^.]*\bcreature/.test(t)) s += oppHas(/Creature/) ? 0.5 : -2.5;
  if (/draw (two|three|\d) cards/.test(t)) s += 1.5;
  if (/each opponent/.test(t)) s += 0.3 * v.opps.length;
  if (/counter target/.test(t) && !stackAll().some(i => i.pid !== MYPID)) s -= 2;
  if (/you lose (\d+) life/.test(t) && S.life <= 8) s -= 2;
  if (/\bdraw/.test(t) && BH.libLow()) s -= 8;                         // don't deck myself
  return s;
};
botLevel('hard', HARD);

/* ---------------------------------------------------------------- the Very hard level */
botLevel('veryhard', {...HARD, label:'Very hard (beta)', ready:true, think:[600, 1500], vh:true,
  opts(v){ return {vh:true, removalTh:VH.removalTh(v)}; },
});

/* ---------------------------------------------------------------- driver glue (bot frames only) */
// scry / surveil dialogs: the level decides what stays on top
{
  const bam = botAnswerModal;
  botAnswerModal = function(m){
    if (m && UI.modal === m && m.type === 'zone' && m.dests && BOT.L && typeof BOT.L.zone === 'function'){
      let plan = null; try { plan = botHook('zone', botView(), m); } catch (e){ BOT.errs.push('zone ' + e.message); }
      try { (plan || []).forEach(x => { if (UI.modal === m && (m.ids || []).includes(x.id)) ACT.mvz({dataset:{id:String(x.id), to:x.to}}); }); } catch (e){ BOT.errs.push('zone move ' + e.message); }
      if (UI.modal === m) closeModal(); return;
    }
    return bam.apply(this, arguments);
  };
}
// Hard / Very hard stop at the end of opponents' turns and in their combat, to use instants
if (BOTMODE){
  setInterval(() => { try { if (BOT.on && BOT.L && BOT.L.keepOpen) BH.observe(); } catch {} }, 150);
  const bb = botBoot;
  botBoot = async function(cfg){ if (cfg && /^(hard|veryhard)$/.test(cfg.level)){ UI.stops.opp.end = true; UI.stops.opp.combat = true; } return bb.apply(this, arguments); };
  // auto-pay leaves the colours of held instants untapped as long as it can
  const as = autoSources;
  autoSources = function(){ const r = as.apply(this, arguments); try { if (BOT.L && BOT.L.keepOpen && BH.keep.size) r.forEach(s => { if (s.opts.some(o => o.outs.some(x => BH.keep.has(x)))) s.flex += 10; }); } catch {} return r; };
}

/* ---------------------------------------------------------------- botAdvise: any level's decision, from this page's own view
   botAdvise(level, state?) → {level, point, move, reason, detail}
   state (all optional): {point:'mulligan'|'bottom'|'main'|'respond'|'attack'|'block'|'choice'|'pick'|'target'|'pw'|'ask'|'zone'|'pay', m:<modal>, need, cost, why, seed}
   Without a point it reads the screen like the bot driver does. It only looks at S (this player) and OPP (public), changes nothing,
   and restores the bot memory it touches. move shapes:
     main/respond: {how:'land'|'cast'|'ab'|'pw'|'pass', card:{id,k,name}, zone, ab, abText, target:{t,pid,id,name}|null}
     attack: {attacks:[{id,name,at:pid,atName}]}   block: {blocks:[{id,name,blocks:id,blocksName}]}
     mulligan: {keep}   bottom/pick: {ids}   choice: {index,label}   target: {indices,names}   pw: {index}   zone: {moves:[{id,to}]}   pay: {pay}   ask: {n} */
function botAdviseLevels(){ return BOT_ORDER.filter(id => BOT_LEVELS[id] && BOT_LEVELS[id].ready); }
function botAdvisePoint(){
  const pn = phaseNow(); const m = UI.modal;
  if (pn.n === 0) return m && m.type === 'bottom' ? 'bottom' : 'mulligan';
  if (m){ const t = m.type; if (t === 'zone') return m.dests ? 'zone' : 'none'; if (['choice', 'pick', 'target', 'pw', 'ask', 'bottom'].includes(t)) return t; return 'none'; }
  if (S.prm.some(p => p.type === 'unless')) return 'pay';
  const cb = pn.ph === 4 ? cbOf(pn) : null;
  if (pn.mine && cb && cb.step === 'atk') return 'attack';
  if (!pn.mine && cb && cb.step === 'blk' && attackersOnMe(pn).length && (S.bd || '') !== cbKey(pn, cb)) return 'block';
  if (myBox()) return 'respond';
  if (pn.mine && (pn.ph === 3 || pn.ph === 5) && !stackAll().length) return 'main';
  return 'none';
}
function botAdvise(level, state = {}){
  const L = BOT_LEVELS[level] && BOT_LEVELS[level].ready ? BOT_LEVELS[level] : BOT_LEVELS.hard;
  if (!S) return {level:L.id, point:'none', move:null, reason:'no_game', detail:''};
  const keepB = {L:BOT.L, R:BOT.R, want:BOT.want, counterWant:BOT.counterWant, lastPlan:BOT.lastPlan, pwWant:BOT.pwWant, deciding:BOT.deciding, keep:BH.keep};
  const grudge = {...VH.grudge};
  BH.advising = true; BH.lastWhy = null;
  const card = c => c ? {id:c.id, k:c.k, name:cname(c)} : null;
  try {
    BOT.L = L; BOT.R = botRng(state.seed ?? 7); BOT.want = null; BOT.counterWant = null;
    const v = botView(); v.R = BOT.R; v.L = L;
    const point = state.point || botAdvisePoint();
    const call = (name, ...a) => { const f = typeof L[name] === 'function' ? L[name] : BOT_BASE[name]; BOT.deciding = true; try { return f.apply(L, a); } finally { BOT.deciding = false; } };
    const m = state.m || UI.modal; let move = null;
    const act = a => { if (!a) return {how:'pass'}; const w = BOT.want && a.c && BOT.want.k === a.c.k ? BOT.want.t : null;
      return {how:a.how, card:card(a.c), zone:a.zone || null, ab:a.ab ?? null, abText:a.how === 'ab' && a.c ? (abilityList(a.c)[a.ab] || {}).eff || '' : '', target:w ? {t:w.t, pid:w.pid, id:w.id ?? null, name:w.nm || (w.t === 'player' ? nameOf(w.pid) : '')} : null, why:a.why || ''}; };
    switch (point){
      case 'mulligan': move = {keep:!!call('keep', v)}; break;
      case 'bottom': move = {ids:call('bottom', v, state.need ?? (m && m.need) ?? 1) || []}; break;
      case 'main': move = act(call('main', v)); break;
      case 'respond': move = act(call('respond', v)); if (move.how === 'pass' && !BH.lastWhy) BH.why('pass', ''); break;
      case 'attack': { const sel = call('attack', v) || {}; move = {attacks:Object.entries(sel).map(([id, d]) => { const c = S.bf.find(x => x.id === +id); const pid = String(d).replace(/^p:/, ''); return {id:+id, name:c ? cname(c) : '', at:pid, atName:nameOf(pid)}; })}; break; }
      case 'block': { const sel = call('block', v) || {}; const atts = attackersOnMe(v.pn); move = {blocks:Object.entries(sel).map(([id, aid]) => { const b = S.bf.find(x => x.id === +id), a = atts.find(x => x.id === +aid); return {id:+id, name:b ? cname(b) : '', blocks:+aid, blocksName:a ? cname(a) : ''}; })}; break; }
      case 'choice': { const i = call('choice', v, m); move = {index:i, label:String(((m && m.options) || [])[i]?.label ?? '')}; break; }
      case 'pick': move = {ids:call('pick', v, m) || []}; break;
      case 'target': { const ix = call('target', v, m) || []; move = {indices:ix, names:ix.map(i => (m.cands[i] || {}).nm || '')}; break; }
      case 'pw': { const ix = state.avail || loyaltyAbs(find(m.id)[2] || {}).map((_, i) => i); move = {index:call('pw', v, m, ix)}; break; }
      case 'ask': move = {n:call('number', v, m)}; break;
      case 'zone': move = {moves:(typeof L.zone === 'function' ? call('zone', v, m) : null) || []}; break;
      case 'pay': { const p = S.prm.find(x => x.type === 'unless'); const cost = state.cost || (p ? `{${p.n}}` : '{1}'); move = {pay:!!call('pay', v, cost, state.why || (p ? 'counter' : 'tax'))}; break; }
      default: move = null;
    }
    const w = BH.lastWhy || {code:point === 'none' ? 'nothing_to_decide' : 'level_default', detail:''};
    return {level:L.id, point, move, reason:w.code, detail:w.detail};
  } catch (e){
    return {level:L.id, point:state.point || 'error', move:null, reason:'error', detail:String(e && e.message || e)};
  } finally {
    Object.assign(BOT, {L:keepB.L, R:keepB.R, want:keepB.want, counterWant:keepB.counterWant, lastPlan:keepB.lastPlan, pwWant:keepB.pwWant, deciding:keepB.deciding}); BH.keep = keepB.keep;
    VH.grudge = grudge; BH.advising = false;
  }
}

/* ---------------------------------------------------------------- core fix found by the 4-pod games (wrapped, not edited):
   sanitizeEngine kept only the FIRST 40 items of another player's stack. With more than 40 triggers (e.g. Caltrops vs 34 attackers)
   nobody else could see the top item, nobody passed on it, and the table froze. Receive up to the last 400 items instead. */
{
  const se = sanitizeEngine;
  sanitizeEngine = function(s){
    const o = se(s);
    try { if (o && s && Array.isArray(s.stk) && s.stk.length > 40){ const all = []; for (let i = Math.max(0, s.stk.length - 400); i < s.stk.length; i += 40) all.push(...(((se({...s, stk:s.stk.slice(i, Math.min(i + 40, s.stk.length))}) || {}).stk) || [])); o.stk = all; } } catch {}
    return o;
  };
}

/* ---------------------------------------------------------------- stage 3a fixes (found while building Master's search)
   1. Self-destructive spells: Demonic Consultation / Tainted Pact exile the library, and the bots named a card in their hand, so the
      whole library went and they lost on the next draw. Hard and Very hard now cast them only as part of a win line (Thassa's Oracle in
      hand with the mana for both, or Laboratory Maniac / Jace, Wielder of Mysteries on the battlefield); Very hard plays that line.
      Doomsday and Ad Nauseam are never cast (no bot pilots them).
   2. "Choose a card name" for those spells: in the win line, a card in hand (so the library is exiled); otherwise the best card that
      isn't in hand or graveyard. */
BH.ORACLE = /if x is greater than or equal to the number of cards in your library, you win the game/;
BH.LABMAN = /if you would draw a card while your library has no cards in it, you win the game instead/;
BH.isDig = c => /exile the top six cards of your library, then reveal cards from the top of your library until|repeat this process until you put a card into your hand or you exile two cards with the same name/.test(BL.role(c.k).text);
BH.noCast = c => /^(Doomsday|Ad Nauseam)$/.test(comboBase(info(c.k)?.n || ''));
BH.digLine = c => {
  if (S.bf.some(x => x.k && !x.fd && BH.LABMAN.test(BL.role(x.k).text))) return {win:null};
  const o = S.hand.find(x => x !== c && BH.ORACLE.test(BL.role(x.k).text));
  if (o && botManaAvail() >= BL.costN(c, 'hand') + BL.costN(o, 'hand')) return {win:o};
  return null;
};
{
  const cl = BH.castList;
  BH.castList = function(v, o = {}){
    const bc = botCastable;
    botCastable = function(){ return bc.apply(this, arguments).filter(x => !BH.noCast(x.c) && !(BH.isDig(x.c) && !BH.digLine(x.c))); };
    try { return cl.call(this, v, o); } finally { botCastable = bc; }
  };
  ['hard', 'veryhard'].forEach(id => {
    const L = BOT_LEVELS[id]; const mn = L.main, pk = L.pick;
    L.main = function(v){
      if (this.vh){
        // the library is gone (or nearly): Thassa's Oracle wins now
        const or = botCastable().find(x => BH.ORACLE.test(BL.role(x.c.k).text));
        if (or && S.lib.length <= 1){ BH.why('combo_win', cname(or.c)); return {how:'cast', c:or.c, zone:or.zone, why:'win with ' + cname(or.c)}; }
        const dig = botCastable().find(x => BH.isDig(x.c) && BH.digLine(x.c));
        if (dig){ BH.why('combo_line', cname(dig.c)); BOT.digWin = (BH.digLine(dig.c).win || {}).k || null; return {how:'cast', c:dig.c, zone:dig.zone, why:'combo: ' + cname(dig.c)}; }
      }
      return mn.call(this, v);
    };
    L.pick = function(v, m){
      if (/choose a card name/i.test(String(m.title || '')) && (m.cards || []).length){
        const cards = m.cards; const inHand = new Set(S.hand.map(c => c.id)), inGy = new Set(S.gy.map(c => c.id));
        const handNames = new Set(S.hand.map(c => cname(c)));
        const winNm = BOT.digWin ? info(BOT.digWin)?.n : null;
        let pick = winNm && cards.find(c => cname(c) === winNm) || (BH.digLineNow() ? cards.find(c => inHand.has(c.id) || handNames.has(cname(c))) : null);
        if (!pick){ const out = cards.filter(c => !inHand.has(c.id) && !inGy.has(c.id) && !handNames.has(cname(c))); pick = out.sort((a, b) => BL.role(b.k).value - BL.role(a.k).value)[0] || cards[0]; }
        BH.why('name_card', cname(pick)); return [pick.id];
      }
      return pk.call(this, v, m);
    };
  });
  BH.digLineNow = () => S.hand.some(x => BH.ORACLE.test(BL.role(x.k).text)) || S.bf.some(x => x.k && !x.fd && BH.LABMAN.test(BL.role(x.k).text));
}

/* ---------------------------------------------------------------- stage 3a: two known gaps (v22)
   3. Attack triggers and attack pumps: when planning an attack, each attacker counts the +X/+Y it will get once it attacks
      ("whenever ~ attacks, it gets +N/+N", "…for each other attacking creature", battle cry and "whenever ~ attacks, creatures you
      control get +N/+N" from the others in the same attack, "attacking creatures you control get +N/+N", exalted when alone).
   4. Planeswalkers: after the attack plan is made, an attacker that is expected to get through unblocked moves over to an opposing
      planeswalker it can kill (smallest one that does the job), unless that damage was going to finish the player. */
BH.atkBonus = (M, plan) => {
  const att = M.filter(m => plan[m.id]); if (!att.length) return M;
  const txt = m => BL.role(m.k).text || '';
  const all = S.bf.filter(c => c.k && !c.fd).map(c => BL.role(c.k).text || '');
  let stat = [0, 0]; all.forEach(t => { const m = t.match(/(?:^|\n)attacking creatures you control get \+(\d+)\/\+(\d+)/); if (m){ stat[0] += +m[1]; stat[1] += +m[2]; } });
  const exalted = all.reduce((s, t) => s + (/(?:^|\n)exalted\b/.test(t) ? 1 : 0), 0);
  return M.map(m => {
    if (!plan[m.id]) return m;
    let p = stat[0], q = stat[1], x; const t = txt(m);
    if ((x = t.match(/whenever ~ attacks[^.]*?, (?:it|~) gets \+(\d+)\/\+(\d+)/))){ p += +x[1]; q += +x[2]; }
    if (/whenever ~ attacks, it gets \+x\/\+0[^.]*for each other attacking creature/.test(t)) p += att.length - 1;
    att.forEach(o => { if (o === m) return; const u = txt(o); if (/\bbattle cry\b/.test(u)) p += 1;
      if ((x = u.match(/whenever ~ attacks, (?:other )?(?:attacking )?creatures you control get \+(\d+)\/\+(\d+)/))){ p += +x[1]; q += +x[2]; } });
    if (att.length === 1) { p += exalted; q += exalted; }
    return p || q ? BH.pumped(m, p, q) : m;
  });
};
{
  const ae = BH.attackEval;
  BH.attackEval = function(v, M, plan, cache, tw){
    const key = M.map(m => plan[m.id] || '-').join(','); if (cache.has(key)) return cache.get(key);
    return ae.call(this, v, BH.atkBonus(M, plan), plan, cache, tw);
  };
  BH.pwRedirect = (v, sel) => {
    const opts = defOpts().filter(o => o.key.startsWith('c:')); if (!opts.length) return sel;
    const out = {...sel}; const used = new Set();
    for (const o of opts){
      const d = parseDef(o.key); const w = (boardOf(d.pid) || []).find(c => c.id === d.id); if (!w || !isPW(w)) continue;
      const op = v.opps.find(x => x.pid === d.pid); if (!op) continue;
      const mine = Object.entries(out).filter(([id, k]) => k === 'p:' + d.pid).map(([id]) => S.bf.find(c => c.id === +id)).filter(Boolean);
      if (!mine.length) continue;
      const M = BH.atkBonus(mine.map(c => BH.model(c, MYPID)), Object.fromEntries(mine.map(c => [c.id, 1])));
      const Bs = BH.oppCreatures(op).filter(c => !BH.tapped(c)).map(c => BH.model(c, op.pid));
      const sol = BH.solveBlocks(M, Bs, {life:op.life, psn:op.psn || 0, cdt:BH.cdtFrom(op), canB:(B, A) => BH.canBlockX(B.c, op.pid, A.c, MYPID), pumpP:0, press:BH.power(S.bf, MYPID)});
      if (sol.lethal) continue;
      const free = sol.pick.filter(x => !x.bl.length && !used.has(x.A.id)).map(x => x.A).filter(A => A.p * (A.ds ? 2 : 1) >= (w.co || 0)).sort((a, b) => a.p - b.p);
      if (free[0]){ out[free[0].id] = o.key; used.add(free[0].id); BH.why('attack_planeswalker', cname(w)); }
    }
    return out;
  };
  ['hard', 'veryhard'].forEach(id => { const L = BOT_LEVELS[id]; const at = L.attack;
    L.attack = function(v){ const sel = at.call(this, v) || {}; try { return BH.pwRedirect(v, sel); } catch (e){ return sel; } }; });
}
