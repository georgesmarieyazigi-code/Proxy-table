/* ===================== trainer.js — the built-in trainer and coach (bots stage 2) =====================
   Watches the LOCAL HUMAN only (never runs in a bot frame, never publishes anything): every decision you make is recorded
   with what you could see at that moment (your own state + public state; no library order, no other hands), compared with
   what the advice level would do (Very hard via botAdvise() when it is ready, else Intermediate's hooks), and checked
   against a rules-of-thumb library. Findings are blunder / mistake / inaccuracy / tip; a rule only fires when the better
   line is clearly better and everything it claims is something the engine can verify.
   Modes: Off (nothing recorded) · Quiet (end-of-turn summary) · Live (a small toast right after a flagged decision,
   pointer-events:none so it never blocks play) · Review (no interruptions; the timeline opens when the game ends).
   Coaching: a local profile (localStorage 'pt.trainer') of mistake categories per game; the Coach tab picks your top 3
   recurring weaknesses, moving from basics (land drops, mana use) to sequencing to decision-making as the basics improve.
   Stage 3 (Claude coach, the user's own API key, not built here) consumes trCoachRecord(): see the format there.
   ============================================================================================================ */
const TR_SEV = {blunder:{w:0, lab:'Blunder', ord:0, col:'#e3705b'}, mistake:{w:0.4, lab:'Mistake', ord:1, col:'#e8a04f'},
  inaccuracy:{w:0.7, lab:'Inaccuracy', ord:2, col:'#d4c24f'}, tip:{w:0.9, lab:'Tip', ord:3, col:'#8fc3d9'}};
// tier 1 = basics, 2 = sequencing, 3 = decision-making. lesson: what to learn; focus: one thing to do next game
const TR_CATS = {
  land_drop:{tier:1, label:'Missed land drops', lesson:'A land every turn is the cheapest advantage in Magic: each missed drop is a whole turn of mana you never get back. Before you press End turn, glance at your hand for a land.', focus:'Play a land every turn you have one, before anything else in main phase 1 unless a cantrip should come first.'},
  unused_mana:{tier:1, label:'Unused mana', lesson:'Mana you don\'t use on your turn is gone. If you are not holding up an instant, spend it: a creature, a rock or a draw spell now is worth more than the same card next turn.', focus:'Before passing the turn, count your untapped mana and ask: is there anything I can cast with it?'},
  mana_float:{tier:1, label:'Mana left floating', lesson:'Mana in your pool empties at the end of every step. Only tap lands when you are about to pay for something, and use floating mana before you move on.', focus:'Tap for mana only as you cast — never "just in case".'},
  hand_size:{tier:1, label:'Discarding to hand size', lesson:'Discarding at cleanup throws away a card you paid for with a draw. If you will be over seven, cast something with the mana you have instead of discarding it.', focus:'With 8+ cards at end of turn, cast your cheapest useful card instead of discarding.'},
  mulligan:{tier:1, label:'Mulligan decisions', lesson:'Keep 7s with 3–4 lands (or 2 lands plus cheap ramp) and something to do early. Ship 0–1 landers and 6–7 landers: they lose far more games than a mulligan does.', focus:'Count lands first: 3–4 is a keep, 0–1 or 6+ is a mulligan.'},
  land_choice:{tier:2, label:'Which land to play', lesson:'Play tapped lands on turns you don\'t need all your mana, and untapped ones on turns you do. Look at what you want to cast this turn before choosing.', focus:'Before your land drop, decide what you are casting this turn — then pick the land.'},
  cantrip_first:{tier:2, label:'Cantrip before land', lesson:'When you can already pay for a cheap draw or scry spell and you hold different lands, cast it first: you see more cards before choosing which land to play.', focus:'Holding Ponder/Preordain and two kinds of land? Cast the cantrip, then pick the land.'},
  ramp_first:{tier:2, label:'Ramp first', lesson:'Mana rocks that tap right away (Sol Ring, Signets, Talismans) pay for themselves. Cast them first, then spend the mana they make.', focus:'Cast mana rocks before your other spells.'},
  color_tap:{tier:2, label:'Tapping the wrong lands', lesson:'When you pay for a spell, keep the colours you still need open — especially for instants like counterspells and removal. Tap the lands whose colours you need least.', focus:'Before paying, check which colours your instants need and keep those lands untapped.'},
  precombat:{tier:2, label:'Creatures before combat', lesson:'A creature without haste or an enters effect does nothing in this combat. Casting it after combat hides information and keeps your mana up for tricks while you attack.', focus:'Cast plain creatures in main phase 2 when you are going to attack.'},
  hold_up:{tier:2, label:'Holding up interaction', lesson:'Counterspells and instant removal are only good if you leave mana for them. Tapping out for a small spell on your turn often costs more than it gains.', focus:'With a counterspell in hand, ask whether this spell is worth giving up the counter for a turn.'},
  fetch:{tier:2, label:'Fetch-land timing', lesson:'Lands like Evolving Wilds fetch a TAPPED land. Crack them on the turn you play them (or at the end of an opponent\'s turn) so the new land untaps with your next turn.', focus:'Crack Evolving Wilds-style lands right away.'},
  commander:{tier:2, label:'Commander handling', lesson:'Your commander costs {2} more every time it is recast. Send it to the command zone when it dies, and don\'t trade it away in combat for nothing.', focus:'Treat your commander like your best card: no free trades, always back to the command zone.'},
  bad_attack:{tier:3, label:'Attacks into bad trades', lesson:'Before attacking, look at each opponent\'s untapped creatures: if one can block and kill your attacker without dying, the attack only gives them a free kill.', focus:'For each attacker, find their best blocker. If it eats your creature for free, keep it home.'},
  crack_back:{tier:3, label:'Dead on the crack-back', lesson:'Attacking taps your creatures, so they can\'t block on your opponents\' turns. Before an attack, add up what each opponent could hit you for next turn.', focus:'Before attacking, count the crack-back: their total power against your life and remaining blockers.'},
  no_block:{tier:3, label:'Not blocking lethal', lesson:'When the damage coming at you is lethal, block — even with creatures you would rather keep. Staying alive is always worth a creature.', focus:'When attacked, add up the unblocked damage first; if it kills you, block.'},
  chump:{tier:3, label:'Needless chump blocks', lesson:'Life is a resource. Throwing a good creature in front of an attacker to save a few points of life at a healthy life total is usually a loss.', focus:'Only chump-block when the damage would kill you or put you in real danger.'},
  lethal:{tier:3, label:'Missed lethal', lesson:'Every combat, check each opponent: if your unblockable damage plus the attackers they can\'t block add up to their life, attack with everything at them.', focus:'At every combat, check: can I kill someone this turn?'},
  removal_target:{tier:3, label:'Removal on the wrong target', lesson:'Removal is scarce: save it for the card that would beat you, not the first thing that annoys you.', focus:'Before using removal, look at every opponent\'s board and point it at the biggest threat.'},
  combo_piece:{tier:3, label:'Ignoring combo pieces', lesson:'A card that wins the game on its own (or with one other card) is a bigger threat than any creature. Answer it first.', focus:'Scan for "win the game", infinite and extra-turn cards before you use removal.'},
  feed_leader:{tier:3, label:'Feeding the leader', lesson:'In multiplayer, hitting the weakest player helps whoever is winning. Pressure the leader unless you can actually knock someone out.', focus:'Each attack: who is winning? Point your damage at them.'},
  overextend:{tier:3, label:'Overextending into a wipe', lesson:'When you are already far ahead on board, extra creatures add little but lose everything to a board wipe. Hold one or two back to rebuild.', focus:'Already ahead on board? Keep a creature or two in hand.'},
  let_resolve:{tier:3, label:'Letting a big spell resolve', lesson:'Hold your counterspells for the spells that would beat you: board wipes, game-winning combos, huge threats.', focus:'When an opponent casts a wipe or a combo piece and you hold a counter, use it.'},
};
const TR_JUDGED = new Set(['land', 'cast', 'ab', 'attack', 'block', 'keep', 'ship', 'end', 'pass']);
const TR_PH = ['untap', 'upkeep', 'draw', 'main 1', 'combat', 'main 2', 'end', 'cleanup'];
const TR = {mode:'quiet', tab:'game', filter:'all', g:null, last:null, prof:{v:1, games:[]}, base:null, judging:false, peeks:[], errs:[],
  perf:{n:0, ms:0, max:0}, open:false, resetArm:false, dirty:false, savedAt:0};

/* ---- storage (only the trainer's own keys) ---- */
const TR_KEY = 'pt.trainer', TR_CUR = 'pt.trainer.cur';
function trStoreGet(k){ try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch { return null; } }
function trStoreSet(k, v){ try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } }
function trLoad(){ const d = trStoreGet(TR_KEY); if (d && typeof d === 'object'){ if (['off', 'quiet', 'live', 'review'].includes(d.mode)) TR.mode = d.mode; if (d.prof && Array.isArray(d.prof.games)) TR.prof = {v:1, games:d.prof.games.slice(-60)}; if (d.last && Array.isArray(d.last.recs)) TR.last = d.last; } }
function trSaveProf(){ return trStoreSet(TR_KEY, {mode:TR.mode, prof:TR.prof, last:TR.last ? trSlim(TR.last) : null}); }
function trSaveCur(){ TR.savedAt = Date.now(); TR.dirty = false; if (!TR.g || TR.g.done) return trStoreSet(TR_CUR, null); return trStoreSet(TR_CUR, trSlim(TR.g)); }
function trSlim(g){ return {...g, recs:g.recs.slice(-400), pend:undefined, tc:undefined}; }
/* ---- end storage ---- */

const trOn = () => !BOTMODE && TR.mode !== 'off' && !!S && !(typeof UI !== 'undefined' && UI.dry);
function trErr(e){ TR.errs.push(String(e && e.stack || e).slice(0, 300)); if (TR.errs.length > 30) TR.errs.shift(); }
function trPeek(what){ TR.peeks.push({what, t:Date.now()}); if (TR.peeks.length > 50) TR.peeks.shift(); }
// run trainer code: never throws into the game, measures its cost, and marks the span for the hidden-information trap
function trGuard(fn){ const was = TR.judging; TR.judging = true; const t0 = performance.now(); try { return fn(); } catch (e){ trErr(e); return null; } finally { TR.judging = was; const ms = performance.now() - t0; if (!was){ TR.perf.n++; TR.perf.ms += ms; TR.perf.max = Math.max(TR.perf.max, ms); } } }

