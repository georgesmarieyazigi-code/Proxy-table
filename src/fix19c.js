/* =================== fix19c (helper N): rules and mechanics from GAPS19 ===================
   1  The Ring: level 1 (can't be blocked by creatures with greater power) and level 3 (blockers are sacrificed at end of combat)
   2  Convoke: a tapped creature pays one mana of one of its colours, or {1}
   3  Disguise / cloak: the face-down permanent has ward {2} (702.168a, 701.58a)
   4  Earthbend: when the land dies or is exiled, it returns to the battlefield tapped (a triggered ability on the stack)
   5  Votes with any number of options; every player votes on their own screen
   6  The last cards that asked for a number (Urza's Saga Construct, Sunbird's Invocation, Glimpse the Impossible, Dihada,
      Hordewing Skaab, Knollspine Dragon)
   7  Locus of Enlightenment gains loyalty abilities of planeswalker materials (606.3: one loyalty ability per turn, sorcery speed)
   8  Yedora's face-down land has no name (708.2) for "different names" counts and name choices
   9  Satoru Umezawa: a creature with its own ninjutsu may use either cost
   10 The Rise of Sozin II: the searching player chooses how many and which cards (701.19b)
   11 Marchesa, Resolute Monarch: "since your last turn" includes your previous turn
   12 Hydroelectric Specimen: "with a single target" uses the targets actually chosen (115.?)
   13 Card names / creature types: any real card name (Scryfall) and every creature type (CR 205.3m)
   14 Kefka, Court Mage: card types among the discarded cards of every player are computed on all clients */
RQ_OPS.push('f19sacT', 'f19disc', 'f19szQ', 'f19szEx', 'f19vote');
const F19 = {nmCache:new Map()};
const f19wn = w => { const n = wn(String(w || '').toLowerCase()); return n != null ? n : (/^\d+$/.test(String(w)) ? +w : null); };

/* ======================================================================
   1. The Ring tempts you — level 1 and level 3 enforced
   ====================================================================== */
{
  const cpe = cardPublicExtra;
  cardPublicExtra = function(c){ const o = cpe(c); try { if (c && c.anim && typeof c.anim === 'string' && !c.fd) o.f19an = c.anim.slice(0, 12); if (c && c.ring) o.ring = 1; if (c && c.fd && (c.fdc === 'disguise' || c.fdc === 'cloak' || c.r26cloak)) o.f19w2 = 1; } catch {} return o; };
  const ss = sanitizeState;
  sanitizeState = function(s){ const r = ss(s); try { if (r && s && Array.isArray(s.bf)) r.bf.forEach((c, i) => { const o = s.bf[i]; if (!o || o.id !== c.id) return; if (typeof o.f19an === 'string' && !c.anim) c.anim = o.f19an.replace(/[^a-z0-9]/gi, '').slice(0, 12); if (o.ring) c.ring = 1; if (o.f19w2) c.f19w2 = 1; }); } catch {} return r; };
  // level 1: "can't be blocked by creatures with greater power" — enforced on the blocker's client
  const cb = canBlock;
  canBlock = function(b, a, apid){ const r = cb(b, a, apid); if (r) return r;
    try { if (a && a.ring && apid && apid !== MYPID && ((OPP.get(apid) || {}).ring || 0) >= 1){ const sa = stats(a, apid); const sb = stats(b); if (sa && sb && sb[0] > sa[0]) return `can't block (the Ring-bearer can't be blocked by creatures with greater power)`; } } catch {}
    return r; };
}
async function f19RingSac(ctx){
  const ring = /ring-bearer/i.test(String(ctx.full || '') + ' ' + (info(ctx.k)?.o || '')); const self = ctx.srcId != null ? S.bf.find(c => c.id === ctx.srcId) : null;
  const rb = ring ? S.bf.find(c => c.ring && !c.fd) : (self && S.bf.find(c => c.id === (ctx.it && ctx.it.evId)) || self); const bl = rb ? (blockersFor().get(rb.id) || []) : [];
  if (!bl.length){ log(`${ctx.name}: no creature is blocking it`); return; }
  S.f19eoc = (S.f19eoc || []).concat(bl.map(b => ({pid:b.pid, id:b.id, nm:b.nm})));
  r21bDelay('eoc', false, ring ? 'Each creature that blocked your Ring-bearer is sacrificed by its controller.' : 'Each creature that blocked it is sacrificed by its controller.', {...ctx, lastT:[], lastTok:[], lastPut:[], r19toks:[], lastCardId:null, srcId:null});
}
function f19RingSacNow(src){
  const list = (S.f19eoc || []).splice(0);
  for (const b of list){ if (b.pid === MYPID){ const c = S.bf.find(x => x.id === b.id); if (c){ sacrificeOne(c); log(`sacrificed ${cname(c)} (${src})`); } }
    else if (b.pid && (OPP.get(b.pid)?.bf || []).some(x => x.id === b.id)){ sendRq(b.pid, 'f19sacT', 0, src, {tid:b.id}); log(`${src}: ${nameOf(b.pid)} sacrifices ${b.nm || 'the blocker'}`); } }
  commit();
}

/* ======================================================================
   2. Convoke pays coloured mana too (702.51a)
   ====================================================================== */
