/* =================== fix21a: intervening "if" triggers (CR 603.4) (GAPS21, helper S) ===================
   "When/Whenever/At <event>, if <condition>, <effect>":
   - the condition is checked when the event happens: if it's false the ability doesn't trigger at all (nothing goes on the
     stack, nothing is asked, no log line);
   - if it's true the ability goes on the stack and its targets (and modes) are chosen then, like every other trigger (603.3d);
   - the condition is checked again as the ability resolves: if it's false then, the ability does nothing (one log line).
   One evaluator (s21Cond) answers every condition written on the 7,000 cards' triggers. It reuses the engine's per-turn
   records and the shared checker jCond (engine23j/24n/27f); conditions about the trigger event itself ("it had counters on it",
   "no mana was spent to cast it", "it was kicked" …) are facts about that event, so the answer found when it triggered is kept.
   The deck checker counts a card as fully understood only if each intervening condition is one the evaluator knows. */
const S21 = {inPush:0, res:null};
const S21N = {a:1, an:1, one:1, two:2, three:3, four:4, five:5, six:6, seven:7, eight:8, nine:9, ten:10, eleven:11, twelve:12, thirteen:13, fourteen:14, fifteen:15, twenty:20, thirty:30, forty:40, fifty:50, hundred:100};
const s21n = w => { w = String(w || '').toLowerCase().trim(); return /^\d+$/.test(w) ? +w : (S21N[w] ?? null); };
const S21_NUM = '(\\d+|a|an|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|twenty|thirty|forty|fifty)';
const s21T = () => turnStr();
const s21Sum = list => list.reduce((a, c) => a + (c.n || 1), 0);
const s21Opps = () => opponents().filter(p => !(p.s && p.s.lost));
const s21Bf = pid => (pid === MYPID ? S.bf : (OPP.get(pid)?.bf || [])).filter(c => c && c.k && !c.fd);
const s21Ty = (c, pid) => pid === MYPID ? typeOf(c) : (typeof l24typeOf === 'function' ? l24typeOf(c, pid) : (info(c.k)?.t || ''));
const s21IsCr = (c, pid) => pid === MYPID ? isCreatureCard(c) : /\bCreature\b/.test(s21Ty(c, pid));
const s21Hand = pid => pid === MYPID ? S.hand.length : (OPP.get(pid)?.hc || 0);
const s21Life = pid => pid === MYPID ? S.life : (OPP.get(pid)?.life ?? 0);
const s21Psn = pid => pid === MYPID ? (S.psn || 0) : (OPP.get(pid)?.psn || 0);
const s21Pow = (c, pid) => { try { const st = pid === MYPID ? stats(c) : statsAny({pid, id:c.id}); return st ? st[0] : (parseInt(info(c.k)?.p) || 0); } catch { return 0; } };
const s21Tou = (c, pid) => { try { const st = pid === MYPID ? stats(c) : statsAny({pid, id:c.id}); return st ? st[1] : 0; } catch { return 0; } };
const s21Ctr = (c, kind) => { if (!c) return 0; if (!kind) return (typeof r21aTotal === 'function') ? r21aTotal(c) : (c.cp || 0) + (c.cm || 0) + Object.values(c.nc || {}).reduce((a, b) => a + (b || 0), 0); return (typeof r21aGet === 'function') ? r21aGet(c, kind) : (kind === '+1/+1' ? c.cp || 0 : kind === '-1/-1' ? c.cm || 0 : (c.nc || {})[kind] || 0); };
const s21Gy = (pid = MYPID) => pid === MYPID ? S.gy.map(c => c.k) : (OPP.get(pid)?.gy || []);
const s21Types = ks => { const T = new Set(); ks.forEach(k => (String(info(k)?.t || '').split('—')[0].match(/\b(Artifact|Battle|Creature|Enchantment|Instant|Kindred|Land|Planeswalker|Sorcery)\b/g) || []).forEach(x => T.add(x))); return T.size; };