/* ---------------------------------------------------------------- what you could see */
function trWho(pid){ const g = TR.g; if (!g) return 'an opponent'; if (!g.opp[pid]) g.opp[pid] = 'Opponent ' + (Object.keys(g.opp).length + 1); return g.opp[pid]; }
function trBrief(c, pid){
  if (!c || !c.k || c.fd) return 'a face-down card';
  let s = cname(c); try { if (isCreatureCard(c)){ const st = botPT(c, pid); s += ` ${st[0]}/${st[1]}`; } } catch {}
  if ((c.n || 1) > 1) s = c.n + '× ' + s; if (c.tap || c.tp) s += ' (tapped)'; if (c.cmd) s += ' [commander]';
  return s;
}
function trSrcList(){ try { return (autoSources() || []).map(s => ({id:s.c.id, nm:cname(s.c), opts:[...new Map(s.opts.map(o => [o.outs.join(''), o.outs.slice()])).values()]})); } catch { return []; } }
const trSrcText = s => s.nm + ' (' + [...new Set(s.opts.map(o => o.join('')))].join('/') + ')';
function trOpps(){ const out = []; for (const [pid, s] of OPP){ if (s.lost || s.b27lost) continue; out.push({pid, nm:s.nm, life:s.life, psn:s.psn || 0, bf:s.bf || [], gy:s.gy || [], hc:s.hc || 0, cz:s.cz || [], cdt:s.cdt || []}); } return out; }
function trSaw(){
  const pn = phaseNow(); const srcs = trSrcList();
  const me = {life:S.life, poison:S.psn || 0, hand:S.hand.map(cname), library:S.lib.length, lands:S.bf.filter(c => c.k && isLand(c.k)).length,
    untapped:srcs.map(trSrcText), pool:poolText(S.pool), mana:botManaAvail(), battlefield:S.bf.filter(c => !c.k || !isLand(c.k)).map(c => trBrief(c, MYPID)),
    commandZone:S.cz.map(c => cname(c) + (S.tax[c.k] ? ` (tax {${2 * S.tax[c.k]}})` : ''))};
  const opps = trOpps().map(o => ({who:trWho(o.pid), life:o.life, poison:o.psn, hand:o.hc, lands:o.bf.filter(c => c.k && isLand(c.k)).length,
    battlefield:o.bf.filter(c => !c.k || !isLand(c.k)).map(c => trBrief(c, o.pid)), commandZone:o.cz.map(x => (info(x.k)?.n || '?') + (x.tax ? ` (tax {${2 * x.tax}})` : ''))}));
  const stack = stackAll().map(i => ({card:i.nm, who:i.pid === MYPID ? 'you' : trWho(i.pid)}));
  return {turn:pn.n, phase:TR_PH[pn.ph] || 'pregame', yourTurn:pn.mine, you:me, opponents:opps, stack};
}

/* ---------------------------------------------------------------- mana: can these sources pay for that? (exact for normal lands) */
function trCost(c, zone){ try { return spellCost(c, zone).cost; } catch { return parseCost(info(c.k)?.m || ''); } }
function trCostN(cost){ return cost ? cost.gen + MANA.reduce((s, m) => s + (cost.col[m] || 0), 0) + cost.hyb.length + cost.two.length * 2 + (cost.x ? 1 : 0) : 0; }
function trAddCost(a, b){ const col = emptyPool(); MANA.forEach(m => { col[m] = (a.col[m] || 0) + (b.col[m] || 0); }); return {gen:a.gen + b.gen, col, hyb:a.hyb.concat(b.hyb), two:a.two.concat(b.two), phy:a.phy.concat(b.phy), x:(a.x || 0) + (b.x || 0), odd:[]}; }
function trCanPay(cost, srcs, pool){
  if (!cost) return true;
  const singles = [], multi = [];
  for (const s of srcs){ if (s.opts.every(o => o.length === 1)) singles.push(new Set(s.opts.map(o => o[0]))); else multi.push(s.opts); }
  const base = []; MANA.forEach(m => { for (let i = 0; i < ((pool && pool[m]) || 0); i++) base.push(new Set([m])); });
  const pips = []; MANA.forEach(m => { for (let i = 0; i < (cost.col[m] || 0); i++) pips.push(m === 'C' ? new Set(['C']) : new Set([m])); });
  cost.hyb.forEach(([a, b]) => pips.push(new Set([a, b])));
  const gen = cost.gen + cost.two.length * 2 + (cost.x ? 1 : 0);
  const fits = units => {
    if (units.length < pips.length + gen) return false;
    const own = new Array(units.length).fill(-1);
    const tryP = (pi, seen) => { for (let j = 0; j < units.length; j++){ if (seen[j] || ![...pips[pi]].some(x => units[j].has(x))) continue; seen[j] = 1; if (own[j] < 0 || tryP(own[j], seen)){ own[j] = pi; return true; } } return false; };
    for (let i = 0; i < pips.length; i++) if (!tryP(i, [])) return false;
    return true;
  };
  let tries = 0;
  const rec = (i, units) => { if (++tries > 3000) return true; if (i === multi.length) return fits(units); for (const o of multi[i]) if (rec(i + 1, units.concat(o.map(x => new Set([x]))))) return true; return false; };
  return rec(0, base.concat(singles));
}
function trSetBase(){ TR.base = {key:turnStr() + '.' + phaseNow().ph, srcs:trSrcList(), pool:{...S.pool}}; }
function trBase(){ const k = turnStr() + '.' + phaseNow().ph; if (TR.base && TR.base.key === k) return TR.base; return {key:k, srcs:trSrcList(), pool:{...S.pool}}; }
const trTotal = (srcs, pool) => poolTotal(pool || {}) + srcs.reduce((s, x) => s + Math.max(...x.opts.map(o => o.length)), 0);

/* ---------------------------------------------------------------- card judgement helpers (public info + my own cards) */
const trR = k => BL.role(k);
const trP1 = (c, pid) => Math.max(0, botPT(c, pid)[0]) * (botKw(c, 'double strike', pid) ? 2 : 1);
const trIsCr = c => { try { return !!c && !!c.k && !c.fd && isCreatureCard(c); } catch { return false; } };
const trIsCmd = (c) => !!(c && c.cmd);
function trInstantAnswers(except){
  return S.hand.filter(c => c !== except && !isLand(c.k)).filter(c => { const r = trR(c.k); return (r.instant || /\bflash\b/.test(r.text)) && (r.roles.has('counter') || r.roles.has('removal')); });
}
// sorcery-speed castability ignoring the current step (used at the end of a turn), with the mana from srcs/pool
function trCanCast(c, zone, srcs, pool){
  const a = info(c.k); if (!a || isLand(c.k) || a.lay === 'split') return false;
  try { const cl = castLimit(c, zone); if (cl && !cl.ok) return false; } catch {}
  if (counterSpec(tname(a.o, a.n))) return false;
  if (!isPermType(a.t)){ try { if (targetsAvailable(tname(a.o, a.n), {pid:MYPID, col:a.c, types:a.t, id:c.id})) return false; } catch { return false; } }
  return trCanPay(trCost(c, zone), srcs, pool);
}
// would casting it now clearly be useful? (conservative: unknown sorceries and situational cards don't count)
function trUseful(c, v){
  const r = trR(c.k), R = r.roles, a = info(c.k) || {};
  if (r.instant || R.has('counter') || R.has('wipe')) return false;
  if (/as an additional cost|sacrifice (?:a|an|another|two)\b/.test(r.text) && !r.creature) return false;
  if (/\{X\}/.test(a.m || '')) return false;
  if (R.has('removal') || (!r.perm && BL.cands(c).length && BL.intentOf(c) === 'harm')){ const b = BL.bestOppTarget(v, c); return !!(b && b.v >= 4); }
  if ((R.has('aura') || R.has('equipment')) && !BL.myCreatures().length) return false;
  if (!r.perm && (R.has('pump') || R.has('protect')) && !BL.myCreatures().length) return false;
  if (r.perm) return true;
  return R.has('draw') || R.has('ramp') || R.has('tutor') || R.has('token');
}
// opponents' creatures that could block my attacker (untapped, legal)
function trBlockers(o, a){ return botCreatures(o.bf, o.pid).filter(b => !b.tp && BL.oppCanBlock(b, a, o.pid)); }
// a lower bound on the damage these attackers deal to o: each of o's untapped creatures blocks one attacker, the biggest first
function trAtkLB(atts, o){
  const B = botCreatures(o.bf, o.pid).filter(b => !b.tp);
  const units = []; atts.forEach(c => { if (botKw(c, 'infect', MYPID)) return; const p = trP1(c, MYPID); for (let i = 0; i < Math.min(30, c.n || 1); i++) units.push({p, bl:B.some(b => BL.oppCanBlock(b, c, o.pid))}); });
  units.sort((a, b) => b.p - a.p);
  const free = units.filter(u => !u.bl).reduce((s, u) => s + u.p, 0);
  const bl = units.filter(u => u.bl); return free + bl.slice(Math.min(B.length, bl.length)).reduce((s, u) => s + u.p, 0);
}
// a lower bound on what opponent o hits me for next turn if they attack with everything and I block as well as I can
function trCrackLB(o){
  const mine = botCreatures(S.bf, MYPID).filter(b => !b.tap && !b.fd);
  const units = []; botCreatures(o.bf, o.pid).forEach(c => { if (botKw(c, 'defender', o.pid) || botKw(c, 'infect', o.pid)) return; const p = trP1(c, o.pid); if (p <= 0) return; for (let i = 0; i < Math.min(30, c.n || 1); i++) units.push({c, p, men:hasMenace(c, o.pid)}); });
  units.sort((a, b) => b.p - a.p);
  const used = new Set(); let dmg = 0;
  for (const u of units){
    const can = mine.filter(b => !used.has(b.id) && (() => { try { return !canBlock(b, u.c, o.pid); } catch { return false; } })());
    const need = u.men ? 2 : 1;
    if (can.length >= need){ can.slice(0, need).forEach(b => used.add(b.id)); } else dmg += u.p;
  }
  return dmg;
}
function trThreat(o){ try { return botThreat(o); } catch { return 0; } }
function trAdvLevel(){ try { if (typeof botAdvise === 'function'){ for (const id of ['veryhard', 'hard']) if (BOT_LEVELS[id] && BOT_LEVELS[id].ready) return id; } } catch {} return 'intermediate'; }
function trActLabel(a){ if (!a) return ''; if (typeof a === 'string') return a; const how = {land:'play', cast:'cast', ab:'activate', pw:'use a loyalty ability of'}[a.how] || a.how || ''; return `${how} ${a.c ? cname(a.c) : ''}`.trim(); }
// botAdvise() (botlevels2.js) move shapes → one plain-English line, in the same words the timeline uses for your own move
function trAdvNorm(r, kind){
  if (!r || r.reason === 'error' || r.reason === 'no_game') return null;
  const m = r.move; let move = '';
  if (kind === 'keep') move = m && m.keep ? 'keep' : 'mulligan';
  else if (kind === 'attack') move = m && m.attacks && m.attacks.length ? m.attacks.map(a => `${a.name} → ${a.atName}`).join(', ') : 'no attack';
  else if (kind === 'block') move = m && m.blocks && m.blocks.length ? m.blocks.map(b => `${b.name} blocks ${b.blocksName}`).join(', ') : 'no blocks';
  else if (!m || m.how === 'pass') move = kind === 'main' ? 'move on (nothing worth casting)' : 'pass';
  else { const how = {land:'play', cast:'cast', ab:'activate', pw:'use a loyalty ability of'}[m.how] || m.how; move = `${how} ${m.card ? m.card.name : ''}`.trim() + (m.target && m.target.name ? ` → ${m.target.name}` : ''); }
  const det = String(r.detail || '').replace(/\s*\((?:[\d.]+(?:\s*vs\s*[\d.]+)?)\)/g, '').trim();
  const reason = String(r.reason || '').replace(/_/g, ' ') + (det ? ': ' + det : '');
  return {move, reason:reason === 'level default' ? '' : reason};
}
function trSelText(sel, verb){
  const ids = Object.keys(sel || {}).filter(k => sel[k] != null && sel[k] !== ''); if (!ids.length) return verb === 'attack' ? 'no attack' : 'no blocks';
  return ids.map(id => { const c = S.bf.find(x => x.id === +id); const d = sel[id]; if (verb === 'attack'){ const p = parseDef(d); return `${c ? cname(c) : '?'} → ${p && p.t === 'player' ? nameOf(p.pid) : 'a planeswalker'}`; }
    const a = trOpps().flatMap(o => o.bf).find(x => x.id === +d); return `${c ? cname(c) : '?'} blocks ${a ? cname(a) : '?'}`; }).join(', ');
}
// what the advice level would do right now (pre-decision state): botAdvise() for Hard / Very hard, Intermediate's hooks otherwise
const TR_POINT = {main:'main', respond:'respond', attack:'attack', block:'block', keep:'mulligan'};
function trAdvise(kind){
  const lv = trAdvLevel();
  if (lv !== 'intermediate'){ try { const r = trAdvNorm(botAdvise(lv, {point:TR_POINT[kind]}), kind); if (r) return {level:lv, ...r}; } catch (e){ trErr(e); } }
  const L = BOT_LEVELS.intermediate; if (!L) return null;
  let v; try { v = botView(); } catch { return null; }
  const keepMull = BOT.mullN, keepPlan = BOT.lastPlan, keepWant = BOT.want; BOT.mullN = S.mull || 0;
  try {
    if (kind === 'main'){ const a = L.main.call(L, v); return {level:'intermediate', move:a ? trActLabel(a) : 'move on (nothing worth casting)', reason:a && a.why || ''}; }
    if (kind === 'respond'){ const a = L.respond.call(L, v); return {level:'intermediate', move:a ? trActLabel(a) : 'pass', reason:a && a.why || ''}; }
    if (kind === 'attack'){ BOT.lastPlan = ''; const sel = L.attack.call(L, v) || {}; return {level:'intermediate', move:trSelText(sel, 'attack'), reason:Object.keys(sel).length ? (BOT.lastPlan || '') : 'no profitable attack'}; }
    if (kind === 'block'){ const sel = L.block.call(L, v) || {}; return {level:'intermediate', move:trSelText(sel, 'block'), reason:''}; }
    if (kind === 'keep'){ const k = L.keep.call(L, v); return {level:'intermediate', move:k ? 'keep' : 'mulligan', reason:''}; }
  } catch (e){ trErr(e); } finally { BOT.mullN = keepMull; BOT.lastPlan = keepPlan; BOT.want = keepWant; }
  return null;
}