function f19Cols(b){ const c = typeof b.col === 'string' && /^[WUBRG]$/.test(b.col) ? b.col : (info(b.k)?.c || ''); return [...new Set(String(c).split('').filter(x => /[WUBRG]/.test(x)))]; }
function f19CostPips(cost){ return (cost.gen || 0) + MANA.reduce((a, x) => a + (cost.col[x] || 0), 0) + cost.hyb.length + cost.two.length + cost.phy.length; }
// assign each creature to one pip of the cost (coloured first, the colour the pool is shortest of); returns the reduced cost and the creatures used
function f19ConvokeAssign(cost0, creatures){
  const cost = {...cost0, col:{...cost0.col}, hyb:cost0.hyb.map(h => h.slice()), two:cost0.two.slice(), phy:cost0.phy.slice()};
  const pool = S.pool || {}; const used = []; const how = [];
  const list = creatures.slice().sort((a, b) => f19Cols(a).length - f19Cols(b).length);
  for (const b of list){
    const cols = f19Cols(b); let done = false;
    const cand = cols.filter(x => (cost.col[x] || 0) > 0).sort((x, y) => ((cost.col[y] || 0) - (pool[y] || 0)) - ((cost.col[x] || 0) - (pool[x] || 0)));
    if (cand.length){ cost.col[cand[0]]--; how.push(cand[0]); done = true; }
    if (!done){ const i = cost.phy.findIndex(x => cols.includes(x)); if (i >= 0){ cost.phy.splice(i, 1); how.push(cols.find(() => true)); done = true; } }
    if (!done){ const i = cost.hyb.findIndex(h => h.some(x => cols.includes(x))); if (i >= 0){ cost.hyb.splice(i, 1); how.push('hybrid'); done = true; } }
    if (!done){ const i = cost.two.findIndex(x => cols.includes(x)); if (i >= 0){ cost.two.splice(i, 1); how.push('2/' + cost0.two[i]); done = true; } }
    if (!done && cost.gen > 0){ cost.gen--; how.push('1'); done = true; }
    if (done) used.push(b);
  }
  return {cost, used, how};
}
const f19ConvokeOn = c => { UI.f19cvOff = true; try { return !!extraKinds(c).convoke; } finally { UI.f19cvOff = false; } };
{
  const ek = extraKinds;
  extraKinds = function(c){ const r = ek(c); if (UI.f19cvOff || !UI.f19cvBase) return r; return r && r.convoke ? {...r, convoke:false} : r; };
  const xp = extraPayments;
  extraPayments = async function(c, sc){
    if (!c || !f19ConvokeOn(c)) return xp(c, sc);
    UI.f19cvBase = true; let base; try { base = await xp(c, sc); } finally { UI.f19cvBase = false; }
    if (base === false) return false;
    const cr = S.bf.filter(b => isCreatureCard(b) && !b.tap && !b.fd); const pips = f19CostPips(sc.cost);
    if (!cr.length || !pips || UI.dry) return base;
    const ids = await pickCards({title:`Convoke: tap creatures to help pay`, hint:`Each creature tapped pays {1} or one mana of its colour. Still to pay: ${costStr(sc.cost)}.`, cards:cr, min:0, max:Math.min(cr.length, pips), noneLabel:'Tap none'});
    if (ids == null) return false;
    const chosen = ids.map(id => S.bf.find(b => b.id === id)).filter(Boolean); if (!chosen.length) return base;
    const a = f19ConvokeAssign(sc.cost, chosen); Object.assign(sc.cost, a.cost);
    const useIds = a.used.map(b => b.id); if (useIds.length) sc.notes.push(`convoke −${useIds.length} (${a.how.map(h => /^[WUBRG]$/.test(h) ? '{' + h + '}' : h === '1' ? '{1}' : h).join('')})`);
    return {apply(){ if (base && base.apply) base.apply(); useIds.forEach(id => { const b = S.bf.find(x => x.id === id); if (b) b.tap = true; });
      if (useIds.length){ log(`convoked with ${useIds.length} creature${useIds.length === 1 ? '' : 's'} (${a.how.map(h => /^[WUBRG]$/.test(h) ? '{' + h + '}' : h === '1' ? '{1}' : h).join('')})`);
        try { S.a26cv = S.a26cv || {}; S.a26cv[c.id] = [...new Set([...(S.a26cv[c.id] || []), ...useIds])]; } catch {} } }};
  };
  const ecp = extraCanPay;
  extraCanPay = function(c, sc){ if (ecp(c, sc)) return true; try { if (!c || !f19ConvokeOn(c)) return false; const cr = S.bf.filter(b => isCreatureCard(b) && !b.tap && !b.fd); if (!cr.length) return false;
      const a = f19ConvokeAssign(sc.cost, cr); return !payPlan(a.cost, S.pool).err; } catch { return false; } };
}

/* ======================================================================
   3. Disguise / cloak: the face-down permanent has ward {2}
   ====================================================================== */
{
  const wo = wardOf;
  wardOf = function(c){ const r = wo(c); if (r) return r; try { if (c && c.fd && (c.fdc === 'disguise' || c.fdc === 'cloak' || c.r26cloak || c.f19w2)) return {mana:'{2}', label:'{2}'}; } catch {} return r; };
}

// face-down permanents are 2/2 colourless nameless creatures (708.2): they can be targeted like any creature (and ward {2} applies)
const F19FD = 'f19:fd';
try { if (!DICT.has(F19FD)) DICT.set(F19FD, {k:F19FD, n:'Face-down creature', m:'', t:'Creature', o:'', p:'2/2', img:'', c:'', back:null, toks:[], tok:false, cc:false, lay:'normal', full:'Face-down creature', set:'', cn:'', pr:'', art:'', mv:0, ci:'', kw:[]}); } catch {}
{
  const tc = targetCands;
  targetCands = function(spec, src){ const out = tc(spec, src);
    try { if (!spec || spec.zone === 'gy' || !Array.isArray(out) || !S) return out; const d = String(spec.desc || '');
      const cardDesc = spec.any ? 'creature or planeswalker or battle' : d.replace(/\b(players?|opponents?)\b/g, '').replace(/^\s*(or|and)\s+|\s+(or|and)\s*$/g, '').trim(); if (!cardDesc) return out;
      const cd = ctlDesc(cardDesc);
      for (const b of boardsAll()){ if (cd.ctl === 'you' && b.pid !== MYPID) continue; if (cd.ctl === 'opp' && b.pid === MYPID) continue;
        for (const c of b.bf){ if (c.emb || out.some(o => o.t === 'card' && o.pid === b.pid && o.id === c.id)) continue;
          // an animated permanent (earthbend, crew, "becomes a creature") is a creature as well as its other types
          if (!c.fd && c.k && c.anim && isCreatureCard(c) && !/\bCreature\b/.test(info(c.k)?.t || '')){ const f = faceOf(c) || info(c.k);
            if (f && descOk(c.k, cd.desc || 'permanent', {tok:c.tok, face:{...f, t:String(f.t || '').replace(/^([^—]*?)(\s*—|$)/, '$1 Creature$2')}})){
              let why = ''; if (b.pid !== (src && src.pid) && kwOf(c, 'hexproof', b.pid)) why = 'hexproof'; else if (kwOf(c, 'shroud', b.pid)) why = 'shroud'; else if (protects(c, src || {})) why = 'protection';
              out.push({t:'card', pid:b.pid, id:c.id, k:c.k, nm:info(c.k)?.n || 'a card', ok:!why, why}); }
            continue; }
          if (!c.fd) continue;
          if (spec.other && src && b.pid === MYPID && c.id === src.id) continue;
          if (!descOk(F19FD, cd.desc || 'permanent', {tok:c.tok})) continue;
          let why = ''; if (b.pid !== (src && src.pid) && (c.ekw || []).includes('hexproof')) why = 'hexproof'; else if ((c.ekw || []).includes('shroud')) why = 'shroud';
          out.push({t:'card', pid:b.pid, id:c.id, k:F19FD, nm:'face-down creature', ok:!why, why}); } } } catch (e){ console.warn('f19 fd targets', e); }
    return out; };
  const tst = targetStillThere;
  targetStillThere = function(t){ try { if (t && t.t === 'card' && t.k === F19FD) return boardOf(t.pid).some(b => b.id === t.id); } catch {} return tst(t); };
}

/* ======================================================================
   4. Earthbend: "When it dies or is exiled, return it to the battlefield tapped."
   ====================================================================== */
{
  const mc = moveCard;
  moveCard = function(id, to, o = {}){
    let eb = null; try { const [z,, c] = find(id); if (z === 'bf' && (to === 'gy' || to === 'ex') && c && c.anim === 'eb' && !c.tok && !c.own) eb = c; } catch {}
    const r = mc(id, to, o);
    try { if (eb && S){ const [z2] = find(eb.id); if (z2 !== 'bf'){ eb.anim = null; delete eb.ebd; if (eb.ekw) eb.ekw = eb.ekw.filter(k => k !== 'haste'); }
        if (z2 === 'gy' || z2 === 'ex'){ (S.f19ebP ||= []).push(eb.id); const it = {sid:rid(6), o:nextO(), kind:'trigger', k:eb.k, nm:cname(eb), txt:'Return this land to the battlefield tapped.', srcId:eb.id, f19eb:eb.id};
          S.stk.push(it); S.pass = 's:' + it.sid; log(`trigger: ${cname(eb)} (earthbend) — it ${z2 === 'gy' ? 'died' : 'was exiled'}: return it to the battlefield tapped`); commit(); } } } catch (e){ console.warn('f19 eb', e); }
    return r;
  };
}

/* ======================================================================
   5. Votes with any number of options
   ====================================================================== */
