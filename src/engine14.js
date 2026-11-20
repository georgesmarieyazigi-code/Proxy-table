/* ===================== Rules engine — round 14: general readers for counters, damage lists, granted abilities ===================== */

const KW_CTR = /^(flying|first strike|double strike|deathtouch|lifelink|menace|trample|reach|vigilance|hexproof|indestructible|haste)$/;
function putCounterOn(c, kind, n, pid){
  if (!c) return;
  if (pid && pid !== MYPID){ applyTo({t:'card', pid, id:c.id, k:c.k}, {op:'ctr', n, src:'counter', d:kind === '+1/+1' ? 'cp' : kind === '-1/-1' ? 'cm' : 'co'}); return; }
  if (kind === '+1/+1') modCounters(c, 'cp', n); else if (kind === '-1/-1') modCounters(c, 'cm', n); else if (kind === 'loyalty') c.co = (c.co || 0) + n; else if (kind === 'lore') modCounters(c, 'lore', n);
  else { addNamed(c, kind, n); if (KW_CTR.test(kind)) c.ekwp = [...new Set([...(c.ekwp || []), kind])]; }
}
function parseCounterList(t){ // "two +1/+1 counters and a flying counter" → [[2,'+1/+1'],[1,'flying']]
  const out = []; for (const part of t.split(/,\s*(?:and\s+)?|\s+and\s+/)){ const m = part.trim().match(/^(a|an|one|two|three|four|five|six|x|\d+) (.+?) counters?$/); if (!m) return null; out.push([m[1], m[2]]); } return out;
}
async function doRound14Pre(s, l, ctx){
  let m; const src = () => srcCardOf(ctx); const say = t => doSentence(cap(t), ctx);
  if (/^then /.test(l)){ const r = await doRound14Pre(s.slice(5), l.slice(5), ctx); if (r) return true; }
  // generic: put COUNTERS on WHO
  if ((m = l.match(/^put (.+? counters?) on (~|it|that creature|each of them|target [a-z ,/-]+?|another target [a-z ]+?|up to one (?:other )?target [a-z ]+?|each (?:other )?[a-z ]+?(?: you control| you don't control| your opponents control)?|equipped creature|enchanted creature|a creature you control|that permanent)(?:, where x is (.+))?$/))){
    const list = parseCounterList(m[1]); if (!list) return false;
    const x = m[3] ? (countOf(m[3], ctx) ?? 0) : (ctx.it && ctx.it.x) || 0; const who = m[2];
    let cards = [];
    if (who === '~') cards = [[src(), MYPID]];
    else if (who === 'it' || who === 'that creature' || who === 'that permanent'){ const t = (ctx.lastT || [])[0]; if (t){ const c = t.pid === MYPID ? S.bf.find(z => z.id === t.id) : {id:t.id, k:t.k}; cards = [[c, t.pid]]; } else if (ctx.it && ctx.it.evId != null){ cards = [[S.bf.find(z => z.id === ctx.it.evId), MYPID]]; } else if (ctx.lastTok) cards = ctx.lastTok.map(id => [S.bf.find(z => z.id === id), MYPID]); }
    else if (who === 'each of them') cards = (ctx.lastTok || (ctx.lastT || []).map(t => t.id)).map(id => [S.bf.find(z => z.id === id), MYPID]);
    else if (/^(equipped|enchanted) creature$/.test(who)){ const sc = src(); const h = sc && sc.att && (sc.att.pid === MYPID ? S.bf.find(z => z.id === sc.att.id) : null); if (h) cards = [[h, MYPID]]; }
    else if (/^a creature you control$/.test(who)){ const cr = S.bf.filter(c => isCreatureCard(c)); const ids = cr.length <= 1 ? cr.map(c => c.id) : await pickCards({title:`${ctx.name}: choose a creature you control`, cards:cr, min:1, max:1}); cards = (ids || []).map(id => [S.bf.find(z => z.id === id), MYPID]); }
    else if (/^each /.test(who)){ const mm = who.match(/^each (other )?([a-z ]+?)( you control| you don't control| your opponents control)?$/); const d = sing(mm[2]); const sc = src();
      if (mm[3] !== " you don't control" && mm[3] !== ' your opponents control') S.bf.forEach(c => { if (!c.fd && (!mm[1] || !sc || c.id !== sc.id) && descOk(c.k, d, {tok:c.tok}) && (d !== 'creature' || isCreatureCard(c))) cards.push([c, MYPID]); });
      if (mm[3] !== ' you control') for (const [pid, st] of OPP) (st.bf || []).forEach(c => { if (c.k && descOk(c.k, d, {tok:c.tok})) cards.push([c, pid]); }); }
    else { let t; while (ctx.tgts && (t = nextTargets(ctx)[0])) cards.push([t.pid === MYPID ? S.bf.find(z => z.id === t.id) : {id:t.id, k:t.k}, t.pid]); }
    for (const [c, pid] of cards){ if (!c) continue; for (const [q, kind] of list){ const n = q === 'x' ? x : (wn(q) || 1); if (n) putCounterOn(c, kind, n, pid); } }
    commit(); return true; }
  // generic damage to a list: “~ deals N damage to each creature and each player”, “… to target creature and 2 damage to you”
  if ((m = l.match(/^(~|it) deals (\d+|x) damage to (each creature(?: without flying| with flying| your opponents control| you don't control)?|each other creature|each creature they control|each creature and planeswalker they control|each creature and each planeswalker) and (each player|each opponent|each planeswalker|each other player|you)$/))){
    const n = m[2] === 'x' ? (ctx.it && ctx.it.x) || 0 : +m[2]; const flt = m[3]; const sc = src();
    const okC = c => isCreatureCard(c) && !(/without flying/.test(flt) && kwOf(c, 'flying')) && !(/with flying/.test(flt) && !kwOf(c, 'flying')) && !(/other/.test(flt) && sc && c.id === sc.id);
    if (!/opponents control|don't control|they control/.test(flt)) S.bf.filter(okC).forEach(c => damageCard(c, n, {}));
    for (const [pid, st] of OPP) (st.bf || []).forEach(c => { if (c.k && isCreatureCard(c) && !(/without flying/.test(flt) && (info(c.k)?.o || '').match(/^flying/im))) dealDamage({t:'card', pid, id:c.id, k:c.k}, n, ctx.k, sc); });
    if (/player|opponent/.test(m[4])){ if (m[4] === 'each player') S.life -= n; opponents().forEach(p => dealDamage({t:'player', pid:p.pid}, n, ctx.k, sc)); }
    if (m[4] === 'you') S.life -= n;
    log(`${ctx.name}: ${n} damage to ${flt} and ${m[4]}`); commit(); return true; }
  if ((m = l.match(/^(~|it) deals (\d+) damage to each (opponent|player) and each (creature|planeswalker)(?: they control)?$/))){ await say(`~ deals ${m[2]} damage to each creature and each ${m[3]}`); return true; }
  // granted abilities in quotes: “Until end of turn, target creature gains "When ~ dies, …"”
  if ((m = s.match(/^(?:Until end of turn, )?(target creature(?: you control)?|it|that creature|creatures you control|each creature you control) gains? (?:([a-z ,]+) and )?"([^"]+)"(?: until end of turn)?\.?$/i))){
    const quoted = m[3]; const kws = (m[2] || '').split(/,\s*(?:and\s+)?/).map(x => x.trim()).filter(Boolean); let list = [];
    if (/^target/i.test(m[1])){ const t = (ctx.tgts ? nextTargets(ctx) : [])[0]; if (t && t.pid === MYPID) list = [S.bf.find(z => z.id === t.id)]; else if (t){ handWarn(`${t.nm || 'That creature'} gains "${quoted}"`, ctx); return true; } }
    else if (/^(it|that creature)$/i.test(m[1])){ const t = (ctx.lastT || [])[0]; list = t ? [S.bf.find(z => z.id === t.id)] : (ctx.lastTok || []).map(id => S.bf.find(z => z.id === id)); }
    else list = S.bf.filter(c => isCreatureCard(c));
    list.filter(Boolean).forEach(c => { c.gtx = (c.gtx || []).concat({txt:quoted, t:turnStr(), src:ctx.name, eot:/until end of turn/i.test(s)}); if (kws.length) c.ekw = [...new Set([...(c.ekw || []), ...kws])]; });
    log(`${ctx.name}: ${list.length ? list.map(cname).join(', ') : 'nothing'} gains “${short(quoted, 60)}”`); commit(); return true; }
  // “If you don't put the card into your hand, you may put it into your graveyard.”
  if ((m = l.match(/^if you don't put the card into your hand, you may put it into your graveyard$/))){ const c = ctx.lastRev; if (c && S.lib[0] === c && (UI.dry || await askYes(`${ctx.name}: put ${cname(c)} into your graveyard?`))){ S.lib.shift(); S.gy.push(c); commit(); } return true; }
  if ((m = l.match(/^(?:you may )?reveal the top card of your library$/)) ){ const c = S.lib[0]; ctx.lastRev = c; if (c){ ctx.lastMV = info(c.k)?.mv || 0; log(`revealed ${cname(c)}`); } return true; }
  if ((m = l.match(/^if it's an? (.+?) card, (?:you may )?put it (into your hand|onto the battlefield(?: tapped)?)$/))){ const c = ctx.lastRev; if (!c || S.lib[0] !== c) return true; const ok = descOk(c.k, sing(m[1])); ctx.condResult = ok; if (ok && (!/you may/.test(l) || UI.dry || await askYes(`${ctx.name}: put ${cname(c)} ${m[2]}?`))){ if (/battlefield/.test(m[2])){ moveCard(c.id, 'bf'); const b = S.bf.find(x => x.id === c.id); if (b && /tapped/.test(m[2])) b.tap = true; } else { S.lib.shift(); S.hand.push(c); } } commit(); return true; }
  if ((m = l.match(/^otherwise, put (?:it|that card) (into your graveyard|on the bottom of your library|into your hand)$/))){ const c = ctx.lastRev; if (ctx.condResult === false && c && S.lib[0] === c){ S.lib.shift(); if (/graveyard/.test(m[1])) S.gy.push(c); else if (/bottom/.test(m[1])) S.lib.push(c); else S.hand.push(c); } ctx.condResult = null; commit(); return true; }
  // “Until your next turn, …” protection-type effects → reminders the table tracks
  if ((m = l.match(/^until your next turn, (.+)$/))){ handWarn(`Until your next turn: ${s.slice(s.length - m[1].length)}`, ctx); return true; }
  if ((m = l.match(/^you gain protection from everything$/))){ handWarn('You have protection from everything until your next turn', ctx); return true; }
  // Duress-style: reveal hand, choose, discard
  if ((m = l.match(/^target (?:player|opponent) reveals their hand\. you choose an? (.+?) card from it\. that player discards that card$/))){ return false; }
  // generic “return target X card(s) … to your hand” with filters
  if ((m = l.match(/^return (?:target|up to (one|two|three) target) (.+?) cards? (?:with [^,]+ )?from your graveyard to your hand$/))){ let t; let any = false; while (ctx.tgts && (t = nextTargets(ctx)[0])){ any = true; if (t.pid === MYPID && find(t.id)[0] === 'gy') moveCard(t.id, 'hand'); } if (!any && !UI.dry){ const d = sing(m[2]); const list = S.gy.filter(c => descOk(c.k, d)); const n = wn(m[1] || 'one') || 1; if (list.length){ const ids = await pickCards({title:`${ctx.name}: return ${m[2]} card${n > 1 ? 's' : ''} to your hand`, cards:list, min:0, max:n}); (ids || []).forEach(id => moveCard(id, 'hand')); } } commit(); return true; }
  if ((m = l.match(/^return all (.+?) cards from your graveyard to your hand$/))){ const d = sing(m[1]); S.gy.filter(c => descOk(c.k, d)).forEach(c => moveCard(c.id, 'hand')); commit(); return true; }
  if ((m = l.match(/^return a (.+?) card from your graveyard to your hand$/))){ const d = sing(m[1]); const list = S.gy.filter(c => descOk(c.k, d)); if (!list.length) return true; const ids = list.length === 1 ? [list[0].id] : await pickCards({title:`${ctx.name}: return a ${m[1]} card`, cards:list, min:1, max:1}); if (ids && ids[0]) moveCard(ids[0], 'hand'); commit(); return true; }
  if ((m = l.match(/^return up to (one|two|three) target (.+?) cards?(?: with [^,]+?)? from your graveyard to the battlefield$/))){ let t; while (ctx.tgts && (t = nextTargets(ctx)[0])) if (t.pid === MYPID && find(t.id)[0] === 'gy') moveCard(t.id, 'bf'); commit(); return true; }
  if ((m = l.match(/^put target card from your graveyard on the bottom of your library$/))){ const t = (ctx.tgts ? nextTargets(ctx) : [])[0]; if (t && find(t.id)[0] === 'gy'){ const c = find(t.id)[2]; S.gy.splice(S.gy.indexOf(c), 1); S.lib.push(c); commit(); } return true; }
  // creatures get base P/T
  if ((m = l.match(/^creatures you control have base power and toughness (x|\d+)\/(x|\d+) until end of turn$/))){ const n = m[1] === 'x' ? (ctx.it && ctx.it.x) || 0 : +m[1]; S.bf.filter(c => isCreatureCard(c)).forEach(c => { const st = stats(c); const bp = st[0] - (c.pu ? c.pu[0] : 0) - (c.cp || 0) + (c.cm || 0); const bt = st[1] - (c.pu ? c.pu[1] : 0) - (c.cp || 0) + (c.cm || 0); c.pu = [(c.pu ? c.pu[0] : 0) + n - bp, (c.pu ? c.pu[1] : 0) + n - bt]; }); commit(); return true; }
  // “That creature gains haste”, “It gains haste”
  if ((m = l.match(/^(that creature|it|they) gains? (haste|flying|trample|vigilance|lifelink|indestructible|hexproof|menace|first strike|double strike)(?: until end of turn)?$/))){ const ids = (ctx.lastT || []).map(t => t.id).concat(ctx.lastTok || []); ids.forEach(id => { const c = S.bf.find(x => x.id === id); if (c) c.ekw = [...new Set([...(c.ekw || []), m[2]])]; }); commit(); return true; }
  // “Exile up to one target card from a graveyard”, “Exile any number of target players' graveyards”
  if ((m = l.match(/^exile up to (one|two|three) target cards? from (?:a single graveyard|graveyards|a graveyard)$/))){ let t; while (ctx.tgts && (t = nextTargets(ctx)[0])){ if (t.pid === MYPID) moveCard(t.id, 'ex'); else sendRq(t.pid, 'gytake', 0, ctx.name, {d:t.k, ex:1}); } commit(); return true; }
  if ((m = l.match(/^exile any number of target players' graveyards$/))){ let t; while (ctx.tgts && (t = nextTargets(ctx)[0])){ if (t.pid === MYPID) S.gy.slice().forEach(c => moveCard(c.id, 'ex')); else sendRq(t.pid, 'exGy', 0, ctx.name); } commit(); return true; }
  return false;
}
{
  const ds = doSentence;
  doSentence = async function(s0, ctx){
    const s = String(s0).replace(/\.$/, '').trim(); const l = s.toLowerCase();
    if (l && await doRound14Pre(s, l, ctx)) return;
    return ds(s0, ctx);
  };
}
// don't split “each creature and each player” / “… and each opponent” before the damage reader sees it
{
  const re = runEffects;
  runEffects = async function(txt, ctx){ return re(String(txt || '').replace(/ deals (\d+|X) damage to (each creature[^.]*?) and (each (?:player|opponent|planeswalker|other player))/gi, (w, n, a, b) => ` deals ${n} damage to ${a} and ${b}`), ctx); };
}
// granted triggered abilities on a permanent (from quoted text) work like its own
{
  const he = handleEvent;
  handleEvent = function(pid, ev){
    he(pid, ev);
    if (!S) return;
    for (const c of S.bf.concat(pid === MYPID && (ev.type === 'die' || ev.type === 'leave') ? S.gy.filter(g => g.id === ev.id) : [])){
      for (const g of (c.gtx || [])){
        const t = tname(g.txt, cname(c)); const m = t.match(/^(when|whenever|at) (.+?), ([\s\S]+)$/i); if (!m) continue;
        const cl = classifyTrig(m[1].toLowerCase(), m[2].toLowerCase()); if (!cl || (cl.ev !== ev.type && !(cl.evs || []).includes(ev.type))) continue;
        if (cl.subj === 'self' && !(pid === MYPID && ev.id === c.id)) continue;
        if (cl.subj !== 'self' && !subjMatch(cl, c, ev, pid)) continue;
        pushTrig(cname(c), m[3], {k:c.k, srcId:c.id, evId:ev.id, evk:ev.k});
      }
    }
  };
  const tc = turnChanged;
  turnChanged = function(...a){ if (S) S.bf.concat(S.gy).forEach(c => { if (c.gtx) c.gtx = c.gtx.filter(g => !g.eot || g.t === turnStr()); }); return tc.apply(this, a); };
  // a creature that died keeps the granted text long enough for its own dies trigger
  const mc = moveCard;
  moveCard = function(id, to, o = {}){ const [from, , c] = find(id); const keep = c && c.gtx; const r = mc(id, to, o); if (keep && c && to === 'gy' && from === 'bf') c.gtx = keep; return r; };
}