/* ---------------------------------------------------------------- records and findings */
function trKey(){ return `${NET.code || 'solo'}|${(S.turn && S.turn[2]) || 0}|${MYPID}`; }
function trNewGame(key){ return {key, id:rid(6), at:Date.now(), fmt:S.fmt, np:players().length, recs:[], finds:[], opp:{}, done:false, kept:false, sumTo:0, result:'', tc:{}, pend:[]}; }
function trRec(kind, did, o = {}){
  const g = TR.g; if (!g) return null; const pn = phaseNow();
  const r = {i:g.recs.length, t:pn.n, ph:pn.ph, mine:pn.mine, kind, did, saw:o.saw || trSaw(), adv:o.adv || null, fl:[]};
  g.recs.push(r); TR.dirty = true; trPillUpdate(); return r;
}
function trFlag(r, cat, sev, msg, better){
  if (!r || !TR.g || r.fl.some(f => f.cat === cat)) return null;
  const f = {i:r.i, t:r.t, cat, sev, msg, better:better || ''};
  r.fl.push(f); TR.g.finds.push(f); TR.dirty = true;
  if (TR.mode === 'live') trToast(f);
  trPillUpdate(); if (TR.open) trRender();
  return f;
}
function trScore(g){
  const rs = (g && g.recs || []).filter(r => TR_JUDGED.has(r.kind) || r.fl.length); if (!rs.length) return null;
  let s = 0; rs.forEach(r => { s += r.fl.length ? Math.min(...r.fl.map(f => TR_SEV[f.sev].w)) : 1; });
  return Math.round(100 * s / rs.length);
}
const trNames = a => a.map(c => typeof c === 'string' ? c : cname(c));
const trList = a => { a = trNames(a); return a.length <= 1 ? (a[0] || '') : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1]; };
const trCostTxt = c => { try { return costStr(trCost(c, 'hand')); } catch { return ''; } };
function trTurn(){ const g = TR.g; const k = turnStr(); if (!g.tc[k]) g.tc[k] = {casts:[], attacked:false, lands:[], pre1:[]}; return g.tc[k]; }

/* ---------------------------------------------------------------- judges: casting */
function trPreCast(c, zone, o){
  const pn = phaseNow(); if (poolTotal(S.pool) === 0) trSetBase();
  const pre = {c, k:c.k, zone, free:!!o.free, pn, saw:trSaw(), base:trBase(), cost:trCost(c, zone), hand:S.hand.slice(), stk:S.stk.length, hist:(S.castHist || []).length, v:botView()};
  const r = trR(c.k); pre.role = r;
  if (!pre.free) pre.adv = pn.mine && (pn.ph === 3 || pn.ph === 5) && !stackAll().length ? trAdvise('main') : stackAll().some(i => i.pid !== MYPID) ? trAdvise('respond') : null;
  if (!r.perm && (r.roles.has('removal') || BL.intentOf(c) === 'harm')) pre.cands = BL.cands(c).filter(x => x.ok && x.t === 'card' && x.pid !== MYPID).map(x => ({x, val:BL.candValue(pre.v, x), roles:trR(x.k).roles, nm:x.nm || (info(x.k)?.n || '?')}));
  return pre;
}
function trPostCast(pre, it){
  const c = pre.c, r = pre.role, R = r.roles, pn = pre.pn;
  const after = {srcs:trSrcList(), pool:{...S.pool}};
  const tapped = pre.base.srcs.filter(s => !after.srcs.some(x => x.id === s.id)).map(s => s.nm);
  const tg = (it && Array.isArray(it.tgts) ? it.tgts.flat() : []).filter(Boolean);
  const rec = trRec('cast', {card:cname(c), from:pre.zone, x:it && it.x || 0, targets:tg.map(t => t.t === 'player' ? (t.pid === MYPID ? 'you' : nameOf(t.pid)) : (t.nm || info(t.k)?.n || 'a card')), tapped, free:pre.free}, {saw:pre.saw, adv:pre.adv});
  if (pre.free || !rec) return;
  const T = trTurn(); T.casts.push({rec:rec.i, k:c.k, id:c.id, creature:r.creature, ramp:R.has('ramp'), ph:pn.ph, mine:pn.mine});
  // tapping that shut off the colours an instant needs
  for (const I of trInstantAnswers(c)){
    const cI = trCost(I, 'hand');
    if (trCanPay(trAddCost(pre.cost, cI), pre.base.srcs, pre.base.pool) && !trCanPay(cI, after.srcs, after.pool) && trTotal(after.srcs, after.pool) >= trCostN(cI)){
      const keep = pre.base.srcs.filter(s => !tapped.includes(s.nm)).map(s => s.nm);
      trFlag(rec, 'color_tap', 'mistake', `You paid for ${cname(c)} with ${trList(tapped) || 'your mana'}, so ${cname(I)} (${costStr(cI)}) can't be cast this turn even though you still have ${trTotal(after.srcs, after.pool)} mana open — the colours are wrong.`,
        `Pay for ${cname(c)} with different lands and keep ${costStr(cI)} open for ${cname(I)} (tap lands yourself before casting to choose).`);
      break;
    }
  }
  // tapping out for a small sorcery-speed spell instead of holding up a counter / instant removal
  if (pn.mine && (pn.ph === 3 || pn.ph === 5) && !r.instant && !rec.fl.length){
    const small = r.value < 0.5 && !['ramp', 'draw', 'removal', 'wipe', 'wincon', 'combo', 'tutor', 'counter'].some(x => R.has(x)) && !(r.creature && r.pow >= 4);
    const opp = trOpps().some(o => o.hc >= 3 || o.bf.some(x => x.k && !x.fd && permValue(x, o.pid) >= 6));
    if (small && opp) for (const I of trInstantAnswers(c)){
      const cI = trCost(I, 'hand');
      if (trCanPay(cI, pre.base.srcs, pre.base.pool) && !trCanPay(trAddCost(pre.cost, cI), pre.base.srcs, pre.base.pool) && !trCanPay(cI, after.srcs, after.pool)){
        trFlag(rec, 'hold_up', 'tip', `${cname(c)} is a small play, and casting it means ${cname(I)} can't be cast until your next turn. Probably better to keep ${costStr(cI)} up for ${cname(I)} while opponents have cards to answer.`, `Pass with ${cname(I)} mana open; cast ${cname(c)} on a turn you have spare mana.`);
        break;
      }
    }
  }
  // removal pointed at a small target while a bigger threat (or a combo piece) was there
  if (pre.cands && pre.cands.length && tg.length){
    const ch = tg.find(t => t.t === 'card' && t.pid !== MYPID); const chosen = ch && pre.cands.find(x => x.x.id === ch.id && x.x.pid === ch.pid);
    const defensive = ch && (() => { const pn2 = phaseNow(); return !pn2.mine && pn2.ph === 4 && attackersOnMe(pn2).some(a => a.id === ch.id); })();
    if (chosen && !defensive){
      const best = pre.cands.slice().sort((a, b) => b.val - a.val)[0];
      const combo = pre.cands.filter(x => x.roles.has('combo') || x.roles.has('wincon')).sort((a, b) => b.val - a.val)[0];
      if (combo && combo !== chosen && !(chosen.roles.has('combo') || chosen.roles.has('wincon')))
        trFlag(rec, 'combo_piece', 'mistake', `You used ${cname(c)} on ${chosen.nm} while ${nameOf(combo.x.pid)}'s ${combo.nm} — a card that can win or go infinite — was a legal target.`, `Point ${cname(c)} at ${combo.nm}.`);
      else if (best && best !== chosen && best.val - chosen.val >= 4 && chosen.val < best.val * 0.5)
        trFlag(rec, 'removal_target', best.val - chosen.val >= 7 ? 'mistake' : 'inaccuracy', `You used ${cname(c)} on ${chosen.nm}, but ${nameOf(best.x.pid)}'s ${best.nm} was a legal target and is a much bigger threat.`, `Save removal for the biggest threat — here ${best.nm}.`);
    }
  }
  // mana rocks first
  if (pn.mine && (pn.ph === 3 || pn.ph === 5) && !R.has('ramp')){
    for (const Rk of pre.hand.filter(h => h !== c && !isLand(h.k))){
      const rr = trR(Rk.k); if (!rr.roles.has('ramp') || rr.creature || !rr.perm || rr.tapped || rr.land) continue;
      let outs = []; try { outs = manaAbs(Rk).filter(ab => ab.tapOnly && !ab.rest).flatMap(ab => ab.outs); } catch {} if (!outs.length) continue;
      const cR = trCost(Rk, 'hand'); const rockSrc = {id:-1, nm:cname(Rk), opts:[...new Map(outs.map(o => [o.join(''), o])).values()]};
      if (!trCanPay(cR, pre.base.srcs, pre.base.pool) || trCanPay(cR, after.srcs, after.pool)) continue;
      // both: pay R from the base, then A from what is left plus R's own mana — modelled by paying R+A with R as an extra source
      if (trCanPay(trAddCost(cR, pre.cost), pre.base.srcs.concat([rockSrc]), pre.base.pool)){ T.rampPend = T.rampPend || []; T.rampPend.push({rec:rec.i, rock:Rk.id, rockNm:cname(Rk), spell:cname(c)}); break; }
    }
  }
  // cast a cantrip after the land drop when it could have come first (and the land choice was a real choice)
  const lr = T.landPre; if (lr && pn.ph === lr.ph && lr.hand.includes(c.id) && (R.has('draw') || /\bscry\b/.test(r.text)) && r.mv <= 2 && trCanPay(pre.cost, lr.base.srcs, lr.base.pool)){
    trFlag(TR.g.recs[lr.rec], 'cantrip_first', 'tip', `You played ${lr.land} and then cast ${cname(c)}. You could already pay for ${cname(c)} without the new land, and you held ${trList(lr.choices)} — casting it first would show you more cards before you picked which land to play.`, `Cast ${cname(c)} first, then choose your land.`);
  }
  if (pn.mine && pn.ph === 3 && r.creature) T.pre1.push(rec.i);
}