async function f19Vote(opts, ctx, labels){
  const votes = {}; opts.forEach(o => { votes[o] = 0; }); const lab = o => (labels && labels[o]) || cap(o); const who = {};
  const extra = rulesOn('extraVote').length ? 2 : 1;
  for (let i = 0; i < extra; i++){ const v = UI.dry ? opts[0] : await askChoice({title:`${ctx.name}: your vote${extra > 1 ? ' ' + (i + 1) : ''}`, options:opts.map(o => ({label:lab(o), value:o}))}); if (v != null && v in votes){ votes[v]++; (who[MYPID] ||= []).push(v); } }
  // every other player votes on their own screen, in turn order after me (they answer at the same time)
  const others = opponents();
  if (UI.dry) others.forEach(p => { votes[opts[0]]++; });
  else {
    // two options: the classic 'vote' request (every build understands it); more: 'f19vote' (labels are looked up on the voter's screen)
    const two = opts.length === 2 && !labels; const d = opts.join('|');
    const asks = others.map(p => { const ref = rid(6); UI.voteAns = UI.voteAns || {}; sendRq(p.pid, two ? 'vote' : 'f19vote', opts.length, ctx.name, {ref, d:d.slice(0, 80)}); return {p, ref}; });
    if (d.length > 80) log(`⚠ ${ctx.name}: too many vote options to send in full`);
    commit(); if (asks.length) toast(`Waiting for ${asks.map(a => a.p.nm).join(', ')} to vote…`);
    for (const a of asks){ const ans = await waitUntil(() => UI.voteAns[a.ref], 90000);
      if (ans){ ans.forEach(v => { if (v in votes){ votes[v]++; (who[a.p.pid] ||= []).push(v); } }); log(`${a.p.nm} voted ${ans.map(lab).join(' and ') || 'nothing'}`); } else log(`${a.p.nm} didn't vote in time`); }
  }
  ctx.votes = votes; ctx.f19who = who; log(`${ctx.name}: votes — ${opts.map(o => lab(o) + ' ' + votes[o]).join(', ')}`); commit();
  return votes;
}
{
  const ao = applyOp;
  applyOp = function(r, from){
    if (r && (r.op === 'f19vote' || (r.op === 'vote' && String(r.d || '').split('|').length > 2))){ (async () => {
        const opts = String(r.d || '').split('|').filter(Boolean); const lab = {}; opts.forEach(k => { lab[k] = k === MYPID ? nameOf(MYPID) + ' (me)' : OPP.has(k) ? nameOf(k) : cap(k); });
        const extra = rulesOn('extraVote').length ? 2 : 1; const out = [];
        for (let i = 0; i < extra; i++){ const v = await askChoice({title:`${r.src}: vote${extra > 1 ? ' ' + (i + 1) : ''} — ${opts.map(o => lab[o]).join(', ')}?`, options:opts.map(o => ({label:lab[o], value:o}))}); if (v) out.push(v); }
        log(`voted ${out.map(o => lab[o]).join(' and ') || 'nothing'} (${r.src})`); sendRq(from, 'voteAns', out.length, r.src, {ref:r.ref, d:out.join('|')}); commit(); })(); return; }
    if (r && r.op === 'f19sacT'){ const c = r.tid != null ? S.bf.find(b => b.id === r.tid) : null; if (c) sacrificeOne(c); commit(); return; }
    if (r && r.op === 'f19disc'){ f19DiscFor(r, from); return; }
    if (r && r.op === 'f19szQ'){ const nm = String(r.d || ''); const has = c => info(c.k)?.n === nm || String(info(c.k)?.n || '').split(' // ').includes(nm);
      const d = ['hand', 'lib', 'gy'].map(z => S[z].filter(has).length).join(','); sendRq(from, 'r21ack', 1, r.src, {ref:r.ref, d}); return; }
    if (r && r.op === 'f19szEx'){ const [nm, cnt] = String(r.d || '').split('§'); const want = String(cnt || '0,0,0').split(',').map(x => clamp(+x || 0, 0, 10)); const got = {hand:0, lib:0, gy:0};
      const has = c => info(c.k)?.n === nm || String(info(c.k)?.n || '').split(' // ').includes(nm);
      ['hand', 'lib', 'gy'].forEach((z, zi) => { let left = want[zi]; for (const c of S[z].filter(has)){ if (left <= 0) break; const i = S[z].indexOf(c); if (i < 0) continue; S[z].splice(i, 1); S.ex.push(c); got[z]++; left--; } });
      shuffle(S.lib); const tot = got.hand + got.lib + got.gy; log(`exiled ${tot} card${tot === 1 ? '' : 's'} named ${nm} (${r.src}: ${got.hand} from hand, ${got.lib} from library, ${got.gy} from graveyard), then shuffled`);
      sendRq(from, 'r21ack', tot, r.src, {ref:r.ref, d:`${got.hand} hand, ${got.lib} library, ${got.gy} graveyard`}); commit(); return; }
    return ao(r, from);
  };
}

/* ======================================================================
   6. The cards that asked for a number
   ====================================================================== */
// damage dealt to each player this turn (published, for Knollspine Dragon)
{
  const dm = damageMe;
  damageMe = function(n, f = {}, from){ const l0 = S ? S.life : 0, p0 = S ? S.psn : 0; const r = dm(n, f, from);
    try { if (S){ const d = Math.max(0, l0 - S.life) + Math.max(0, S.psn - p0); if (d > 0){ const t = turnStr(); if (!S.f19dmg || S.f19dmg.t !== t) S.f19dmg = {t, n:0}; S.f19dmg.n += d; } } } catch {} return r; };
  const ep = enginePublic;
  enginePublic = function(){ const o = ep(); try { if (S.f19dmg) o.f19dmg = {t:S.f19dmg.t, n:S.f19dmg.n}; } catch {} return o; };
  const se = sanitizeEngine;
  sanitizeEngine = function(s){ const o = se(s); try { if (s && s.f19dmg && typeof s.f19dmg === 'object') o.f19dmg = {t:String(s.f19dmg.t || '').slice(0, 20), n:clamp(+s.f19dmg.n || 0, 0, 999)}; } catch {} return o; };
}
const f19DmgThisTurn = pid => { if (pid === MYPID) return S.f19dmg && S.f19dmg.t === turnStr() ? S.f19dmg.n : 0; const s = OPP.get(pid); return s && s.f19dmg && s.f19dmg.t === turnStr() ? s.f19dmg.n : 0; };
// "that spell's mana value" (Sunbird's Invocation): the spell that was cast, with X
{
  const co = countOf;
  countOf = function(phrase, ctx){
    const p = String(phrase || '').trim().toLowerCase().replace(/\.$/, '');
    try {
      if (/^that spell's mana value$/.test(p)){ const it = ctx && ctx.it; const id = it && it.evId; const k = it && it.evk;
        const st = id != null ? stackAll().find(x => x.kind === 'spell' && (x.it ? x.it.card && x.it.card.id === id : false)) : null;
        if (st) return st.mv || 0; if (k) return info(k)?.mv || 0; return UI.dry ? 3 : 0; }
      if (/different names/.test(p)){ const r = co(phrase, ctx); const named = c => c && c.k && !c.fd && c.k !== 'a27:fdforest' && info(c.k)?.n;
        const m = p.match(/^(lands?|creatures?|permanents?|artifacts?|enchantments?) (?:you control )?with different names(?: you control)?$/);
        if (m){ const d = sing(m[1]); return new Set(S.bf.filter(c => named(c) && descOk(c.k, d, {tok:c.tok})).map(c => info(c.k).n)).size; }
        return r; }
    } catch (e){ console.warn('f19 countOf', e); }
    return co(phrase, ctx);
  };
}
// Hordewing Skaab: how many opponents the Zombies dealt combat damage to in this batch
{
  const pt = pushTrigger;
  pushTrigger = function(src, t, ev, evPid){ const n0 = S.stk.length; const r = pt(src, t, ev, evPid);
    try { if (t && /number of opponents dealt damage this way/i.test(t.eff || '') && S.stk.length > n0){ const it = S.stk[S.stk.length - 1];
        const d = /one or more ([a-z]+?)s? you control deal combat damage/i.exec(t.raw || '') ; const desc = d ? d[1].toLowerCase() : '';
        const q = (UI.curQ || []).filter(([pid, e]) => pid === MYPID && e && e.type === 'cdmg' && e.dp && e.dp !== MYPID && (!desc || descOk(e.k, desc)));
        const src0 = q.length ? q : S.ev.filter(e => e.type === 'cdmg' && e.dp && e.dp !== MYPID && ev && e.n >= (ev.n || 0) - 8 && (!desc || descOk(e.k, desc))).map(e => [MYPID, e]);
        it.f19opps = new Set(src0.map(([, e]) => e.dp)).size; commit(); } } catch (e){ console.warn('f19 skaab', e); }
    return r; };
}
// track the cards each sentence put into my graveyard ("for each card put into your graveyard this way")
{
  const ds = doSentence;
  doSentence = async function(s0, ctx){
    const before = ctx && S ? new Set(S.gy.map(c => c.id)) : null;
    const r = await ds(s0, ctx);
    try { if (before && ctx){ const add = S.gy.filter(c => !before.has(c.id)).map(c => c.id); ctx.f19gyPrev = add; } } catch {}
    return r;
  };
}
// the Construct token's ability is in single quotes inside a granted ability: it isn't a "for each" count
{
  const cft = createFromText;
  createFromText = async function(s, ctx){ let t = String(s);
    try { t = t.replace(/ with '([^']*?for each[^']*?)'(?=\s*(?:\.|$|,| and ))/i, ' with "$1"'); } catch {}
    return cft(t, ctx); };
}