// a description of permanents ("creature with power 4 or greater", "Blood tokens", "lands with different names", "enchanted creature") → test
function s21Desc(d0){
  let d = String(d0 || '').trim(); const o = {distinct:null};
  let m;
  if ((m = d.match(/^(.+?) with different (names|powers)$/))){ o.distinct = m[2]; d = m[1]; }
  const tests = [];
  if ((m = d.match(/^(.+?) with power (\d+) or greater$/))){ const n = +m[2]; d = m[1]; tests.push((c, pid) => s21Pow(c, pid) >= n); }
  if ((m = d.match(/^(.+?) with an? \+1\/\+1 counter on (?:it|them)$/))){ d = m[1]; tests.push(c => (c.cp || 0) > 0); }
  if ((m = d.match(/^(.+?) with (decayed|flying|deathtouch|haste)$/))){ const kw = m[2]; d = m[1]; tests.push((c, pid) => kwOf(c, kw, pid) || (c.ekw || []).includes(kw) || new RegExp('(^|\\n)' + kw + '\\b', 'i').test(info(c.k)?.o || '')); }
  if ((m = d.match(/^(.+?) you don't own$/))){ d = m[1]; tests.push(c => !!c.own); }
  if (/^enchanted /.test(d)){ d = d.replace(/^enchanted /, ''); tests.push((c, pid) => boardsAll().some(b => b.bf.some(a => a.k && a.att && a.att.pid === pid && a.att.id === c.id && /\bAura\b/.test(info(a.k)?.t || '')))); }
  let tok = null; if (/\btokens?$/.test(d)){ tok = true; d = d.replace(/\s*\btokens?$/, ''); }
  if (/\bwith\b|\bthat\b|\bwhich\b/.test(d)) return null;
  d = sing(d.replace(/\bpermanents?\b/, 'permanent')).trim();
  const base = d === 'permanent' || d === '' ? '' : d;
  const cr = /^(?:\w+ )?creature$/.test(base);
  o.test = (c, pid) => { if (tok === true && !c.tok) return false; if (base){ if (base === 'creature'){ if (!s21IsCr(c, pid)) return false; } else if (cr){ if (!s21IsCr(c, pid) || !descOk(c.k, base.replace(/ creature$/, ''), {tok:c.tok})) return false; } else if (!descOk(c.k, base, {tok:c.tok})) return false; } return tests.every(f => f(c, pid)); };
  return o;
}
function s21Count(pid, d, opt = {}){
  const sp = s21Desc(d); if (!sp) return null;
  const list = s21Bf(pid).filter(c => sp.test(c, pid) && !(opt.notId != null && pid === MYPID && c.id === opt.notId) && !(opt.notId2 != null && c.id === opt.notId2));
  if (sp.distinct === 'names') return new Set(list.map(c => info(c.k)?.n)).size;
  if (sp.distinct === 'powers') return new Set(list.map(c => s21Pow(c, pid))).size;
  return s21Sum(list);
}
// "you control N or more / at least N / no / a / another / one or more <desc> [other than ~]"
function s21CtlQ(q){
  let m; q = q.trim();
  if ((m = q.match(new RegExp('^' + S21_NUM + ' or more (other )?(.+)$')))) return {min:s21n(m[1]), other:!!m[2], d:m[3]};
  if ((m = q.match(new RegExp('^at least ' + S21_NUM + ' (other )?(.+)$')))) return {min:s21n(m[1]), other:!!m[2], d:m[3]};
  if ((m = q.match(new RegExp('^' + S21_NUM + ' or fewer (other )?(.+)$')))) return {max:s21n(m[1]), other:!!m[2], d:m[3]};
  if ((m = q.match(/^no (.+?)(?: other than ~)?$/))) return {max:0, other:/ other than ~$/.test(q), d:m[1]};
  if ((m = q.match(/^another (.+)$/))) return {min:1, other:true, d:m[1]};
  if ((m = q.match(/^(?:an?|one or more) (.+)$/))) return {min:1, other:false, d:m[1]};
  return null;
}
function s21CtlTest(pid, q, E){
  const x = s21CtlQ(q); if (!x) return null;
  // "other": other than ~ and, for "whenever a <desc> enters, if you control N other <desc>", other than the one entering
  const ev = E.it && E.it.evId != null && (E.it.evPid || MYPID) === pid && E.it.evId !== E.srcId ? E.it.evId : null;
  const n = s21Count(pid, x.d, {notId:x.other ? E.srcId : null, notId2:x.other ? ev : null}); if (n == null) return null;
  return x.max != null ? n <= x.max : n >= x.min;
}
// the cards "exiled with ~" (every way the engine links them)
function s21ExiledWith(E){
  const id = E.srcId; if (id == null) return [];
  const out = new Map(); const add = c => { if (c && c.id != null) out.set(c.id, c); };
  try { if (typeof zLinked === 'function') zLinked(id).forEach(add); } catch {}
  S.ex.forEach(c => { if (c.g23by === id || (c.c27diary && c.c27diary.id === id) || (c.mayPlay && E.name && c.mayPlay.src === E.name && c.mayPlay.srcId == null) || (c.mayPlay && c.mayPlay.srcId === id)) add(c); });
  const sc = E.src; if (sc){ (sc.w25hid || (sc.hid ? [sc.hid] : [])).forEach(i => add(S.ex.find(c => c.id === i))); }
  return [...out.values()];
}
// the object "it / that creature / that spell" means: the event object, or ~ itself for its own event
function s21Obj(E){
  const it = E.it; if (it.evId != null && it.evId !== E.srcId){ const pid = it.evPid || MYPID; const c = pid === MYPID ? find(it.evId)[2] : boardOf(pid).find(b => b.id === it.evId); return {c, pid, k:it.evk || (c && c.k), id:it.evId}; }
  return {c:E.src, pid:MYPID, k:(E.src && E.src.k) || E.k, id:E.srcId};
}
// the spell an event or cast trigger is about (mine or another player's stack item)
function s21Spell(E){
  const it = E.it;
  if (it.castSid){ const x = S.stk.find(s => s.sid === it.castSid); if (x) return {pid:MYPID, it:x}; }
  const pid = it.evPid || MYPID; const k = it.evk;
  if (pid === MYPID){ const x = S.stk.slice().reverse().find(s => s.kind === 'spell' && ((it.evId != null && s.card && s.card.id === it.evId) || s.k === k)); return x ? {pid, it:x} : null; }
  const st = OPP.get(pid); const x = st && (st.stk || []).slice().reverse().find(s => s.kind === 'spell' && s.k === k); return x ? {pid, it:x, st} : null;
}
function s21NoMana(E){
  const sp = s21Spell(E); const it = E.it;
  if ((it.evPid || MYPID) === MYPID || it.castSid){ if (sp && sp.it.r21free) return true; const n = (typeof n24spFor === 'function') ? n24spFor(E.ctx) : null; if (n) return n.tot === 0; if (sp && sp.it.free) return true; return !!(sp && sp.it.r21free); }
  return !!(sp && sp.st && (sp.st.r21free || []).includes(sp.it.sid));
}
const s21Was = (c, f) => !!(c && c[f] === s21T());

/* ---------- the rules: [regex over the lower-case condition, (m, E) → boolean, event-fact?] ---------- */
const S21R = [];
const s21r = (re, f, ev) => S21R.push({re, f, ev:!!ev});
// --- permanents you control
s21r(/^you control your commander$|^you control a commander$/, () => cmdControlled());
s21r(/^you control the artifact with the greatest mana value or tied for the greatest mana value$/, () => { let best = -1, mine = -1; for (const b of boardsAll()) for (const c of b.bf){ if (!c.k || c.fd || !/Artifact/.test(s21Ty(c, b.pid))) continue; const mv = info(c.k)?.mv || 0; best = Math.max(best, mv); if (b.pid === MYPID) mine = Math.max(mine, mv); } return mine >= 0 && mine === best; });
s21r(/^you control (.+)$/, (m, E) => s21CtlTest(MYPID, m[1], E));
s21r(/^you don't control an? (.+)$/, (m, E) => { const n = s21Count(MYPID, m[1]); return n == null ? null : n === 0; });
s21r(/^you both own and control ~ and an? (creature|land|permanent) named (.+)$/, (m, E) => { const sc = E.src; if (!sc || !S.bf.includes(sc) || sc.own || sc.tok) return false; const nm = m[2].trim(); return S.bf.some(c => c !== sc && !c.fd && !c.own && !c.tok && String(info(c.k)?.n || '').toLowerCase().startsWith(nm) && (m[1] === 'permanent' || descOk(c.k, m[1]))); });
s21r(/^creatures you control have total (power|toughness) (\d+) or greater$/, m => s21Bf(MYPID).filter(c => isCreatureCard(c)).reduce((a, c) => a + Math.max(0, m[1] === 'power' ? s21Pow(c, MYPID) : s21Tou(c, MYPID)) * (c.n || 1), 0) >= +m[2]);
s21r(new RegExp('^there are ' + S21_NUM + ' or more ((?:[a-z+\\/1-]+ )?counters? among .+? you control)$'), (m, E) => { const n = countOf(m[2], E.ctx); return n == null ? null : n >= s21n(m[1]); });
s21r(/^your devotion to (white|blue|black|red|green)(?: and (white|blue|black|red|green))? is (\w+) or greater$/, m => devotion([m[1], m[2]].filter(Boolean)) >= s21n(m[3]));
// --- other players' permanents
s21r(/^an opponent controls more (lands|creatures|artifacts|enchantments) than you$/, m => { const d = sing(m[1]); const me = s21Count(MYPID, d); return s21Opps().some(p => s21Count(p.pid, d) > me); });
s21r(/^(that player|defending player) controls more (lands|creatures|artifacts) than you$/, (m, E) => { const pid = m[1] === 'that player' ? E.pid : s21DefPid(E); if (!pid || pid === MYPID) return false; const d = sing(m[2]); return s21Count(pid, d) > s21Count(MYPID, d); });
s21r(/^an opponent controls (.+)$/, (m, E) => { let any = false; for (const p of s21Opps()){ const r = s21CtlTest(p.pid, m[1], E); if (r == null) return null; if (r) any = true; } return any; });
s21r(/^a player controls no creatures$/, () => players().filter(p => !(p.s && p.s.lost)).some(p => !s21Bf(p.pid).some(c => s21IsCr(c, p.pid))));
s21r(/^no creatures are on the battlefield$/, () => !boardsAll().some(b => b.bf.some(c => c.k && !c.fd && s21IsCr(c, b.pid))));
// --- life, poison, hands
s21r(new RegExp('^you have ' + S21_NUM + ' or more life$'), m => S.life >= s21n(m[1]));
s21r(new RegExp('^you have ' + S21_NUM + ' or less life$'), m => S.life <= s21n(m[1]));
s21r(/^you have at least (\d+) life more than your starting life total$/, m => S.life >= (FMT[S.fmt]?.life || 40) + +m[1]);
s21r(new RegExp('^each player has ' + S21_NUM + ' or less life$'), m => players().filter(p => !(p.s && p.s.lost)).every(p => s21Life(p.pid) <= s21n(m[1])));
s21r(/^that opponent has more life than another of your opponents$/, (m, E) => { const pid = E.it.a26def || E.it.evDp || E.pid; if (!pid || pid === MYPID) return false; return s21Opps().some(p => p.pid !== pid && s21Life(p.pid) < s21Life(pid)); });
s21r(new RegExp('^an opponent has ' + S21_NUM + ' or more poison counters$'), m => s21Opps().some(p => s21Psn(p.pid) >= s21n(m[1])));
s21r(new RegExp('^you have exactly ' + S21_NUM + ' cards in your hand$'), m => S.hand.length === s21n(m[1]));
s21r(new RegExp('^you have fewer than ' + S21_NUM + ' cards in (?:your )?hand$'), m => S.hand.length < s21n(m[1]));
s21r(/^you have no cards in (?:your )?hand$/, () => S.hand.length === 0);
s21r(/^that player has no cards in hand$/, (m, E) => !!E.pid && s21Hand(E.pid) === 0);
s21r(new RegExp('^that player has ' + S21_NUM + ' or fewer cards in hand$'), (m, E) => !!E.pid && s21Hand(E.pid) <= s21n(m[1]));
s21r(/^an opponent has more cards in hand than you$/, () => s21Opps().some(p => s21Hand(p.pid) > S.hand.length));
// --- graveyards
s21r(new RegExp('^there are ' + S21_NUM + ' or more card types among cards in your graveyard$'), m => s21Types(S.gy.map(c => c.k)) >= s21n(m[1]));
s21r(new RegExp('^(?:there are|you have) ' + S21_NUM + ' or more ((?:[a-z]+ )*?)cards in your graveyard$'), m => { const d = (m[2] || '').trim(); return S.gy.filter(c => !d || (d === 'permanent' ? isPermType(info(c.k)?.t || '') : descOk(c.k, d))).length >= s21n(m[1]); });
s21r(new RegExp('^there are ' + S21_NUM + ' or more (land|creature) cards in your graveyard and you both own and control ~ and an? (creature|land) named (.+)$'), (m, E) => S.gy.filter(c => descOk(c.k, m[2])).length >= s21n(m[1]) && s21Eval1(`you both own and control ~ and a ${m[3]} named ${m[4]}`, E) === true);
// --- ~ itself
s21r(/^~ is (tapped|untapped)$/, (m, E) => { const c = E.src; if (!c || !S.bf.includes(c)) return false; return m[1] === 'tapped' ? !!c.tap : !c.tap; });
s21r(/^~ is in your graveyard$/, (m, E) => E.zone === 'gy');
s21r(/^~ is exiled$/, (m, E) => E.zone === 'ex');
s21r(/^~ is suspended$/, (m, E) => E.zone === 'ex' && !!(E.src && E.src.r21bsus));
s21r(/^~ is in the command zone$/, (m, E) => E.zone === 'cz');
s21r(/^~ is in the command zone or on the battlefield$/, (m, E) => E.zone === 'cz' || E.zone === 'bf');
s21r(/^it's on the battlefield$/, (m, E) => E.zone === 'bf');
s21r(new RegExp('^(?:~ has|there are) ' + S21_NUM + ' or more ((?:[a-z+\\/1-]+ )?)counters? on ~$|^~ has ' + S21_NUM + ' or more ((?:[a-z+\\/1-]+ )?)counters? on it$'), (m, E) => { const n = s21n(m[1] || m[3]); const kind = String(m[2] || m[4] || '').trim(); const c = E.src; return !!c && s21Ctr(c, kind || null) >= n; });
s21r(/^~ has counters on it$/, (m, E) => s21Ctr(E.src, null) > 0);
s21r(new RegExp('^~ has fewer than ' + S21_NUM + ' ((?:[a-z+\\/1-]+ )?)counters? on it$'), (m, E) => s21Ctr(E.src, String(m[2] || '').trim() || null) < s21n(m[1]));
s21r(/^there are cards exiled with (?:~|it)$/, (m, E) => s21ExiledWith(E).length > 0);
s21r(new RegExp('^(?:there are )?' + S21_NUM + ' or more cards (?:are |have been )?exiled with ~$'), (m, E) => s21ExiledWith(E).length >= s21n(m[1]));
s21r(/^~ entered this turn$/, (m, E) => !!(E.src && (S.r23Ient || []).some(e => e.t === s21T() && e.id === E.src.id)));
s21r(/^a counter was put on ~ this turn$/, (m, E) => s21Was(E.src, 'r21pt'));
s21r(/^~ dealt damage to another creature this turn$/, (m, E) => s21Was(E.src, 'p24dmgCr'));
s21r(/^it was crewed by exactly two creatures$/, (m, E) => { const c = E.src; return !!(c && c.qCrewT === s21T() && (c.qCrewers || []).length === 2); });
s21r(/^it's attacking$/, (m, E) => !!(E.src && S.bf.includes(E.src) && E.src.atk));
s21r(/^it's attacking the player with the most life or tied for most life$/, (m, E) => { const d = E.src && parseDef(E.src.atk); const pid = d && d.t === 'player' ? d.pid : null; if (!pid) return false; const top = Math.max(...players().filter(p => !(p.s && p.s.lost)).map(p => s21Life(p.pid))); return s21Life(pid) >= top; });
s21r(/^you haven't added mana with this ability this turn$/, (m, E) => !((typeof A26 !== 'undefined') && A26.cf && A26.cf['a26cf:' + E.srcId] === s21T()));
s21r(/^you chose a creature other than ~ as your ring-bearer$/, (m, E) => { const rb = S.bf.find(c => c.ring); return !!rb && rb.id !== E.srcId; });
// --- this turn / last turn
s21r(new RegExp('^you gained (?:' + S21_NUM + ' or more )?life this turn$'), m => lifeT().g >= (m[1] ? s21n(m[1]) : 1));
s21r(/^you gained and lost life this turn$/, () => { const lt = lifeT(); return lt.g > 0 && lt.l > 0; });
s21r(/^you didn't lose life this turn$/, () => lifeT().l === 0);
s21r(new RegExp('^an opponent lost (?:' + S21_NUM + ' or more )?life this turn$'), m => { const n = m[1] ? s21n(m[1]) : 1; return s21Opps().some(p => lostThisTurn(p.pid) >= n) || (n === 1 && r21bOppLost()); });
s21r(new RegExp('^a player lost ' + S21_NUM + ' or more life this turn$'), m => players().some(p => lostThisTurn(p.pid) >= s21n(m[1])));
s21r(/^a creature died this turn$/, () => r19Died() > 0);
s21r(new RegExp('^' + S21_NUM + ' or more creatures died this turn$'), m => r19Died() >= s21n(m[1]));
s21r(/^a creature died under your control this turn$/, () => !!(R23K.died && R23K.died.t === s21T() && R23K.died.n > 0));
s21r(/^a creature card was put into your graveyard from anywhere this turn$/, () => jTurnRec().crGy > 0);
s21r(/^a nonland permanent left the battlefield this turn or a spell was warped this turn$/, () => r23ILeftNonland() || (S.casts || []).some(x => x.t === s21T() && x.warp));
s21r(/^a permanent you controlled left the battlefield this turn$/, () => S.r23IleftMine === s21T());
s21r(/^a player discarded a card this turn$/, () => r23IAnyDiscarded());
s21r(/^an opponent discarded a card this turn$/, () => r23IOppDiscarded());
s21r(/^you attacked this turn$/, () => !!(S.r23atk && S.r23atk.t === s21T() && S.r23atk.ids.length));
s21r(/^you attacked with creatures with total power (\d+) or greater this combat$/, m => S.bf.filter(c => c.atk && !c.fd && isCreatureCard(c)).reduce((a, c) => a + Math.max(0, s21Pow(c, MYPID)) * (c.n || 1), 0) >= +m[1]);
s21r(/^you didn't cast a spell this turn$/, () => !(S.castHist || []).some(h => h.t === s21T()) && !(S.casts || []).some(x => x.t === s21T()));
s21r(/^you created a token this turn$/, () => (S.r23Ient || []).some(e => e.t === s21T() && e.tok));
s21r(/^you descended this turn$/, () => jTurnRec().desc > 0);
s21r(/^you sacrificed a food this turn$/, () => S.h23food === s21T());
s21r(/^you put a counter on a creature this turn$/, () => jTurnRec().ctrC > 0);
s21r(/^you've drawn more than one card this turn$/, () => drawnThisTurn() > 1);
s21r(/^you didn't activate a loyalty ability of a planeswalker this turn$/, () => !(S.g23loyT === s21T() || S.bf.some(c => c.lu === s21T())));
s21r(/^another (.+?) entered the battlefield under your control this turn$/, (m, E) => (S.r23Ient || []).some(e => e.t === s21T() && e.id !== E.srcId && descOk(e.k, sing(m[1]), {tok:e.tok})));
s21r(/^a player was dealt combat damage by a zombie this turn$/, () => S.g23zdmg === s21T());
s21r(/^a creature or planeswalker an opponent controlled was dealt excess damage this turn$/, () => !!(S.p24exSeen && S.p24exSeen.t === s21T() && S.p24exSeen.pids.some(p => p !== MYPID)));
s21r(/^you haven't been dealt combat damage since your last turn$/, () => !e27HitSinceLast());
s21r(/^you had another creature enter the battlefield under your control last turn$/, (m, E) => { const ks = S.jEntPrev || []; const me = E.src ? E.src.k : E.k; return ks.filter(k => k !== me).length > 0 || ks.filter(k => k === me).length > 1; });
s21r(/^no spells were cast last turn$|^a player cast (two|\d+) or more spells last turn$/, (m, E) => jCond(m[0], E.ctx));
s21r(/^two or more players have lost the game$/, () => c27LostCount() >= 2);
// --- turn and phase
s21r(/^it's your turn$/, () => currentTurn()[1] === MYPID);
s21r(/^it's not your turn$/, () => currentTurn()[1] !== MYPID);
s21r(/^it's your main phase$/, () => { const p = phaseNow(); return p.mine && (p.ph === 3 || p.ph === 5); });
s21r(/^it(?:'s not| isn't) (?:their|that player's) turn$/, (m, E) => { const pid = E.it.evPid || E.it.evDp; return !!pid && currentTurn()[1] !== pid; });
s21r(/^it's the first combat phase of the turn$/, () => !(S.cb && S.cb.n > 1));
s21r(/^you're the defending player$/, (m, E) => { const o = s21Obj(E); const c = o.c; const d = c && parseDef(c.atk); return !!d && attackTargetProtector(d) === MYPID; });
// --- designations
s21r(/^you're the monarch$/, () => holderOf('mon') === MYPID);
s21r(/^an opponent is the monarch$/, () => { const h = holderOf('mon'); return !!h && h !== MYPID; });
s21r(/^there is no monarch$/, () => holderOf('mon') == null);
s21r(/^you have the city's blessing$/, () => r19City());
s21r(/^you've completed a dungeon$/, () => (S.dgList || []).length > 0);
s21r(/^you haven't completed (.+)$/, m => !(S.dgList || []).some(d => d.toLowerCase() === m[1]));
// --- the trigger event's object (facts about that event: the answer found when it triggered is kept)
s21r(/^it had (no|one or more|two or more|three or more|an?|\d+ or more)? ?((?:[a-z+\/1-]+ )?)counters? on it$/, (m, E) => {
  const o = s21Obj(E); const live = o.c && o.pid === MYPID && S.bf.includes(o.c) ? o.c : null; let lk = typeof r21aLki === 'function' && o.id != null && o.pid === MYPID ? r21aLki(o.id) : null; if (lk && Date.now() - (lk.t || 0) > 15000) lk = null; const l = live || lk || (o.pid === MYPID && E.it.s21ev && E.it.s21ev.id === o.id ? {cp:E.it.s21ev.cp || 0, cm:E.it.s21ev.cm || 0, nc:{}} : null);
  const ev = E.it.s21ev || {}; const kind = String(m[2] || '').trim() || null;
  const n = l ? s21Ctr(l, kind) : kind === '+1/+1' ? (ev.cp ?? E.it.evCp ?? 0) : kind === '-1/-1' ? (ev.cm ?? 0) : kind ? 0 : (ev.cp ?? E.it.evCp ?? 0) + (ev.cm ?? 0);
  const q = m[1] || 'one or more'; if (q === 'no') return n === 0; const need = /^an?$/.test(q) ? 1 : s21n(q.split(' ')[0]); return n >= need; }, true);
s21r(/^it had counters on it$/, (m, E) => s21Eval1('it had one or more counters on it', E), true);
s21r(/^it (?:isn't|'s not) a token$|^it's not a token$/, (m, E) => { const o = s21Obj(E); const ev = E.it.s21ev || {}; return !(o.c ? o.c.tok : ev.tok); }, true);
s21r(/^it was a creature$/, (m, E) => { const o = s21Obj(E); return E.it.s21ev && E.it.s21ev.type === 'die' ? true : /\bCreature\b/.test(info(o.k)?.t || ''); }, true);
s21r(/^it's a creature$/, (m, E) => { const o = s21Obj(E); return o.c ? s21IsCr(o.c, o.pid) : /\bCreature\b/.test(info(o.k)?.t || ''); });
s21r(/^it was historic$/, (m, E) => { const t = info(s21Obj(E).k)?.t || ''; return /\bLegendary\b/.test(t) || /\b(Artifact|Saga)\b/.test(t); }, true);
s21r(/^that creature was an? (\w+)$/, (m, E) => descOk(s21Obj(E).k, m[1]), true);
s21r(/^it was enchanted or equipped$/, (m, E) => !!(typeof W25 !== 'undefined' && W25.attTo && W25.attTo[E.it.evId]), true);
s21r(/^it didn't have decayed$/, (m, E) => { const k = s21Obj(E).k; return !(k && /decayed/i.test(info(k)?.o || '')); }, true);
s21r(/^its toughness was less than 1$/, (m, E) => { const pid = E.it.evPid, id = E.it.evId; const evs = pid === MYPID ? S.ev : (OPP.get(pid)?.ev || []); const dn = Math.max(-1, ...evs.filter(e => e.type === 'die' && e.id === id).map(e => e.n)); return dn >= 0 && evs.some(e => e.type === 'a26die0' && e.id === id && e.n > dn && e.n <= dn + 4); }, true);
s21r(/^it doesn't have the same name as another creature you control or a creature card in your graveyard$/, (m, E) => { const c = s21Obj(E).c; if (!c) return false; const nm = info(c.k)?.n; return !(S.bf.some(x => x.id !== c.id && isCreatureCard(x) && info(x.k)?.n === nm) || S.gy.some(x => isCreatureCard(x) && info(x.k)?.n === nm)); }, true);
s21r(/^it entered from your graveyard or you cast it from your graveyard$/, (m, E) => !!(s21Obj(E).c || {}).e27gyE, true);
s21r(/^they entered or were cast from a graveyard$|^one or more of them entered from a graveyard or was cast from a graveyard$/, (m, E) => { const list = (typeof cpyBatch === 'function' ? cpyBatch(E.ctx) : []).map(e => e.pid === MYPID ? S.bf.find(b => b.id === e.id) : null).filter(Boolean); const o = s21Obj(E).c; if (o && !list.includes(o)) list.push(o); return list.some(c => c.cpyFrom === 'gy' || c.cpyCastFrom === 'gy' || c.fromGy || c.from === 'gy' || c.e27gyE); }, true);
s21r(/^none of them were cast or no mana was spent to cast them$/, (m, E) => { const ids = E.it.b26ids || (E.it.evId != null ? [E.it.evId] : []); const cs = ids.map(id => S.bf.find(b => b.id === id)).filter(Boolean); return cs.reduce((a, c) => a + (c.b26cast ? (c.b26spent || 0) : 0), 0) === 0; }, true);
s21r(/^it wasn't put onto the battlefield with this ability$/, (m, E) => !(s21Obj(E).c || {}).u25kod, true);
s21r(/^(?:you cast it|it was cast|he was cast|she was cast)$/, (m, E) => { const o = s21Obj(E); const c = o.c; return !!(c && (c.wasCast === s21T() || (S.casts || []).some(x => x.id === c.id && x.t === s21T()))); }, true);
s21r(/^it wasn't cast$/, (m, E) => { const c = s21Obj(E).c; return !(c && c.wasCast === s21T()); }, true);
s21r(/^you cast it from your hand$/, (m, E) => { const c = s21Obj(E).c; const rec = c && (S.casts || []).slice().reverse().find(x => x.id === c.id); return !!(rec && rec.from === 'hand' && c.wasCast === s21T()); }, true);
s21r(/^you didn't cast it from your hand$/, (m, E) => { const c = s21Obj(E).c; const f = c && (S.a26from || {})[c.id]; return !(f && f.z === 'hand' && f.t === s21T()); }, true);
s21r(/^(?:it|~) was kicked$/, (m, E) => { const c = s21Obj(E).c; const sp = s21Spell(E); return !!((c && c.kicked) || E.it.kicked || (E.it.castSid && sp && (sp.it.kicked || (sp.it.card && sp.it.card.kicked)))); }, true);
s21r(/^the gift was promised$/, (m, E) => { if (E.it.s21gift !== undefined) return !!E.it.s21gift; const c = E.src; return !!(c && c.s21gift && c.s21gift.t === s21T() && c.s21gift.v); }, true);
s21r(/^it isn't a mana ability$/, () => true, true);   // only non-mana activations raise this event (engine24m)
s21r(/^that spell's mana cost or that ability's activation cost contains \{x\}$/, (m, E) => { const it = E.it; if (it.m24sid) return !!it.evX; const x = typeof m24Ref === 'function' ? m24Ref(E.ctx) : null; return !!(x && /\{X\}/.test(info(x.k)?.m || '')); }, true);
s21r(/^no mana was spent to cast (?:it|that spell)$/, (m, E) => s21NoMana(E), true);
s21r(/\bspent to cast (?:it|that spell)\b|^the amount of mana spent to cast/, (m, E) => { const r = jCond(m.input, E.ctx); return r == null ? null : r; }, true);
s21r(/^it targets one or more other permanents you control$/, (m, E) => { const it = E.it; const sp = stackAll().filter(x => x.kind === 'spell' && (it.evId == null || (x.card && x.card.id === it.evId) || x.k === it.evk)).pop(); return !!(sp && (sp.tgts || (sp.it && sp.it.tgts) || []).flat().some(t => t && t.t === 'card' && t.pid === MYPID && t.id !== E.srcId && S.bf.some(b => b.id === t.id))); }, true);
s21r(/^it's the first instant spell, the first sorcery spell, or the first otter spell other than ~ you've cast this turn$/, (m, E) => { const k = E.it.evk; const ks = (S.casts || []).filter(x => x.t === s21T()).map(x => x.k); const ty = x => info(x)?.t || ''; const first = (re, excl) => { const f = ks.find(x => re.test(ty(x)) && !(excl && info(x)?.n === excl)); return f != null && f === k; }; return !!k && ((/\bInstant\b/.test(ty(k)) && first(/\bInstant\b/)) || (/\bSorcery\b/.test(ty(k)) && first(/\bSorcery\b/)) || (/\bOtter\b/.test(ty(k)) && info(k)?.n !== E.name && first(/\bOtter\b/, E.name))); }, true);
s21r(/^it's the first time that creature has become tapped this turn$/, (m, E) => { const id = E.it.evId; return id != null && !!S.r26tap && S.r26tap.t === s21T() && (S.r26tap.n[id] || 0) === 1; }, true);
s21r(/^it's the first time \+1\/\+1 counters have been put on that permanent this turn$/, (m, E) => { const r = S.c2ctrT; return !(r && r.t === s21T() && r.ids.includes(E.it.evId)); }, true);
s21r(/^it isn't being declared as an attacker$/, (m, E) => { const pid = E.it.evPid, id = E.it.evId; const c = pid && id != null ? boardOf(pid).find(b => b.id === id) : null; return !(c && c.atk); }, true);
s21r(/^that creature had to attack this combat$/, (m, E) => { const pid = E.it.evPid || MYPID; const c = E.it.evId != null ? boardOf(pid).find(b => b.id === E.it.evId) : null; return !!(c && (mustAttack(c) || c.goad || c.c2had === s21T())); }, true);
s21r(/^two or more of those creatures are attacking you and\/or planeswalkers you control$/, (m, E) => { const pid = E.it.evPid; if (!pid || pid === MYPID) return false; return s21Sum((OPP.get(pid)?.bf || []).filter(c => { const d = parseDef(c.atk); return d && attackTargetProtector(d) === MYPID; })) >= 2; }, true);
s21r(/^one or more players being attacked are poisoned$/, (m, E) => { const ap = E.it.evPid || currentTurn()[1]; const def = new Set(); (ap === MYPID ? S.bf : (OPP.get(ap)?.bf || [])).forEach(c => { const d = parseDef(c.atk); if (d && d.t === 'player') def.add(d.pid); }); return [...def].some(p => s21Psn(p) > 0); }, true);
s21r(/^any of that damage was dealt by an? (\w+)$/, (m, E) => { const q = (UI.curQ || []).filter(([p, e]) => p === MYPID && e.type === 'cdmg' && e.dp && e.dp !== MYPID); if (q.length) return q.some(([, e]) => descOk(e.k, m[1])); const ev = E.it.s21ev; return !!(ev && ev.k && descOk(ev.k, m[1])); }, true);
s21r(/^they were attacked this turn by an? (\w+) you controlled$/, (m, E) => { const pid = E.it.c27lostPid; const a = S.c27atk; return !!(pid && a && a.t === s21T() && a.by.includes(pid)); }, true);

/* ---------- evaluating ---------- */
function s21Env(ctx){
  const it = ctx.it || {}; const srcId = ctx.srcId ?? it.srcId ?? null; const f = srcId != null ? find(srcId) : [null, -1, null];
  return {ctx, it, srcId, src:f[2], zone:f[0], k:ctx.k || it.k, name:ctx.name || it.nm || '', pid:it.evPid || it.evDp || null};
}
function s21DefPid(E){ const d = E.src && parseDef(E.src.atk); return d ? attackTargetProtector(d) : null; }
function s21Rule(cond){ const l = String(cond || '').toLowerCase().trim(); for (const r of S21R){ const m = l.match(r.re); if (m) return {r, m}; } return null; }
function s21Eval1(cond, E){ const x = s21Rule(cond); if (!x) return null; try { const v = x.r.f(x.m, E); return v == null ? null : !!v; } catch (e){ console.warn('s21 cond', cond, e); return null; } }
// the whole evaluator: my rules first, then the shared checker (jCond) for anything else it knows
function s21Cond(cond, ctx){
  const E = s21Env(ctx || {}); const r = s21Eval1(cond, E); if (r != null) return r;
  try { const j = jCond(cond, ctx || {}); if (j != null) return !!j; } catch {}
  return null;
}
// "if <condition>, <effect>": the condition (it may contain commas, so the shortest known prefix wins)
function s21Split(txt){
  const t = String(txt || '').trim(); const mm = t.match(/^if ([^\n]+)$/i) || t.match(/^if ([^\n]+)/i); if (!mm) return null;
  const body = mm[1]; let i = -1; const firstC = body.indexOf(',');
  if (firstC < 0) return null;
  const head0 = body.slice(0, firstC).toLowerCase().trim(); if (/^(?:you do|they do|you don't|they don't|a player does|that player does|no one does|you can't)$/.test(head0)) return null;
  while ((i = body.indexOf(',', i + 1)) >= 0){ const c = body.slice(0, i).trim(); if (s21Known(c)) return {cond:c.toLowerCase(), eff:body.slice(i + 1).trim(), known:true}; }
  return {cond:head0, eff:body.slice(firstC + 1).trim(), known:false};
}
// does the evaluator understand this condition? (checked on a scratch state, so it works in the deck checker too)
const S21_KNOWN = new Map();
function s21Known(cond){
  const l = String(cond || '').toLowerCase().trim(); if (S21_KNOWN.has(l)) return S21_KNOWN.get(l);
  const saved = S; let r = null;
  try { if (!S) S = newState(); const ctx = {k:null, name:'', it:{evPid:MYPID}}; r = s21Eval1(l, s21Env(ctx)); if (r == null) r = jCond(l, ctx); } catch { r = null; } finally { S = saved; }
  S21_KNOWN.set(l, r != null); return r != null;
}
const s21Iff = it => it && it.kind === 'trigger' && typeof it.txt === 'string' && /^if\b/i.test(it.txt.trim()) ? s21Split(it.txt) : null;
function s21ItCtx(it){
  const ctx = {k:it.k, name:it.nm, it, srcId:it.srcId};
  if (it.castSid){ const sp = S.stk.find(s => s.sid === it.castSid); if (sp && sp.card) ctx.card = sp.card; }
  return ctx;
}
// one trigger: evaluate its condition (event facts are kept from trigger time)
function s21Check(it, when){
  const sp = s21Iff(it); if (!sp || !sp.known) return null;
  const x = s21Rule(sp.cond);
  if (when === 'res' && x && x.r.ev && it.s21tt != null) return it.s21tt;
  const v = s21Cond(sp.cond, s21ItCtx(it));
  if (when === 'trig') it.s21tt = v;
  return v;
}
function s21Retract(it){
  try { for (let i = S.log.length - 1; i >= 0 && i >= S.log.length - 8; i--){ const e = S.log[i]; if (String(e.s).startsWith(`trigger: ${it.nm} — `)){ S.log.splice(i, 1); LOGS.delete(MYPID + '|' + e.t); break; } } } catch {}
}
// targets of a trigger whose condition held: chosen as it goes on the stack (as fix19b does for the rest)
function s21Choose(it){
  const txt = String(it.txt || '');
  if (it.tgts || it.m19wait || it.hold || /•|\bwhen you do\b|\bwhenever you do\b/i.test(txt) || (typeof m24StackSpec === 'function' && m24StackSpec(txt))) return;
  let specs = []; try { specs = targetSpecs(txt); } catch {} if (!specs.length) return;
  return m19Hold(it, async () => {
    const t = await chooseTargets(txt, {pid:MYPID, col:info(it.k)?.c, types:info(it.k)?.t, id:it.srcId}, it.nm);
    if (t == null){ log(`${it.nm}: no target chosen — the trigger is removed`); return 'remove'; }
    it.tgts = t; it.tgtNm = tgtLabel(t).slice(0, 118);
    if (t.flat().length && !(await payWard(t, it.nm))){ log(`${it.nm}: countered by ward`); return 'remove'; }
  });
}
// decorate an intervening-if trigger with what its old resolution handlers read
function s21Decorate(it, ev){
  if (ev) it.s21ev = {type:ev.type, k:ev.k, id:ev.id, tok:ev.tok ? 1 : 0, cp:ev.cp, cm:ev.cm, amt:ev.amt, dp:ev.dp};
  try { const sc = it.srcId != null ? find(it.srcId)[2] : null; if (sc && sc.s21gift && sc.s21gift.t === s21T()) it.s21gift = !!sc.s21gift.v; } catch {}
  try { if (it.castSid){ const sp = S.stk.find(s => s.sid === it.castSid); if (sp && (sp.kicked || (sp.card && sp.card.kicked))) it.kicked = sp.kicked || sp.card.kicked; } } catch {}
}
// new trigger items: false → removed as if it never triggered; true → targets now
function s21After(items, pass0, n0){
  let removed = 0;
  for (const it of items){
    if (!it || it.s21seen) continue; it.s21seen = 1;
    const v = s21Check(it, 'trig');
    if (v === false){ const i = S.stk.indexOf(it); if (i >= 0){ S.stk.splice(i, 1); removed++; } s21Retract(it); continue; }
    if (v === true){ it.s21 = 1; try { m19EarlyTrig(it); } catch (e){ console.warn('s21 early', e); } try { s21Choose(it); } catch (e){ console.warn('s21 choose', e); } }
    else { try { m19EarlyTrig(it); } catch {} }
  }
  if (removed && S.stk.length === n0) S.pass = pass0;
  if (removed) commit();
}
{
  const et = m19EarlyTrig;
  m19EarlyTrig = function(it){ if (S21.inPush && s21Iff(it)) return; return et(it); };
  const pt = pushTrigger;
  pushTrigger = function(src, t, ev, evPid){
    if (!S || UI.dry || !t || !/^if\b/i.test(String(t.eff || '').trim())) return pt(src, t, ev, evPid);
    const n0 = S.stk.length; const pass0 = S.pass; let r;
    S21.inPush++; try { r = pt(src, t, ev, evPid); } finally { S21.inPush--; }
    try { const items = S.stk.slice(n0).filter(it => it.kind === 'trigger' && s21Iff(it)); items.forEach(it => s21Decorate(it, ev)); if (!S21.inPush) s21After(items, pass0, n0); } catch (e){ console.warn('s21 push', e); }
    return r;
  };
  // triggers put on the stack directly (cast triggers, "a player loses the game" …)
  const ptg = pushTrig;
  pushTrig = function(nm, txt, extra = {}){
    if (!S || UI.dry || !/^if\b/i.test(String(txt || '').trim())) return ptg(nm, txt, extra);
    const n0 = S.stk.length; const pass0 = S.pass; const it = ptg(nm, txt, extra);
    try { if (it && S.stk.includes(it) && s21Iff(it)){ s21Decorate(it, null); const v = s21Check(it, 'trig'); it.s21seen = 1;
      if (v === false){ S.stk.splice(S.stk.indexOf(it), 1); s21Retract(it); if (S.stk.length === n0) S.pass = pass0; commit(); return null; }
      if (v === true){ it.s21 = 1; s21Choose(it); } } } catch (e){ console.warn('s21 pushTrig', e); }
    return it;
  };
  // resolution: checked again; false → it does nothing
  const rt = resolveTop;
  resolveTop = async function(it, ...a){
    if (!it || it.kind !== 'trigger' || it.m19wait || UI.resolving || UI.dry || !S || !S.stk.includes(it)) return rt(it, ...a);
    const sp = s21Iff(it); if (!sp || !sp.known) return rt(it, ...a);
    let v = null; try { v = s21Check(it, 'res'); } catch (e){ console.warn('s21 res', e); }
    if (v === false){ const i = S.stk.indexOf(it); if (i >= 0) S.stk.splice(i, 1); log(`${it.nm}: “if ${sp.cond.replace(/~/g, it.nm)}” is no longer true — the ability does nothing`); commit(); try { queueRender(); } catch {} return; }
    const keep = S21.res; S21.res = v === true ? {cond:sp.cond, it} : null;
    try { return await rt(it, ...a); } finally { S21.res = keep; }
  };
  // while it resolves, the shared checker agrees with the answer just found (the generic "if X, Y" handlers ask it again)
  const jc = jCond;
  jCond = function(cond, ctx){ const r = jc(cond, ctx); const R = S21.res; if (r != null && R && ctx && ctx.it === R.it && String(cond || '').toLowerCase().trim() === R.cond) return true; return r; };   // only for conditions it already knows: otherwise the generic "if X, Y" handler would take sentences that have their own handler (Animate Dead)
  // the gift chosen while casting a permanent spell is remembered on the permanent (Scrapshooter's ETB trigger)
  const rt2 = resolveTop;
  resolveTop = async function(it, ...a){ try { if (it && it.kind === 'spell' && it.card && it.gift !== undefined) it.card.s21gift = {t:turnStr(), v:!!it.gift}; } catch {} return rt2(it, ...a); };
  const re = runEffects;
  runEffects = async function(txt, ctx){ try { if (ctx && ctx.it && ctx.it.kind === 'trigger' && ctx.gift === undefined && ctx.it.s21gift !== undefined) ctx.gift = !!ctx.it.s21gift; } catch {} return re(txt, ctx); };
}

/* ---------- targets of intervening-if triggers that the stock parser misread ----------
   - a target inside a quoted ability of a token being created isn't a target of this ability (Zurzoth, Raphael, Gwaihir);
   - "target creature card with mana value less than or equal to ~'s power from your graveyard" (Alesha, Who Laughs at Fate) and
     "… with mana value X or less from your graveyard …, where X is the amount of life you gained this turn" (Moseo) are
     graveyard targets with a limit (they were read as battlefield creatures). */
{
  const ts = targetSpecs;
  targetSpecs = function(t, ...a){
    const s = String(t || '');
    if (!/^if\b/i.test(s.trim()) || !/"|mana value (?:less than or equal to ~'s power|x or less from your graveyard)/i.test(s)) return ts.call(this, t, ...a);
    const x = s.replace(/"[^"]*"/g, '""');
    return ts.call(this, x, ...a).map(sp => {
      if (!sp || sp.zone !== 'bf' || typeof sp.desc !== 'string') return sp;
      if (/^creature card with mana value less than or equal$/.test(sp.desc) && /target creature card with mana value less than or equal to ~'s power from your graveyard/i.test(x)) return {...sp, desc:'creature card', zone:'gy', whose:'you', s21mv:'pow'};
      if (/^creature card with mana value x or less from your graveyard$/.test(sp.desc) && /where x is the amount of life you gained this turn/i.test(x)) return {...sp, desc:'creature card', zone:'gy', whose:'you', s21mv:'life'};
      return sp;
    });
  };
  const tc = targetCands;
  targetCands = function(spec, src){
    const out = tc(spec, src);
    try { if (spec && spec.s21mv && Array.isArray(out)){
      let lim = Infinity;
      if (spec.s21mv === 'pow'){ const c = src && src.id != null ? S.bf.find(b => b.id === src.id) : null; lim = c ? Math.max(0, (stats(c) || [0])[0]) : Infinity; }
      if (spec.s21mv === 'life') lim = lifeT().g;
      return out.filter(c => (info(c.k)?.mv || 0) <= lim);
    } } catch (e){ console.warn('s21 cands', e); }
    return out;
  };
}

/* ---------- the deck checker: an intervening condition the evaluator doesn't know is a gap ---------- */
{
  const cc = checkCard;
  checkCard = async function(k){
    const r = await cc(k);
    try {
      const a = info(k); if (!a || !r || !Array.isArray(r.issues)) return r;
      const faces = a.lay === 'split' && a.faces ? a.faces : a.lay === 'adventure' && a.faces ? [a, a.faces[1]] : a.back ? [a, a.back] : [a];
      const n0 = r.issues.length;
      for (const f of faces){
        for (const line of tname(f.o || '', f.n).split('\n')){
          const m = line.trim().match(/^(when|whenever|at) ([^,]+?), (if [\s\S]+)$/i); if (!m) continue;
          const sp = s21Split(m[3]); if (!sp || sp.known) continue;
          r.issues.push({kind:'effect', text:`intervening “if ${sp.cond}” — the condition isn't evaluated`.replace(/~/g, f.n), where:line.replace(/~/g, f.n)});
        }
      }
      if (!n0 && r.issues.length) r.ok = Math.max(0, (r.ok || 0) - 1);
    } catch (e){ console.warn('s21 check', e); }
    return r;
  };
}

/* ---------- found while testing: a permanent spell whose text says "counter target spell" (Kozilek's activated ability,
   Mystic Snake's enters trigger) was treated as a counterspell while being cast: it couldn't be cast with an empty stack, and
   casting it asked what it counters. Only an instant or sorcery's own text counters as it's cast. ---------- */
{
  const cs = counterSpec;
  counterSpec = function(t){ if (S21.permTxt != null && t === S21.permTxt) return null; return cs(t); };
  const perm = c => { const a = c && info(c.k); return a && isPermType(a.t || '') ? tname(a.o, a.n) : null; };
  const cc = castCheck;
  castCheck = function(c, zone){ const p = perm(c); if (p == null) return cc(c, zone); const keep = S21.permTxt; S21.permTxt = p; try { return cc(c, zone); } finally { S21.permTxt = keep; } };
  const bc = beginCast;
  beginCast = async function(c, zone, o){ const p = perm(c); if (p == null || UI.casting) return bc(c, zone, o); const keep = S21.permTxt; S21.permTxt = p; try { return await bc(c, zone, o); } finally { S21.permTxt = keep; } };
}