/* ---- lands ---- */
function trPreLand(c){
  const pn = phaseNow(); if (poolTotal(S.pool) === 0) trSetBase();
  return {c, pn, wasBf:S.bf.some(b => b.id === c.id), saw:trSaw(), base:trBase(), adv:pn.mine && !stackAll().length ? trAdvise('main') : null, lands:S.hand.filter(h => h.k && isLand(h.k)), hand:S.hand.map(h => h.id)};
}
function trPostLand(pre){
  const c = pre.c; const rec = trRec('land', {card:cname(c), tapped:!!trR(c.k).tapped}, {saw:pre.saw, adv:pre.adv}); if (!rec) return;
  const T = trTurn(); T.lands.push({rec:rec.i, k:c.k, id:c.id, tapped:!!trR(c.k).tapped, others:pre.lands.filter(h => h.id !== c.id).map(h => ({k:h.k, id:h.id, tapped:!!trR(h.k).tapped}))});
  const names = [...new Set(pre.lands.map(cname))];
  if (names.length >= 2) T.landPre = {rec:rec.i, ph:pre.pn.ph, land:cname(c), choices:names, base:pre.base, hand:pre.hand};
}

/* ---- abilities ---- */
const trFetchAb = ab => /\{t\}/i.test(ab.cost) && /sacrifice/i.test(ab.cost) && /search your library for [^.]*\b(?:land|forest|plains|island|swamp|mountain)\b[^.]*onto the battlefield tapped/i.test(ab.eff);
function trPostAb(pre, c, ab, it){
  const tg = (it && Array.isArray(it.tgts) ? it.tgts.flat() : []).filter(Boolean);
  trRec('ab', {card:pre.nm, ability:short(ab.eff, 90), cost:ab.cost, targets:tg.map(t => t.nm || (t.t === 'player' ? nameOf(t.pid) : 'a card'))}, {saw:pre.saw, adv:pre.adv});
}

/* ---- passing priority on an opponent's spell ---- */
function trOnPass(){
  const tos = stackTop(); const key = prioKey(); if (!tos || tos.pid === MYPID || !key || S.pass === key) return;
  const ctr = S.hand.filter(c => !isLand(c.k) && trR(c.k).roles.has('counter')).filter(c => { try { if (!castCheck(c, 'hand').ok) return false; const a = info(c.k); return counterLegal(tos, counterSpec(tname(a.o, a.n))).ok; } catch { return false; } });
  const held = S.hand.filter(c => !isLand(c.k) && (trR(c.k).instant)).filter(c => { try { return castCheck(c, 'hand').ok; } catch { return false; } });
  const rec = trRec('pass', {on:tos.nm, by:nameOf(tos.pid), openMana:botManaAvail(), couldCast:held.map(cname)}, {adv:trAdvise('respond')});
  if (!rec || !ctr.length || tos.kind !== 'spell') return;
  const r = trR(tos.k); const myCr = botCreatures(S.bf, MYPID).length;
  let sev = '', why = '';
  if (r.roles.has('wincon') || r.roles.has('combo')){ sev = 'mistake'; why = 'it can win the game or go infinite'; }
  else if (r.roles.has('wipe') && (myCr >= 2 || botCreatures(S.bf, MYPID).reduce((s, c) => s + permValue(c, MYPID), 0) > 8)){ sev = 'mistake'; why = `it wipes the board and you have ${myCr} creature${myCr === 1 ? '' : 's'}`; }
  else if ((tos.mv || 0) >= 6 || r.roles.has('tutor')){ sev = 'inaccuracy'; why = r.roles.has('tutor') ? 'tutors find the card that beats you' : `it is a ${tos.mv}-mana bomb`; }
  if (sev) trFlag(rec, 'let_resolve', sev, `You let ${nameOf(tos.pid)}'s ${tos.nm} resolve while holding ${cname(ctr[0])} — probably worth countering: ${why}.`, `Counter ${tos.nm} with ${cname(ctr[0])}.`);
}

/* ---- mulligans ---- */
function trHandShape(cards){
  const lands = cards.filter(c => isLand(c.k)).length;
  const cheap = cards.filter(c => !isLand(c.k) && (info(c.k)?.mv || 0) <= 3).length;
  const ramp = cards.filter(c => !isLand(c.k) && trR(c.k).roles.has('ramp') && (info(c.k)?.mv || 0) <= 2).length;
  return {n:cards.length, lands, cheap, ramp};
}
function trOnShip(hand){
  const h = trHandShape(hand); const first = (S.mull || 0) === 0 || ((S.mull || 0) === 1 && FMT[S.fmt] && FMT[S.fmt].freeMull);
  const adv = trAdvise('keep');
  const rec = trRec('ship', {hand:trNames(hand), lands:h.lands, mulligans:(S.mull || 0) + 1}, {adv});
  if (rec && h.n >= 7 && first && h.lands >= 3 && h.lands <= 4 && h.cheap >= 2)
    trFlag(rec, 'mulligan', 'mistake', `You shipped a 7-card hand with ${h.lands} lands and ${h.cheap} spells costing 3 or less — that is a keep.`, 'Keep hands with 3–4 lands and early plays.');
  else if (rec && h.n >= 7 && first && h.lands === 2 && h.ramp >= 1 && h.cheap >= 3)
    trFlag(rec, 'mulligan', 'inaccuracy', `You shipped 2 lands plus cheap ramp (${trList(hand.filter(c => !isLand(c.k) && trR(c.k).roles.has('ramp')))}) — usually a keep.`, 'Two lands plus a cheap mana rock or ramp spell is a keep.');
}
function trOnKeep(){
  const g = TR.g; if (!g || g.kept) return; g.kept = true;
  const hand = S.hand.slice(); const h = trHandShape(hand);
  const adv = trAdvise('keep');
  const rec = trRec('keep', {hand:trNames(hand), lands:h.lands, mulligans:S.mull || 0}, {adv}); if (!rec) return;
  if (h.lands === 0 && h.n >= 5) trFlag(rec, 'mulligan', 'blunder', `You kept ${h.n} cards with no lands.`, 'Always mulligan a hand with no lands.');
  else if (h.lands === 1 && h.n >= 6 && h.ramp === 0) trFlag(rec, 'mulligan', 'mistake', `You kept ${h.n} cards with 1 land and no cheap ramp — this hand misses land drops most games.`, 'Mulligan one-landers unless they have cheap ramp.');
  else if (h.lands >= 6 && h.n === 7) trFlag(rec, 'mulligan', 'mistake', `You kept 7 cards with ${h.lands} lands — almost nothing to do with all that mana.`, 'Mulligan hands with 6 or 7 lands.');
}