/* ======================================================================
   7. Locus of Enlightenment: loyalty abilities of planeswalker materials
   ====================================================================== */
function f19LocusMats(c){ try { if (!c || !c.fl || c.fd) return null; const f = faceOf(c); if (!f || !/has each activated ability of the exiled cards used to craft it/i.test(f.o || '')) return null; return c.e27mat || (S.e27mat && S.e27mat[c.id]) || null; } catch { return null; } }
{
  const la = loyaltyAbs;
  loyaltyAbs = function(c){ const out = la(c); try { if (!c || isPW(c) || !S || !S.bf.includes(c)) return out; const mats = f19LocusMats(c); if (!mats) return out; const add = [];
      mats.forEach((k, mi) => { const a = info(k); if (!a || !/\bPlaneswalker\b/.test(a.t || '')) return; tname(a.o || '', a.n).split('\n').forEach((raw, li) => { const m = raw.trim().match(/^([+−\-]?(?:\d+|X)):\s*(.+)$/); if (!m) return;
        add.push({raw:m[1], cost:m[1] === 'X' ? 0 : m[1].replace('−', '-'), eff:m[2], f19once:`${c.id}|${mi}|${li}`, f19from:a.n}); }); });
      return out.concat(add); } catch (e){ console.warn('f19 locus', e); } return out; };
  const lr = loyaltyReady;
  loyaltyReady = function(c, ab){ try { if (ab && ab.f19once && S.e27used && S.e27used[ab.f19once] === turnStr()) return 'Only once each turn (Locus of Enlightenment)'; } catch {} return lr(c, ab); };
  const al = activateLoyalty;
  activateLoyalty = async function(c, i){ const ab = loyaltyAbs(c)[i]; const n0 = S.stk.length; const r = await al(c, i);
    try { if (ab && ab.f19once && S.stk.length > n0){ (S.e27used ||= {})[ab.f19once] = turnStr(); commit(); } } catch {} return r; };
  const mi = round4MenuItems;
  round4MenuItems = function(c){ let h = mi(c); try { if (c && !c.fd && !isPW(c) && S && S.bf.includes(c) && loyaltyAbs(c).length) h = mb('pwOpen', `Loyalty abilities of crafted planeswalkers (loyalty ${c.co || 0})…`, `data-id="${c.id}"`) + '<div class="sep"></div>' + h; } catch {} return h; };
}

/* ======================================================================
   8. Yedora's face-down land has no name: never offered as a card name
   ====================================================================== */
{
  const no = r21NameOptions;
  r21NameOptions = function(desc){ return no(desc).filter(n => n && n !== 'Face-down land'); };
}

/* ======================================================================
   9. Satoru Umezawa: own ninjutsu cost or the granted {2}{U}{B}
   ====================================================================== */
function f19NjOwn(c){ const m = (info(c.k)?.o || '').match(/^(Commander )?ninjutsu ((?:\{[^}]+\})+)/mi); return m ? {cmd:!!m[1], cost:m[2]} : null; }
function f19NjGrant(c){ try { if (S && c && S.hand.includes(c) && isCreatureCard(c)){ const g = rulesOn('a27nj')[0]; if (g) return {cmd:false, cost:g.cost, a27:g.src}; } } catch {} return null; }
{
  const no = ninjutsuOf;
  ninjutsuOf = function(c){ try { if (c && UI.f19nj && UI.f19nj.id === c.id) return UI.f19nj.nj; } catch {} return no(c); };
  const hi = r8HandItems;
  r8HandItems = function(c, zone){ let s = hi(c, zone);
    try { if (zone === 'hand' && c){ const own = f19NjOwn(c), g = f19NjGrant(c); if (own && g && own.cost.toUpperCase() !== g.cost.toUpperCase()){ const ok = ninjutsuWindow() && unblockedAttackers().length;
          s += `<button type="button" data-act="f19nj" data-id="${c.id}" ${ok ? '' : 'disabled'}><span>Ninjutsu ${manaHTML(g.cost)} (granted by ${esc(g.a27 || 'Satoru')})${ninjutsuWindow() ? '' : '<small class="why">after blockers are declared, with an unblocked attacker</small>'}</span></button>`; } } } catch {}
    return s; };
  Object.assign(ACT, { f19nj(el){ const [z,, c] = find(+el.dataset.id); closeMenu(); if (c) f19NinjutsuGranted(c, z); } });
}
async function f19NinjutsuGranted(c, zone){ const g = f19NjGrant(c); if (!g) return; UI.f19nj = {id:c.id, nj:g}; try { await doNinjutsu(c, zone); } finally { UI.f19nj = null; } }

/* ======================================================================
   13. Any real card name, every creature type
   ====================================================================== */
