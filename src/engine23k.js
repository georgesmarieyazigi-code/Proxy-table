/* ===================== Rules engine — round 23 helper K (ranks 6160–6999) ===================== */
const R23K = {};
function r23kKws(t){ return String(t || '').split(/,\s*(?:and\s+)?|\s+and\s+/).map(x => x.trim()).filter(Boolean); }
function r23kSrc(ctx){ return srcCardOf(ctx); }
function r23kCards(pidFilter, pred){ const out = []; for (const b of boardsAll()){ if (pidFilter && !pidFilter(b.pid)) continue; for (const c of b.bf){ if (!c.k || c.fd) continue; if (pred(c, b.pid)) out.push({t:'card', pid:b.pid, id:c.id, k:c.k, c}); } } return out; }
function r23kMv(k){ return +(info(k)?.mv) || 0; }
function r23kGyExile(t, ctx){ if (!t) return; if (t.pid === MYPID || !t.pid){ if (find(t.id)[0] === 'gy') moveCard(t.id, 'ex'); } else sendRq(t.pid, 'gytake', 0, ctx.name, {d:t.k, ex:1}); }
function r23kTokFor(pid, text, ctx){ if (pid === MYPID) return createFromText('Create ' + text, ctx); if (/ token named .+ with ["“]/i.test(text) && ctx.k){ sendRq(pid, 'r23kNamedTok', 0, ctx.name, {d:ctx.k}); log(`${nameOf(pid)} creates ${text.slice(0, 60)}… (${ctx.name})`); return; } sendRq(pid, 'tokText', 0, ctx.name, {d:text}); log(`${nameOf(pid)} creates ${text} (${ctx.name})`); }
function r23kDmgEach(pred, n, ctx){
  const c0 = r23kSrc(ctx); const f = srcFlags(ctx.k, MYPID, c0);
  r23kCards(null, (c, pid) => isCreatureCard(c) && pred(c, pid)).forEach(t => { if (t.pid === MYPID) dealDamage(t, n, ctx.k, c0); else applyTo(t, {op:'dmg', n, src:ctx.name, f}); });
}
// a lost-life-this-turn ledger for every player (Teysa, Reaper's Scythe, Gev)
{
  const cm = commit;
  commit = function(...a){
    try { if (S){ const t = turnStr(); if (!R23K.life || R23K.life.t !== t){ R23K.life = {t, last:{}, lost:new Set()}; }
      const L = R23K.life; const cur = {[MYPID]:S.life}; for (const [pid, s] of OPP) cur[pid] = s.life;
      for (const pid in cur){ if (L.last[pid] != null && cur[pid] < L.last[pid]) L.lost.add(pid); L.last[pid] = cur[pid]; } } } catch {}
    return cm.apply(this, a);
  };
}
function r23kLostLife(pid){ try { commit(); } catch {} return !!(R23K.life && R23K.life.t === turnStr() && R23K.life.lost.has(pid)); }

async function doRound23KPre(s, l, ctx){
  let m; const name = ctx.name || '';
  const full = String(ctx.full || '').toLowerCase();
  const tgt = () => (ctx.tgts ? nextTargets(ctx) : [])[0];
  const src = () => r23kSrc(ctx);
  const say = t => doSentence(cap(t), ctx);
  const tail = n => s.slice(s.length - n.length);
  const pumpT = (t, p, tt, kw) => { if (t) applyTo(t, {op:'pump', src:name, f:{p, t:tt, kw}}); };

  if (ctx.r23kRowSkip && ctx.r23kRowSkip.includes(l)){ ctx.r23kRowSkip.splice(ctx.r23kRowSkip.indexOf(l), 1); return true; }
  // quoted abilities split across sentences (emblems, tokens with abilities)
  if (ctx.r23kQ && l !== ctx.r23kQw && ctx.r23kQ.includes(l.replace(/["”]+$/, '').trim())) return true;
  if ((s.match(/[“"]/g) || []).length % 2 === 1 && !(s.match(/[”]/g) || []).length){
    const o = tname(String(info(ctx.k)?.o || ctx.full || ''), name).replace(/~/g, name); const lo = o.toLowerCase(); const at = lo.indexOf(l.slice(0, 40));
    const q1 = at >= 0 ? lo.slice(at).search(/[“"]/) : -1; const q2 = q1 >= 0 ? lo.slice(at + q1 + 1).search(/[”"]/) : -1;
    if (q2 >= 0){ let end = at + q1 + 1 + q2 + 1; const whole = o.slice(at, end).replace(/\.$/, ''); ctx.r23kQ = lo.slice(at, end + 1); ctx.r23kQw = whole.toLowerCase(); await say(whole); return true; } }
  // ---- strip an ability-word / flavour-word label ("Stampede! — …")
  if ((m = s.match(/^([A-Z][A-Za-z' !,]{2,40}) — (.+)$/)) && !/^(choose|[IVX]+\b)/i.test(m[1])){ await say(m[2]); return true; }
  // ---- Sarkhan's Unsealing: the trigger condition list leaks into the effect
  if ((m = l.match(/^\d+, or \d+, (.+)$/))){ await say(tail(m[1])); return true; }
  if ((m = l.match(/^(?:~|it) deals (\d+) damage to each opponent and each creature and planeswalker they control$/))){
    const n = +m[1]; const c0 = src(); const f = srcFlags(ctx.k, MYPID, c0);
    for (const p of opponents()){ sendRq(p.pid, 'pdmg', n, name, {f}); sendRq(p.pid, 'dmgAll', n, name, {d:'creature', f}); sendRq(p.pid, 'dmgAll', n, name, {d:'planeswalker', f}); }
    log(`${name} deals ${n} damage to each opponent and each creature and planeswalker they control`); commit(); return true; }

  // ---- targeted pumps / keyword grants on any described target
  if ((m = l.match(/^(?:until end of turn, )?(another )?target ([a-z0-9 ,'+\/-]+?) (?:gets ([+-]\d+)\/([+-]\d+)(?: and gains ([a-z ,]+?))?|gains ([a-z ,]+?)(?: and gets ([+-]\d+)\/([+-]\d+))?)(?: until end of turn)?$/)) && /until end of turn/.test(l)
      && !(!m[1] && /^(creature|creature you control)$/.test(m[2])) && !/\b(for each|where|card)\b/.test(m[2])){
    const p = +(m[3] || m[7] || 0), tt = +(m[4] || m[8] || 0); const kw = r23kKws(m[5] || m[6]);
    if (kw.some(k => !/^(flying|first strike|double strike|deathtouch|lifelink|vigilance|trample|haste|hexproof|indestructible|menace|reach|shroud|myriad|protection|infect|wither|ward \{\d\}|firebending \d)$/.test(k))) return false;
    pumpT(tgt(), p, tt, kw); commit(); return true; }
  // equipped / enchanted creature gets +N/+N until end of turn
  if ((m = l.match(/^(equipped|enchanted) creature gets ([+-]\d+)\/([+-]\d+)(?: and gains ([a-z ,]+?))? until end of turn$/))){
    const c0 = src(); const host = c0 && c0.att ? {t:'card', pid:c0.att.pid, id:c0.att.id} : null;
    if (host) applyTo(host, {op:'pump', src:name, f:{p:+m[2], t:+m[3], kw:r23kKws(m[4])}}); else log(`${name}: not attached to a creature`);
    commit(); return true; }
  // group pumps: "(all) other (attacking) creatures (you control|target player controls) get … until end of turn"
  if ((m = l.match(/^(?:until end of turn, )?(?:all )?(other )?(attacking )?(creatures|[a-z]+s) (you control |target player controls |your opponents control )?(?:get ([+-]\d+)\/([+-]\d+)(?: and gain ([a-z ,]+?))?|gain ([a-z ,]+?)(?: and get ([+-]\d+)\/([+-]\d+))?)(?: until end of turn)?$/)) && /until end of turn/.test(l)){
    const other = !!m[1], atk = !!m[2]; const d = m[3] === 'creatures' ? 'creature' : sing(m[3]); const who = (m[4] || '').trim();
    const p = +(m[5] || m[9] || 0), tt = +(m[6] || m[10] || 0); const kw = r23kKws(m[7] || m[8]);
    if (!who && !atk && d === 'creature') return false;
    const c0 = src();
    let pidOk = pid => pid === MYPID;
    if (who === 'target player controls'){ const t = tgt(); const pid = t ? t.pid : MYPID; pidOk = x => x === pid; }
    else if (who === 'your opponents control') pidOk = pid => pid !== MYPID;
    else if (!who && atk) pidOk = () => true;
    const list = r23kCards(pidOk, (c, pid) => isCreatureCard(c) && (d === 'creature' || descOk(c.k, d, {tok:c.tok})) && !(other && pid === MYPID && c0 && c.id === c0.id) && (!atk || c.atk));
    list.forEach(t => applyTo(t, {op:'pump', src:name, f:{p, t:tt, kw}}));
    log(`${name}: ${list.length} creature${list.length === 1 ? '' : 's'} get${p || tt ? ` ${p >= 0 ? '+' : ''}${p}/${tt >= 0 ? '+' : ''}${tt}` : ''}${kw.length ? ' and gain ' + kw.join(', ') : ''}`); commit(); return true; }

  // ---- damage wordings
  if ((m = l.match(/^have (?:it|~) deal (\d+|x) damage to (.+)$/))){ await say(`~ deals ${m[1]} damage to ${tail(m[2])}`.replace('~', name)); return true; }
  if ((m = l.match(/^(?:~|it) deals (\d+) damage to another target creature$/))){ const t = tgt(); if (t) dealDamage(t, +m[1], ctx.k, src()); ctx.lastT = t ? [t] : ctx.lastT; commit(); return true; }
  if ((m = l.match(/^(?:~|it) deals (\d+) damage to each (untapped|tapped) creature$/))){ const tp = m[2] === 'tapped'; r23kDmgEach(c => !!c.tap === tp, +m[1], ctx); commit(); return true; }
  if ((m = l.match(/^(?:~|it) deals (\d+) damage to that permanent's controller$/))){ const t = (ctx.lastT || [])[0]; if (t && t.pid) dealDamage({t:'player', pid:t.pid}, +m[1], ctx.k, src()); commit(); return true; }

  // ---- life
  if ((m = l.match(/^you gain life equal to (?:its|that card's) mana value$/))){ const t = (ctx.lastT || [])[0]; const n = t && t.k ? r23kMv(t.k) : (ctx.lastMV || 0); if (n && gainLife(n, name)) log(`gained ${n} life → ${S.life}`); commit(); return true; }
  if ((m = l.match(/^you gain life equal to the greatest toughness among creatures you control$/))){ const n = Math.max(0, ...S.bf.filter(c => isCreatureCard(c) && !c.fd).map(c => (stats(c) || [0, 0])[1])); if (n && gainLife(n, name)) log(`gained ${n} life → ${S.life}`); commit(); return true; }
  if ((m = l.match(/^if you don't control a human, you lose life equal to that creature's toughness$/))){
    if (S.bf.some(c => isCreatureCard(c) && descOk(c.k, 'human', {tok:c.tok}))){ log(`${name}: you control a Human — no life loss`); return true; }
    const t = (ctx.lastT || [])[0]; const n = t ? ((t.k && statsAny(t)) || [0, +(info(t.k)?.tn ?? String(info(t.k)?.p || '0/0').split('/')[1]) || 0])[1] : 0;
    if (n > 0){ S.life -= n; log(`${name}: lost ${n} life → ${S.life}`); } commit(); return true; }
  if ((m = l.match(/^target player loses 1 life for each card in their graveyard$/))){ const t = tgt(); if (!t) return true; const n = t.pid === MYPID ? S.gy.length : (OPP.get(t.pid)?.gy || []).length; if (n) await loseLife(t.pid, n, name); commit(); return true; }

  // ---- proliferate / conditions on the last target
  if ((m = l.match(/^if that permanent's mana value was (\d+) or less, (.+)$/))){ const t = (ctx.lastT || [])[0]; if (t && t.k && r23kMv(t.k) <= +m[1]) await say(tail(m[2])); else log(`${name}: mana value too high — no ${m[2]}`); return true; }

  // ---- untaps
  if ((m = l.match(/^untap another target creature$/))){ const t = tgt(); if (t) applyTo(t, {op:'untap', src:name}); commit(); return true; }
  if ((m = l.match(/^untap all ([a-z]+?)s? you control$/)) && m[1] !== 'creature' && m[1] !== 'land' && m[1] !== 'permanent'){ const d = m[1]; S.bf.filter(c => !c.fd && descOk(c.k, d, {tok:c.tok})).forEach(c => { c.tap = false; }); log(`${name}: untapped all ${d}s`); commit(); return true; }

  // ---- other players create tokens
  if ((m = l.match(/^each player creates (.+)$/)) && !/the tokens are goaded/.test(full)){ const txt = tail(m[1]); for (const p of players()) await r23kTokFor(p.pid, txt, ctx); ctx.r23kEachTok = true; commit(); return true; }
  if ((m = l.match(/^target opponent creates (.+)$/))){ const t = tgt(); const pid = t && t.pid !== MYPID ? t.pid : (opponents()[0] || {}).pid; if (pid) await r23kTokFor(pid, tail(m[1]), ctx); commit(); return true; }

  // ---- investigate / amass counts
  if ((m = l.match(/^investigate (two|three|\d+) times$/))){ const n = wn(m[1]) || +m[1]; await createFromText(`Create ${n} Clue tokens`, ctx); return true; }
  if ((m = l.match(/^investigate for each opponent who lost life this turn$/))){ const n = opponents().filter(p => r23kLostLife(p.pid)).length; if (n) await createFromText(`Create ${n} Clue token${n > 1 ? 's' : ''}`, ctx); else log(`${name}: no opponent lost life this turn`); return true; }
  if ((m = l.match(/^put a soul counter on ~ for each player who lost life this turn$/))){ const n = players().filter(p => r23kLostLife(p.pid)).length; const c = src(); if (c && n){ addNamed(c, 'soul', n); log(`${name}: ${n} soul counter${n > 1 ? 's' : ''}`); } commit(); return true; }

  // ---- draws counted from this turn's spells
  if ((m = l.match(/^draw a card for each other instant and sorcery spell you've cast this turn$/))){ const t = turnStr(); const n = Math.max(0, (S.castHist || []).filter(h => h.t === t && /\b(Instant|Sorcery)\b/.test(info(DICT && [...DICT.values()].find(x => x.n === h.n)?.k)?.t || '')).length - 1); if (n) draw(n); log(`${name}: drew ${n} more`); commit(); return true; }

  // ---- fights
  if ((m = l.match(/^that creature fights (?:target|up to one target) creature you don't control$/))){ const a = (ctx.lastT || [])[0]; const b = tgt(); if (!a || !b){ log(`${name}: fight didn't happen`); return true; } const sa = statsAny(a), sb = statsAny(b); if (!sa || !sb) return true; const ca = boardOf(a.pid).find(x => x.id === a.id); dealDamage(b, sa[0], a.k, ca); if (a.pid === MYPID) applyOp({op:'dmg', tid:a.id, n:sb[0], f:srcFlags(b.k, b.pid)}, MYPID); log(`${cname(ca)} fights ${b.nm}`); commit(); return true; }

  // ---- graveyard exiles
  if ((m = l.match(/^exile up to (one|two|three|\d+) target cards? from (?:their|target player's|that player's) graveyard$/))){ let g = ctx.tgts ? nextTargets(ctx) : []; g.forEach(t => r23kGyExile(t, ctx)); ctx.r23kExGy = g; commit(); return true; }

  // ---- batch 2 ----
  if (/^then /.test(l) && !/^then (?:you may|that player|those|it|draw)/.test(l)){ if (await doRound23KPre(s.slice(5), l.slice(5), ctx)) return true; }
  if ((m = l.match(/^then that creature fights (.+)$/))){ return doRound23KPre(s.slice(5), l.slice(5), ctx); }
  // short names ("Gev deals …" on Gev, Scaled Scorch)
  { const short0 = name.split(',')[0].trim(); if (short0 && short0 !== name && short0.length > 2 && l.startsWith(short0.toLowerCase() + ' ') && !l.startsWith(name.toLowerCase())){ await say('~' + s.slice(short0.length)); return true; } }
  if (name && l.startsWith(name.toLowerCase() + ' deals ')){ await say('~' + s.slice(name.length)); return true; }
  // Duress-style in the sandbox (no opponents there): pretend a hand so the next lines are checked
  if ((m = l.match(/^target opponent reveals their hand$/)) && UI.dry && !opponents().length){ ctx.revealed = {pid:'dry-opp', ks:S.lib.slice(0, 4).map(c => c.k)}; return true; }
  // pumps with the "until end of turn," prefix on any target creature
  if ((m = l.match(/^until end of turn, target creature gets ([+-]\d+)\/([+-]\d+) and gains ([a-z ,]+)$/))){ pumpT(tgt(), +m[1], +m[2], r23kKws(m[3])); commit(); return true; }
  // delirium-style condition
  if ((m = l.match(/^if there are four or more card types among cards in your graveyard, (.+)$/))){ const T = new Set(); S.gy.forEach(c => (String(info(c.k)?.t || '').split('—')[0].match(/\b(Artifact|Battle|Creature|Enchantment|Instant|Kindred|Land|Planeswalker|Sorcery)\b/g) || []).forEach(x => T.add(x))); if (T.size >= 4) await say(tail(m[1])); else log(`${name}: only ${T.size} card types in graveyard`); return true; }
  // unblockable this turn + keyword
  if ((m = l.match(/^creatures you control gain (hexproof|indestructible|flying|trample) until end of turn and can't be blocked this turn$/))){ S.bf.filter(c => isCreatureCard(c) && !c.fd).forEach(c => { c.ekw = [...new Set([...(c.ekw || []), m[1], 'unblockable'])]; c.r23kUnbl = turnStr(); }); log(`${name}: creatures gain ${m[1]} and can't be blocked this turn`); commit(); return true; }
  // Froghemoth: counters / life per card exiled this way
  if ((m = l.match(/^put a \+1\/\+1 counter on ~ for each (creature|noncreature) card exiled this way$/)) || (m = l.match(/^you gain 1 life for each (creature|noncreature) card exiled this way$/))){
    const ex = (ctx.r23kExGy || []).filter(t => t && t.k); const n = ex.filter(t => (m[1] === 'creature') === /Creature/.test(info(t.k)?.t || '')).length;
    if (/^put/.test(l)){ const c = src(); if (c && n) modCounters(c, 'cp', n); } else if (n && gainLife(n, name)) log(`gained ${n} life → ${S.life}`);
    commit(); return true; }
  // Oreskos Explorer
  if ((m = l.match(/^search your library for up to x (plains|island|swamp|mountain|forest) cards, where x is the number of players who control more lands than you$/))){
    const mine = S.bf.filter(c => isLand(c.k) && !c.fd).length; const n = opponents().filter(p => (OPP.get(p.pid)?.bf || []).filter(c => c.k && isLand(c.k)).length > mine).length;
    ctx.r23kSearched = true; if (!n){ log(`${name}: no player controls more lands — X is 0`); return true; }
    await searchLibrary(`up to ${n} ${m[1]} cards`, 'reveal those cards, put them into your hand', ctx); return true; }
  if (/^reveal those cards, put them into your hand$/.test(l) && ctx.r23kSearched) return true;
  // Day of Black Sun
  if ((m = l.match(/^each creature with mana value (x|\d+) or less loses all abilities until end of turn$/))){ const x = m[1] === 'x' ? ((ctx.it && ctx.it.x) || 0) : +m[1]; ctx.r23kThose = r23kCards(null, c => isCreatureCard(c) && r23kMv(c.k) <= x); ctx.r23kThose.forEach(t => applyTo(t, {op:'r23kNoAb', src:name})); log(`${name}: ${ctx.r23kThose.length} creatures with mana value ${x} or less lose all abilities`); commit(); return true; }
  if (/^destroy those creatures$/.test(l) && ctx.r23kThose){ ctx.r23kThose.forEach(t => applyTo(t, {op:'destroy', src:name})); commit(); return true; }
  // Sleep
  if ((m = l.match(/^tap all creatures target player controls$/))){ const t = tgt(); const pid = t ? t.pid : null; ctx.r23kTapPid = pid; if (!pid) return true; if (pid === MYPID) S.bf.filter(c => isCreatureCard(c)).forEach(c => { c.tap = true; }); else sendRq(pid, 'r23kTapAll', 0, name, {d:'creature'}); commit(); return true; }
  if ((m = l.match(/^those creatures don't untap during (?:that|target) player's next untap step$/))){ const pid = ctx.r23kTapPid || ((ctx.lastT || [])[0] || {}).pid; if (!pid) return true; if (pid === MYPID) S.bf.filter(c => isCreatureCard(c) && c.tap).forEach(c => { c.skipUntap = 1; }); else sendRq(pid, 'r23kTapAll', 1, name, {d:'creature'}); commit(); return true; }
  // Veteran Explorer & co: each player may search
  if ((m = l.match(/^each player may search their library for (up to (?:one|two|three) basic land cards?|a basic land card), put (?:them|it) onto the battlefield( tapped)?(?:, then shuffle)?$/))){
    const d = m[1]; for (const p of opponents()) sendRq(p.pid, 'r23kSearch', m[2] ? 1 : 0, name, {d});
    if (UI.dry || await askYes(`${name}: search your library for ${d}?`, 'Search', 'No')) await searchLibrary(d, `put them onto the battlefield${m[2] || ''}, then shuffle`, ctx); commit(); return true; }
  // Crystal Shard: unless its controller pays
  if ((m = l.match(/^return target creature to its owner's hand unless its controller pays (\{\d+\})$/))){ const t = tgt(); if (!t) return true;
    if (t.pid !== MYPID && await askOpponentPay(t.pid, m[1], name)){ log(`${nameOf(t.pid)} paid ${m[1]} — ${t.nm} stays`); return true; }
    if (t.pid === MYPID){ const plan = payPlan(parseCost(m[1]), S.pool); if (!plan.err && !UI.dry && await askYes(`${name}: pay ${m[1]} to keep ${t.nm}?`, 'Pay', "Don't")){ S.pool = plan.pool; log(`paid ${m[1]}`); return true; } }
    applyTo(t, {op:'bounce', src:name}); commit(); return true; }
  // Commodore Guff −3 (X already worked out)
  if ((m = l.match(/^you draw (x|\d+) cards and ~ deals (x|\d+) damage to each opponent(?:, where x is the number of planeswalkers you control)?$/))){ const n = /x/.test(m[1]) || /planeswalkers/.test(full) ? S.bf.filter(c => !c.fd && /Planeswalker/.test(typeOf(c))).length : +m[1]; if (n){ draw(n); for (const p of opponents()) dealDamage({t:'player', pid:p.pid}, n, ctx.k, src()); } log(`${name}: X = ${n}`); commit(); return true; }
  // Proteus Staff
  if ((m = l.match(/^that creature's controller reveals cards from the top of their library until they reveal a creature card$/))){ const t = (ctx.lastT || [])[0]; const pid = t ? t.pid : null; ctx.r23kProt = true; if (!pid) return true; if (pid === MYPID) r23kRevealCreature(name); else sendRq(pid, 'r23kRevC', 0, name); commit(); return true; }
  if (ctx.r23kProt && /^the player puts that card onto the battlefield and the rest on the bottom of their library in any order$/.test(l)) return true;
  // Hidden Blade
  if ((m = l.match(/^if that creature is an? ([a-z]+), it gains ([a-z ]+) until end of turn$/))){ const t = (ctx.lastT || [])[0]; if (t && t.k && descOk(t.k, m[1])) pumpT(t, 0, 0, [m[2]]); commit(); return true; }
  // Show and Tell / Kynaios and Tiro
  if ((m = l.match(/^each player may put an? (.+?) card from their hand onto the battlefield$/))){ const d = m[1].replace(/, or /g, ' or ').replace(/, /g, ' or ');
    ctx.r23kPut = {}; for (const p of opponents()) sendRq(p.pid, 'r23kPutHand', 0, name, {d});
    const list = S.hand.filter(c => descOk(c.k, d)); const ids = UI.dry || !list.length ? [] : await pickCards({title:`${name}: put a ${m[1]} card onto the battlefield`, cards:list, min:0, max:1, noneLabel:"Don't"});
    (ids || []).forEach(id => { moveCard(id, 'bf'); }); ctx.r23kPutMe = !!(ids && ids.length); ctx.r23kPutRef = Date.now();
    commit(); return true; }
  if ((m = l.match(/^(?:then )?each opponent who didn't draws a card$/)) && ctx.r23kPutRef){ for (const p of opponents()) sendRq(p.pid, 'r23kDrawIfNot', 0, name); commit(); return true; }
  // Yawgmoth's Vile Offering
  if ((m = l.match(/^put up to one target (creature or planeswalker|creature|artifact or creature) card from a graveyard onto the battlefield under your control$/))){ const t = tgt(); if (!t) return true; if (t.pid === MYPID || t.t !== 'gy' && find(t.id)[0] === 'gy'){ if (find(t.id)[0] === 'gy') moveCard(t.id, 'bf'); } else sendRq(t.pid, 'gytake', 0, name, {d:t.k}); commit(); return true; }
  // Chandra, Spark Hunter
  if ((m = l.match(/^choose up to one target vehicle you control$/))){ const t = tgt(); ctx.r23kChosen = t || null; return true; }
  if ((m = l.match(/^until end of turn, it becomes an artifact creature and gains haste$/))){ const t = ctx.r23kChosen || (ctx.lastT || [])[0]; const c = t && S.bf.find(x => x.id === t.id); if (c){ c.anim = 'crew'; c.ekw = [...new Set([...(c.ekw || []), 'haste'])]; log(`${cname(c)} becomes an artifact creature with haste`); } commit(); return true; }
  // Dune Chanter
  if ((m = l.match(/^mill (two|three|\d+) cards$/)) && /you gain 1 life for each land card milled this way/.test(full)){ const n = wn(m[1]) || +m[1]; const top = S.lib.slice(0, n); mill(n); ctx.r23kMilled = top; return true; }
  if ((m = l.match(/^you gain 1 life for each (land|creature) card milled this way$/))){ const n = (ctx.r23kMilled || []).filter(c => descOk(c.k, m[1])).length; if (n && gainLife(n, name)) log(`gained ${n} life → ${S.life}`); commit(); return true; }
  // Faith's Reward
  if ((m = l.match(/^return to the battlefield all permanent cards in your graveyard that were put there from the battlefield this turn$/))){ const ids = R23K.bfgy && R23K.bfgy.t === turnStr() ? R23K.bfgy.ids : []; const list = S.gy.filter(c => ids.includes(c.id) && !c.tok); list.forEach(c => moveCard(c.id, 'bf')); log(`${name}: returned ${list.length} permanent card${list.length === 1 ? '' : 's'}`); commit(); return true; }
  // Hunter's Bow
  if ((m = l.match(/^that creature deals damage equal to its power to up to one target creature you don't control$/))){ const a = (ctx.lastT || [])[0]; const b = tgt(); if (!a || !b) return true; const st = statsAny(a); const ca = boardOf(a.pid).find(x => x.id === a.id); if (st && st[0] > 0) dealDamage(b, st[0], a.k, ca); commit(); return true; }
  // Sméagol
  if ((m = l.match(/^if a creature died under your control this turn, (.+)$/))){ if (R23K.died && R23K.died.t === turnStr() && R23K.died.n > 0) await say(tail(m[1])); else log(`${name}: no creature died under your control this turn`); return true; }
  if ((m = l.match(/^target opponent reveals cards from the top of their library until they reveal a land card$/)) && /onto the battlefield tapped under your control and the rest into their graveyard/.test(full)){ const t = tgt(); const pid = t && t.pid !== MYPID ? t.pid : (opponents()[0] || {}).pid; ctx.r23kSmeagol = true; if (pid) sendRq(pid, 'r23kSmeagol', 0, name); commit(); return true; }
  if (ctx.r23kSmeagol && /^put that card onto the battlefield tapped under your control and the rest into their graveyard$/.test(l)) return true;
  // Nine Lives / Archfiend of the Dross
  if ((m = l.match(/^you lose the game$/))){ S.r23kLost = 1; S.lost = 'lost the game (' + name + ')'; log(`☠ ${name}: loses the game`); toast(`${name}: you lose the game`); commit(); return true; }
  // Solidarity of Heroes
  if ((m = l.match(/^choose any number of target creatures$/))){ ctx.r23kChosenT = ctx.tgts ? nextTargets(ctx) : []; ctx.lastT = ctx.r23kChosenT; return true; }
  if ((m = l.match(/^double the number of \+1\/\+1 counters on each of them$/))){ (ctx.r23kChosenT || ctx.lastT || []).forEach(t => { const c = boardOf(t.pid).find(x => x.id === t.id); const n = c ? (c.cp || 0) : 0; if (n) applyTo(t, {op:'ctr', n, src:name, d:'cp'}); }); commit(); return true; }
  // Erebos's Intervention
  if ((m = l.match(/^exile up to twice x target cards from graveyards$/))){ let g; while (ctx.tgts && (g = nextTargets(ctx)).length) g.forEach(t => r23kGyExile(t, ctx)); commit(); return true; }
  // Mass Manipulation
  if ((m = l.match(/^gain control of (x|\w+) target creatures and\/or planeswalkers$/))){ let g; while (ctx.tgts && (g = nextTargets(ctx)).length) g.forEach(t => { if (t.pid !== MYPID) applyTo(t, {op:'steal', src:name, f:{}}); }); commit(); return true; }
  // Azorius Charm
  if ((m = l.match(/^put target (attacking or blocking creature|creature|nonland permanent) on top of its owner's library$/))){ const t = tgt(); if (t) r22applyLib(t, 'top', name, false); commit(); return true; }
  // Red Death
  if ((m = l.match(/^goad target creature an opponent controls$/))){ const t = tgt(); if (t && t.pid !== MYPID) sendRq(t.pid, 'goad', 0, name, {tid:t.id}); ctx.lastT = t ? [t] : []; commit(); return true; }
  if ((m = l.match(/^you add (\{[wubrgc]\})$/))){ addMana([m[1][1].toUpperCase()]); log(`added ${m[1].toUpperCase()}`); commit(); return true; }
  // Rakdos, the Showstopper
  if ((m = l.match(/^flip a coin for each creature that isn't a demon, devil, or imp$/))){ const list = r23kCards(null, c => isCreatureCard(c) && !/\b(Demon|Devil|Imp)\b/.test(typeOf(c) || info(c.k)?.t || '')); ctx.r23kTails = list.filter(() => Math.random() < 0.5); log(`🪙 ${name}: ${list.length} flips, ${ctx.r23kTails.length} tails`); return true; }
  if ((m = l.match(/^destroy each creature whose coin comes up tails$/))){ (ctx.r23kTails || []).forEach(t => applyTo(t, {op:'destroy', src:name})); commit(); return true; }
  // Chaos Defiler
  if ((m = l.match(/^for each opponent, choose a nonland permanent (?:that|target) player controls$/))){ const ch = []; for (const p of opponents()){ const list = (OPP.get(p.pid)?.bf || []).filter(c => c.k && !c.fd && !isLand(c.k)); if (!list.length) continue; const v = list.length === 1 || UI.dry ? String(list[0].id) : await askChoice({title:`${name}: choose a nonland permanent ${p.nm} controls`, options:list.map(c => ({label:info(c.k)?.n || '?', value:String(c.id)}))}); const c = list.find(x => String(x.id) === v) || list[0]; ch.push({t:'card', pid:p.pid, id:c.id, k:c.k}); } ctx.r23kCh = ch; return true; }
  if ((m = l.match(/^destroy one of them chosen at random$/))){ const ch = ctx.r23kCh || []; if (ch.length){ const t = ch[Math.floor(Math.random() * ch.length)]; log(`${name}: randomly chose ${info(t.k)?.n}`); applyTo(t, {op:'destroy', src:name}); } commit(); return true; }
  // Skyfisher Spider
  if ((m = l.match(/^exile ~ from your graveyard$/))){ const c = S.gy.find(x => cname(x) === name); if (c) moveCard(c.id, 'ex'); commit(); return true; }
  // Glorious Protector
  if ((m = l.match(/^exile any number of (non-[a-z]+ )?creatures you control until ~ leaves the battlefield$/))){ const sc = src(); const nd = m[1] ? m[1].trim().slice(4) : null; const list = S.bf.filter(c => isCreatureCard(c) && !c.fd && c !== sc && !(nd && descOk(c.k, nd, {tok:c.tok}))); if (UI.dry || !list.length || !sc) return true;
    const ids = await pickCards({title:`${name}: exile any number of creatures until it leaves`, cards:list, min:0, max:99, noneLabel:'None'}); (ids || []).forEach(id => { moveCard(id, 'ex'); const e = S.ex.find(x => x.id === id); if (e) e.r21until = sc.id; }); commit(); return true; }
  // Grindstone
  if ((m = l.match(/^target player mills two cards$/)) && /if two cards that share a color were milled this way, repeat this process/.test(full)){ const t = tgt(); const pid = t ? t.pid : MYPID; ctx.r23kGrind = true; if (pid === MYPID) r23kGrind(); else sendRq(pid, 'r23kGrind', 0, name); commit(); return true; }
  if (ctx.r23kGrind && /^if two cards that share a color were milled this way, repeat this process$/.test(l)) return true;
  // Battle at the Helvault
  if ((m = l.match(/^for each player, exile up to one target non-saga, nonland permanent (?:that|target) player controls until ~ leaves the battlefield$/))){ await say('For each opponent, exile up to one target nonland permanent that player controls until ~ leaves the battlefield'); return true; }
  // Dawn-Blessed Pennant
  if ((m = l.match(/^return target card of the chosen type from your graveyard to your hand$/))){ const t = tgt(); if (t && find(t.id)[0] === 'gy') moveCard(t.id, 'hand'); commit(); return true; }
  // Herigast
  if ((m = l.match(/^exile your hand$/))){ const n = S.hand.length; S.hand.slice().forEach(c => moveCard(c.id, 'ex', {quiet:true})); log(`${name}: exiled their hand (${n})`); ctx.didPay = true; commit(); return true; }
  // Lost in the Maze
  if ((m = l.match(/^tap (x|\w+) target creatures$/))){ const all = []; let g; while (ctx.tgts && (g = nextTargets(ctx)).length) all.push(...g); all.forEach(t => applyTo(t, {op:'tap', src:name})); ctx.lastT = all; ctx.r23kThoseT = all; commit(); return true; }
  if ((m = l.match(/^put a stun counter on each of those creatures you don't control$/))){ (ctx.r23kThoseT || ctx.lastT || []).filter(t => t.pid !== MYPID).forEach(t => applyTo(t, {op:'r23kNamed', n:1, src:name, d:'stun'})); commit(); return true; }
  // Edge of Autumn
  if ((m = l.match(/^if you control (four|three|five|\d+) or fewer lands, (.+)$/))){ const n = wn(m[1]) || +m[1]; if (S.bf.filter(c => isLand(c.k) && !c.fd).length <= n) await say(tail(m[2])); else log(`${name}: you control more than ${n} lands`); return true; }
  // The Mouth of Sauron
  if ((m = l.match(/^amass (\w+) x, where x is the number of instant and sorcery cards in (?:target|that) player's graveyard$/))){ const t = (ctx.lastT || [])[0] || ctx.lastTgt; const pid = t && t.pid ? t.pid : MYPID; const gy = pid === MYPID ? S.gy.map(c => c.k) : (OPP.get(pid)?.gy || []); const n = gy.filter(k => /\b(Instant|Sorcery)\b/.test(info(k)?.t || '')).length; if (n) await amass(sing(m[1]).replace(/^\w/, ch => ch.toUpperCase()), n, ctx); else log(`${name}: X is 0`); return true; }
  // Celestial Mantle
  if ((m = l.match(/^double its controller's life total$/))){ const n = Math.max(0, S.life); if (n && gainLife(n, name)) log(`${name}: doubled life → ${S.life}`); commit(); return true; }
  // Pitiless Carnage
  if ((m = l.match(/^sacrifice any number of permanents you control$/))){ const list = S.bf.filter(c => !c.fd && !c.emb); const ids = UI.dry || !list.length ? [] : await pickCards({title:`${name}: sacrifice any number of permanents`, cards:list, min:0, max:99, noneLabel:'None'}); (ids || []).forEach(id => { const c = S.bf.find(x => x.id === id); if (c) sacrificeOne(c); }); ctx.r23kN = (ids || []).length; commit(); return true; }
  if ((m = l.match(/^draw that many cards$/)) && ctx.r23kN != null){ if (ctx.r23kN) draw(ctx.r23kN); commit(); return true; }
  // Nightpack Ambusher
  if ((m = l.match(/^if you didn't cast a spell this turn, (.+)$/))){ const t = turnStr(); if (!(S.castHist || []).some(h => h.t === t)) await say(tail(m[1])); else log(`${name}: you cast a spell this turn`); return true; }
  // Necrotic Hex
  if ((m = l.match(/^each player sacrifices (two|three|four|five|six|seven|\d+) creatures of their choice$/))){ const n = wn(m[1]) || +m[1]; for (const p of opponents()) sendRq(p.pid, 'sac', n, name, {d:'creature'}); const list = S.bf.filter(c => isCreatureCard(c) && !c.fd);
    let ids = list.length <= n ? list.map(c => c.id) : UI.dry ? [] : await pickCards({title:`${name}: sacrifice ${n} creatures`, cards:list, min:n, max:n}); (ids || []).forEach(id => { const c = S.bf.find(x => x.id === id); if (c) sacrificeOne(c); }); commit(); return true; }
  // Mastermind Plum
  if ((m = l.match(/^if an? (artifact|creature|land) card was exiled this way, (.+)$/))){ const t = ctx.lastExGy || (ctx.lastT || [])[0]; if (t && t.k && descOk(t.k, m[1])) await say(tail(m[2])); else log(`${name}: no ${m[1]} card exiled`); return true; }
  // Drana, the Last Bloodchief
  if ((m = l.match(/^(?:target|defending) player chooses a nonlegendary creature card in your graveyard$/))){ const list = S.gy.filter(c => isCreatureCard(c) && !/Legendary/.test(info(c.k)?.t || '')); const pid = (ctx.it && ctx.it.evDp) || ((ctx.lastT || [])[0] || {}).pid || (opponents()[0] || {}).pid;
    let id = null; if (list.length === 1) id = list[0].id; else if (list.length && pid && pid !== MYPID) id = (await r22oppPick(pid, list, 1, 'choose a creature card to return', name))[0]; else if (list.length) id = list[0].id; ctx.r23kDrana = id; if (id != null) log(`${name}: ${pid ? nameOf(pid) : 'they'} chose ${cname(list.find(c => c.id === id))}`); return true; }
  if ((m = l.match(/^you return that card to the battlefield with an additional \+1\/\+1 counter on it$/))){ const id = ctx.r23kDrana; if (id != null && find(id)[0] === 'gy'){ moveCard(id, 'bf'); const c = S.bf.find(x => x.id === id); if (c){ modCounters(c, 'cp', 1); c.r23kType = 'Vampire'; } } commit(); return true; }
  if ((m = l.match(/^the creature is a vampire in addition to its other types$/))) return true;
  // Jolted Awake
  if ((m = l.match(/^choose up to one target (artifact or creature|creature|artifact) card in your graveyard$/))){ ctx.r23kChosen = tgt() || null; return true; }
  if ((m = l.match(/^pay an amount of \{e\} equal to that card's mana value$/))){ const t = ctx.r23kChosen; const n = t && t.k ? r23kMv(t.k) : 0; const have = (S.pc || {}).energy || 0; if (t && have >= n){ if (n) addPC('energy', -n); ctx.didPay = true; ctx.mayYes = true; } else { ctx.didPay = false; ctx.mayYes = false; log(`${name}: not enough energy`); } return true; }
  if ((m = l.match(/^(?:if you do, )?return it from your graveyard to the battlefield$/)) && ctx.r23kChosen !== undefined){ const t = ctx.r23kChosen; if (t && ctx.didPay && find(t.id)[0] === 'gy') moveCard(t.id, 'bf'); commit(); return true; }
  // Cosmic Rebirth
  if ((m = l.match(/^choose target (permanent|creature) card in your graveyard$/))){ ctx.r23kChosen = tgt() || null; return true; }
  if ((m = l.match(/^if it has mana value (\d+) or less, you may put it onto the battlefield$/))){ const t = ctx.r23kChosen; ctx.r23kOnto = false; if (t && find(t.id)[0] === 'gy' && r23kMv(t.k) <= +m[1] && (UI.dry || await askYes(`${name}: put ${t.nm} onto the battlefield?`, 'Battlefield', 'Hand'))){ moveCard(t.id, 'bf'); ctx.r23kOnto = true; } commit(); return true; }
  if ((m = l.match(/^if you don't put it onto the battlefield, put it into your hand$/))){ const t = ctx.r23kChosen; if (t && !ctx.r23kOnto && find(t.id)[0] === 'gy') moveCard(t.id, 'hand'); commit(); return true; }
  // Shaman of Forgotten Ways
  if ((m = l.match(/^each player's life total becomes the number of creatures they control$/))){ const mine = S.bf.filter(c => isCreatureCard(c) && !c.fd).reduce((a, c) => a + (c.n || 1), 0); S.life = mine; log(`${name}: life total becomes ${mine}`);
    for (const [pid, st] of OPP){ const n = (st.bf || []).filter(c => c.k && isCreatureCard(c) && !c.fd).reduce((a, c) => a + (c.n || 1), 0); const d = n - (st.life || 0); if (d) sendRq(pid, 'life', d, name); } commit(); return true; }
  // The Stasis Coffin
  if ((m = l.match(/^you gain protection from everything until your next turn$/))){ S.r23kProt = turnStr(); log(`${name}: protection from everything until their next turn`); commit(); return true; }
  // Atarka's Command
  if ((m = l.match(/^your opponents can't gain life this turn$/))){ for (const p of opponents()) sendRq(p.pid, 'r23kNoGain', 0, name); log(`${name}: opponents can't gain life this turn`); commit(); return true; }
  // Crawling Barrens
  if ((m = l.match(/^have it become an? (\d+)\/(\d+) ([a-z ]+?) creature until end of turn$/))){ const c = src(); if (c){ c.anim = 'crew'; c.animPT = [+m[1], +m[2]]; log(`${cname(c)} becomes a ${m[1]}/${m[2]} creature`); } commit(); return true; }
  if (/^it's still a land$/.test(l)) return true;
  // Warkite Marauder
  if ((m = l.match(/^target creature (?:target|defending) player controls loses all abilities and has base power and toughness (\d+)\/(\d+) until end of turn$/))){ const t = tgt(); if (t) applyTo(t, {op:'r23kNoAb', src:name, f:{p:+m[1], t:+m[2]}}); commit(); return true; }
  // Self-Destruct
  if ((m = l.match(/^target creature you control deals x damage to any other target and x damage to itself, where x is its power$/))){ const a = tgt(); const b = tgt(); if (!a) return true; const st = statsAny(a); const n = st ? Math.max(0, st[0]) : 0; const ca = boardOf(a.pid).find(x => x.id === a.id); if (b) dealDamage(b, n, a.k, ca); dealDamage(a, n, a.k, ca); commit(); return true; }
  // Mutinous Massacre
  if ((m = l.match(/^choose odd or even$/))){ ctx.r23kOdd = UI.dry ? 'odd' : await askChoice({title:`${name}: odd or even?`, options:[{label:'Odd', value:'odd'}, {label:'Even', value:'even'}]}); log(`${name}: chose ${ctx.r23kOdd}`); return true; }
  if ((m = l.match(/^destroy each creature with mana value of the chosen quality$/))){ const odd = ctx.r23kOdd === 'odd'; r23kCards(null, c => isCreatureCard(c) && (r23kMv(c.k) % 2 === 1) === odd).forEach(t => applyTo(t, {op:'destroy', src:name})); commit(); return true; }
  if ((m = l.match(/^(?:then )?gain control of all creatures until end of turn$/))){ ctx.r23kStole = true; r23kCards(pid => pid !== MYPID, c => isCreatureCard(c)).forEach(t => applyTo(t, {op:'steal', src:name, f:{eot:true, untap:/untap them/.test(full), haste:/gain haste/.test(full)}})); S.bf.filter(c => isCreatureCard(c)).forEach(c => { if (/untap them/.test(full)) c.tap = false; if (/gain haste/.test(full)) c.ekw = [...new Set([...(c.ekw || []), 'haste'])]; }); commit(); return true; }
  if (ctx.r23kStole && /^(untap them|they gain haste until end of turn)$/.test(l)) return true;
  // The Ring Goes South
  if ((m = l.match(/^(?:then )?reveal cards from the top of your library until you reveal (x|\d+) land cards(?:, where x is the number of legendary creatures you control)?$/))){ const n = m[1] === 'x' || /legendary creatures you control/.test(full) ? S.bf.filter(c => isCreatureCard(c) && !c.fd && /Legendary/.test(typeOf(c) || '')).length : +m[1];
    const lands = [], rest = []; while (lands.length < n && S.lib.length){ const c = S.lib.shift(); (isLand(c.k) ? lands : rest).push(c); } ctx.r23kRev = {lands, rest}; log(`${name}: revealed ${lands.length + rest.length} cards, ${lands.length} lands`);
    lands.forEach(c => { S.hand.push(c); moveCard(c.id, 'bf', {quiet:true}); c.tap = true; }); shuffle(rest); S.lib.push(...rest); commit(); return true; }
  if (ctx.r23kRev && /^put those land cards onto the battlefield tapped and the rest on the bottom of your library in a random order$/.test(l)) return true;

  // ---- batch 3 ----
  // free casts from hand / graveyard
  if ((m = l.match(/^(?:you may )?cast an? (noncreature |instant or sorcery |creature )?spell (?:with mana value (\d+) or less )?from your hand without paying its mana cost$/))){ const d = (m[1] || '').trim(); const list = S.hand.filter(c => !isLand(c.k) && (!d || descOk(c.k, d)) && (m[2] == null || r23kMv(c.k) <= +m[2]));
    if (UI.dry || !list.length){ if (!list.length) log(`${name}: nothing to cast`); return true; }
    const ids = await pickCards({title:`${name}: cast a ${d ? d + ' ' : ''}spell from your hand for free`, cards:list, min:0, max:1, noneLabel:"Don't"}); const c = ids && ids[0] != null ? S.hand.find(x => x.id === ids[0]) : null; if (c){ UI.afterCast = () => {}; await beginCast(c, 'hand', {free:true}); } commit(); return true; }
  if ((m = l.match(/^(?:you may )?(?:play|cast) target ([a-z ]+?) card from your graveyard without paying its mana cost$/))){ const t = tgt(); const c = t && S.gy.find(x => x.id === t.id); if (!c || UI.dry) return true;
    if (isLand(c.k)){ moveCard(c.id, 'bf'); log(`${name}: played ${cname(c)} from the graveyard`); } else { UI.afterCast = () => {}; await beginCast(c, 'gy', {free:true}); } commit(); return true; }
  // Shadow Puppeteers
  if ((m = l.match(/^have it become a (red|black|blue|white|green) ([a-z]+) with base power and toughness (\d+)\/(\d+) in addition to its other colors and types until end of turn$/))){ const id = ctx.it && ctx.it.evId; const c = id != null ? S.bf.find(x => x.id === id) : null; if (c){ const st = stats(c) || [0, 0]; const b = ptOf(faceOf(c)) || [0, 0]; c.pu = [(c.pu ? c.pu[0] : 0) + (+m[3]) - b[0], (c.pu ? c.pu[1] : 0) + (+m[4]) - b[1]]; c.r23kType = cap(m[2]); c.r23kTypeT = turnStr(); log(`${cname(c)} becomes a ${m[3]}/${m[4]} ${m[1]} ${cap(m[2])} until end of turn`); } commit(); return true; }
  // Tomb of Horrors Adventurer
  if ((m = l.match(/^if you've completed a dungeon, copy that spell twice instead$/))){ if ((S.dgDone || 0) > 0){ const sp = stackAll().filter(i => i.kind === 'spell').pop(); if (sp) await copyMany({...ctx, it:{...(ctx.it || {}), copyOf:sp.sid}}, 1).catch(() => {}); log(`${name}: completed a dungeon — one more copy`); } return true; }
  // Pir's Whim
  if ((m = l.match(/^for each player, choose friend or foe$/))){ ctx.r23kFF = {}; for (const p of players()) ctx.r23kFF[p.pid] = UI.dry ? (p.me ? 'friend' : 'foe') : await askChoice({title:`${name}: ${p.me ? 'you are' : p.nm + ' is'} friend or foe?`, options:[{label:'Friend', value:'friend'}, {label:'Foe', value:'foe'}]}); log(`${name}: ${Object.entries(ctx.r23kFF).map(([pid, v]) => nameOf(pid) + ' ' + v).join(', ')}`); return true; }
  if ((m = l.match(/^each friend searches their library for an? (.+?) card, puts it onto the battlefield( tapped)?(?:, then shuffles)?$/)) && ctx.r23kFF){ for (const [pid, v] of Object.entries(ctx.r23kFF)){ if (v !== 'friend') continue; if (pid === MYPID) await searchLibrary(`a ${m[1]} card`, `put it onto the battlefield${m[2] || ''}, then shuffle`, ctx); else sendRq(pid, 'r23kSearch', m[2] ? 1 : 0, name, {d:`a ${m[1]} card`}); } commit(); return true; }
  if ((m = l.match(/^each foe sacrifices an? (.+?) of their choice$/)) && ctx.r23kFF){ for (const [pid, v] of Object.entries(ctx.r23kFF)){ if (v !== 'foe') continue; if (pid === MYPID){ const list = S.bf.filter(c => !c.fd && descOk(c.k, m[1], {tok:c.tok})); const ids = list.length <= 1 ? list.map(c => c.id) : await pickCards({title:`${name}: sacrifice an ${m[1]}`, cards:list, min:1, max:1}); (ids || []).forEach(id => sacrificeOne(S.bf.find(x => x.id === id))); } else sendRq(pid, 'sac', 1, name, {d:m[1]}); } commit(); return true; }
  // Morningtide's Light
  if ((m = l.match(/^exile any number of target creatures$/)) && /return those cards to the battlefield tapped under their owners' control/.test(full)){ const all = []; let g; while (ctx.tgts && (g = nextTargets(ctx)).length) all.push(...g); ctx.r23kFlick = true;
    all.forEach(t => { if (t.pid === MYPID){ const c = S.bf.find(x => x.id === t.id); if (c){ moveCard(c.id, 'ex'); (S.r23kBack ||= []).push({id:c.id, tap:1}); } } else sendRq(t.pid, 'r23kFlicker', 1, name, {tid:t.id}); }); commit(); return true; }
  if (ctx.r23kFlick && /^at the beginning of the next end step, return those cards to the battlefield tapped under their owners' control$/.test(l)) return true;
  if ((m = l.match(/^until your next turn[,:] prevent all damage that would be dealt to you$/))){ S.r23kProt = turnStr(); log(`${name}: all damage to them is prevented until their next turn`); commit(); return true; }
  // Fractal Harness
  if ((m = l.match(/^put x \+1\/\+1 counters on it and attach ~ to it$/))){ const tid = (ctx.lastTok || []).slice(-1)[0]; const tok = tid != null ? S.bf.find(x => x.id === tid) : null; const sc = src(); const x = (ctx.it && (ctx.it.x || ctx.it.evX)) || (sc && sc.xv) || 0; if (tok){ if (x) modCounters(tok, 'cp', x); if (sc) sc.att = {pid:MYPID, id:tok.id}; log(`${name}: ${x} counters, attached to ${cname(tok)}`); } commit(); return true; }
  // Epic Experiment
  if ((m = l.match(/^exile the top (x|\d+) cards of your library$/)) && /cast instant and sorcery spells with mana value x or less from among them without paying their mana costs/.test(full)){ const n = m[1] === 'x' ? ((ctx.it && ctx.it.x) || 0) : +m[1]; ctx.r23kX = n; const cs = S.lib.splice(0, n); S.ex.push(...cs); ctx.r21ids = cs.map(c => c.id); ctx.r21 = true; log(`${name}: exiled the top ${cs.length} cards`); commit(); return true; }
  if ((m = l.match(/^(?:you may )?cast instant and sorcery spells with mana value x or less from among them without paying their mana costs$/)) && ctx.r21ids){ await r21CastNow(ctx, {free:true, mv:ctx.r23kX || 0, desc:'instant or sorcery'}); return true; }
  if ((m = l.match(/^(?:then )?put all cards exiled this way that weren't cast into your graveyard$/)) && ctx.r21ids){ ctx.r21ids.forEach(id => { const c = S.ex.find(x => x.id === id); if (c) moveCard(c.id, 'gy', {quiet:true}); }); commit(); return true; }
  // Kaito Shizuki
  if ((m = l.match(/^if ~ entered this turn, (?:he|she|it) phases out$/))){ const c = src(); if (c && c.et === turnStr()){ S.bf.splice(S.bf.indexOf(c), 1); S.poz = (S.poz || []).concat(c); log(`${name} phased out`); } commit(); return true; }
  // Banon / pay and discard
  if ((m = l.match(/^pay (\{\d+\}) and discard a card$/))){ ctx.didPay = false; const plan = payPlan(parseCost(m[1]), S.pool); if (plan.err || !S.hand.length){ log(`${name}: can't pay`); return true; } if (UI.dry){ ctx.didPay = true; return true; } const ids = await pickCards({title:`${name}: discard a card`, cards:S.hand.slice(), min:1, max:1}); if (!ids || !ids.length) return true; S.pool = payPlan(parseCost(m[1]), S.pool).pool; moveCard(ids[0], 'gy'); ctx.didPay = true; ctx.mayYes = true; commit(); return true; }
  // Fiery Gambit
  if ((m = l.match(/^flip a coin until you lose a flip or choose to stop flipping$/))){ let w = 0, lost = false; while (true){ const win = Math.random() < 0.5; if (!win){ lost = true; break; } w++; if (UI.dry || !(await askYes(`${name}: won ${w} flip${w > 1 ? 's' : ''}. Keep flipping?`, 'Flip again', 'Stop'))) break; } ctx.r23kWins = lost ? 0 : w; ctx.r23kLostFlip = lost; log(`🪙 ${name}: ${lost ? 'lost a flip after ' + w + ' wins — no effect' : 'stopped after ' + w + ' wins'}`); return true; }
  if (/^if you lose a flip, ~ has no effect$/.test(l)) return true;
  if ((m = l.match(/^if you win (one|two|three) or more flips, (.+)$/)) && ctx.r23kWins != null){ if (ctx.r23kWins >= wn(m[1])) await say(tail(m[2])); else { const t = /target/.test(m[2]) ? tgt() : null; } return true; }
  if ((m = l.match(/^draw nine cards and untap all lands you control$/))){ draw(9); S.bf.filter(c => isLand(c.k)).forEach(c => { c.tap = false; }); commit(); return true; }
  // Galvanic Discharge
  if ((m = l.match(/^choose target (creature or planeswalker|creature)$/))){ ctx.r23kChosen = tgt() || null; ctx.lastT = ctx.r23kChosen ? [ctx.r23kChosen] : []; return true; }
  if ((m = l.match(/^(?:then )?(?:you may )?pay any amount of \{e\}$/))){ const have = (S.pc || {}).energy || 0; const n = UI.dry ? have : Math.max(0, Math.min(have, +(await askNumber(`${name}: pay how much energy? (you have ${have})`, 'That much damage', have)) || 0)); if (n) addPC('energy', -n); ctx.r23kPaid = n; return true; }
  if ((m = l.match(/^~ deals that much damage to that (permanent|creature)$/)) && ctx.r23kPaid != null){ const t = ctx.r23kChosen; if (t && ctx.r23kPaid) dealDamage(t, ctx.r23kPaid, ctx.k, src()); commit(); return true; }
  // Ty Lee
  if ((m = l.match(/^it doesn't untap during its controller's untap step for as long as you control ~$/))){ const t = (ctx.lastT || [])[0]; const sc = src(); if (t && sc) applyTo(t, {op:'r23kLock', src:name, ref:String(sc.id), d:MYPID}); commit(); return true; }
  // Command the Dreadhorde
  if ((m = l.match(/^choose any number of target creature and\/or planeswalker cards in graveyards$/))){ const all = []; let g; while (ctx.tgts && (g = nextTargets(ctx)).length) all.push(...g); ctx.r23kDread = all; return true; }
  if ((m = l.match(/^~ deals damage to you equal to the total mana value of those cards$/)) && ctx.r23kDread){ const n = ctx.r23kDread.reduce((a, t) => a + r23kMv(t.k), 0); if (n) dealDamage({t:'player', pid:MYPID}, n, ctx.k, null); commit(); return true; }
  if ((m = l.match(/^put them onto the battlefield under your control$/)) && ctx.r23kDread){ ctx.r23kDread.forEach(t => { if (t.pid === MYPID){ if (find(t.id)[0] === 'gy') moveCard(t.id, 'bf'); } else sendRq(t.pid, 'gytake', 0, name, {d:t.k}); }); commit(); return true; }
  // Marcus, Mutant Mayor
  if ((m = l.match(/^draw a card if that creature has a \+1\/\+1 counter on it$/))){ const id = ctx.it && ctx.it.evId; const c = id != null ? S.bf.find(x => x.id === id) : null; ctx.r23kHad = !!(c && (c.cp || 0) > 0); if (ctx.r23kHad) draw(1); commit(); return true; }
  if ((m = l.match(/^if it doesn't, put a \+1\/\+1 counter on it$/))){ const id = ctx.it && ctx.it.evId; const c = id != null ? S.bf.find(x => x.id === id) : null; if (c && !ctx.r23kHad) modCounters(c, 'cp', 1); commit(); return true; }
  // Balan
  if ((m = l.match(/^attach all equipment you control to ~$/))){ const c = src(); if (c) S.bf.filter(x => /Equipment/.test(typeOf(x))).forEach(e => { e.att = {pid:MYPID, id:c.id}; }); log(`${name}: attached all Equipment`); commit(); return true; }
  // Vile Mutilator
  if ((m = l.match(/^each opponent sacrifices an? (nontoken [a-z]+) of their choice, then sacrifices an? (nontoken [a-z]+) of their choice$/))){ for (const p of opponents()){ sendRq(p.pid, 'sac', 1, name, {d:m[1]}); sendRq(p.pid, 'sac', 1, name, {d:m[2]}); } commit(); return true; }
  // Azlask
  if ((m = l.match(/^scions and spawns you control gain indestructible and annihilator 1 until end of turn$/))){ S.bf.filter(c => isCreatureCard(c) && /\b(Scion|Spawn)\b/.test(typeOf(c))).forEach(c => { c.ekw = [...new Set([...(c.ekw || []), 'indestructible', 'annihilator 1'])]; }); commit(); return true; }
  // Benevolent Offering
  if ((m = l.match(/^choose an opponent$/)) && /you and that player each create|that player gains \d+ life for each creature they control/.test(full)){ const ops = opponents(); ctx.r23kOpp = ops.length <= 1 || UI.dry ? (ops[0] || {}).pid : await askChoice({title:`${name}: choose an opponent`, options:ops.map(p => ({label:p.nm, value:p.pid}))}); return true; }
  if ((m = l.match(/^you and that player each create (.+)$/))){ await createFromText('Create ' + tail(m[1]), ctx); if (ctx.r23kOpp) await r23kTokFor(ctx.r23kOpp, tail(m[1]), ctx); commit(); return true; }
  if ((m = l.match(/^you gain (\d+) life for each creature you control and that player gains \1 life for each creature they control$/))){ const k = +m[1]; const mine = S.bf.filter(c => isCreatureCard(c) && !c.fd).reduce((a, c) => a + (c.n || 1), 0); if (mine && gainLife(k * mine, name)) log(`gained ${k * mine} life → ${S.life}`); const pid = ctx.r23kOpp; if (pid) sendRq(pid, 'r23kGainPer', k, name, {d:'creature'}); commit(); return true; }
  // Industrial Advancement
  if ((m = l.match(/^(?:you may )?sacrifice a creature$/)) && /look at the top x cards of your library, where x is that creature's mana value/.test(full)){ const list = S.bf.filter(c => isCreatureCard(c) && !c.fd); ctx.didPay = false; ctx.r23kLook = []; if (!list.length) return true; const ids = UI.dry ? [list[0].id] : await pickCards({title:`${name}: sacrifice a creature`, cards:list, min:0, max:1, noneLabel:"Don't"}); const c = ids && ids[0] != null ? S.bf.find(x => x.id === ids[0]) : null; if (c){ ctx.r23kSacMV = r23kMv(c.k); sacrificeOne(c); ctx.didPay = true; ctx.mayYes = true; } commit(); return true; }
  if ((m = l.match(/^(?:if you do, )?look at the top x cards of your library, where x is that creature's mana value$/))){ if (!ctx.didPay && ctx.r23kSacMV == null) return true; const n = ctx.r23kSacMV || 0; ctx.r23kLook = S.lib.slice(0, n); log(`${name}: looked at the top ${n} cards`); return true; }
  if ((m = l.match(/^(?:you may )?put a creature card from among them onto the battlefield$/)) && ctx.r23kLook){ const list = ctx.r23kLook.filter(c => isCreatureCard(c)); const ids = UI.dry || !list.length ? [] : await pickCards({title:`${name}: put a creature card onto the battlefield`, cards:list, min:0, max:1, noneLabel:'None'}); (ids || []).forEach(id => { moveCard(id, 'bf'); ctx.r23kLook = ctx.r23kLook.filter(c => c.id !== id); }); commit(); return true; }
  if ((m = l.match(/^put the rest on the bottom of your library in a random order$/)) && ctx.r23kLook){ const rest = ctx.r23kLook.filter(c => S.lib.includes(c)); rest.forEach(c => S.lib.splice(S.lib.indexOf(c), 1)); shuffle(rest); S.lib.push(...rest); commit(); return true; }
  // vehicles / artifacts becoming creatures
  if ((m = l.match(/^~ becomes an artifact creature until end of turn$/))){ const c = src(); if (c){ c.anim = 'crew'; log(`${cname(c)} becomes an artifact creature`); } commit(); return true; }
  // Yusri
  if ((m = l.match(/^choose a number between 1 and 5$/))){ ctx.r23kN = UI.dry ? 2 : +(await askChoice({title:`${name}: how many coins to flip?`, options:[1, 2, 3, 4, 5].map(n => ({label:String(n), value:n}))})) || 1; return true; }
  if ((m = l.match(/^flip (that many|\d+) coins$/))){ const n = /that many/.test(m[1]) ? (ctx.r23kN || 1) : +m[1]; let w = 0; for (let i = 0; i < n; i++) if (Math.random() < 0.5) w++; ctx.r23kWins = w; ctx.r23kLoss = n - w; log(`🪙 ${name}: won ${w}, lost ${n - w}`); return true; }
  if ((m = l.match(/^for each flip you win, draw a card$/)) && ctx.r23kWins != null){ if (ctx.r23kWins) draw(ctx.r23kWins); commit(); return true; }
  if ((m = l.match(/^for each flip you lose, ~ deals (\d+) damage to you$/)) && ctx.r23kLoss != null){ const n = ctx.r23kLoss * +m[1]; if (n) dealDamage({t:'player', pid:MYPID}, n, ctx.k, src()); commit(); return true; }
  if ((m = l.match(/^if you won five flips this way, you may cast spells from your hand this turn without paying their mana costs$/))){ if (ctx.r23kWins >= 5){ S.r23kFreeHand = turnStr(); log(`${name}: may cast spells from hand for free this turn`); } return true; }
  // Empty the Laboratory
  if ((m = l.match(/^sacrifice (x|\d+) (\w+?)s$/))){ const n = m[1] === 'x' ? ((ctx.it && ctx.it.x) || 0) : +m[1]; const d = m[2]; const list = S.bf.filter(c => !c.fd && descOk(c.k, d, {tok:c.tok})); const ids = list.length <= n ? list.map(c => c.id) : UI.dry ? [] : await pickCards({title:`${name}: sacrifice ${n} ${d}s`, cards:list, min:n, max:n}); (ids || []).forEach(id => sacrificeOne(S.bf.find(x => x.id === id))); ctx.r23kSacN = (ids || []).length; commit(); return true; }
  if ((m = l.match(/^(?:then )?reveal cards from the top of your library until you reveal a number of (\w+) creature cards equal to the number of \w+s sacrificed this way$/))){ const n = ctx.r23kSacN || 0; const hit = [], rest = []; while (hit.length < n && S.lib.length){ const c = S.lib.shift(); (isCreatureCard(c) && descOk(c.k, m[1]) ? hit : rest).push(c); } hit.forEach(c => { S.hand.push(c); moveCard(c.id, 'bf', {quiet:true}); }); shuffle(rest); S.lib.push(...rest); ctx.r23kRev = {hit, rest}; log(`${name}: put ${hit.map(cname).join(', ') || 'nothing'} onto the battlefield`); commit(); return true; }
  if (ctx.r23kRev && /^put those cards onto the battlefield and the rest on the bottom of your library in a random order$/.test(l)) return true;
  // Dire Fleet Ravager
  if ((m = l.match(/^each player loses a third of their life, rounded up$/))){ const me = Math.ceil(Math.max(0, S.life) / 3); if (me){ S.life -= me; log(`lost ${me} life → ${S.life}`); } for (const [pid, st] of OPP){ const n = Math.ceil(Math.max(0, st.life || 0) / 3); if (n) sendRq(pid, 'life', -n, name); } commit(); return true; }
  // Twins of Discord
  if ((m = l.match(/^creatures with mana value of that quality can't block this turn$/))){ const odd = ctx.r23kOdd === 'odd'; r23kCards(null, c => isCreatureCard(c) && (r23kMv(c.k) % 2 === 1) === odd).forEach(t => applyTo(t, {op:'pump', src:name, f:{p:0, t:0, kw:['cantblock']}})); commit(); return true; }
  // Caustic Bronco
  if ((m = l.match(/^reveal the top card of your library and put it into your hand$/)) && /if ~ isn't saddled/.test(full)){ const c = S.lib[0]; if (c){ moveCard(c.id, 'hand'); ctx.lastMV = r23kMv(c.k); log(`${name}: revealed ${cname(c)}`); } else ctx.lastMV = 0; return true; }
  if ((m = l.match(/^you lose life equal to that card's mana value if ~ isn't saddled$/))){ const sc = src(); ctx.r23kSaddled = !!(sc && (sc.saddled === turnStr() || sc.sad || (sc.saddledBy && sc.saddledBy.length))); if (!ctx.r23kSaddled && ctx.lastMV){ S.life -= ctx.lastMV; log(`lost ${ctx.lastMV} life → ${S.life}`); } commit(); return true; }
  if ((m = l.match(/^otherwise, each opponent loses that much life$/)) && ctx.r23kSaddled != null){ if (ctx.r23kSaddled && ctx.lastMV) for (const p of opponents()) await loseLife(p.pid, ctx.lastMV, name); commit(); return true; }
  // Crystalline Giant / Vivien keyword counters
  if ((m = l.match(/^choose a kind of counter at random that ~ doesn't have on it from among (.+)$/))){ const c = src(); const kinds = m[1].replace(/, and /, ', ').split(/,\s*/).map(x => x.trim()); const left = kinds.filter(k => !(c && ((k === '+1/+1' && (c.cp || 0)) || ((c.nc || {})[k])))); ctx.r23kKind = left.length ? left[Math.floor(Math.random() * left.length)] : null; return true; }
  if ((m = l.match(/^put a counter of that kind on ~$/))){ const c = src(); const k = ctx.r23kKind; if (c && k){ if (k === '+1/+1') modCounters(c, 'cp', 1); else { addNamed(c, k, 1); c.ekwp = [...new Set([...(c.ekwp || []), k])]; } log(`${name}: got a ${k} counter`); } commit(); return true; }
  if ((m = l.match(/^put your choice of an? ([a-z ]+) counter, an? ([a-z ]+) counter, or an? ([a-z ]+) counter on it$/))){ const tid = (ctx.lastTok || []).slice(-1)[0]; const c = tid != null ? S.bf.find(x => x.id === tid) : null; const k = UI.dry ? m[1] : await askChoice({title:`${name}: which counter?`, options:[m[1], m[2], m[3]].map(x => ({label:cap(x), value:x}))}); if (c && k){ addNamed(c, k, 1); c.ekwp = [...new Set([...(c.ekwp || []), k])]; } commit(); return true; }

  // ---- batch 4 ----
  // named tokens with quoted abilities (Banana, Icy Manalith)
  if ((m = s.match(/^create (a|an|one|two|three) (tapped )?((?:colorless |snow |legendary |white |blue |black |red |green )*)(artifact |enchantment )?token named ([A-Z][\w' -]+?) with ["“](.+?)["”]$/i))){ await r23kNamedToken(MYPID, m, ctx); return true; }
  if ((m = l.match(/^for each creature card in your graveyard, (create .+)$/))){ const n = S.gy.filter(c => isCreatureCard(c)).length; if (!n){ log(`${name}: no creature cards in graveyard`); return true; } await say(tail(m[1]).replace(/^create (a|an|one) /i, `Create ${n} `).replace(/ token /, ' tokens ').replace(/ token$/, ' tokens')); return true; }
  if ((m = l.match(/^if that creature is legendary, its controller loses (\d+) life$/))){ const t = (ctx.lastT || [])[0]; if (t && t.k && /Legendary/.test(info(t.k)?.t || '')) await loseLife(t.pid, +m[1], name); commit(); return true; }
  if ((m = l.match(/^~ deals (\d+) damage to any target that was dealt damage this turn$/))){ const t = tgt(); if (t) dealDamage(t, +m[1], ctx.k, src()); commit(); return true; }
  if ((m = l.match(/^(?:you may )?discard an? (creature|land|artifact|nonland) card$/))){ const list = S.hand.filter(c => descOk(c.k, m[1])); ctx.didPay = false; if (!list.length){ log(`${name}: no ${m[1]} card to discard`); return true; } const ids = UI.dry ? [list[0].id] : await pickCards({title:`${name}: discard a ${m[1]} card`, cards:list, min:0, max:1, noneLabel:"Don't"}); if (ids && ids.length){ moveCard(ids[0], 'gy'); ctx.didPay = true; ctx.mayYes = true; ctx.lastMV = r23kMv(find(ids[0])[2]?.k); } commit(); return true; }
  // Rendmaw
  if ((m = l.match(/^each player creates (.+)$/)) && /the tokens are goaded for the rest of the game/.test(full)){ const txt = tail(m[1]); for (const p of opponents()) sendRq(p.pid, 'r23kTokGoad', 0, name, {d:txt}); const before = new Set(S.bf.map(x => x.id)); await createFromText('Create ' + txt, ctx); S.bf.filter(x => !before.has(x.id)).forEach(x => { x.goad = {by:MYPID, n:1e6}; }); ctx.r23kGoaded = true; commit(); return true; }
  if (/^the tokens are goaded for the rest of the game$/.test(l) && ctx.r23kGoaded) return true;
  // Memory Jar
  if ((m = l.match(/^each player exiles all cards from their hand face down and draws seven cards$/))){ for (const p of opponents()) sendRq(p.pid, 'r23kJar', 0, name); r23kJar(name); ctx.r23kJar = true; commit(); return true; }
  if (ctx.r23kJar && /^at the beginning of the next end step, each player discards their hand and returns to their hand each card they exiled this way$/.test(l)) return true;
  // Exponential Growth
  if ((m = l.match(/^until end of turn, double target creature's power (x|\d+) times$/))){ const x = m[1] === 'x' ? ((ctx.it && ctx.it.x) || 0) : +m[1]; const t = tgt(); if (!t) return true; const st = statsAny(t); const p = st ? Math.max(0, st[0]) : 0; const add = p * (Math.pow(2, Math.min(x, 20)) - 1); if (add) pumpT(t, add, 0, []); commit(); return true; }
  // Imposing Grandeur
  if ((m = l.match(/^each player may discard their hand and draw cards equal to the greatest mana value of a commander they own on the battlefield or in the command zone$/))){ for (const p of opponents()) sendRq(p.pid, 'r23kGrandeur', 0, name); await r23kGrandeur(name); commit(); return true; }
  // animate a target artifact
  if ((m = l.match(/^until end of turn, target (noncreature artifact|artifact token|artifact|vehicle) you control becomes an? (\d+)\/(\d+) (?:([a-z]+) )?artifact creature(?: with ([a-z ,]+))?$/))){ const t = tgt(); const c = t && S.bf.find(x => x.id === t.id); if (c){ c.anim = 'crew'; c.animPT = [+m[2], +m[3]]; if (m[4]) c.r23kType = cap(m[4]); if (m[5]) c.ekw = [...new Set([...(c.ekw || []), ...r23kKws(m[5])])]; log(`${cname(c)} becomes a ${m[2]}/${m[3]} artifact creature`); } commit(); return true; }
  // Jace, Mirror Mage
  if ((m = l.match(/^draw a card and reveal it$/))){ const c = S.lib[0]; draw(1); ctx.lastMV = c ? r23kMv(c.k) : 0; if (c) log(`${name}: revealed ${cname(c)}`); commit(); return true; }
  if ((m = l.match(/^remove a number of loyalty counters equal to that card's mana value from ~$/))){ const c = src(); const n = ctx.lastMV || 0; if (c && n){ c.co = Math.max(0, (c.co || 0) - n); log(`${name}: removed ${n} loyalty`); } commit(); return true; }
  // giving permanents away
  if ((m = l.match(/^target (opponent|player) gains control of (?:another )?target (.+?) you control$/))){ const p = tgt(); const t = tgt(); ctx.r23kGave = false; if (!p || !t || p.pid === MYPID) return true; const c = S.bf.find(x => x.id === t.id); if (c){ giveAway(single(c), p.pid, {}); ctx.r23kGave = true; } commit(); return true; }
  if ((m = l.match(/^if they do, you draw a card$/)) && ctx.r23kGave != null){ if (ctx.r23kGave) draw(1); commit(); return true; }
  // Mishra, Claimed by Gix
  if ((m = l.match(/^each opponent loses x life and you gain x life, where x is the number of attacking creatures$/))){ const n = S.bf.filter(c => c.atk && isCreatureCard(c)).length; if (n){ for (const p of opponents()) await loseLife(p.pid, n, name); if (gainLife(n, name)) log(`gained ${n} life → ${S.life}`); } commit(); return true; }
  // Gix's Command
  if ((m = l.match(/^put two \+1\/\+1 counters on up to one creature$/))){ const all = r23kCards(null, c => isCreatureCard(c)); if (!all.length || UI.dry) return true; const v = await askChoice({title:`${name}: put two +1/+1 counters on which creature?`, options:[...all.map((t, i) => ({label:`${info(t.k)?.n}${t.pid === MYPID ? '' : ' (' + nameOf(t.pid) + ')'}`, value:String(i)})), {label:'None', value:''}]}); if (v){ const t = all[+v]; applyTo(t, {op:'ctr', n:2, src:name, d:'cp'}); ctx.lastT = [t]; } commit(); return true; }
  if ((m = l.match(/^return up to (one|two|three) (creature|artifact|land) cards from your graveyard to your hand$/))){ const n = wn(m[1]); const list = S.gy.filter(c => descOk(c.k, m[2])); const ids = list.length <= n ? list.map(c => c.id) : UI.dry ? [] : await pickCards({title:`${name}: return up to ${n} ${m[2]} cards`, cards:list, min:0, max:n}); (ids || []).forEach(id => moveCard(id, 'hand')); commit(); return true; }
  // Ribtruss Roaster
  if ((m = l.match(/^they have ["“](.+?)["”]$/)) && (ctx.lastTok || []).length){ const q = m[1].replace(new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), 'this token'); (ctx.lastTok || []).forEach(id => { const c = S.bf.find(x => x.id === id); if (!c) return; const a = info(c.k); const k2 = c.k + '|r23k' + norm(q).slice(0, 30); if (!DICT.has(k2)) DICT.set(k2, {...a, k:k2, o:((a.o || '') + '\n' + q).trim()}); c.k = k2; }); commit(); return true; }
  // Arcum Dagsson
  if ((m = l.match(/^target artifact creature's controller sacrifices it$/))){ const t = tgt(); ctx.r23kArcum = t ? t.pid : null; if (!t) return true; if (t.pid === MYPID){ const c = S.bf.find(x => x.id === t.id); if (c) sacrificeOne(c); } else sendRq(t.pid, 'r23kSacThis', 0, name, {tid:t.id}); commit(); return true; }
  if ((m = l.match(/^that player may search their library for an? (noncreature artifact) card, put it onto the battlefield(?:, then shuffle)?$/)) && ctx.r23kArcum !== undefined){ const pid = ctx.r23kArcum; if (!pid) return true; if (pid === MYPID){ if (UI.dry || await askYes(`${name}: search for a ${m[1]} card?`)) await searchLibrary(`a ${m[1]} card`, 'put it onto the battlefield, then shuffle', ctx); } else sendRq(pid, 'r23kSearch', 0, name, {d:`a ${m[1]} card`}); commit(); return true; }
  // attaching equipment
  if ((m = l.match(/^attach target equipment(?: you control)? to target creature$/)) || (m = l.match(/^attach up to one target equipment you control to target attacking creature$/))){ const e = tgt(); const t = tgt(); if (e && t){ const c = boardOf(e.pid).find(x => x.id === e.id); if (e.pid === MYPID && c){ c.att = {pid:t.pid, id:t.id}; log(`${name}: attached ${cname(c)} to ${t.nm}`); } else if (c) sendRq(e.pid, 'r23kAttach', 0, name, {tid:e.id, d:t.pid, ref:String(t.id)}); } commit(); return true; }
  if ((m = l.match(/^attach any number of target equipment to it$/))){ const c0 = src(); const all = []; let g; while (ctx.tgts && (g = nextTargets(ctx)).length) all.push(...g); all.forEach(e => { if (!c0) return; if (e.pid === MYPID){ const c = S.bf.find(x => x.id === e.id); if (c) c.att = {pid:MYPID, id:c0.id}; } else sendRq(e.pid, 'r23kAttach', 0, name, {tid:e.id, d:MYPID, ref:String(c0.id)}); }); commit(); return true; }
  // Bulwark Ox / Iroh
  if ((m = l.match(/^(?:each )?creatures? you control with (?:a counter|counters) on (?:it|them) gains? ([a-z0-9 ,]+?) until end of turn$/))){ const kw = r23kKws(m[1]); S.bf.filter(c => isCreatureCard(c) && !c.fd && ((c.cp || 0) + (c.cm || 0) + Object.values(c.nc || {}).reduce((a, b) => a + b, 0)) > 0).forEach(c => { c.ekw = [...new Set([...(c.ekw || []), ...kw])]; }); commit(); return true; }
  // Shakedown Heavy
  if ((m = l.match(/^(?:target|defending) player may have you draw a card$/))){ const pid = (ctx.it && ctx.it.evDp) || ((tgt() || {}).pid); ctx.r23kTheyDid = pid && pid !== MYPID ? await r22ask(pid, `let ${nameOf(MYPID)} draw a card? (${name} then untaps and leaves combat)`, name) : false; if (ctx.r23kTheyDid){ draw(1); log(`${nameOf(pid)} had them draw a card`); } commit(); return true; }
  if ((m = l.match(/^if they do, untap ~ and remove it from combat$/))){ const c = src(); if (ctx.r23kTheyDid && c){ c.tap = false; c.atk = ''; log(`${name} untapped and removed from combat`); } commit(); return true; }
  // Sigarda's Splendor
  if ((m = l.match(/^draw a card if your life total is greater than or equal to the last noted life total for ~$/))){ const c = src(); const noted = c && c.r23kNote != null ? c.r23kNote : null; if (noted != null && S.life >= noted) draw(1); else if (noted == null) log(`${name}: no life total noted`); commit(); return true; }
  if ((m = l.match(/^(?:then )?note your life total$/))){ const c = src(); if (c){ c.r23kNote = S.life; log(`${name}: noted life total ${S.life}`); } commit(); return true; }
  // The Aesir Escape Valhalla
  if ((m = l.match(/^exile a permanent card from your graveyard$/))){ const list = S.gy.filter(c => !/\b(Instant|Sorcery)\b/.test(info(c.k)?.t || '')); const ids = list.length <= 1 ? list.map(c => c.id) : UI.dry ? [list[0].id] : await pickCards({title:`${name}: exile a permanent card from your graveyard`, cards:list, min:1, max:1}); const c = ids && ids[0] != null ? S.gy.find(x => x.id === ids[0]) : null; if (c){ moveCard(c.id, 'ex'); ctx.lastT = [{t:'card', pid:MYPID, id:c.id, k:c.k}]; ctx.lastMV = r23kMv(c.k); const sc = src(); if (sc) sc.r23kEx = c.id; } commit(); return true; }
  if ((m = l.match(/^put a number of \+1\/\+1 counters on target creature you control equal to the mana value of the exiled card$/))){ const sc = src(); const e = sc && sc.r23kEx != null ? S.ex.find(x => x.id === sc.r23kEx) : null; const n = e ? r23kMv(e.k) : 0; const t = tgt(); if (t && n) applyTo(t, {op:'ctr', n, src:name, d:'cp'}); commit(); return true; }
  if ((m = l.match(/^return ~ and the exiled card to their owner's hand$/))){ const sc = src(); const e = sc && sc.r23kEx != null ? S.ex.find(x => x.id === sc.r23kEx) : null; if (e) moveCard(e.id, 'hand'); if (sc) moveCard(sc.id, 'hand'); commit(); return true; }
  // Canoptek Wraith / Killer Service
  if ((m = l.match(/^pay (\{\d+\}) and sacrifice (it|~|a token)$/))){ ctx.didPay = false; const plan = payPlan(parseCost(m[1]), S.pool); const c = /token/.test(m[2]) ? null : src(); const toks = /token/.test(m[2]) ? S.bf.filter(x => x.tok && !x.emb) : []; if (plan.err || (/token/.test(m[2]) ? !toks.length : !c)){ log(`${name}: can't pay`); return true; } if (UI.dry){ ctx.didPay = true; return true; }
    let victim = c; if (!victim){ const ids = toks.length === 1 ? [toks[0].id] : await pickCards({title:`${name}: sacrifice a token`, cards:toks, min:1, max:1}); victim = ids && S.bf.find(x => x.id === ids[0]); } if (!victim) return true; S.pool = plan.pool; sacrificeOne(victim); ctx.didPay = true; ctx.mayYes = true; commit(); return true; }
  if ((m = l.match(/^choose a land you control$/)) && /same name as the chosen land/.test(full)){ const list = S.bf.filter(c => isLand(c.k) && !c.fd); const ids = list.length <= 1 || UI.dry ? list.slice(0, 1).map(c => c.id) : await pickCards({title:`${name}: choose a land you control`, cards:list, min:1, max:1}); ctx.r23kLand = ids && ids[0] != null ? S.bf.find(x => x.id === ids[0]) : null; return true; }
  if ((m = l.match(/^(?:then )?search your library for up to two basic land cards which have the same name as the chosen land, put them onto the battlefield tapped, then shuffle$/))){ const nm = ctx.r23kLand ? cname(ctx.r23kLand) : null; if (!nm){ shuffleLib(); return true; } const list = S.lib.filter(c => cname(c) === nm && /Basic/.test(info(c.k)?.t || '')); const ids = UI.dry ? [] : await pickCards({title:`${name}: search for up to two ${nm}`, cards:list, min:0, max:2, noneLabel:'Find nothing'}); (ids || []).forEach(id => { moveCard(id, 'bf', {quiet:true}); const c = S.bf.find(x => x.id === id); if (c) c.tap = true; }); shuffleLib(); commit(); return true; }
  // Sarkhan, Dragon Ascendant
  if ((m = l.match(/^behold an? ([a-z]+)$/))){ const d = m[1]; const has = S.hand.concat(S.bf).filter(c => descOk(c.k, d)); ctx.didPay = !!has.length; if (has.length) log(`${name}: beheld ${cname(has[0])}`); else log(`${name}: no ${d} to behold`); return true; }
  if ((m = l.match(/^until end of turn, ~ becomes an? ([a-z]+) in addition to (?:his|her|its) other types and gains (flying|haste|trample)$/))){ const c = src(); if (c){ c.r23kType = cap(m[1]); c.r23kTypeT = turnStr(); c.ekw = [...new Set([...(c.ekw || []), m[2]])]; } commit(); return true; }
  // World War Hulk
  if ((m = l.match(/^the next (red or green creature|creature|instant or sorcery) spell you cast this turn can be cast without paying its mana cost$/))){ S.r23kFreeNext = {t:turnStr(), desc:m[1]}; log(`${name}: the next ${m[1]} spell this turn is free`); commit(); return true; }
  if ((m = l.match(/^until end of turn, double its power and toughness and it gains (trample|flying|haste)$/))){ const t = ctx.r23kChosen || (ctx.lastT || [])[0]; const st = t ? statsAny(t) : null; if (t && st) pumpT(t, Math.max(0, st[0]), Math.max(0, st[1]), [m[1]]); commit(); return true; }
  // Time Spiral
  if ((m = l.match(/^(?:then )?you untap up to (six|three|two|four|five|\d+) lands$/))){ const n = wn(m[1]) || +m[1]; const list = S.bf.filter(c => isLand(c.k) && c.tap).slice(0, n); list.forEach(c => { c.tap = false; }); log(`${name}: untapped ${list.length} lands`); commit(); return true; }
  // Rust Elemental
  if ((m = l.match(/^if you can't, tap ~ and you lose (\d+) life$/))){ const c = src(); if (ctx.didPay === false || ctx.r23kCant){ if (c) c.tap = true; S.life -= +m[1]; log(`${name}: tapped, lost ${m[1]} life → ${S.life}`); } commit(); return true; }
  // Surge of Brilliance
  if ((m = l.match(/^draw a card for each spell you've cast this turn from anywhere other than your hand$/))){ const t = turnStr(); const n = (S.castHist || []).filter(h => h.t === t && h.z && h.z !== 'hand').length; if (n) draw(n); log(`${name}: drew ${n}`); commit(); return true; }
  // Coveted Prize
  if ((m = l.match(/^if you have a full party, (.+)$/))){ if (r23kParty() >= 4) await say(tail(m[1])); else log(`${name}: no full party`); return true; }
  // Cone of Cold
  if ((m = l.match(/^tap all creatures your opponents control$/))){ for (const p of opponents()) sendRq(p.pid, 'r23kTapAll', 0, name, {d:'creature'}); ctx.r23kTapOpps = true; commit(); return true; }
  if ((m = l.match(/^those creatures don't untap during their controllers' next untap steps?$/)) && ctx.r23kTapOpps){ for (const p of opponents()) sendRq(p.pid, 'r23kTapAll', 1, name, {d:'creature'}); commit(); return true; }
  // Underdark Rift
  if ((m = l.match(/^put target (.+?) into its owner's library just beneath the top x cards of that library, where x is the result$/))){ const t = tgt(); const x = ctx.roll || (1 + Math.floor(Math.random() * 10)); if (t) r22applyLib(t, x, name, false); commit(); return true; }
  // Space-Time Anomaly
  if ((m = l.match(/^target player mills cards equal to your life total$/))){ const t = tgt(); const n = Math.max(0, S.life); if (!t) return true; if (t.pid === MYPID) mill(n); else sendRq(t.pid, 'mill', n, name); commit(); return true; }
  // Profane Transfusion
  if ((m = l.match(/^two target players exchange life totals$/))){ const a = tgt(), b = tgt(); const ps = [a, b].filter(Boolean); if (ps.length < 2) return true; const life = pid => pid === MYPID ? S.life : (OPP.get(pid)?.life || 0); const la = life(ps[0].pid), lb = life(ps[1].pid); ctx.r23kDiff = Math.abs(la - lb); [[ps[0].pid, lb - la], [ps[1].pid, la - lb]].forEach(([pid, d]) => { if (!d) return; if (pid === MYPID){ S.life += d; log(`life total becomes ${S.life}`); } else sendRq(pid, 'life', d, name); }); commit(); return true; }
  // Bazaar Trader
  if ((m = l.match(/^target player gains control of target (.+?) you control$/))){ const p = tgt(); const t = tgt(); if (p && t && p.pid !== MYPID){ const c = S.bf.find(x => x.id === t.id); if (c) giveAway(single(c), p.pid, {}); } commit(); return true; }
  // Whiptongue Hydra
  if ((m = l.match(/^destroy all creatures with flying$/)) && /for each creature destroyed this way/.test(full)){ const list = r23kCards(null, (c, pid) => isCreatureCard(c) && kwOf(c, 'flying', pid)); ctx.r23kKilled = list.filter(t => !kwOf(t.c, 'indestructible', t.pid)).length; list.forEach(t => applyTo(t, {op:'destroy', src:name})); commit(); return true; }
  if ((m = l.match(/^put a \+1\/\+1 counter on ~ for each creature destroyed this way$/))){ const c = src(); const n = ctx.r23kKilled || 0; if (c && n) modCounters(c, 'cp', n); commit(); return true; }
  // Ring of Xathrid
  if ((m = l.match(/^regenerate equipped creature$/))){ const c0 = src(); if (c0 && c0.att) applyTo({t:'card', pid:c0.att.pid, id:c0.att.id}, {op:'regen', src:name}); commit(); return true; }
  if ((m = l.match(/^put a \+1\/\+1 counter on equipped creature if it's (black|white|blue|red|green)$/))){ const c0 = src(); const h = c0 && c0.att ? boardOf(c0.att.pid).find(x => x.id === c0.att.id) : null; if (h && new RegExp(COLW[m[1]] || 'B').test(info(h.k)?.c || '')) applyTo({t:'card', pid:c0.att.pid, id:h.id}, {op:'ctr', n:1, src:name, d:'cp'}); commit(); return true; }
  // Meteor Crater
  if ((m = l.match(/^choose a color of a permanent you control$/))){ const cols = new Set(); S.bf.forEach(c => String(info(c.k)?.c || '').replace(/[^WUBRG]/g, '').split('').forEach(x => cols.add(x))); const list = [...cols]; ctx.r23kCol = !list.length ? null : list.length === 1 || UI.dry ? list[0] : await askChoice({title:`${name}: choose a color`, options:list.map(x => ({label:MNAME[x] || x, value:x}))}); return true; }
  if ((m = l.match(/^add one mana of that color$/)) && ctx.r23kCol !== undefined){ if (ctx.r23kCol){ addMana([ctx.r23kCol]); log(`added {${ctx.r23kCol}}`); } commit(); return true; }
  // Great Intelligence's Plan (villainous choice)
  if ((m = l.match(/^target opponent faces a villainous choice — they discard (three|two|a|\d+) cards?, or you may cast a spell from your hand without paying its mana cost$/))){ const t = tgt(); const pid = t && t.pid !== MYPID ? t.pid : (opponents()[0] || {}).pid; if (!pid) return true; const n = wn(m[1]) || 1;
    const disc = await r22ask(pid, `villainous choice: discard ${n} card${n > 1 ? 's' : ''}? (No = ${nameOf(MYPID)} may cast a spell from hand for free)`, name);
    if (disc){ sendRq(pid, 'discard', n, name); log(`${nameOf(pid)} chose to discard ${n}`); } else { log(`${nameOf(pid)} lets them cast a free spell`); await say('You may cast a spell from your hand without paying its mana cost'); } commit(); return true; }

  // ---- batch 6 ----
  // d20 tables: "1—9 | …" lines
  if ((m = s.match(/^(\d+)(?:—(\d+))? \| ([\s\S]+)$/))){ const lo = +m[1], hi = m[2] ? +m[2] : +m[1]; const r = ctx.roll;
    const pre = m[1] + (m[2] ? '—' + m[2] : '') + ' | '; const row = tname(info(ctx.k)?.o || '', name).split('\n').map(x => x.trim()).find(x => x.startsWith(pre)); let parts = m[3].split(/(?<=\.)\s+(?=[A-Z~])/);
    if (row){ const all = row.slice(pre.length).split(/(?<=\.)\s+(?=[A-Z~])/); if (all.length > parts.length){ ctx.r23kRowSkip = (ctx.r23kRowSkip || []).concat(all.slice(parts.length).map(x => x.replace(/\.$/, '').trim().toLowerCase())); parts = all; } }
    if (r == null && !UI.dry){ log(`${name}: no roll — skipped ${pre.trim()}`); return true; }
    if (UI.dry || r == null || (r >= lo && r <= hi)){ for (const part of parts) await doSentence(part, ctx); } return true; }
  if ((m = l.match(/^roll a d(\d+)(?: for each player being attacked and ignore all but the highest roll)?$/))){ const n = /for each player being attacked/.test(l) ? Math.max(1, new Set(S.bf.filter(c => c.atk).map(c => String(c.atk).split(':')[1])).size) : 1; let r = 0; for (let i = 0; i < n; i++) r = Math.max(r, 1 + Math.floor(Math.random() * +m[1])); ctx.roll = r; log(`🎲 ${name}: rolled a ${r} (d${m[1]})`); emit({type:'roll', x:r, cnt:1});
    const o = tname(info(ctx.k)?.o || '', name); if (!/\n\d+(?:—\d+)? \|/.test(String(ctx.full || ''))){ const rows = o.split('\n').map(x => x.trim()).filter(x => /^\d+(?:—\d+)? \| /.test(x)); for (const row of rows) await doSentence(row, ctx); } return true; }
  // Through the Forest Gate
  if ((m = l.match(/^look at the top (twenty|ten|\w+) cards of your library, put any number of (land) cards from among them onto the battlefield tapped$/))){ const n = wn(m[1]) || 20; const top = S.lib.slice(0, n); const list = top.filter(c => isLand(c.k)); const ids = UI.dry || !list.length ? [] : await pickCards({title:`${name}: put any number of lands onto the battlefield tapped`, cards:list, min:0, max:99, noneLabel:'None'}); (ids || []).forEach(id => { moveCard(id, 'bf', {quiet:true}); const c = S.bf.find(x => x.id === id); if (c) c.tap = true; }); log(`${name}: put ${(ids || []).length} lands onto the battlefield`); commit(); return true; }
  // Sapling of Colfenor
  if ((m = l.match(/^reveal the top card of your library$/)) && /if it's a creature card, you gain life equal to that card's toughness, lose life equal to its power/.test(full)){ ctx.r23kTop = S.lib[0] || null; if (ctx.r23kTop) log(`${name}: revealed ${cname(ctx.r23kTop)}`); return true; }
  if ((m = l.match(/^if it's a creature card, you gain life equal to that card's toughness, lose life equal to its power, then put it into your hand$/)) || (m = l.match(/^if it's a creature card, you gain life equal to that card's toughness, lose life equal to its power$/))){ const c = ctx.r23kTop || S.lib[0]; if (c && isCreatureCard(c)){ const pt = ptOf(faceOf(c)) || [0, 0]; if (pt[1] > 0 && gainLife(pt[1], name)) log(`gained ${pt[1]} life`); if (pt[0] > 0){ S.life -= pt[0]; log(`lost ${pt[0]} life → ${S.life}`); } moveCard(c.id, 'hand'); ctx.r23kSapDone = true; } commit(); return true; }
  if (/^put it into your hand$/.test(l) && ctx.r23kSapDone) return true;
  // Chrome Dome
  if ((m = l.match(/^create a token that's a copy of another target (artifact|creature|enchantment) you control$/))){ const t = tgt(); if (!t) return true; const before = new Set(S.bf.map(x => x.id)); createToken(t.k, 1, null, {}); ctx.lastTok = S.bf.filter(x => !before.has(x.id)).map(x => x.id); commit(); return true; }
  if ((m = l.match(/^that token gains haste$/)) && (ctx.lastTok || []).length){ ctx.lastTok.forEach(id => { const c = S.bf.find(x => x.id === id); if (c) c.ekw = [...new Set([...(c.ekw || []), 'haste'])]; }); commit(); return true; }
  // Hostile Negotiations
  if ((m = l.match(/^exile the top three cards of your library in (?:a|another) face-down pile$/))){ const pile = S.lib.splice(0, 3); pile.forEach(c => { c.fd = true; S.ex.push(c); }); (ctx.r23kPiles ||= []).push(pile); log(`${name}: exiled ${pile.length} cards in a face-down pile`); commit(); return true; }
  if (/^look at the cards in each pile$/.test(l) && ctx.r23kPiles){ log(`${name}: piles — ${ctx.r23kPiles.map((p, i) => 'pile ' + (i + 1) + ': ' + p.map(cname).join(', ')).join(' / ')}`); return true; }
  if ((m = l.match(/^(?:then )?turn a pile of your choice face up$/)) && ctx.r23kPiles){ const ps = ctx.r23kPiles; ctx.r23kUp = UI.dry || ps.length < 2 ? 0 : await askChoice({title:`${name}: turn which pile face up?`, options:ps.map((p, i) => ({label:`Pile ${i + 1}: ${p.map(cname).join(', ')}`, value:i}))}); (ps[ctx.r23kUp || 0] || []).forEach(c => { c.fd = false; }); log(`${name}: turned pile ${(ctx.r23kUp || 0) + 1} face up — ${(ps[ctx.r23kUp || 0] || []).map(cname).join(', ')}`); commit(); return true; }
  if ((m = l.match(/^an opponent chooses one of those piles$/)) && ctx.r23kPiles){ const ps = ctx.r23kPiles; const up = ctx.r23kUp || 0; const opp = opponents()[0]; let pick = up; if (opp && ps.length === 2){ const yes = await r22ask(opp.pid, `choose the face-up pile (${ps[up].map(cname).join(', ')}) for ${nameOf(MYPID)}'s hand? No = the face-down pile`, name); pick = yes ? up : 1 - up; } ctx.r23kPick = pick; log(`${opp ? opp.nm : 'opponent'} chose pile ${pick + 1}`); return true; }
  if ((m = l.match(/^put that pile into your hand and the other into your graveyard$/)) && ctx.r23kPiles){ ctx.r23kPiles.forEach((p, i) => p.forEach(c => { const j = S.ex.indexOf(c); if (j < 0) return; S.ex.splice(j, 1); c.fd = false; (i === (ctx.r23kPick || 0) ? S.hand : S.gy).push(c); })); commit(); return true; }
  // Vile Mutilator (second half after ", then")
  if ((m = l.match(/^sacrifices an? (nontoken [a-z]+|[a-z]+) of their choice$/))){ for (const p of opponents()) sendRq(p.pid, 'sac', 1, name, {d:m[1]}); commit(); return true; }
  // Dictate of Karametra
  if ((m = l.match(/^(?:that|target) player adds one mana of any type that land produced$/))){ const pid = (ctx.it && ctx.it.evPid) || MYPID; const k = ctx.it && (ctx.it.evK || ctx.it.evk); if (pid === MYPID) await r23kLandMana(k, name); else sendRq(pid, 'r23kLandMana', 0, name, {d:k || ''}); commit(); return true; }
  // "~ deals N damage to that player" (Burning Earth)
  if ((m = l.match(/^~ deals (\d+) damage to that player$/))){ const pid = ctx.it && (ctx.it.evPid || ctx.it.evDp); if (pid) dealDamage({t:'player', pid}, +m[1], ctx.k, src()); commit(); return true; }
  // Ballad of the Black Flag
  if ((m = l.match(/^mill three cards$/)) && /put a historic card from among them into your hand/.test(full)){ ctx.r23kMilled = S.lib.slice(0, 3); mill(3); return true; }
  if ((m = l.match(/^put a historic card from among them into your hand$/))){ const list = (ctx.r23kMilled || []).filter(c => S.gy.includes(c) && r23kHistoric(c.k)); const ids = UI.dry || !list.length ? [] : await pickCards({title:`${name}: put a historic card into your hand`, cards:list, min:0, max:1, noneLabel:'None'}); (ids || []).forEach(id => moveCard(id, 'hand')); commit(); return true; }
  if ((m = l.match(/^historic spells you cast this turn cost \{(\d+)\} less to cast$/))){ S.r23kHistDisc = {t:turnStr(), n:+m[1]}; log(`${name}: historic spells cost {${m[1]}} less this turn`); commit(); return true; }
  // Teysa, Envoy of Ghosts
  if ((m = l.match(/^destroy that creature$/)) && ctx.it && ctx.it.evId != null && ctx.it.evPid && /whenever a creature deals combat damage to you, destroy that creature/i.test(info(ctx.k)?.o || '')){ applyTo({t:'card', pid:ctx.it.evPid, id:ctx.it.evId}, {op:'destroy', src:name}); commit(); return true; }

  if ((m = l.match(/^~ deals damage equal to its power to (you|defending player|each opponent)$/))){ const c = src(); const n = c ? Math.max(0, (stats(c) || [0])[0]) : 0; if (!n) return true; const pids = m[1] === 'you' ? [MYPID] : m[1] === 'each opponent' ? opponents().map(p => p.pid) : [(ctx.it && ctx.it.evDp) || (c && c.atk && String(c.atk).split(':')[1]) || (opponents()[0] || {}).pid].filter(Boolean); pids.forEach(pid => dealDamage({t:'player', pid}, n, ctx.k, c)); commit(); return true; }

  // tokens counted from last-known power / creatures sacrificed this way
  if ((m = s.match(/^create a number of (.+? tokens?) equal to (?:~|this creature)'s power$/i))){ const c = src(); const id = c ? c.id : (ctx.it && ctx.it.evId); const lk = id != null && S.r19lk ? S.r19lk[id] : null; const n = c && S.bf.includes(c) ? Math.max(0, (stats(c) || [0])[0]) : Math.max(0, (lk || [ptOf(info(ctx.k)) ? ptOf(info(ctx.k))[0] : 0])[0]); if (!n){ log(`${name}: power 0 — no tokens`); return true; } await createFromText(`Create ${n} ${m[1].replace(/^(a|an|one) /i, '')}`, ctx); return true; }
  if ((m = l.match(/^each opponent sacrifices a creature of their choice$/)) && /create (?:a|an) .+? token for each creature sacrificed this way/.test(full)){ ctx.r23kSacBefore = {}; for (const p of opponents()){ ctx.r23kSacBefore[p.pid] = (OPP.get(p.pid)?.bf || []).filter(c => c.k && isCreatureCard(c)).length; sendRq(p.pid, 'sac', 1, name, {d:'creature'}); } commit(); return true; }
  if ((m = s.match(/^create (?:a|an) (.+?) token for each creature sacrificed this way$/i)) && ctx.r23kSacBefore){ const n = Object.values(ctx.r23kSacBefore).filter(x => x > 0).length; if (n) await createFromText(`Create ${n} ${m[1]} tokens`, ctx); return true; }

  if ((m = l.match(/^until your next turn, creatures your opponents control enter tapped$/))){ for (const p of opponents()) sendRq(p.pid, 'r23kEnterTapped', 0, name, {d:turnStr()}); log(`${name}: until their next turn, opponents' creatures enter tapped`); commit(); return true; }

  // Trail of Mystery
  if ((m = l.match(/^if it's a creature, it gets \+(\d+)\/\+(\d+) until end of turn$/))){ const id = ctx.it && ctx.it.evId; const c = id != null ? S.bf.find(x => x.id === id) : null; if (c && isCreatureCard(c)) applyOp({op:'pump', tid:c.id, src:name, f:{p:+m[1], t:+m[2]}}, MYPID); commit(); return true; }
  // Scalelord Reckoner
  if ((m = l.match(/^destroy target nonland permanent that player controls$/))){ const t = tgt(); const pid = ctx.it && ctx.it.evPid; if (t && (!pid || t.pid === pid)) applyTo(t, {op:'destroy', src:name}); else if (t) log(`${name}: that permanent isn't controlled by the targeting player`); commit(); return true; }

  // Protean Hydra (fires from the counter-removal event)
  if ((m = l.match(/^put two \+1\/\+1 counters on (?:it|~) at the beginning of the next end step$/))){ const c = src(); if (c){ (S.r23kHydra ||= []).push({id:c.id, n:2}); log(`${name}: two +1/+1 counters at the next end step`); } commit(); return true; }
  // Elminster's Simulacrum
  if ((m = l.match(/^for each opponent, you create a token that's a copy of up to one target creature (?:that|target) player controls$/))){ const all = []; let g; while (ctx.tgts && (g = nextTargets(ctx)).length) all.push(...g); for (const t of all) if (t.k) createToken(t.k, 1, null, {}); log(`${name}: created ${all.length} token cop${all.length === 1 ? 'y' : 'ies'}`); commit(); return true; }

  return false;
}
{
  const ds = doSentence;
  doSentence = async function(s0, ctx){ const s = String(s0).replace(/\.$/, '').trim(); const l = s.toLowerCase(); if (l && await doRound23KPre(s, l, ctx)) return; return ds(s0, ctx); };
}

// ---- support for batch 2 ----
function r23kRevealCreature(src){ const rev = []; let hit = null; while (S.lib.length){ const c = S.lib.shift(); if (isCreatureCard(c)){ hit = c; break; } rev.push(c); } if (hit){ S.hand.push(hit); moveCard(hit.id, 'bf', {quiet:true}); log(`${src}: revealed ${rev.length + 1} cards — put ${cname(hit)} onto the battlefield`); } else log(`${src}: no creature card found`); S.lib.push(...rev); commit(); }
function r23kGrind(){ let n = 0; for (let i = 0; i < 60 && S.lib.length; i++){ const two = S.lib.slice(0, 2); mill(2); n += two.length; const cs = two.map(c => String(info(c.k)?.c || '').replace(/[^WUBRG]/g, '')); if (two.length < 2 || ![...'WUBRG'].some(x => cs[0].includes(x) && cs[1].includes(x))) break; } log(`Grindstone: milled ${n} cards`); commit(); }
RQ_OPS.push('r23kTapAll', 'r23kSearch', 'r23kRevC', 'r23kPutHand', 'r23kDrawIfNot', 'r23kSmeagol', 'r23kGrind', 'r23kNamed', 'r23kNoAb', 'r23kNoGain');
{
  const ao = applyOp;
  applyOp = function(r, from){
    const c = r.tid != null ? S.bf.find(b => b.id === r.tid) : null;
    if (r.op === 'r23kTapAll'){ S.bf.filter(x => isCreatureCard(x) && !x.fd).forEach(x => { if (r.n) { if (x.tap) x.skipUntap = 1; } else x.tap = true; }); log(r.n ? `their tapped creatures don't untap next untap step (${r.src})` : `tapped all their creatures (${r.src})`); commit(); return; }
    if (r.op === 'r23kSearch'){ (async () => { if (await askYes(`${r.src}: search your library for ${r.d}?`, 'Search', 'No')) await searchLibrary(String(r.d), `put them onto the battlefield${r.n ? ' tapped' : ''}, then shuffle`, {name:r.src}); commit(); })(); return; }
    if (r.op === 'r23kRevC'){ r23kRevealCreature(r.src); return; }
    if (r.op === 'r23kPutHand'){ (async () => { const list = S.hand.filter(x => descOk(x.k, String(r.d))); let put = false; if (list.length){ const ids = await pickCards({title:`${r.src}: you may put a ${r.d} card onto the battlefield`, cards:list, min:0, max:1, noneLabel:"Don't"}); (ids || []).forEach(id => { moveCard(id, 'bf'); put = true; }); } R23K.put = {t:turnStr(), src:r.src, put}; commit(); })(); return; }
    if (r.op === 'r23kDrawIfNot'){ (async () => { await waitUntil(() => R23K.put && R23K.put.src === r.src && R23K.put.t === turnStr(), 90000); if (!(R23K.put && R23K.put.put)){ draw(1); log(`drew a card (${r.src})`); } commit(); })(); return; }
    if (r.op === 'r23kSmeagol'){ const rev = []; let hit = null; while (S.lib.length){ const x = S.lib.shift(); if (isLand(x.k)){ hit = x; break; } rev.push(x); } S.gy.push(...rev); if (hit){ const ref = rid(6); S.lent.push({ref, to:from, card:hit, perm:true}); sendRq(from, 'give', 0, r.src, {ref, c:{k:hit.k, tap:1}, f:{tap:true}}); } log(`${r.src}: revealed ${rev.length + (hit ? 1 : 0)} cards; ${hit ? cname(hit) + ' goes to ' + nameOf(from) : 'no land'}, the rest into the graveyard`); commit(); return; }
    if (r.op === 'r23kGrind'){ r23kGrind(); return; }
    if (r.op === 'r23kNamed'){ if (c){ addNamed(single(c), String(r.d || 'stun'), r.n || 1); log(`${cname(c)} gets ${r.n || 1} ${r.d} counter${(r.n || 1) > 1 ? 's' : ''} (${r.src})`); } commit(); return; }
    if (r.op === 'r23kNoAb'){ if (c){ const s = single(c); s.r23kNoAb = turnStr(); if (r.f && r.f.p != null){ const st = stats(s) || [0, 0]; s.pu = [(s.pu ? s.pu[0] : 0) + (+r.f.p) - st[0], (s.pu ? s.pu[1] : 0) + (+r.f.t) - st[1]]; } s.ekw = []; log(`${cname(s)} loses all abilities until end of turn${r.f && r.f.p != null ? ` and is ${r.f.p}/${r.f.t}` : ''} (${r.src})`); } commit(); return; }
    if (r.op === 'r23kNoGain'){ S.r23kNoGain = turnStr(); log(`can't gain life this turn (${r.src})`); commit(); return; }
    return ao(r, from);
  };
}
{
  const kw0 = kwOf;
  kwOf = function(c, k, pid){ try { if (c && S && c.r23kNoAb && c.r23kNoAb === turnStr()) return (c.ekw || []).includes(k); } catch {} return kw0(c, k, pid); };
  const cg = canGain;
  canGain = function(){ try { if (S && S.r23kNoGain === turnStr()) return {ok:false, why:"Atarka's Command: you can't gain life this turn"}; } catch {} return cg(); };
  const dm = damageMe;
  damageMe = function(n, f = {}, from){ try { if (S && S.r23kProt){ if (currentTurn()[1] === MYPID && S.r23kProt !== turnStr()) S.r23kProt = null; else { log('damage to me prevented (protection from everything)'); return; } } } catch {} return dm(n, f, from); };
  const sb = sba;
  sba = function(...a){ const r = sb.apply(this, a); try { if (S && S.r23kLost && !S.lost) S.lost = 'lost the game'; } catch {} return r; };
  // cards put into my graveyard from the battlefield this turn (Faith's Reward) and creature deaths (Sméagol)
  const mc = moveCard;
  moveCard = function(id, to, o = {}){ let was = null; try { if (S && to === 'gy'){ const f = find(id); if (f[0] === 'bf') was = f[2]; } } catch {} const r = mc(id, to, o);
    try { if (was){ const t = turnStr(); if (!R23K.bfgy || R23K.bfgy.t !== t) R23K.bfgy = {t, ids:[]}; R23K.bfgy.ids.push(was.id); if (isCreatureCard(was)){ if (!R23K.died || R23K.died.t !== t) R23K.died = {t, n:0}; R23K.died.n++; } } } catch {} return r; };
}

// ---- support for batch 3 ----
RQ_OPS.push('r23kFlicker', 'r23kLock');
{
  const ao = applyOp;
  applyOp = function(r, from){
    const c = r.tid != null ? S.bf.find(b => b.id === r.tid) : null;
    if (r.op === 'r23kFlicker'){ if (c && !c.tok){ moveCard(c.id, 'ex'); (S.r23kBack ||= []).push({id:c.id, tap:r.n ? 1 : 0}); } else if (c) moveCard(c.id, 'gy', {quiet:true}); commit(); return; }
    if (r.op === 'r23kLock'){ if (c){ c.r23kLock = {pid:r.d || from, id:+r.ref}; log(`${cname(c)} doesn't untap while ${nameOf(r.d || from)} controls ${r.src}`); } commit(); return; }
    return ao(r, from);
  };
  // delayed returns at the next end step (Morningtide's Light)
  const fs = fireSteps;
  fireSteps = function(...a){ const r = fs.apply(this, a); try { const [step] = a; if (S && step === 'end' && S.r23kBack && S.r23kBack.length){ const back = S.r23kBack.splice(0); back.forEach(b => { const e = S.ex.find(x => x.id === b.id); if (e){ moveCard(e.id, 'bf'); const n = S.bf.find(x => x.id === e.id); if (n && b.tap) n.tap = true; } }); log(`returned ${back.length} exiled card${back.length === 1 ? '' : 's'} to the battlefield`); commit(); } } catch (e){ console.warn(e); } return r; };
  // Ty Lee: doesn't untap while its controller keeps Ty Lee
  const sp = setPhase;
  setPhase = function(i){ const keep = i === 0 && S ? S.bf.filter(c => c.r23kLock && c.tap).filter(c => { const L = c.r23kLock; const ok = L.pid === MYPID ? S.bf.some(x => x.id === L.id) : (OPP.get(L.pid)?.bf || []).some(x => x.id === L.id); if (!ok) c.r23kLock = null; return ok; }) : []; const r = sp(i); keep.forEach(c => { c.tap = true; }); if (keep.length) log(`${keep.length} creature${keep.length === 1 ? '' : 's'} stayed tapped`); return r; };
  // extra type words (Shadow Puppeteers, Drana)
  const to0 = typeOf;
  typeOf = c => { const t = to0(c); try { if (c && c.r23kType && !new RegExp('\\b' + c.r23kType + '\\b').test(t)) return /—/.test(t) ? t + ' ' + c.r23kType : t + ' — ' + c.r23kType; } catch {} return t; };
}

// ---- support for batch 4 ----
async function r23kNamedToken(pid, m, ctx){
  const n = wn(m[1]) || 1; const nm = m[5].trim(); const q = m[6].replace(new RegExp(String(ctx.name || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), 'this token');
  const sup = (m[3] || '').toLowerCase(); const ty = (m[4] || 'artifact ').trim();
  const k0 = customToken(nm, '', ''); const k = k0 + '|r23k' + norm(nm + q).slice(0, 40);
  if (!DICT.has(k)) DICT.set(k, {...DICT.get(k0), k, n:nm, t:'Token ' + (/legendary/.test(sup) ? 'Legendary ' : '') + (/snow/.test(sup) ? 'Snow ' : '') + cap(ty), o:q, p:''});
  createToken(k, n * tokenMult(k), null, {tapped:!!m[2]}); commit();
}
function r23kParty(){ const roles = ['Cleric', 'Rogue', 'Warrior', 'Wizard']; const cs = S.bf.filter(c => isCreatureCard(c) && !c.fd).map(c => typeOf(c)); const used = new Set(); let n = 0;
  const tryAssign = (i) => { if (i === roles.length) return 0; let best = tryAssign(i + 1); cs.forEach((t, j) => { if (!used.has(j) && new RegExp('\\b' + roles[i] + '\\b').test(t)){ used.add(j); best = Math.max(best, 1 + tryAssign(i + 1)); used.delete(j); } }); return best; };
  n = tryAssign(0); return n; }
function r23kJar(src){ const h = S.hand.splice(0); h.forEach(c => { c.fd = true; S.ex.push(c); }); (S.r23kJar ||= []).push(...h.map(c => c.id)); log(`${src}: exiled their hand face down (${h.length})`); draw(7); commit(); }
async function r23kGrandeur(src){ const cmd = S.cz.concat(S.bf.filter(c => c.cmd)); const n = Math.max(0, ...cmd.map(c => r23kMv(c.k))); if (UI.dry) return; if (!(await askYes(`${src}: discard your hand and draw ${n} card${n === 1 ? '' : 's'}?`, 'Discard and draw', 'Keep my hand'))) return; S.hand.slice().forEach(c => moveCard(c.id, 'gy', {quiet:true})); log(`${src}: discarded their hand`); if (n) draw(n); commit(); }
RQ_OPS.push('r23kTokGoad', 'r23kJar', 'r23kGrandeur', 'r23kSacThis', 'r23kAttach');
{
  const ao = applyOp;
  applyOp = function(r, from){
    const c = r.tid != null ? S.bf.find(b => b.id === r.tid) : null;
    if (r.op === 'r23kTokGoad'){ (async () => { const before = new Set(S.bf.map(x => x.id)); await createFromText('Create ' + String(r.d || ''), {name:r.src, k:null, it:{}}); S.bf.filter(x => !before.has(x.id)).forEach(x => { x.goad = {by:from, n:1e6}; }); log(`the new tokens are goaded for the rest of the game (${r.src})`); commit(); })(); return; }
    if (r.op === 'r23kJar'){ r23kJar(r.src); return; }
    if (r.op === 'r23kGrandeur'){ r23kGrandeur(r.src); return; }
    if (r.op === 'r23kSacThis'){ if (c) sacrificeOne(single(c)); commit(); return; }
    if (r.op === 'r23kAttach'){ if (c){ c.att = {pid:r.d || from, id:+r.ref}; log(`${cname(c)} was attached (${r.src})`); } commit(); return; }
    return ao(r, from);
  };
  const fs = fireSteps;
  fireSteps = function(...a){ const r = fs.apply(this, a); try { const [step] = a; if (S && step === 'end' && S.r23kJar && S.r23kJar.length){ const ids = S.r23kJar.splice(0); S.hand.slice().forEach(x => moveCard(x.id, 'gy', {quiet:true})); ids.forEach(id => { const e = S.ex.find(x => x.id === id); if (e){ S.ex.splice(S.ex.indexOf(e), 1); e.fd = false; S.hand.push(e); } }); log(`Memory Jar: discarded their hand and returned ${ids.length} exiled cards to hand`); commit(); } } catch (e){ console.warn(e); } return r; };
  // free casts: Yusri (all spells from hand this turn), World War Hulk (next matching creature spell)
  const bc = beginCast;
  beginCast = async function(c, zone, o, ...rest){
    try { if (S && c && c.k && !(o && o.free) && !UI.dry){
      if (S.r23kFreeNext && S.r23kFreeNext.t === turnStr() && descOk(c.k, S.r23kFreeNext.desc)){ const d = S.r23kFreeNext; S.r23kFreeNext = null; if (await askYes(`Cast ${cname(c)} without paying its mana cost?`, 'Free', 'Pay normally')) return bc.call(this, c, zone, {...(o || {}), free:true}, ...rest); S.r23kFreeNext = d; }
      else if (S.r23kFreeHand === turnStr() && zone === 'hand' && await askYes(`Cast ${cname(c)} without paying its mana cost (Yusri)?`, 'Free', 'Pay normally')) return bc.call(this, c, zone, {...(o || {}), free:true}, ...rest);
    } } catch {}
    return bc.call(this, c, zone, o, ...rest);
  };
  // types added until end of turn wear off
  const tc = turnChanged;
  turnChanged = function(...a){ try { if (S) S.bf.forEach(c => { if (c.r23kType && c.r23kTypeT && c.r23kTypeT !== turnStr()){ c.r23kType = null; c.r23kTypeT = null; } }); } catch {} return tc.apply(this, a); };
}

// ---- batch 5: static abilities ----
STATIC_RULES.push(
  [/^you may cast (merfolk|historic|elf|goblin|dragon|wizard) spells as though they had flash$/, m => ({kind:'r23kFlash', who:'you', desc:m[1]})],
  [/^you can't cast (creature|noncreature|artifact) spells$/, m => ({kind:'r23kNoCast', who:'you', desc:m[1]})],
  [/^activated abilities of artifacts, creatures, and planeswalkers can't be activated$/, m => ({kind:'noAbil', who:'all', type:'(?:Artifact|Creature|Planeswalker)'})],
  [/^creatures can't block$/, m => ({kind:'r23kNoBlock', who:'all'})],
  [/^players can't untap more than one creature during their untap steps$/, m => ({kind:'r23kSmoke', who:'all'})],
  [/^~ gets \+(\d+)\/\+(\d+) as long as there are (seven|\w+) or more cards in your graveyard$/, m => ({kind:'r23kThresh', who:'you'})],
  [/^other creatures you control get \+(\d+)\/\+(\d+) as long as you've completed a dungeon$/, m => ({kind:'r23kDungeon', who:'you'})],
  [/^creatures you control can't have -1\/-1 counters put on them$/, m => ({kind:'r23kNoMinus', who:'you'})],
  [/^you can't win the game and your opponents can't lose the game$/, m => ({kind:'r23kPersecutor', who:'opp'})],
  [/^you don't lose the game for having 0 or less life$/, m => ({kind:'r23kUnlife', who:'you'})],
  [/^as long as you have 0 or less life, all damage is dealt to you as though its source had infect$/, m => ({kind:'r23kUnlife2', who:'you'})],
  [/^~ is also an? ([a-z]+(?:, [a-z]+)*,? and [a-z]+)$/, m => ({kind:'r23kAlso', who:'you'})],
  [/^each land card in your hand has cycling \{([wubrg\d])\}$/, m => ({kind:'r23kLandCycle', who:'you', cost:m[1].toUpperCase()})],
  [/^other creatures have base power and toughness (\d+)\/(\d+) and are ([a-z]+)s in addition to their other types$/, m => ({kind:'r23kBase', who:'all', p:+m[1], t:+m[2], ty:cap(m[3])})],
  [/^if ~ would be put into a graveyard from anywhere, reveal ~ and shuffle it into its owner's library instead$/, m => ({kind:'noop'})],
  [/^if damage would be dealt to ~, prevent that damage and remove that many \+1\/\+1 counters from it$/, m => ({kind:'noop'})],
  [/^if a nontoken creature an opponent controls would die, instead exile that card and create a 2\/2 black zombie creature token$/, m => ({kind:'dieEx', who:'opp', nontoken:true, r23kZombie:true})],
  [/^as long as you're the monarch, damage doesn't cause you to lose life$/, m => ({kind:'r23kMonarchShield', who:'you'})],
  [/^if one or more tokens would be created under your control, those tokens plus an? (.+? token) are created instead$/, m => ({kind:'r23kPlusTok', who:'you', tok:m[1]})],
  [/^you may activate equip abilities any time you could cast an instant$/, m => ({kind:'r23kEquipFlash', who:'you'})],
);
STATIC_KNOWN.push(/^artifact landcycling \{\d+\}$/);
function r23kHistoric(k){ const t = info(k)?.t || ''; return /\b(Legendary|Artifact|Saga)\b/.test(t); }
{
  const to = timingOk;
  timingOk = function(c){ const r = to(c); try { if (r && !r.ok && phaseNow().n > 0 && !/split second/i.test(r.why || '') && c && c.k && rulesOn('r23kFlash').some(x => x.desc === 'historic' ? r23kHistoric(c.k) : descOk(c.k, x.desc))) return {ok:true}; } catch {} return r; };
  const cc = castCheck;
  castCheck = function(c, zone){ try { if (S && c && c.k && !isLand(c.k)){ const r = rulesOn('r23kNoCast').find(x => descOk(c.k, x.desc)); if (r) return {ok:false, why:`${r.src}: you can't cast ${r.desc} spells`}; } } catch {} return cc(c, zone); };
  const cb = canBlock;
  canBlock = function(b, a, apid){ try { const r = S && rulesOn('r23kNoBlock')[0]; if (r) return `can't block (${r.src})`; } catch {} return cb(b, a, apid); };
  const ar = abilityReady;
  abilityReady = function(c, ab, mana){ try { if (ab && ab.equip && ab.sorc && rulesOn('r23kEquipFlash').length) return ar(c, {...ab, sorc:false}, mana); } catch {} return ar(c, ab, mana); };
  // Smoke: one creature untaps
  const sp = setPhase;
  setPhase = function(i){
    if (i !== 0 || !S || UI.dry || !rulesOn('r23kSmoke').length) return sp(i);
    const snap = S.bf.filter(c => isCreatureCard(c) && c.tap).map(c => c);
    const r = sp(i);
    try { const up = snap.filter(c => S.bf.includes(c) && !c.tap); if (up.length > 1){ up.forEach(c => { c.tap = true; }); log(`Smoke: only one creature untaps`); (async () => { const ids = await pickCards({title:'Smoke: untap one creature', cards:up, min:1, max:1}); const c = ids && S.bf.find(x => x.id === ids[0]); if (c){ c.tap = false; log(`untapped ${cname(c)}`); } commit(); })(); commit(); } } catch (e){ console.warn(e); }
    return r;
  };
  // threshold / dungeon anthems
  const xa = xAnthems;
  xAnthems = function(c, ownerPid){ const r = xa(c, ownerPid); try { if (!S || !c || !c.k || ownerPid !== MYPID) return r; let [p, t] = r;
      if (S.bf.includes(c) && /cards in your graveyard/.test(info(c.k)?.o || '')){ const mm = tname(info(c.k)?.o || '', info(c.k)?.n || '').toLowerCase().match(/^~ gets \+(\d+)\/\+(\d+) as long as there are (\w+) or more cards in your graveyard\.?$/m); if (mm && S.gy.length >= (wn(mm[3]) || +mm[3])){ p += +mm[1]; t += +mm[2]; } }
      if ((S.dgDone || 0) > 0 && isCreatureCard(c)) for (const s of S.bf){ if (s === c || s.fd || !s.k || !/completed a dungeon/.test(info(s.k)?.o || '')) continue; const mm = tname(info(s.k)?.o || '', info(s.k)?.n || '').toLowerCase().match(/other creatures you control get \+(\d+)\/\+(\d+) as long as you've completed a dungeon/); if (mm){ p += +mm[1]; t += +mm[2]; } }
      return [p, t]; } catch { return r; } };
  // Kudo: other creatures have base P/T 2/2 (sources cached on every commit)
  const st = stats;
  stats = function(c, pid = MYPID){ const r = st(c, pid); try { const K = R23K.kudo; if (!r || !K || !K.length || !c || !c.k || !isCreatureCard(c)) return r; const src = K.find(x => !(x.pid === pid && x.id === c.id)); if (src){ const base = ptOf(faceOf(c)); if (base) return [r[0] - base[0] + src.p, r[1] - base[1] + src.t]; } } catch {} return r; };
  const to0 = typeOf;
  typeOf = c => { let t = to0(c); try { if (c && c.k){ const extra = r23kAlso(c.k); if (extra.length) extra.forEach(x => { if (!new RegExp('\\b' + x + '\\b').test(t)) t += (/—/.test(t) ? ' ' : ' — ') + x; });
      const K = R23K.kudo; if (K && K.length && !/\bBear\b/.test(t) && /Creature/.test(t) && K.some(x => x.id !== c.id)) t += (/—/.test(t) ? ' ' : ' — ') + K[0].ty; } } catch {} return t; };
  // Darksteel Angel
  const mc = modCounters;
  modCounters = function(c, kind, n, putter, owner){ try { if (kind === 'cm' && n > 0 && S && c && S.bf.includes(c) && isCreatureCard(c) && rulesOn('r23kNoMinus').length){ log(`${cname(c)} can't get -1/-1 counters`); return 0; } } catch {} return mc(c, kind, n, putter, owner); };
  // Abyssal Persecutor / Phyrexian Unlife
  const sb = sba;
  sba = function(...a){ const r = sb.apply(this, a); try { if (S && S.lost && !S.r23kLost && /0 life/.test(S.lost) && (rulesOn('r23kPersecutor').length || rulesOn('r23kUnlife').length)){ S.lost = ''; log(`doesn't lose the game at ${S.life} life (${(rulesOn('r23kPersecutor')[0] || rulesOn('r23kUnlife')[0]).src})`); } } catch {} return r; };
  const dm = damageMe;
  damageMe = function(n, f = {}, from){ try { if (S && n > 0){
      if (S.life <= 0 && rulesOn('r23kUnlife2').length && !f.inf) return dm(n, {...f, inf:true}, from);
      if (rulesOn('r23kMonarchShield').length && holderOf('mon') === MYPID){ log(`${n} damage doesn't cause life loss (monarch)`); return; } } } catch {} return dm(n, f, from); };
  // Progenitus: shuffled into the library instead of any graveyard
  const mv = moveCard;
  moveCard = function(id, to, o = {}){ try { if (S && to === 'gy'){ const [z, , c] = find(id); if (c && c.k && !c.tok && /would be put into a graveyard from anywhere, reveal ~ and shuffle it into its owner's library instead/i.test(tname(info(c.k)?.o || '', info(c.k)?.n || ''))){ const r = mv(id, 'lib', {...o, quiet:true}); shuffle(S.lib); log(`${cname(c)} was revealed and shuffled into the library instead`); commit(); return r; } } } catch {} return mv(id, to, o); };
  // Protean Hydra: damage removes counters, two come back at the next end step
  const dc = damageCard;
  damageCard = function(c, n, f = {}){ try { if (c && n > 0 && /if damage would be dealt to ~, prevent that damage and remove that many \+1\/\+1 counters from it/i.test(tname(info(c.k)?.o || '', info(c.k)?.n || ''))){ const k = Math.min(n, c.cp || 0); c.cp = (c.cp || 0) - k; log(`${cname(c)}: ${n} damage prevented, removed ${k} +1/+1 counter${k === 1 ? '' : 's'}`); if (k) emit({type:'r23kCtrOff', k:c.k, id:c.id, cnt:k}); return 0; } } catch {} return dc(c, n, f); };
  const fs = fireSteps;
  fireSteps = function(...a){ const r = fs.apply(this, a); try { const [step] = a; if (S && step === 'end' && S.r23kHydra && S.r23kHydra.length){ S.r23kHydra.splice(0).forEach(h => { const c = S.bf.find(x => x.id === h.id); if (c){ modCounters(c, 'cp', h.n); log(`${cname(c)} gets ${h.n} +1/+1 counters`); } }); commit(); } } catch (e){ console.warn(e); } return r; };
  // Kalitas: the controller of Kalitas gets a Zombie
  const gr = gyReplace;
  gyReplace = function(c, from){ const r = gr(c, from); try { if (r === 'ex' && from === 'bf' && c && !c.tok && isCreatureCard(c)){ const z = rulesOn('dieEx').filter(x => x.r23kZombie && x.pid !== MYPID); z.forEach(x => sendRq(x.pid, 'tokText', 0, x.src, {d:'a 2/2 black Zombie creature token'})); } } catch {} return r; };
  // Quina / Donatello: one extra token
  const ct = createToken;
  createToken = function(k, n, near, o){ const r = ct(k, n, near, o); try { if (S && !UI.dry && !R23K.plusTok && n > 0){ const rs = rulesOn('r23kPlusTok'); if (rs.length){ R23K.plusTok = true; (async () => { try { for (const x of rs) await createFromText('Create a ' + x.tok.replace(/^an? /, ''), {name:x.src, k:null, it:{}}); } finally { R23K.plusTok = false; } commit(); })(); } } } catch {} return r; };
  // Tectonic Reformation: land cards in hand get cycling; Sojourner's Companion: artifact landcycling
  const cy = r21bCycles;
  r21bCycles = function(c){ const out = cy(c); try { if (c && c.k){ for (const l of r21bLines(c.k)){ const mm = l.trim().match(/^artifact landcycling ((?:\{[^}]+\})+)$/i); if (mm){ const cost = r21bCost(mm[1]); out.push({ty:'artifact land', desc:'artifact land', cost, label:`Artifact landcycling ${cost.label}`}); } }
      if (isLand(c.k) && S && S.hand.includes(c)) rulesOn('r23kLandCycle').forEach(x => { const cost = r21bCost('{' + x.cost + '}'); if (!out.some(o => !o.ty && o.cost.label === cost.label)) out.push({ty:'', desc:null, cost, label:`Cycling ${cost.label} (${x.src})`}); }); } } catch {} return out; };
}

const R23K_ALSO = new Map();
function r23kAlso(k){ if (R23K_ALSO.has(k)) return R23K_ALSO.get(k); const a = info(k); let out = []; if (a && / is also an? /.test(a.o || '')){ const mm = tname(a.o || '', a.n || '').toLowerCase().match(/^~ is also an? ([a-z]+(?:, [a-z]+)*,? and [a-z]+)\.?$/m); if (mm) out = mm[1].split(/,\s*(?:and\s+)?|\s+and\s+/).map(x => cap(x.trim())).filter(Boolean); } if (a) R23K_ALSO.set(k, out); return out; }
{
  const cm = commit;
  commit = function(...a){ try { if (S){ const K = []; for (const b of boardsAll()) for (const x of b.bf){ if (!x.k || x.fd) continue; const o = info(x.k)?.o || ''; if (!/^Other creatures have base power and toughness/m.test(o)) continue; const mm = o.match(/^Other creatures have base power and toughness (\d+)\/(\d+) and are (\w+?)s in addition/m); if (mm) K.push({pid:b.pid, id:x.id, p:+mm[1], t:+mm[2], ty:mm[3]}); } R23K.kudo = K; } } catch {} return cm.apply(this, a); };
}

// ---- support for batch 6 ----
async function r23kLandMana(k, src){ const outs = k ? manaOuts(String(info(k)?.o || '').split('\n').find(x => /add\b/i.test(x)) || '') : []; const cols = [...new Set(outs.flat())]; if (!cols.length){ log(`${src}: couldn't tell what that land produced`); return; } const c = cols.length === 1 || UI.dry ? cols[0] : await askChoice({title:`${src}: add one mana of which type?`, options:cols.map(x => ({label:'{' + x + '}', html:manaHTML('{' + x + '}'), value:x}))}); if (c){ addMana([c]); log(`${src}: added {${c}}`); } commit(); }
RQ_OPS.push('r23kLandMana');
STATIC_KNOWN.push(/^\d+(?:—\d+)? \| /);
STATIC_RULES.push([/^(?:\d+(?:—\d+)? \| .+|you may play (?:it|them) this turn)$/, m => ({kind:'noop'})]);
{
  const ao = applyOp;
  applyOp = function(r, from){ if (r.op === 'r23kLandMana'){ r23kLandMana(r.d, r.src); return; } return ao(r, from); };
  // ability words ending in "!" ("Bring it Down! — ", "Allons-y! — ") are labels too
  const tn = tname;
  tname = function(txt, name){ return tn(String(txt || '').replace(/(^|\n)(?!(?:I|II|III|IV|V|VI|VII)(?:, (?:I|II|III|IV|V|VI|VII))* — )([A-Z][A-Za-z'’\-, ]{1,32}!) — /g, '$1'), name); };
  const ct = classifyTrig;
  classifyTrig = function(w, c){
    const cc = String(c);
    if (/^a player taps a nonbasic land for mana$/.test(cc)) return {ev:'manatap', subj:'any', ctl:'any', desc:'nonbasic land'};
    if (/^you roll one or more dice$/.test(cc)) return {ev:'roll', subj:'any', ctl:'you', desc:''};
    if (/^a creature deals combat damage to you$/.test(cc)) return {ev:'cdmg', subj:'any', ctl:'any', desc:'creature', toYou:true};
    if (w === 'at' && /^the beginning of each other player's draw step/.test(cc)) return ct(w, cc.replace("each other player's", "each opponent's"));
    return ct(w, c);
  };
  // Ballad of the Black Flag IV: historic spells cost {2} less this turn
  const sc = spellCost;
  spellCost = function(c, zone, o = {}){ const r = sc(c, zone, o); try { const d = S && S.r23kHistDisc; if (d && d.t === turnStr() && r && r.cost && c && c.k && r23kHistoric(c.k)){ const cut = Math.min(d.n, r.cost.gen || 0); if (cut){ r.cost.gen -= cut; (r.notes ||= []).push(`historic −${cut}`); } } } catch {} return r; };
  // named tokens with quoted abilities, also when another player creates them
  const cft = createFromText;
  createFromText = async function(s0, ctx){ const mm = String(s0 || '').match(/^create (a|an|one|two|three) (tapped )?((?:colorless |snow |legendary |white |blue |black |red |green )*)(artifact |enchantment )?token named ([A-Z][\w' -]+?) with ["“](.+?)["”]\.?$/i); if (mm) return r23kNamedToken(MYPID, mm, ctx || {}); return cft(s0, ctx); };
}

RQ_OPS.push('r23kEnterTapped');
{
  const ao = applyOp;
  applyOp = function(r, from){ if (r.op === 'r23kEnterTapped'){ S.r23kET = {by:from, t:String(r.d || ''), src:r.src}; log(`creatures enter tapped until ${nameOf(from)}'s next turn (${r.src})`); commit(); return; } return ao(r, from); };
  const oe = onEnter;
  onEnter = function(c, from, o = {}){ const r = oe(c, from, o); try { const E = S && S.r23kET; if (E){ const [, pid] = currentTurn(); if (pid === E.by && turnStr() !== E.t) S.r23kET = null; else if (c && isCreatureCard(c) && S.bf.includes(c) && !c.tap){ c.tap = true; log(`${cname(c)} enters tapped (${E.src})`); } } } catch {} return r; };
}

RQ_OPS.push('r23kNamedTok', 'r23kGainPer');
{
  const ao = applyOp;
  applyOp = function(r, from){
    if (r.op === 'r23kNamedTok'){ (async () => { const a = info(r.d); const o = a ? tname(a.o || '', a.n || '') .replace(/~/g, a.n) : ''; const mm = o.match(/creates? (a|an|one|two|three) (tapped )?((?:colorless |snow |legendary |white |blue |black |red |green )*)(artifact |enchantment )?token named ([A-Z][\w' -]+?) with ["“](.+?)["”]/i); if (mm) await r23kNamedToken(MYPID, mm, {name:a.n, k:null, it:{}}); else log(`couldn't read the token from ${r.src}`); commit(); })(); return; }
    if (r.op === 'r23kGainPer'){ (async () => { await waitUntil(() => !(R23K.tokBusy > 0), 8000); const n = S.bf.filter(c => !c.fd && descOk(c.k, String(r.d || 'creature'), {tok:c.tok})).reduce((a, c) => a + (c.n || 1), 0); if (n && gainLife(r.n * n, r.src)) log(`gained ${r.n * n} life (${r.src}) → ${S.life}`); commit(); })(); return; }
    if (r.op === 'tokText'){ R23K.tokBusy = (R23K.tokBusy || 0) + 1; setTimeout(() => { R23K.tokBusy = Math.max(0, (R23K.tokBusy || 1) - 1); }, 6000); const p = createFromText('Create ' + String(r.d || ''), {name:r.src, k:null, it:{}}); Promise.resolve(p).finally(() => { R23K.tokBusy = Math.max(0, (R23K.tokBusy || 1) - 1); commit(); }); return; }
    return ao(r, from);
  };
}

// ---- batch 7: triggers on being targeted, face-up, mana grants, land replacements, devotion, explore ----
EV_TYPES.push('r23kTgtd');
STATIC_RULES.push(
  [/^your devotion to each color and each combination of colors is increased by one$/, m => ({kind:'r23kDevo', who:'you'})],
  [/^if a creature you control would explore, instead it explores, then it explores again$/, m => ({kind:'r23kExplore2', who:'you'})],
  [/^if ~ would enter, sacrifice two untapped lands instead$/, m => ({kind:'noop'})],
  [/^if you do, put ~ onto the battlefield$/, m => ({kind:'noop'})],
  [/^if you don't, put (?:it|~) into its owner's graveyard$/, m => ({kind:'noop'})],
  [/^each creature you control with a \+1\/\+1 counter on it has "\{t\}: add one mana of any color\.?"$/, m => ({kind:'r23kManaCtr', who:'you'})],
  [/^enchanted land has "\{t\}: add two mana of any one color\.?"$/, m => ({kind:'noop'})],
);
{
  // emit "became the target" for each of the other players' permanents I target
  const ctg = chooseTargets;
  chooseTargets = async function(text, src, name){ const r = await ctg(text, src, name); try { if (!UI.dry){ (Array.isArray(r) ? r.flat(2) : []).filter(t => t && t.t === 'card' && t.pid && t.pid !== MYPID && t.k).forEach(t => emit({type:'r23kTgtd', k:t.k, id:t.id, dp:t.pid, cnt:1})); } } catch {} return r; };
  const ct = classifyTrig;
  classifyTrig = function(w, c){ const cc = String(c); let mm;
    if ((mm = cc.match(/^an? ([a-z]+) you control becomes the target of a spell or ability an opponent controls$/))) return {ev:'r23kTgtd', subj:'any', ctl:'you', desc:mm[1], r23kTgt:true};
    if (/^a creature you control with a \+1\/\+1 counter on it becomes the target of a spell or ability an opponent controls$/.test(cc)) return {ev:'r23kTgtd', subj:'any', ctl:'you', desc:'creature', r23kTgt:true, withCp:true};
    if (/^a permanent you control is turned face up$/.test(cc)) return {ev:'turnup', subj:'any', ctl:'you', desc:''};
    return ct(w, c); };
  const sm = subjMatch;
  subjMatch = function(t, src, ev, pid){ if (ev && ev.type === 'r23kTgtd'){ if (ev.dp !== MYPID || pid === MYPID) return false; const c = S.bf.find(x => x.id === ev.id); if (!c || (t.desc && !descOk(c.k, t.desc, {tok:c.tok}))) return false; if (t.withCp && !(c.cp > 0)) return false; return true; } return sm(t, src, ev, pid); };
  // Altar of the Pantheon
  const dv = devotion;
  devotion = function(cols){ const n = dv(cols); try { return n + (S ? rulesOn('r23kDevo').length : 0); } catch { return n; } };
  // Topography Tracker
  const ex = explore;
  explore = async function(c, ctx){ await ex(c, ctx); try { if (S && c && S.bf.includes(c) && rulesOn('r23kExplore2').length){ log(`${cname(c)} explores again (Topography Tracker)`); await ex(c, ctx); } } catch (e){ console.warn(e); } };
  // mana granted to creatures with +1/+1 counters (Jiang Yanggu) and to an enchanted land (Gift of Paradise)
  const ma = manaAbs;
  const mk = eff => ({cost:'{T}', eff, rest:'', outs:/two mana of any one color/.test(eff) ? ['W', 'U', 'B', 'R', 'G'].map(x => [x, x]) : manaOuts(eff), tapOnly:true, line:`{T}: ${eff}.`, r23k:true});
  manaAbs = function(c){ let out = ma(c); try { if (!S || !c || !S.bf.includes(c) || out.some(o => o.r23k)) return out;
      if (isCreatureCard(c) && (c.cp || 0) > 0 && rulesOn('r23kManaCtr').length) out = out.concat(mk('Add one mana of any color'));
      if (isLand(c.k) && S.bf.some(b => b.att && b.att.pid === MYPID && b.att.id === c.id && /Enchanted land has "\{T\}: Add two mana of any one color\.?"/.test(info(b.k)?.o || ''))) out = out.concat(mk('Add two mana of any one color'));
    } catch {} return out; };
  // Scorched Ruins / Lotus Vale: sacrifice two untapped lands or it goes to the graveyard
  const oe = onEnter;
  onEnter = function(c, from, o = {}){
    try { if (S && c && c.k && !UI.dry && from === 'hand' && /If (?:this land|~) would enter, sacrifice two untapped lands instead/i.test(tname(info(c.k)?.o || '', info(c.k)?.n || '').replace(info(c.k)?.n || '~', '~'))){
      const lands = S.bf.filter(x => x !== c && isLand(x.k) && !x.tap && !x.fd);
      if (lands.length < 2){ moveCard(c.id, 'gy', {quiet:true}); log(`${cname(c)}: not enough untapped lands to sacrifice — put into the graveyard`); commit(); return; }
      (async () => { const ids = lands.length === 2 ? lands.map(x => x.id) : await pickCards({title:`${cname(c)}: sacrifice two untapped lands (or it goes to the graveyard)`, cards:lands, min:0, max:2, noneLabel:"Don't"});
        if (!ids || ids.length < 2){ moveCard(c.id, 'gy', {quiet:true}); log(`${cname(c)} was put into the graveyard`); }
        else { ids.forEach(id => { const x = S.bf.find(y => y.id === id); if (x) sacrificeOne(x); }); log(`${cname(c)}: sacrificed two lands`); }
        commit(); })();
    } } catch (e){ console.warn(e); }
    return oe(c, from, o);
  };
}

EV_TYPES.push('r23kCtrOff');
{
  const ct = classifyTrig;
  classifyTrig = function(w, c){ if (/^a \+1\/\+1 counter is removed from ~$/.test(String(c))) return {ev:'r23kCtrOff', subj:'self', ctl:'you', desc:''}; return ct(w, c); };
}