/* ---------------------------------------------------------------- judges: combat */
function trPreAttack(){
  const pot = S.bf.filter(c => { try { return !canAttack(c); } catch { return false; } });
  const opps = trOpps(); const lethal = opps.filter(o => o.life > 0 && trAtkLB(pot, o) >= o.life);
  const safe = opps.every(o => trCrackLB(o) < S.life);
  return {pot, opps, lethal, safe, saw:trSaw(), adv:trAdvise('attack'), sel:{...UI.atkSel}};
}
function trPostAttack(pre){
  const atk = S.bf.filter(c => c.atk); const byO = new Map();
  atk.forEach(c => { const d = parseDef(c.atk); if (d && d.t === 'player') { if (!byO.has(d.pid)) byO.set(d.pid, []); byO.get(d.pid).push(c); } });
  const rec = trRec('attack', {attackers:atk.map(c => `${cname(c)} → ${(() => { const d = parseDef(c.atk); return d && d.t === 'player' ? nameOf(d.pid) : 'a planeswalker/battle'; })()}`)}, {saw:pre.saw, adv:pre.adv});
  if (!rec) return;
  const T = trTurn(); if (atk.length) T.attacked = true;
  const lethalHit = pre.opps.some(o => byO.has(o.pid) && trAtkLB(byO.get(o.pid), o) >= o.life);
  // missed lethal
  if (pre.lethal.length && !lethalHit){
    const o = pre.lethal.sort((a, b) => a.life - b.life)[0];
    trFlag(rec, 'lethal', 'blunder', `You had lethal on ${o.nm}: ${pre.pot.length} creatures deal at least ${trAtkLB(pre.pot, o)} even if ${o.nm} blocks as well as possible, and ${o.nm} is at ${o.life}.`, `Attack ${o.nm} with everything (barring a trick, they are out).`);
  }
  // attacks into a blocker that eats the attacker for free
  for (const [pid, list] of byO){
    const o = pre.opps.find(x => x.pid === pid); if (!o) continue;
    const B = botCreatures(o.bf, pid).filter(b => !b.tp);
    if (trAtkLB(list, o) >= o.life || list.length > B.length + 1) continue;
    const trick = S.hand.some(h => { const r = trR(h.k); return !isLand(h.k) && r.instant && (r.roles.has('pump') || r.roles.has('protect')); });
    if (trick) continue;
    for (const c of list){
      const fs = x => botKw(x, 'first strike', x === c ? MYPID : pid) || botKw(x, 'double strike', x === c ? MYPID : pid);
      const eater = trBlockers(o, c).find(b => BL.kills(b, pid, c, MYPID) && (!BL.kills(c, MYPID, b, pid) || (fs(b) && !fs(c))));
      if (!eater) continue;
      const pc = botPT(c, MYPID), pb = botPT(eater, pid); const cmd = trIsCmd(c);
      trFlag(rec, cmd ? 'commander' : 'bad_attack', cmd || permValue(c, MYPID) >= 4 ? 'mistake' : 'inaccuracy',
        `${cname(c)} (${pc[0]}/${pc[1]}) attacked ${o.nm}, whose untapped ${cname(eater)} (${pb[0]}/${pb[1]}) can block it and kill it without dying${cmd ? ` — and your commander would cost {${2 * ((S.tax[c.k] || 0) + 1)}} more to recast` : ''}. Probably a free kill for them.`,
        `Keep ${cname(c)} home unless you have a combat trick.`);
      break;
    }
  }
  // feeding the leader (3+ players)
  if (pre.opps.length >= 2 && atk.length && !lethalHit){
    const tgt = [...byO.entries()].sort((a, b) => b[1].reduce((s, c) => s + trP1(c, MYPID), 0) - a[1].reduce((s, c) => s + trP1(c, MYPID), 0))[0];
    const leader = pre.opps.slice().sort((a, b) => trThreat(b) - trThreat(a))[0];
    if (tgt && leader && tgt[0] !== leader.pid){
      const o = pre.opps.find(x => x.pid === tgt[0]); const tl = trThreat(leader), to = o ? trThreat(o) : 0;
      const safeAtLeader = tgt[1].every(c => !trBlockers(leader, c).some(b => BL.kills(b, leader.pid, c, MYPID) && !BL.kills(c, MYPID, b, leader.pid)));
      if (o && tl >= to * 2 && tl - to >= 8 && safeAtLeader)
        trFlag(rec, 'feed_leader', 'tip', `You attacked ${o.nm}, the weakest board at the table, while ${leader.nm} is clearly ahead. Hitting ${o.nm} probably helps ${leader.nm} most.`, `Point the same attackers at ${leader.nm} — they can't block them profitably.`);
    }
  }
  if (pre.safe && atk.length) T.crack = {rec:rec.i, atk:atk.filter(c => !botKw(c, 'vigilance', MYPID)).map(c => c.id)};
}
function trPreBlock(pn, cb, auto){
  return {key:cbKey(pn, cb), apid:pn.pid, atts:attackersOnMe(pn).slice(), saw:trSaw(), adv:trAdvise('block'), auto:!!auto, life:S.life, psn:S.psn || 0};
}
// damage that reaches me with these blocks: [life damage, poison, commander-damage lethal?]
function trBlockDmg(atts, apid, blk){
  let dmg = 0, psn = 0, cmdDead = false;
  for (const a of atts){
    const bs = blk.filter(x => x.a === a.id).map(x => x.b);
    const p = trP1(a, apid) * Math.max(1, Math.min(30, a.n || 1));
    let through = bs.length ? 0 : p;
    if (bs.length && botKw(a, 'trample', apid)) through = Math.max(0, p - bs.reduce((s, b) => s + Math.max(0, botPT(b, MYPID)[1] - (b.dmg || 0)), 0));
    if (botKw(a, 'infect', apid)) psn += through; else dmg += through;
    if (a.cmd && through){ const k = Object.keys(S.cdt || {}).find(x => x.endsWith('|' + a.k)); if (((k && S.cdt[k]) || 0) + through >= 21) cmdDead = true; }
  }
  return {dmg, psn, dead:dmg >= S.life || (S.psn || 0) + psn >= 10 || cmdDead};
}
function trPostBlock(pre){
  const blk = S.bf.filter(c => c.blk != null && c.blk !== '').map(b => ({b, a:+b.blk}));
  const rec = trRec('block', {blocks:blk.map(x => { const a = pre.atts.find(y => y.id === x.a); return `${cname(x.b)} blocks ${a ? cname(a) : '?'}`; }), attackers:pre.atts.map(a => trBrief(a, pre.apid)), auto:pre.auto}, {saw:pre.saw, adv:pre.adv});
  if (!rec) return;
  const now = trBlockDmg(pre.atts, pre.apid, blk);
  if (now.dead){
    // could some legal set of blocks have kept me alive? (greedy: block the biggest attackers first)
    const free = botCreatures(S.bf, MYPID).filter(b => !b.tap); const used = new Set(); const plan = [];
    for (const a of pre.atts.slice().sort((x, y) => trP1(y, pre.apid) - trP1(x, pre.apid))){
      const need = hasMenace(a, pre.apid) ? 2 : 1;
      const can = free.filter(b => !used.has(b.id) && (() => { try { return !canBlock(b, a, pre.apid); } catch { return false; } })());
      if (can.length >= need) can.slice(0, need).forEach(b => { used.add(b.id); plan.push({b, a:a.id}); });
      if (!trBlockDmg(pre.atts, pre.apid, plan).dead) break;
    }
    if (plan.length && !trBlockDmg(pre.atts, pre.apid, plan).dead)
      trFlag(rec, 'no_block', 'blunder', `The unblocked damage (${now.dmg}${now.psn ? ' + ' + now.psn + ' poison' : ''}) was lethal at ${S.life} life, and you had blocks that kept you alive.`, `Block: ${plan.map(x => `${cname(x.b)} on ${cname(pre.atts.find(a => a.id === x.a))}`).join(', ')}.`);
    return;
  }
  // chump blocks that weren't needed
  for (const x of blk){
    const a = pre.atts.find(y => y.id === x.a); if (!a) continue;
    const gang = blk.filter(y => y.a === x.a);
    const killsA = gang.some(y => BL.kills(y.b, MYPID, a, pre.apid)) || gang.reduce((s, y) => s + Math.max(0, botPT(y.b, MYPID)[0]), 0) >= botPT(a, pre.apid)[1] - (a.dmg || 0);
    if (killsA || !BL.kills(a, pre.apid, x.b, MYPID)) continue;
    const without = trBlockDmg(pre.atts, pre.apid, blk.filter(y => y.a !== x.a));
    if (without.dead || S.life - without.dmg < Math.max(8, Math.ceil(S.life * 0.3)) || without.psn) continue;
    const v = permValue(x.b, MYPID); const cmd = trIsCmd(x.b);
    if (!cmd && v < 2.5) continue;
    trFlag(rec, cmd ? 'commander' : 'chump', cmd || v >= 5 ? 'mistake' : 'inaccuracy', `You chump-blocked ${cname(a)} with ${cname(x.b)}. Without that block you would still have been at ${S.life - without.dmg} life — you traded a ${cmd ? 'commander' : 'good creature'} for ${trP1(a, pre.apid)} life.`, `Take the damage and keep ${cname(x.b)}.`);
    break;
  }
}