const F19_TYPES = ("Advisor, Aetherborn, Alien, Ally, Angel, Antelope, Ape, Archer, Archon, Armadillo, Army, Artificer, Assassin, Assembly-Worker, Astartes, Atog, Aurochs, Avatar, Azra, Badger, Balloon, Barbarian, Bard, Basilisk, Bat, Bear, Beast, Beaver, Beeble, Beholder, Berserker, Bird, Bison, Blinkmoth, Boar, Bringer, Brushwagg, Camarid, Camel, Capybara, Caribou, Carrier, Cat, Centaur, Child, Chimera, Citizen, Cleric, Clown, Cockatrice, Construct, Coward, Coyote, Crab, Crocodile, C’tan, Custodes, Cyberman, Cyclops, Dalek, Dauthi, Demigod, Demon, Deserter, Detective, Devil, Dinosaur, Djinn, Doctor, Dog, Dragon, Drake, Dreadnought, Drix, Drone, Druid, Dryad, Dwarf, Echidna, Efreet, Egg, Elder, Eldrazi, Elemental, Elephant, Elf, Elk, Employee, Eternal, Eye, Faerie, Ferret, Fish, Flagbearer, Fox, Fractal, Frog, Fungus, Gamer, Gamma, Gargoyle, Germ, Giant, Giraffe, Gith, Glimmer, Gnoll, Gnome, Goat, Goblin, God, Golem, Gorgon, Graveborn, Gremlin, Griffin, Guest, Hag, Halfling, Hamster, Harpy, Hedgehog, Hellion, Hero, Hippo, Hippogriff, Homarid, Homunculus, Horror, Horse, Human, Hydra, Hyena, Illusion, Imp, Incarnation, Inhuman, Inkling, Inquisitor, Insect, Jackal, Jellyfish, Juggernaut, Kangaroo, Kavu, Kirin, Kithkin, Knight, Kobold, Kor, Kraken, Kree, Llama, Lamia, Lammasu, Leech, Lemur, Leviathan, Lhurgoyf, Licid, Lizard, Lobster, Manticore, Masticore, Mercenary, Merfolk, Metathran, Minion, Minotaur, Mite, Mole, Monger, Mongoose, Monk, Monkey, Moogle, Moonfolk, Mount, Mouse, Mutant, Myr, Mystic, Nautilus, Necron, Nephilim, Nightmare, Nightstalker, Ninja, Noble, Noggle, Nomad, Nymph, Octopus, Ogre, Ooze, Orb, Orc, Orgg, Otter, Ouphe, Ox, Oyster, Pangolin, Peasant, Pegasus, Pentavite, Performer, Pest, Phelddagrif, Phoenix, Phyrexian, Pilot, Pincher, Pirate, Plant, Platypus, Porcupine, Possum, Praetor, Primarch, Prism, Processor, Qu, Rabbit, Raccoon, Ranger, Rat, Rebel, Reflection, Rhino, Rigger, Robot, Rogue, Sable, Salamander, Samurai, Sand, Saproling, Satyr, Scarecrow, Scientist, Scion, Scorpion, Scout, Sculpture, Seal, Serf, Serpent, Servo, Shade, Shaman, Shapeshifter, Shark, Sheep, Shi’ar, Siren, Skeleton, Skrull, Skunk, Slith, Sliver, Sloth, Slug, Snail, Snake, Soldier, Soltari, Sorcerer, Spawn, Specter, Spellshaper, Sphinx, Spider, Spike, Spirit, Splinter, Sponge, Spy, Squid, Squirrel, Starfish, Surrakar, Survivor, Symbiote, Synth, Tentacle, Tetravite, Thalakos, Thopter, Thrull, Tiefling, Time Lord, Toy, Treefolk, Trilobite, Triskelavite, Troll, Turtle, Tyranid, Unicorn, Utrom, Vampire, Varmint, Vedalken, Villain, Volver, Wall, Walrus, Warlock, Warrior, Weasel, Weird, Werewolf, Whale, Wizard, Wolf, Wolverine, Wombat, Worm, Wraith, Wurm, Yeti, Zombie, Zubera").split(', ');
const F19_COMMON = ['Elf', 'Goblin', 'Zombie', 'Human', 'Vampire', 'Dragon', 'Angel', 'Sliver', 'Merfolk', 'Wizard', 'Dinosaur', 'Cat', 'Dog', 'Spirit', 'Warrior', 'Knight', 'Soldier', 'Cleric', 'Rogue', 'Squirrel', 'Ninja', 'Faerie', 'Elemental', 'Beast', 'Rat', 'Treefolk', 'Pirate', 'Demon', 'Horror', 'Eldrazi'];
// a "choice" modal with a search box: options = local matches + Scryfall autocomplete (names) or the full list (types)
function f19AskSearch(o){
  // o: {title, base:[...first options], all:[...] | null, remote:bool, hint}
  if (UI.dry) return Promise.resolve(o.base[0] || (o.all || [])[0] || null);
  const opts = (o.base.length ? o.base : (o.all || []).slice(0, 30)).map(n => ({label:n, value:n}));
  return askChoice({title:o.title, options:opts, f19s:{q:'', base:o.base, all:o.all || null, remote:!!o.remote, hint:o.hint || ''}});
}
function f19SearchOpts(m){
  const s = m.f19s; const q = norm(s.q || ''); if (!q) return (s.base.length ? s.base : (s.all || []).slice(0, 30));
  const pool = [...new Set([...(s.base || []), ...(s.all || []), ...(s.remoteHits || [])])];
  const st = pool.filter(n => norm(n).startsWith(q)), inc = pool.filter(n => !norm(n).startsWith(q) && norm(n).includes(q));
  return [...st, ...inc].slice(0, 40);
}
function f19ChoicesHTML(m){ return m.options.map((op, i) => `<button class="btn${i === 0 ? ' primary' : ''}" type="button" data-act="choose" data-i="${i}"><span>${esc(op.label)}</span></button>`).join('') || '<p class="hint">Nothing matches.</p>'; }
{
  const rem = renderEngineModal;
  renderEngineModal = function(m){ if (m && m.type === 'choice' && m.f19s){
      return {title:m.title, body:`<p class="hint">${esc(m.f19s.hint || 'Type to search every card name.')}</p><input type="search" id="f19nq" placeholder="Type to search" value="${esc(m.f19s.q || '')}" autocomplete="off" spellcheck="false" aria-label="Search" style="width:100%;margin:4px 0 8px"><div class="choices" id="f19nc">${f19ChoicesHTML(m)}</div>`}; }
    return rem(m); };
  document.addEventListener('input', e => {
    if (!e.target || e.target.id !== 'f19nq') return; const m = UI.modal; if (!m || !m.f19s) return;
    m.f19s.q = e.target.value; const refresh = () => { if (UI.modal !== m) return; m.options = f19SearchOpts(m).map(n => ({label:n, value:n})); const box = document.getElementById('f19nc'); if (box) box.innerHTML = f19ChoicesHTML(m); };
    refresh();
    if (m.f19s.remote && m.f19s.q.trim().length >= 2){ const q = m.f19s.q.trim(); clearTimeout(F19.acT);
      F19.acT = setTimeout(async () => { try { const r = await sf('/cards/autocomplete?q=' + encodeURIComponent(q)); if (UI.modal !== m || m.f19s.q.trim() !== q) return; m.f19s.remoteHits = [...new Set([...(m.f19s.remoteHits || []), ...((r && r.data) || [])])]; refresh(); } catch {} }, 250); }
  });
}
// make sure a name typed from Scryfall is a real card of the right kind (loads it into the dictionary)
async function f19NameCard(nm){
  let a = [...DICT.values()].find(x => x && x.n === nm && !x.tok); if (a) return a;
  if (F19.nmCache.has(nm)) return F19.nmCache.get(nm);
  try { const c = await sf('/cards/named?exact=' + encodeURIComponent(nm)); if (c && c.object === 'card'){ a = addInfo(infoFrom(c)); F19.nmCache.set(nm, a); return a; } } catch {}
  F19.nmCache.set(nm, null); return null;
}
async function f19ChooseName(title, desc, base){
  const ok = a => !a ? false : desc === 'creature' ? /\bCreature\b/.test(a.t || '') : desc === 'land' ? /\bLand\b/.test(a.t || '') : desc === 'nonland' ? !/\bLand\b/.test(a.t || '') : true;
  const list = (base || r21NameOptions(desc === 'creature' ? '' : desc)).filter(n => n && n !== 'Face-down land');
  for (let tries = 0; tries < 4; tries++){
    const v = await f19AskSearch({title, base:list, remote:true, hint:`Type to search every ${desc ? desc + ' ' : ''}card name (Scryfall).`});
    if (!v || UI.dry) return v;
    const a = await f19NameCard(v); if (ok(a)) return v;
    toast(a ? `${v} isn't a ${desc} card` : `Couldn't find a card named ${v}`);
  }
  return null;
}
{
  askText = async function(title, def){ if (UI.dry) return def; const v = await f19AskSearch({title, base:F19_COMMON, all:F19_TYPES, hint:'Type to search every creature type.'}); return v || def; };
  c27CreatureTypes = function(){ return F19_TYPES.slice(); };
  r21ChooseName = async function(c, desc, src){ const v = await f19ChooseName(`${src}: choose a ${desc ? desc + ' ' : ''}card name`, desc || '', null); if (v){ c.r21 = v; log(`${src}: chose ${v}`); commit(); } };
  c27PaperChoose = async function(s){
    const key = s.att.pid + ':' + s.att.id; if (s.c27pp && s.c27pp.key === key) return; s.c27pp = {key, nm:'', ty:'', h:''};
    const nm = await f19ChooseName(`${cname(s)}: choose a creature card name`, 'creature', c27CreatureNames());
    const ty = await f19AskSearch({title:`${cname(s)}: choose a creature type`, base:F19_COMMON, all:F19_TYPES, hint:'Type to search every creature type.'});
    if (!S.bf.includes(s) || !s.att || s.att.pid + ':' + s.att.id !== key) return;
    const h = rid(6); C27.pp[h] = {nm:nm || '', ty:ty || ''}; s.c27pp = {key, nm:nm || '', ty:ty || '', h};
    log(`${cname(s)}: the equipped creature's name is ${nm || '(unchanged)'} and its creature type is ${ty || '(unchanged)'}`); commit();
  };
  // Gift of Doom: every creature on the battlefield (face-down and animated ones too) can be the one it's attached to
  c27UpAttach = async function(c){
    const f = faceOf(c); if (!f || !/as ~ is turned face up, you may attach it to a creature/i.test(tname(f.o || '', f.n))) return;
    const opts = []; for (const b of boardsAll()) for (const x of b.bf) if (x.k && x.id !== c.id && !x.emb && (b.pid === MYPID ? isCreatureCard(x) : (x.fd || isCreatureCard(x)))) opts.push({label:`${b.pid === MYPID ? 'My' : nameOf(b.pid) + "'s"} ${x.fd ? 'face-down creature' : info(x.k)?.n}`, value:b.pid + '|' + x.id});
    const v = opts.length ? await askChoice({title:`${f.n} is turned face up: attach it to a creature?`, options:opts.concat([{label:"Don't attach", value:'none'}])}) : 'none';
    if (v && v !== 'none'){ const i = v.lastIndexOf('|'); c.att = {pid:v.slice(0, i), id:+v.slice(i + 1)}; log(`${f.n} is turned face up attached to ${opts.find(o => o.value === v).label}`); }
    else if (/\bAura\b/.test(f.t || '') && !c.att){ log(`${f.n} is an Aura attached to nothing — it goes to the graveyard`); moveCard(c.id, 'gy', {quiet:true}); }
    commit();
  };
}

/* ======================================================================
   12. "with a single target": the targets actually chosen
   ====================================================================== */
const f19TgN = it => { try { return (it.tgts || []).flat(3).filter(t => t && (t.t === 'card' || t.t === 'player' || t.sid)).length + (it.tgts ? 0 : (it.tgt ? 1 : 0)); } catch { return 0; } };
{
  const ep = enginePublic;
  enginePublic = function(){ const o = ep(); try { if (Array.isArray(o.stk)) o.stk.forEach((p, i) => { const it = S.stk[i]; if (it && it.sid === p.sid) p.f19n = f19TgN(it); }); } catch {} return o; };
  const se = sanitizeEngine;
  sanitizeEngine = function(s){ const o = se(s); try { if (s && Array.isArray(s.stk) && Array.isArray(o.stk)) o.stk.forEach(p => { const q = s.stk.find(x => x && x.sid === p.sid); if (q && Number.isFinite(q.f19n)) p.f19n = clamp(q.f19n, 0, 99); }); } catch {} return o; };
}
function f19SingleTarget(x){
  if (x.pid === MYPID && x.it) return f19TgN(x.it) === 1;
  if (Number.isFinite(x.f19n)) return x.f19n === 1;
  const sp = targetSpecs(String(x.txt || '')); return sp.length === 1 && sp[0].n === 1 && !!(x.tgtNm || x.tgt);   // a player on an older build
}

/* ======================================================================
   14. Kefka: each player discards; card types among all the discarded cards
   ====================================================================== */
function f19DiscFor(r, from){
  const before = S.hand.slice(); const reply = got => { const ty = [...new Set(got.flatMap(c => typesOf(c.k)))]; sendRq(from, 'r21ack', got.length, r.src, {ref:r.ref, d:ty.join(',').slice(0, 80)}); commit(); };
  if (!S.hand.length){ log(`has nothing to discard (${r.src})`); reply([]); return; }
  addChoicePrompt('discard', '', 1, from, r.src);
  const p = S.prm[S.prm.length - 1];
  if (p && p.type === 'discard' && p.from === from && !p.f19ref){ p.f19ref = r.ref; p.f19from = from; p.f19src = r.src; commit(); return; }
  // discarded at once (one card in hand)
  reply(before.filter(c => !S.hand.includes(c)));
}
{
  const fc = finishChoice;
  finishChoice = function(p, ids){ const got = p && p.f19ref ? ids.map(id => find(id)[2]).filter(Boolean) : null; const r = fc(p, ids);
    try { if (got){ const ty = [...new Set(got.flatMap(c => typesOf(c.k)))]; sendRq(p.f19from, 'r21ack', got.length, p.f19src, {ref:p.f19ref, d:ty.join(',').slice(0, 80)}); commit(); } } catch (e){ console.warn('f19 disc', e); }
    return r; };
}

/* ======================================================================
   Sentences
   ====================================================================== */