/* ---------------------------------------------------------------- judges: the end of my turn */
function trEndTurn(fromPh){
  const g = TR.g; const T = trTurn(); if (T.ended) return; T.ended = true;
  const srcs = trSrcList(), pool = {...S.pool}; const v = botView(); const saw = trSaw();
  const castable = S.hand.filter(c => !isLand(c.k)).map(c => ({c, zone:'hand'})).concat(S.cz.map(c => ({c, zone:'cz'})))
    .filter(x => trCanCast(x.c, x.zone, srcs, pool));
  const useful = castable.filter(x => trUseful(x.c, v));
  const rec = trRec('end', {from:TR_PH[fromPh] || '', untappedMana:trTotal(srcs, pool), castable:useful.map(x => cname(x.c)), hand:S.hand.length}, {saw});
  if (!rec) return;
  // 1. missed land drop
  const played = S.landT && S.landT[0] === turnStr() && S.landT[1] > 0;
  const landsInHand = S.hand.filter(c => c.k && isLand(c.k)).filter(c => !(/return a land you control to its owner's hand/.test(trR(c.k).text) && !S.bf.some(b => b.k && isLand(b.k))));
  if (!played && landsInHand.length) trFlag(rec, 'land_drop', 'mistake', `You ended your turn without playing a land, holding ${trList([...new Set(trNames(landsInHand))])}.`, `Play ${cname(landsInHand[0])} before passing.`);
  // 2. mana and cards left unused (holding up an instant or an instant-speed ability is fine)
  const holding = S.hand.some(c => !isLand(c.k) && (trR(c.k).instant) && trCanPay(trCost(c, 'hand'), srcs, pool))
    || S.bf.some(c => { try { return abilityList(c).some(ab => !ab.sorc && costMana(ab.cost) && !trFetchAb(ab) && !abilityReady(c, ab, true)); } catch { return false; } });
  if (useful.length && !holding){
    const best = useful.slice().sort((a, b) => trR(b.c.k).value - trR(a.c.k).value)[0];
    const over = S.hand.length - (typeof curMaxHand === 'function' ? curMaxHand() : 7);
    if (over > 0 && !(typeof noMaxHand === 'function' && noMaxHand()))
      trFlag(rec, 'hand_size', 'mistake', `You'll discard ${over} card${over > 1 ? 's' : ''} at cleanup with ${trTotal(srcs, pool)} mana unused — ${cname(best.c)} (${trCostTxt(best.c)}) could have been cast instead.`, `Cast ${cname(best.c)} rather than discarding.`);
    else if (poolTotal(pool) && fromPh >= 3) trFlag(rec, 'mana_float', 'inaccuracy', `You had ${poolText(pool)} floating when the turn moved on — it emptied unused, and ${cname(best.c)} was castable.`, `Use floating mana before moving on, or tap only as you cast.`);
    else trFlag(rec, 'unused_mana', trTotal(srcs, pool) >= 3 && trR(best.c.k).value >= 0.4 ? 'mistake' : 'inaccuracy', `You passed with ${trTotal(srcs, pool)} untapped mana and could have cast ${trList(useful.slice(0, 3).map(x => x.c))}.`, `Cast ${cname(best.c)} (${trCostTxt(best.c)}) before ending your turn.`);
  }
  // 3. mana rocks that should have come first
  (T.rampPend || []).forEach(p => { if (S.hand.some(h => h.id === p.rock)) trFlag(g.recs[p.rec], 'ramp_first', 'mistake', `You cast ${p.spell} before ${p.rockNm}. Casting ${p.rockNm} first would have paid for itself and still left the mana for ${p.spell} — now it is stuck in your hand.`, `Cast ${p.rockNm} first, then ${p.spell}.`); });
  // 4. the land you played: tapped when the untapped one would have cast a spell / untapped when you didn't need the mana
  T.lands.forEach(L => {
    const lr = g.recs[L.rec]; if (!lr) return;
    if (L.tapped){
      const alt = L.others.find(o => !o.tapped && S.hand.some(h => h.id === o.id)); if (!alt) return;
      const altCard = S.hand.find(h => h.id === alt.id); let outs = []; try { outs = manaAbs(altCard).filter(ab => ab.tapOnly).flatMap(ab => ab.outs); } catch {} if (!outs.length) return;
      const plus = srcs.concat([{id:-2, nm:cname(altCard), opts:[...new Map(outs.map(o => [o.join(''), o])).values()]}]);
      const x = S.hand.filter(h => !isLand(h.k) && !trR(h.k).instant && trUseful(h, v)).find(h => !trCanCast(h, 'hand', srcs, pool) && trCanCast(h, 'hand', plus, pool));
      if (x) trFlag(lr, 'land_choice', 'mistake', `You played ${cname({k:L.k})}, which entered tapped, and ended the turn one mana short of ${cname(x)}. ${cname(altCard)} would have entered untapped and let you cast it.`, `Play ${cname(altCard)} this turn and the tapped land on a turn you don't need the mana.`);
    } else {
      const tl = L.others.find(o => o.tapped && S.hand.some(h => h.id === o.id)); const me = S.bf.find(b => b.id === L.id);
      const instants = S.hand.some(h => !isLand(h.k) && trR(h.k).instant);
      if (tl && me && !me.tap && !useful.length && !instants && trTotal(srcs, pool) >= 1)
        trFlag(lr, 'land_choice', 'tip', `You played ${cname({k:L.k})} but never used its mana this turn. ${cname({k:tl.k})} enters tapped — this was the turn to play it.`, `Play tapped lands on turns you don't need the mana.`);
    }
  });
  // 5. plain creatures cast before an attack
  if (T.attacked && T.pre1.length){
    const r0 = g.recs[T.pre1[0]]; const c0 = r0 && T.casts.find(x => x.rec === r0.i);
    if (c0){ const r = trR(c0.k); const plain = !/[:]|\bwhen\b|\bwhenever\b|creatures you control|\bother\b|at the beginning|\bhaste\b|\bas long as\b|\battack/.test(r.text.replace(/\([^)]*\)/g, ''));
      if (plain) trFlag(r0, 'precombat', 'tip', `You cast ${cname({k:c0.k})} before combat, but it can't attack this turn and has no effect on the fight. Cast after combat, it keeps your opponents guessing about your open mana.`, `Attack first, then cast ${cname({k:c0.k})} in main phase 2.`); }
  }
  // 6. overextending when already far ahead
  const crCast = T.casts.filter(x => x.creature && x.mine);
  if (crCast.length >= 2){
    const myCr = botCreatures(S.bf, MYPID); const myP = BL.boardPower(S.bf, MYPID); const opps = trOpps();
    const maxO = Math.max(0, ...opps.map(o => BL.boardPower(o.bf, o.pid)));
    if (myCr.length >= 5 && myP >= maxO * 2 + 4 && !S.hand.some(h => trR(h.k).creature) && opps.some(o => o.hc >= 3))
      trFlag(g.recs[crCast[crCast.length - 1].rec], 'overextend', 'tip', `You were already far ahead on board (power ${myP} against at most ${maxO}) and emptied your hand of creatures. A single board wipe now costs you everything.`, 'Keep one or two creatures in hand to rebuild after a wipe.');
  }
  // 7. the crack-back
  if (T.crack){
    const dead = trOpps().map(o => ({o, d:trCrackLB(o)})).filter(x => x.d >= S.life).sort((a, b) => b.d - a.d)[0];
    if (dead) trFlag(g.recs[T.crack.rec], 'crack_back', 'blunder', `After your attack you have ${botCreatures(S.bf, MYPID).filter(b => !b.tap).length} untapped creature${botCreatures(S.bf, MYPID).filter(b => !b.tap).length === 1 ? '' : 's'} left to block, and ${dead.o.nm}'s creatures can hit you for at least ${dead.d} next turn — you are at ${S.life}. Probably dead on the crack-back.`, `Keep enough creatures home to block (before attacking you were safe).`);
  }
  // 8. fetch lands left uncracked: checked at my next untap
  g.fetchHold = {rec:rec.i, ids:S.bf.filter(c => !c.tap && c.k && isLand(c.k) && (() => { try { return abilityList(c).some(trFetchAb) && !(/untap that land/.test(trR(c.k).text) && S.bf.filter(b => b.k && isLand(b.k)).length >= 4); } catch { return false; } })()).map(c => c.id)};
  trQuietSummary();
}
function trTurnStart(){
  const g = TR.g; const h = g && g.fetchHold; g && (g.fetchHold = null);
  if (h && h.ids.length){ const still = S.bf.filter(c => h.ids.includes(c.id) && !c.tap);
    if (still.length) trFlag(g.recs[h.rec], 'fetch', 'inaccuracy', `${cname(still[0])} sat uncracked through your opponents' turns. The land it fetches enters tapped, so cracking it at the end of an opponent's turn (or right away) would have had that land untapped now.`, `Crack ${cname(still[0])} the turn you play it, or at the end of the turn before yours.`); }
}
function trManaFloat(fromPh){
  if (!poolTotal(S.pool)) return;
  const v = botView(); const srcs = trSrcList();
  const use = S.hand.filter(c => !isLand(c.k)).filter(c => trCanCast(c, 'hand', [], S.pool) && trUseful(c, v));
  if (!use.length) return;
  const rec = trRec('end', {from:TR_PH[fromPh], floating:poolText(S.pool)});
  trFlag(rec, 'mana_float', 'inaccuracy', `You left ${poolText(S.pool)} floating at the end of ${TR_PH[fromPh]} — it emptied unused, and ${cname(use[0])} could have been cast with it.`, `Spend floating mana before moving on (or tap only as you cast).`);
  void srcs;
}
function trOnChoice(m, val){
  const title = String(m.title || '');
  const opt = (m.options || []).find(o => o.value === val);
  const rec = trRec('choice', {question:short(title, 120), answer:opt ? String(opt.label || '') : String(val)});
  const cz = title.match(/^(.+?) is going to your (graveyard|exile|library|hand)\. Move it to the command zone instead\?/);
  if (rec && cz && val === false) trFlag(rec, 'commander', 'mistake', `You left ${cz[1]} in your ${cz[2]}. From there you usually can't cast it again; from the command zone you can, for {2} more.`, 'Send your commander to the command zone.');
}

/* ---------------------------------------------------------------- summaries, game end, coaching profile */
function trQuietSummary(){
  const g = TR.g; if (!g || TR.mode !== 'quiet') return;
  const fs = g.finds.slice(g.sumTo); g.sumTo = g.finds.length; if (!fs.length) return;
  const cnt = {}; fs.forEach(f => { cnt[f.sev] = (cnt[f.sev] || 0) + 1; });
  const parts = Object.keys(TR_SEV).filter(s => cnt[s]).map(s => `${cnt[s]} ${TR_SEV[s].lab.toLowerCase()}${cnt[s] > 1 ? 's' : ''}`);
  trToast({sev:fs.sort((a, b) => TR_SEV[a.sev].ord - TR_SEV[b.sev].ord)[0].sev, msg:`Turn ${phaseNow().n}: ${parts.join(', ')}. ${short(fs[0].msg, 110)}`, summary:true});
}
function trFinish(result){
  const g = TR.g; if (!g || g.done) return; g.done = true; g.result = result || 'unfinished';
  const judged = g.recs.filter(r => TR_JUDGED.has(r.kind)).length;
  if (judged >= 5){
    const cats = {}; g.finds.forEach(f => { cats[f.cat] = (cats[f.cat] || 0) + 1; });
    const sev = {}; g.finds.forEach(f => { sev[f.sev] = (sev[f.sev] || 0) + 1; });
    TR.prof.games.push({id:g.id, at:g.at, end:Date.now(), acc:trScore(g), n:judged, turns:Math.max(0, ...g.recs.map(r => r.t)), np:g.np, fmt:g.fmt, result:g.result, cats, sev});
    TR.prof.games = TR.prof.games.slice(-60);
  }
  TR.last = g; trSaveProf(); trStoreSet(TR_CUR, null);
  if (judged >= 1 && TR.mode !== 'off'){
    if (TR.mode === 'review'){ TR.tab = 'review'; trOpen(true); }
    else trToast({sev:'tip', msg:`Game over — your accuracy ${trScore(g) ?? '–'}%. Open Game ▾ → Trainer for the review.`, summary:true});
  }
}
// the coach: top recurring weaknesses, moving from basics to sequencing to decisions as the basics improve
function trCoach(){
  const games = TR.prof.games.filter(x => x.n >= 5); const N = games.length;
  const last5 = games.slice(-5), prev5 = games.slice(-10, -5), last10 = games.slice(-10);
  const inG = (list, cat) => list.filter(x => (x.cats || {})[cat]).length;
  const active = t => Object.keys(TR_CATS).some(c => TR_CATS[c].tier === t && inG(last5, c) >= Math.min(2, last5.length));
  const stage = !N ? 1 : active(1) ? 1 : active(2) ? 2 : 3;
  const rows = Object.keys(TR_CATS).map(cat => {
    const g5 = inG(last5, cat), tot = last10.reduce((s, x) => s + ((x.cats || {})[cat] || 0), 0); if (!g5 && !tot) return null;
    const tier = TR_CATS[cat].tier; const f = tier === stage ? 1.5 : tier < stage ? 1 : stage === 1 ? 0.6 : 0.9;
    return {cat, tier, score:(g5 * 2 + tot * 0.5) * f, g5, n5:last5.length, gp:inG(prev5, cat), np:prev5.length, tot};
  }).filter(Boolean).sort((a, b) => b.score - a.score);
  const weak = rows.slice(0, 3);
  const accs = last10.map(x => x.acc).filter(x => x != null);
  const STAGE = {1:'Basics: land drops, mana use and mulligans', 2:'Sequencing: the order you play things and the lands you tap', 3:'Decision-making: combat math, holding interaction, threat assessment'};
  const focus = weak.length ? TR_CATS[weak[0].cat].focus : stage === 3 ? 'Before every attack, count the crack-back; before every removal spell, find the biggest threat.' : 'Play every land drop and spend your mana every turn.';
  return {N, stage, stageText:STAGE[stage], weak, rows, focus, accs};
}

/* ---------------------------------------------------------------- the stage-3 decision record (privacy-safe: no player names, no table code) */
function trCoachRecord(g = TR.g || TR.last){
  if (!g) return null;
  const names = new Map(); for (const [pid, lab] of Object.entries(g.opp || {})){ const nm = OPP.get(pid)?.nm; if (nm) names.set(nm, lab); }
  const anon = s => { let t = String(s || ''); for (const [nm, lab] of names) t = t.split(nm).join(lab); return t; };
  const deep = x => typeof x === 'string' ? anon(x) : Array.isArray(x) ? x.map(deep) : x && typeof x === 'object' ? Object.fromEntries(Object.entries(x).map(([k, v]) => [k, deep(v)])) : x;
  const c = trCoach();
  return {format:'proxy-table/decisions@1',
    game:{format:(FMT[g.fmt] || {}).label || g.fmt, players:g.np, turns:Math.max(0, ...g.recs.map(r => r.t)), result:g.result || 'in progress', accuracy:trScore(g), adviceLevel:trAdvLevel()},
    decisions:g.recs.map(r => ({n:r.i, turn:r.t, phase:TR_PH[r.ph] || 'pregame', yourTurn:r.mine, kind:r.kind, did:deep(r.did), saw:deep(r.saw), bot:r.adv ? deep({level:r.adv.level, move:r.adv.move, reason:r.adv.reason}) : null,
      flags:r.fl.map(f => ({category:f.cat, label:TR_CATS[f.cat].label, severity:f.sev, message:anon(f.msg), better:anon(f.better)}))})),
    profile:{games:c.N, stage:c.stage, topWeaknesses:c.weak.map(x => x.cat), recentAccuracy:c.accs}};
}

/* ---------------------------------------------------------------- UI: pill, toasts, panel */
const TR_CSS = `#trToasts{position:fixed;left:50%;transform:translateX(-50%);bottom:calc(196px + env(safe-area-inset-bottom));z-index:79;display:flex;flex-direction:column;gap:6px;width:min(540px,92vw);pointer-events:none}
.trT{pointer-events:none;background:rgba(11,19,17,.95);border:1px solid var(--line);border-left:4px solid var(--sevc);border-radius:9px;padding:7px 11px;font-size:13.5px;box-shadow:0 8px 24px rgba(0,0,0,.45);transition:opacity .4s}
.trT b{color:var(--sevc);margin-right:6px}
#trPanel{position:fixed;right:10px;top:54px;width:min(440px,94vw);max-height:calc(100vh - 70px);overflow:auto;z-index:75;background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:12px;box-shadow:0 14px 40px rgba(0,0,0,.55);font-size:13.5px}
#trPanel h3{margin:0;font:700 18px/1.1 var(--f-display);display:flex;align-items:center;gap:8px}
#trPanel .trrow{display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin:8px 0}
#trPanel .trtabs button[aria-pressed=true],#trPanel .trmode button[aria-pressed=true]{background:var(--brass);color:var(--brass-ink);border-color:var(--brass)}
#trPanel .trscore{font:800 34px/1 var(--f-display);color:var(--brass)}
#trPanel .trf{border-left:3px solid var(--sevc);padding:4px 8px;margin:6px 0;background:var(--panel-2);border-radius:6px}
#trPanel .trf .sev{color:var(--sevc);font-weight:700}
#trPanel .trbetter{color:var(--good)}
#trPanel .trd{padding:4px 0;border-bottom:1px solid var(--line)}
#trPanel .trd small{color:var(--dim)}
#trPanel .trbar{display:inline-block;width:12px;margin-right:2px;background:var(--brass);vertical-align:bottom;border-radius:2px}
#trPanel .hint{color:var(--dim)}
#trPill .trbadge{background:var(--bad);color:#fff;border-radius:999px;padding:0 6px;margin-left:4px;font-size:11px}`;
function trEnsureDom(){
  if (BOTMODE || document.getElementById('trToasts')) return;
  const st = document.createElement('style'); st.textContent = TR_CSS; document.head.appendChild(st);
  const t = document.createElement('div'); t.id = 'trToasts'; t.setAttribute('role', 'status'); t.setAttribute('aria-live', 'polite'); document.body.appendChild(t);
  const p = document.createElement('div'); p.id = 'trPanel'; p.hidden = true; p.setAttribute('role', 'dialog'); p.setAttribute('aria-label', 'Trainer'); document.body.appendChild(p);
}
function trToast(f){
  trEnsureDom(); const box = document.getElementById('trToasts'); if (!box) return;
  const el = document.createElement('div'); el.className = 'trT'; el.style.setProperty('--sevc', TR_SEV[f.sev].col);
  el.innerHTML = `<b>${f.summary ? 'Trainer' : TR_SEV[f.sev].lab}</b>${esc(f.msg)}${f.better && !f.summary ? `<div style="color:var(--good)">→ ${esc(f.better)}</div>` : ''}`;
  box.appendChild(el); while (box.children.length > 3) box.firstChild.remove();
  setTimeout(() => { el.style.opacity = '0'; setTimeout(() => el.remove(), 450); }, f.summary ? 6500 : 8000);
}
function trPillHTML(){
  if (TR.mode === 'off' || !TR.g) return `<button class="btn small" id="trPill" data-act="trOpen" type="button" title="Trainer (off)">Trainer</button>`;
  const sc = trScore(TR.g); const unseen = TR.g.finds.length - (TR.g.seen || 0);
  return `<button class="btn small" id="trPill" data-act="trOpen" type="button" title="Trainer: your decisions this game">Trainer${sc != null ? ' · ' + sc + '%' : ''}${unseen > 0 && TR.mode !== 'review' ? `<span class="trbadge">${unseen}</span>` : ''}</button>`;
}
function trPillUpdate(){ if (BOTMODE) return; const el = document.getElementById('trPill'); if (el) el.outerHTML = trPillHTML(); }
function trOpen(show){ trEnsureDom(); TR.open = show !== false; const p = document.getElementById('trPanel'); if (!p) return; p.hidden = !TR.open; if (TR.open){ if (TR.g) TR.g.seen = TR.g.finds.length; trRender(); trPillUpdate(); } }
function trFindHTML(f, g){
  const r = g.recs[f.i];
  return `<div class="trf" style="--sevc:${TR_SEV[f.sev].col}"><span class="sev">${TR_SEV[f.sev].lab}</span> · <small>${esc(TR_CATS[f.cat].label)} · turn ${f.t}${r ? ' · ' + esc(trRecLabel(r)) : ''}</small><div>${esc(f.msg)}</div>${f.better ? `<div class="trbetter">Better: ${esc(f.better)}</div>` : ''}</div>`;
}
function trRecLabel(r){
  const d = r.did || {};
  switch (r.kind){
    case 'land': return 'played ' + d.card; case 'cast': return 'cast ' + d.card + (d.targets && d.targets.length ? ' → ' + d.targets.join(', ') : ''); case 'ab': return 'activated ' + d.card;
    case 'attack': return d.attackers && d.attackers.length ? 'attacked: ' + d.attackers.join(', ') : 'no attack'; case 'block': return d.blocks && d.blocks.length ? 'blocked: ' + d.blocks.join(', ') : 'no blocks';
    case 'keep': return `kept ${d.hand.length} (${d.lands} lands)`; case 'ship': return `mulligan (${d.lands} lands)`; case 'pass': return `let ${d.on} resolve`;
    case 'end': return d.floating ? `left ${d.floating} floating` : `ended the turn (${d.untappedMana} mana open)`; case 'choice': return `${d.question}: ${d.answer}`;
  }
  return r.kind;
}
function trRender(){
  const p = document.getElementById('trPanel'); if (!p || p.hidden) return;
  const g = TR.g && TR.g.recs.length ? TR.g : (TR.last || TR.g);
  const modeB = ['off', 'quiet', 'live', 'review'].map(m => `<button type="button" class="btn small" data-act="trMode" data-m="${m}" aria-pressed="${TR.mode === m}">${{off:'Off', quiet:'Quiet', live:'Live', review:'Review'}[m]}</button>`).join('');
  const tabs = [['game', 'This game'], ['review', 'Review'], ['coach', 'Coach']].map(([t, l]) => `<button type="button" class="btn small" data-act="trTab" data-t="${t}" aria-pressed="${TR.tab === t}">${l}</button>`).join('');
  let body = '';
  const lvl = BOT_LEVELS[trAdvLevel()]?.label || 'Intermediate';
  if (TR.tab === 'game'){
    if (!g || !g.recs.length) body = `<p class="hint">${TR.mode === 'off' ? 'The trainer is off. Pick Quiet, Live or Review to start.' : 'No decisions recorded yet. Play — the trainer watches your own moves only.'}</p>`;
    else {
      const sc = trScore(g); const cnt = {}; g.finds.forEach(f => { cnt[f.sev] = (cnt[f.sev] || 0) + 1; });
      const agree = g.recs.filter(r => r.adv && TR_JUDGED.has(r.kind)); const same = agree.filter(r => trSame(r)).length;
      body = `<div class="trrow"><span class="trscore">${sc ?? '–'}%</span><span>accuracy over ${g.recs.filter(r => TR_JUDGED.has(r.kind)).length} decisions${g === TR.last && g.done ? ' (last game)' : ''}<br><small class="hint">${Object.keys(TR_SEV).map(s => `${cnt[s] || 0} ${TR_SEV[s].lab.toLowerCase()}${(cnt[s] || 0) === 1 ? '' : 's'}`).join(' · ')}${agree.length ? ` · matched the ${esc(lvl)} bot on ${same} of ${agree.length}` : ''}</small></span></div>` +
        (g.finds.length ? g.finds.slice().reverse().slice(0, 12).map(f => trFindHTML(f, g)).join('') : '<p class="hint">Nothing flagged so far — clean play.</p>');
    }
  } else if (TR.tab === 'review'){
    if (!g || !g.recs.length) body = '<p class="hint">Play a game: every decision you make shows up here, with what the trainer thought of it.</p>';
    else {
      const cats = [...new Set(g.finds.map(f => f.cat))];
      const opts = [['all', 'All decisions'], ['flagged', 'Flagged only'], ...Object.keys(TR_SEV).map(s => [s, TR_SEV[s].lab + 's']), ...cats.map(c => ['cat:' + c, TR_CATS[c].label])];
      const keep = r => TR.filter === 'all' ? (TR_JUDGED.has(r.kind) || r.fl.length) : TR.filter === 'flagged' ? r.fl.length : TR.filter.startsWith('cat:') ? r.fl.some(f => f.cat === TR.filter.slice(4)) : r.fl.some(f => f.sev === TR.filter);
      const list = g.recs.filter(keep);
      body = `<div class="trrow"><label class="hint" for="trFilter">Show</label><select id="trFilter" style="width:auto">${opts.map(([v, l]) => `<option value="${esc(v)}" ${TR.filter === v ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select><small class="hint">${list.length} of ${g.recs.length}</small></div>
        <div id="trTimeline">${list.map(r => `<div class="trd" data-rec="${r.i}"><small>T${r.t} · ${esc(TR_PH[r.ph] || 'pregame')}${r.mine ? '' : ' (their turn)'}</small> ${esc(trRecLabel(r))}${r.adv && r.adv.move ? `<br><small>${esc(BOT_LEVELS[r.adv.level]?.label || r.adv.level)} bot: ${esc(r.adv.move)}${r.adv.reason ? ' (' + esc(r.adv.reason) + ')' : ''}${trSame(r) ? ' ✓' : ''}</small>` : ''}${r.fl.map(f => trFindHTML(f, g)).join('')}</div>`).join('') || '<p class="hint">Nothing matches.</p>'}</div>`;
    }
  } else {
    const c = trCoach();
    const prog = x => x.np ? `${x.gp} of ${x.np} earlier games → ${x.g5} of ${x.n5} recent games` : (x.n5 === 1 ? 'in your last game' : `in ${x.g5} of your last ${x.n5} games`);
    body = c.N < 3 ? `<p class="hint">The coach needs a few finished games to spot patterns (${c.N} so far, games with 5+ decisions). Until then it shows what it sees.</p>` : '';
    body += `<div class="trrow"><b>Now working on:</b> ${esc(c.stageText)}</div>`;
    body += c.weak.length ? c.weak.map((x, i) => `<div class="trf" style="--sevc:${['#e3705b', '#e8a04f', '#d4c24f'][i]}"><b>${i + 1}. ${esc(TR_CATS[x.cat].label)}</b> <small class="hint">${esc(prog(x))}</small><div>${esc(TR_CATS[x.cat].lesson)}</div></div>`).join('') : '<p class="hint">No recurring weaknesses yet.</p>';
    body += `<div class="trf" style="--sevc:var(--good)"><b>Focus for your next game:</b> ${esc(c.focus)}</div>`;
    if (c.accs.length) body += `<div class="trrow"><small class="hint">Accuracy, last ${c.accs.length} games:</small><span aria-label="${c.accs.join(', ')}">${c.accs.map(a => `<span class="trbar" title="${a}%" style="height:${Math.max(3, Math.round(a / 4))}px"></span>`).join('')}</span><small>${c.accs[c.accs.length - 1]}%</small></div>`;
    body += `<div class="trrow"><button type="button" class="btn small" data-act="trExport">Export my data</button><button type="button" class="btn small" data-act="trReset">${TR.resetArm ? '<span class="warn">Click again to erase the profile</span>' : 'Reset profile'}</button></div><p class="hint">Stored only in this browser. Bots and other players never see it.</p>`;
  }
  p.innerHTML = `<div class="trrow" style="margin-top:0"><h3>Trainer</h3><span class="spacer" style="flex:1"></span><button type="button" class="btn small" data-act="trClose" aria-label="Close the trainer">✕</button></div>
    <div class="trrow trmode" role="group" aria-label="Trainer mode">${modeB}</div><small class="hint">${{off:'Off: nothing is recorded.', quiet:'Quiet: a short summary at the end of each of your turns.', live:'Live: a small note right after a flagged move. It never blocks play.', review:'Review: no interruptions; the full timeline opens when the game ends.'}[TR.mode]} Compared with the ${esc(lvl)} bot.</small>
    <div class="trrow trtabs" role="tablist">${tabs}</div>${body}`;
}
function trSame(r){ if (!r.adv || !r.adv.move) return false; const lab = trRecLabel(r).toLowerCase(), mv = String(r.adv.move).toLowerCase();
  if (r.kind === 'keep') return mv === 'keep'; if (r.kind === 'ship') return mv === 'mulligan'; if (r.kind === 'pass') return mv === 'pass';
  if (r.kind === 'land' || r.kind === 'cast'){ const card = String(r.did.card || '').toLowerCase(); return !!card && mv.includes(card); }
  if (r.kind === 'attack' || r.kind === 'block'){ const norm = x => x.replace(/^(attacked|blocked): /, '').split(/,\s*/).map(y => y.trim()).sort().join('|'); return norm(mv) === norm(lab); }
  return false; }
function trSetMode(m){ if (!['off', 'quiet', 'live', 'review'].includes(m)) return; TR.mode = m; if (TR.g) TR.g.sumTo = TR.g.finds.length; trSaveProf(); if (m !== 'off' && S && !TR.g) trWatch(); trPillUpdate(); trRender(); try { botPanelRender(); } catch {} }
function trExport(){
  const data = {exported:new Date().toISOString(), profile:TR.prof, lastGame:trCoachRecord(TR.last), currentGame:TR.g && TR.g !== TR.last ? trCoachRecord(TR.g) : null};
  try { const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 1)], {type:'application/json'})); const a = document.createElement('a'); a.href = url; a.download = 'proxy-table-trainer.json'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 2000); } catch (e){ trErr(e); }
  return data;
}

/* ---------------------------------------------------------------- watching: wrappers around the player's own actions (local human only) */
function trWatch(){
  if (!trOn() || $('#game').hidden) return;
  const key = trKey();
  if (!TR.g || TR.g.key !== key){
    if (TR.g && !TR.g.done) trFinish('unfinished');
    const cur = trStoreGet(TR_CUR); TR.g = cur && cur.key === key && !cur.done ? {...cur, tc:{}, pend:[]} : trNewGame(key);
    if (phaseNow().n > 0) TR.g.kept = true;
    trPillUpdate();
  }
  const g = TR.g; if (g.done) return;
  const pn = phaseNow(); g.np = Math.max(g.np || 1, players().length);
  if (pn.n > 0 && !g.kept) trGuard(trOnKeep);
  if (poolTotal(S.pool) === 0 && !UI.casting) trGuard(trSetBase);
  // the game is over for me
  const opps = [...OPP.values()];
  if (S.lost || S.j18out) trFinish('lost');
  else if (opps.length && opps.every(o => o.lost || o.b27lost) && pn.n > 0) trFinish('won');
  if (TR.dirty && Date.now() - TR.savedAt > 8000) trSaveCur();
}
if (!BOTMODE){
  trLoad();
  /* ---- trap: while the trainer is judging, any look into a bot's window or someone else's saved data is recorded ---- */
  try { const d = Object.getOwnPropertyDescriptor(HTMLIFrameElement.prototype, 'contentWindow'); if (d && d.get) Object.defineProperty(HTMLIFrameElement.prototype, 'contentWindow', {configurable:true, get(){ if (TR.judging) trPeek('iframe.contentWindow'); return d.get.call(this); }}); } catch {}
  try { const gi = Storage.prototype.getItem; Storage.prototype.getItem = function(k){ if (TR.judging && !/^pt\.trainer/.test(String(k))) trPeek('localStorage:' + k); return gi.apply(this, arguments); }; } catch {}
  /* ---- end trap ---- */
  { const bc = beginCast; beginCast = async function(c, zone, o = {}){
      if (!trOn() || !c || !c.k || UI.casting || UI.resolving || isLand(c.k)) return bc.apply(this, arguments);
      const pre = trGuard(() => trPreCast(c, zone, o || {}));
      const r = await bc.apply(this, arguments);
      trGuard(() => { if (!pre) return; const it = S.stk.find(x => x.kind === 'spell' && x.card === c); if (it && ((S.castHist || []).length > pre.hist || S.stk.length > pre.stk)) trPostCast(pre, it); });
      return r; }; }
  { const pl = playLand; playLand = function(c){
      if (!trOn() || !c || UI.resolving) return pl.apply(this, arguments);
      const pre = trGuard(() => trPreLand(c)); const r = pl.apply(this, arguments);
      trGuard(() => { if (pre && !pre.wasBf && S.bf.some(b => b.id === c.id)) trPostLand(pre); });
      return r; }; }
  { const aa = activateAbility; activateAbility = async function(c, ab){
      if (!trOn() || !c || !ab || UI.casting || UI.resolving) return aa.apply(this, arguments);
      const pre = trGuard(() => { if (poolTotal(S.pool) === 0) trSetBase(); const pn = phaseNow(); return {nm:cname(c), n0:S.stk.length, saw:trSaw(), adv:pn.mine && (pn.ph === 3 || pn.ph === 5) && !stackAll().length ? trAdvise('main') : null}; });
      const r = await aa.apply(this, arguments);
      trGuard(() => { const it = S.stk.slice(pre ? pre.n0 : 0).find(x => x.kind === 'ability' && x.srcId === c.id); if (pre && it) trPostAb(pre, c, ab, it); });
      return r; }; }
  { const qt = quickTap; quickTap = function(){ if (trOn() && poolTotal(S.pool) === 0) trGuard(trSetBase); return qt.apply(this, arguments); }; }
  { const am = activateMana; activateMana = async function(){ if (trOn() && poolTotal(S.pool) === 0) trGuard(trSetBase); return am.apply(this, arguments); }; }
  { const da = declareAttackers; declareAttackers = function(){
      const pre = trOn() ? trGuard(() => { const pn = phaseNow(); return pn.mine && S.cb && S.cb.step === 'atk' ? trPreAttack() : null; }) : null;
      const r = da.apply(this, arguments);
      if (pre) trGuard(() => { if (S.cb && S.cb.step !== 'atk') trPostAttack(pre); });
      return r; }; }
  { const cfb = confirmBlocks; confirmBlocks = function(auto){
      const pre = trOn() ? trGuard(() => { const pn = phaseNow(); const cb = cbOf(pn); return !pn.mine && cb && cb.step === 'blk' && (S.bd || '') !== cbKey(pn, cb) && attackersOnMe(pn).length ? trPreBlock(pn, cb, auto) : null; }) : null;
      const r = cfb.apply(this, arguments);
      if (pre) trGuard(() => { if ((S.bd || '') === pre.key) trPostBlock(pre); });
      return r; }; }
  { const dp = doPass; doPass = function(){ if (trOn() && TR.g) trGuard(trOnPass); return dp.apply(this, arguments); }; }
  { const mu = mulligan; mulligan = function(){ if (trOn()){ trWatch(); const hand = S.hand.slice(); trGuard(() => trOnShip(hand)); } return mu.apply(this, arguments); }; }
  { const tc = turnChanged; turnChanged = function(){ if (trOn()){ trWatch(); if (TR.g && !TR.g.kept && phaseNow().n > 0) trGuard(trOnKeep); } return tc.apply(this, arguments); }; }
  { const sp = setPhase; setPhase = function(i){
      if (trOn() && TR.g && !TR.g.done) trGuard(() => { const pn = phaseNow(); if (!pn.mine || S.lost) return;
        if (i === 0) trTurnStart();
        else if (i === 4 && pn.ph === 3) trManaFloat(3);
        else if (i === 6 && pn.ph >= 1 && pn.ph <= 5) trEndTurn(pn.ph); });
      return sp.apply(this, arguments); }; }
  { const ac = askChoice; askChoice = function(m){ const p = ac.apply(this, arguments); if (!trOn() || !m || !TR.g || phaseNow().n === 0) return p; return Promise.resolve(p).then(v => { trGuard(() => trOnChoice(m, v)); return v; }); }; }
  { const ng = newGame; newGame = function(){ if (TR.g && !TR.g.done) trGuard(() => trFinish('unfinished')); return ng.apply(this, arguments); }; }
  { const cn = closeNet; closeNet = function(){ if (TR.g && !TR.g.done) trGuard(() => trFinish('unfinished')); return cn.apply(this, arguments); }; }
  { const rt = renderTop; renderTop = function(){ const r = rt.apply(this, arguments); try { const tb = document.getElementById('topbar'); const gm = tb && tb.querySelector('[data-act="gameMenu"]'); if (gm && !document.getElementById('trPill')) gm.insertAdjacentHTML('beforebegin', trPillHTML()); } catch {} return r; }; }
  { const gm = gameMenu; gameMenu = function(){ const r = gm.apply(this, arguments); try { const m = $('#menu'); if (m && !m.hidden && S) m.insertAdjacentHTML('beforeend', `<div class="sep"></div>` + mb('trOpen', `Trainer… <small>(${{off:'off', quiet:'quiet', live:'live', review:'review'}[TR.mode]})</small>`)); } catch {} return r; }; }
  // the bots lobby: trainer mode next to the bot seats
  { const bph = botPanelHTML; botPanelHTML = function(){ const h = bph.apply(this, arguments);
      return h + `<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap" id="trLobby"><label class="label" for="trLobbyMode">Trainer</label><select id="trLobbyMode" style="width:auto">${['off', 'quiet', 'live', 'review'].map(m => `<option value="${m}" ${TR.mode === m ? 'selected' : ''}>${{off:'Off', quiet:'Quiet (end-of-turn summary)', live:'Live (note after each flagged move)', review:'Review (after the game)'}[m]}</option>`).join('')}</select><button class="btn small" type="button" data-act="trOpen" data-t="coach">Coach…</button><small class="hint">Watches your own moves only; works in any game.</small></div>`; }; }
  document.addEventListener('change', e => { if (e.target.id === 'trLobbyMode') trSetMode(e.target.value); if (e.target.id === 'trFilter'){ TR.filter = e.target.value; trRender(); } });
  Object.assign(ACT, {
    trOpen(el){ closeMenu(); if (el && el.dataset && el.dataset.t) TR.tab = el.dataset.t; trOpen(true); },
    trClose(){ trOpen(false); },
    trMode(el){ trSetMode(el.dataset.m); },
    trTab(el){ TR.tab = el.dataset.t; TR.resetArm = false; trRender(); },
    trExport(){ trExport(); },
    trReset(){ if (!TR.resetArm){ TR.resetArm = true; trRender(); return; } TR.resetArm = false; TR.prof = {v:1, games:[]}; TR.last = null; trStoreSet(TR_KEY, null); trStoreSet(TR_CUR, null); trSaveProf(); trRender(); },
  });
  setInterval(() => { try { trWatch(); } catch (e){ trErr(e); } }, 500);
  window.addEventListener('pagehide', () => { try { if (TR.g && !TR.g.done && TR.dirty) trSaveCur(); } catch {} });
}