async function doFix19CPre(s, l, ctx){
  let m; const name = ctx.name; const it = ctx.it || {}; const full = String(ctx.full || '').toLowerCase();
  const say = async t => doSentence(cap(t), ctx);
  // ---- 1. the Ring, level 3
  if (/^that creature's controller sacrifices it at end of combat$/.test(l) && /becomes blocked by a creature/i.test(full + ' ' + (info(ctx.k)?.o || ''))){ if (!UI.dry) await f19RingSac(ctx); return true; }
  if (/^each creature that blocked (?:your ring-bearer|it) is sacrificed by its controller$/.test(l)){ if (!UI.dry) f19RingSacNow(ctx.name); return true; }
  // ---- 4. earthbend: the land comes back tapped
  if (/^return this land to the battlefield tapped$/.test(l) && (it.f19eb != null || (ctx.srcId != null && (S.f19ebP || []).includes(ctx.srcId)))){ const id = it.f19eb != null ? it.f19eb : ctx.srcId; S.f19ebP = (S.f19ebP || []).filter(x => x !== id); const [z, , c] = find(id);
    if (c && (z === 'gy' || z === 'ex')){ moveCard(id, 'bf', {quiet:true}); const b = S.bf.find(x => x.id === id); if (b){ b.tap = true; b.anim = null; delete b.ebd; log(`${cname(b)} returned to the battlefield tapped (earthbend)`); } }
    else log(`${name}: the land is no longer in the graveyard or exile`); commit(); return true; }
  // ---- 5. votes with any number of options
  if ((m = l.match(/^(?:starting with you, )?each player votes for ((?:[a-z]+, )+(?:or )?[a-z]+|[a-z]+ or [a-z]+)$/)) && !/^(a|an|one) /.test(m[1])){
    const opts = m[1].split(/,\s*(?:or\s+)?|\s+or\s+/).map(x => x.trim()).filter(Boolean); if (opts.length < 2) return false;
    await f19Vote(opts, ctx); return true; }
  if ((m = l.match(/^(?:starting with you, )?each player votes for (a player|an opponent|a player other than you)$/))){
    const ps = (m[1] === 'a player' ? players() : opponents()).map(p => p.pid); const lab = {}; ps.forEach(p => { lab[p] = nameOf(p); });
    await f19Vote(ps, ctx, lab); ctx.f19voteP = true; return true; }
  if ((m = l.match(/^if (\w+) gets more votes(?: or the vote is tied)?, (.+)$/)) && ctx.votes && Object.keys(ctx.votes).length > 2){
    const v = ctx.votes; const mine = v[m[1]] || 0; const others = Object.entries(v).filter(([k]) => k !== m[1]).map(([, n]) => n); const best = Math.max(0, ...others);
    const tieOk = /or the vote is tied/.test(l); if (mine > best || (tieOk && mine === best) || UI.dry) await say(s.slice(s.length - m[2].length)); return true; }
  if ((m = l.match(/^if (\w+) gets the most votes or is tied for most votes, (.+)$/)) && ctx.votes){ const v = ctx.votes; const mine = v[m[1]] || 0; if (mine >= Math.max(0, ...Object.values(v)) || UI.dry) await say(s.slice(s.length - m[2].length)); return true; }
  // ---- 6. Glimpse the Impossible: a delayed trigger "if any of those cards remain exiled, put them into your graveyard, then create … for each card put into your graveyard this way"
  if (/^at the beginning of the next end step, if any of those cards remain exiled, put them into your graveyard$/.test(l)){
    ctx.f19glPend = {ids:(ctx.r21ids || ctx.lastEx || []).slice()}; return true; }
  if ((m = s.match(/^(?:then )?create (?:a|an|one) (.+?) tokens? for each card put into your graveyard this way$/i)) && ctx.f19glPend){
    const hv = String(ctx.full || '').match(/Those tokens have "([^"]+)"/i); const tok = `${m[1]} token`; const ids = ctx.f19glPend.ids; ctx.f19glPend = null;
    S.f19gl = (S.f19gl || []).concat({ids, tok, ab:hv ? hv[1] : ''}); r21bDelay('end', false, 'Put those cards that remain exiled into your graveyard and create a token for each of them.', {...ctx, lastT:[], lastTok:[], lastPut:[], r19toks:[], lastCardId:null, srcId:null});
    ctx.f19glDone = true; return true; }
  if (/^those tokens have ".+"$/.test(l) && ctx.f19glDone) return true;   // part of the delayed trigger's tokens
  if (/^put those cards that remain exiled into your graveyard and create a token for each of them$/.test(l)){
    const e = (S.f19gl || []).shift(); if (!e || UI.dry) return true; let n = 0;
    for (const id of e.ids){ const c = S.ex.find(x => x.id === id); if (!c) continue; moveCard(id, 'gy', {quiet:true}); if (find(id)[0] === 'gy') n++; }
    log(`${name}: put ${n} card${n === 1 ? '' : 's'} that remained exiled into the graveyard`);
    if (n) await createFromText(`Create ${n} ${e.tok.replace(/ token$/, '')} token${n === 1 ? '' : 's'}${e.ab ? ` with "${e.ab}"` : ''}`, ctx); commit(); return true; }
  // ---- 6. Dihada (and any): "for each card put into your graveyard this way"
  if ((m = s.match(/^(?:then )?(create (?:a|an|one) (.+?) tokens?)( with ".+")? for each card put into your graveyard this way$/i))){
    const n = UI.dry ? 0 : (ctx.f19gyPrev || []).length; if (!n){ if (!UI.dry) log(`${name}: no card was put into the graveyard this way`); return true; }
    await createFromText(`Create ${n} ${m[2]} token${n === 1 ? '' : 's'}${m[3] || ''}`, ctx); return true; }
  // ---- 6. Hordewing Skaab
  if (/^you may draw cards equal to the number of opponents dealt damage this way$/.test(l)){
    const n = it.f19opps != null ? it.f19opps : (UI.dry ? 1 : 0); ctx.f19skaab = 0; if (!n || UI.dry){ ctx.f19skaab = n; return true; }
    if (!(await askYes(`${name}: draw ${n} card${n === 1 ? '' : 's'} (${n} opponent${n === 1 ? '' : 's'} dealt damage), then discard ${n}?`, `Draw ${n}`, "Don't"))) return true;
    draw(n); ctx.f19skaab = n; log(`${name}: drew ${n}`); commit(); return true; }
  if (/^if you do, discard that many cards$/.test(l) && ctx.f19skaab != null){ const n = ctx.f19skaab; if (n && !UI.dry) await discardTracked(n, ctx); return true; }
  // ---- 6. Knollspine Dragon
  if (/^(?:you may )?discard your hand and draw cards equal to the damage dealt to target opponent this turn$/.test(l)){
    const t = (ctx.tgts ? nextTargets(ctx) : []).find(x => x.t === 'player'); const pid = t ? t.pid : null; if (UI.dry || !pid) return true;
    const n = f19DmgThisTurn(pid);
    if (/^you may/.test(l) && !(await askYes(`${name}: discard your hand (${S.hand.length}) and draw ${n} (damage dealt to ${nameOf(pid)} this turn)?`, 'Discard and draw', "Don't"))) return true;
    const h = S.hand.slice(); h.forEach(c => moveCard(c.id, 'gy', {quiet:true})); h.forEach(c => emit({type:'discard', k:c.k, id:c.id, cnt:1})); if (h.length) log(`${name}: discarded ${h.length} card${h.length === 1 ? '' : 's'}`);
    if (n) draw(n); log(`${name}: drew ${n} (damage dealt to ${nameOf(pid)} this turn)`); commit(); return true; }
  // ---- 10. The Rise of Sozin II
  if (/^choose a card name$/.test(l) && /for up to (four|\w+) cards with that name and exile them/.test(full)){
    ctx.e27name = UI.dry ? 'x' : await f19ChooseName(`${name}: choose a card name`, '', null); if (ctx.e27name && !UI.dry) log(`${name}: named ${ctx.e27name}`); return true; }
  if ((m = l.match(/^search target opponent's graveyard, hand, and library for up to (four|\w+) cards with that name and exile them$/))){
    const n = f19wn(m[1]) || 4; const t = (ctx.tgts ? nextTargets(ctx) : []).find(x => x.t === 'player'); let pid = t && t.pid; if (!pid && !UI.dry) pid = await choosePlayer(`${name}: target opponent`, true); ctx.e27sozin = 1;
    if (!pid || pid === MYPID || !ctx.e27name || UI.dry) return true;
    await f19SozinSearch(pid, ctx.e27name, n, name); commit(); return true; }
  // ---- 11. Marchesa, Resolute Monarch: "since your last turn" counts from the start of your previous turn
  if ((m = l.match(/^if you haven't been dealt combat damage since your last turn, (.+)$/))){
    const hit = !!(S.e27hitK && S.e27hitK >= (S.e27prevMy || 0));
    if (!hit || UI.dry) await say(s.slice(s.length - m[1].length)); else log(`${name}: you were dealt combat damage since your last turn`); return true; }
  // ---- 12. Hydroelectric Specimen
  if (/^(?:you may )?change the target of target instant or sorcery spell with a single target to (?:~|this creature)$/.test(name ? l.split(name.toLowerCase()).join('~') : l)){
    if (UI.dry) return true;
    const cands = stackAll().filter(x => x.kind === 'spell' && x.sid !== (ctx.it && ctx.it.sid) && m24IsIS(x) && f19SingleTarget(x));
    let x = ctx.it && ctx.it.tgt ? cands.find(i => i.sid === ctx.it.tgt) : null;
    if (ctx.it && ctx.it.tgt && !x){ const t0 = stackAll().find(i => i.sid === ctx.it.tgt); log(`${name}: ${t0 ? t0.nm + " doesn't have a single target" : 'the spell is gone'} — nothing changes`); return true; }
    if (!x && cands.length){ const v = await askChoice({title:`${name}: change the target of which spell to ${name}?`, options:[...cands.map(i => ({label:m24Label(i), value:i.sid})), {label:"Don't", value:''}]}); x = v ? cands.find(i => i.sid === v) : null; }
    else if (x && /^you may/.test(l) && !(await askYes(`${name}: change the target of ${x.nm} to ${name}?`, 'Change it', "Don't"))) x = null;
    if (!x){ log(`${name}: no instant or sorcery spell with a single target changed`); return true; }
    await r21Retarget({...ctx, it:{...(ctx.it || {}), tgt:x.sid}}, {spec:'instant or sorcery spell', single:true, toSelf:true}); return true; }
  // ---- 14. Kefka: each player discards a card; draw for each card type among them
  if (/^each player discards a card$/.test(l) && /card type among cards discarded this way/.test(full)){
    await discardTracked(1, ctx); const mine = new Set((ctx.discCards || []).flatMap(c => typesOf(c.k))); ctx.f19discTypes = mine;
    if (UI.dry) return true;
    const asks = opponents().map(p => { const ref = rid(6); UI.r21ack ||= {}; sendRq(p.pid, 'f19disc', 1, name, {ref}); return {p, ref, done:false}; }); commit();
    ctx.f19discAsks = asks;
    // a player whose discard is forced answers at once; the others discard on their own screen without holding up the stack
    await waitUntil(() => asks.every(a => UI.r21ack[a.ref]) ? 1 : 0, 1500);
    asks.forEach(a => f19DiscTake(a, mine, name));
    return true; }
  if (/^(?:then )?you draw a card for each card type among cards discarded this way$/.test(l) && ctx.f19discTypes){
    const mine = ctx.f19discTypes; const ty = [...mine]; const n = ty.length; if (n && !UI.dry) draw(n);
    const pend = (ctx.f19discAsks || []).filter(a => !a.done);
    log(`${name}: ${n} card type${n === 1 ? '' : 's'} among the discarded cards${n ? ' (' + ty.join(', ') + ')' : ''} — drew ${n}${pend.length ? ` (waiting for ${pend.map(a => a.p.nm).join(', ')})` : ''}`); commit();
    // late discards: draw one more card for each new card type they add
    if (pend.length && !UI.dry) (async () => { for (const a of pend){ await waitUntil(() => UI.r21ack[a.ref], 75000); const before = mine.size; if (!f19DiscTake(a, mine, name)) continue; const extra = mine.size - before; if (extra > 0){ draw(extra); log(`${name}: ${extra} more card type${extra === 1 ? '' : 's'} (${a.p.nm}'s discard) — drew ${extra}`); } commit(); } })();
    return true; }
  return false;
}
function f19DiscTake(a, set, name){ if (a.done) return false; const ans = UI.r21ack[a.ref]; if (!ans) return false; a.done = true;
  const ty = String(ans.d || '').split(',').filter(Boolean); ty.forEach(t => set.add(t)); log(`${name}: ${a.p.nm} discarded ${ans.n ? 'a card' : 'nothing'}${ty.length ? ' (' + ty.join(', ') + ')' : ''}`); return true; }
// 10: ask the opponent how many cards with that name are in each zone, choose which to exile, then they exile and shuffle
async function f19SozinSearch(pid, nm, n, src){
  UI.r21ack ||= {}; const ref = rid(6); sendRq(pid, 'f19szQ', 0, src, {ref, d:String(nm).slice(0, 78)}); commit();
  const a = await waitUntil(() => UI.r21ack[ref], 25000); if (!a){ log(`${src}: ${nameOf(pid)} didn't answer`); return; }
  const [h, lb] = String(a.d || '0,0,0').split(',').map(x => +x || 0); const gyN = (OPP.get(pid)?.gy || []).filter(k => info(k)?.n === nm).length;
  const card = await f19NameCard(nm); const k = card ? card.k : null;
  const pile = []; const lab = {hand:'hand', lib:'library', gy:'graveyard'};
  if (k){ for (let i = 0; i < h; i++) pile.push({id:-3000 - pile.length, k, z:'hand'}); for (let i = 0; i < lb; i++) pile.push({id:-3000 - pile.length, k, z:'lib'}); for (let i = 0; i < gyN; i++) pile.push({id:-3000 - pile.length, k, z:'gy'}); }
  let ids = [];
  if (pile.length){ ids = await pickCards({title:`${src}: exile up to ${n} cards named ${nm} from ${nameOf(pid)}'s graveyard, hand and library`, hint:`Found: ${h} in hand, ${lb} in library, ${gyN} in graveyard. Choose any number up to ${n} (you may find fewer).`, cards:pile.map(c => ({...c})), min:0, max:Math.min(n, pile.length), noneLabel:'Exile none'}) || []; }
  const pick = ids.map(id => pile.find(c => c.id === id)).filter(Boolean); const cnt = ['hand', 'lib', 'gy'].map(z => pick.filter(c => c.z === z).length);
  const ref2 = rid(6); sendRq(pid, 'f19szEx', pick.length, src, {ref:ref2, d:(String(nm).slice(0, 70) + '§' + cnt.join(','))}); commit();
  const b = await waitUntil(() => UI.r21ack[ref2], 25000);
  log(`${src}: exiled ${b ? b.n : 0} card${b && b.n === 1 ? '' : 's'} named ${nm} from ${nameOf(pid)}'s graveyard, hand and library${b && b.d ? ' (' + b.d + ')' : ''}, then they shuffled`);
  void lab;
}
{ const ds = doSentence; doSentence = async function(s0, ctx){ const s = String(s0).replace(/\.$/, '').trim(); const l = s.toLowerCase(); if (l && await doFix19CPre(s, l, ctx)) return; return ds(s0, ctx); }; }
