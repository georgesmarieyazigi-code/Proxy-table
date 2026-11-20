
/* =============================================================
   Rules engine — round 2
   Targets (hexproof, shroud, protection, ward), removal and damage on
   any board, live power/toughness with anthems, state-based actions,
   gain control, other players' choices (sacrifice, discard), the
   Repeat ×N loop shortcut, graveyard casting and recursion, "until end
   of turn" and "at the beginning of the next end step".
   ============================================================= */

/* ---------- Boards, keywords, power/toughness ---------- */
function boardOf(pid){ return pid === MYPID ? S.bf : (OPP.get(pid)?.bf || []); }
function boardsAll(){ const out = [{pid:MYPID, bf:S.bf}]; for (const [pid, s] of OPP) out.push({pid, bf:s.bf || []}); return out; }
const isPW = c => /\bPlaneswalker\b/.test(typeOf(c));
const isBattle = c => /\bBattle\b/.test(typeOf(c));
// one printed power or toughness, in any form Scryfall uses: 3, -1, +2, *, 1+*, *+1, 7-*, 2*, *², X, ?, ∞, ½, 3½, 1.5
// the variable part (*, X, ?) counts as 0 here; characteristic-defining abilities add their number on top
const PT_CACHE = new Map();
function ptNum(v){
  const s = String(v == null ? '' : v).trim().replace(/\s+/g, '').replace(/[−–]/g, '-').replace(/²/g, '').replace(/(\d)½/g, '$1.5').replace(/½/g, '0.5');
  if (!s) return null; if (s === '∞') return 999; let m;
  if (/^[*xX?]$/.test(s)) return 0;
  if ((m = s.match(/^([+-]?(?:\d+\.?\d*|\.\d+))$/))) return +m[1];
  if (/^\d+[*xX]$/.test(s)) return 0;                                                  // 2* (twice a variable)
  if ((m = s.match(/^([+-]?(?:\d+\.?\d*|\.\d+))[+-][*xX?]$/))) return +m[1];           // 1+*, 7-*
  if ((m = s.match(/^[*xX?]([+-])(\d+\.?\d*)$/))) return (m[1] === '-' ? -1 : 1) * +m[2];   // *+1
  return null;
}
const ptOf = f => { const p = String(f && f.p || ''); if (!p || /^[LD]/.test(p)) return null; let r = PT_CACHE.get(p);
  if (r === undefined){ const i = p.indexOf('/'); const a = i < 0 ? null : ptNum(p.slice(0, i)), b = i < 0 ? null : ptNum(p.slice(i + 1)); r = a == null || b == null ? null : [a, b]; if (PT_CACHE.size < 500) PT_CACHE.set(p, r); }
  return r ? [r[0], r[1]] : null; };
function kwOf(c, kw, pid=MYPID){
  if (!c || c.fd) return false;
  if ((c.ekw || []).includes(kw)) return true;
  if (hasKwText(faceOf(c), kw)) return true;
  if (attachFx(c, pid).kws.includes(kw)) return true;
  return grantedKw(c, kw, boardOf(pid)) === true;
}
function anthems(c, ownerPid){
  let dp = 0, dt = 0;
  for (const b of boardsAll()) for (const s of b.bf){
    if (!s.k || s.fd) continue; const a = info(s.k); if (!a) continue; const f = s.fl && a.back ? a.back : a;
    for (const sen of tname(f.o, f.n).toLowerCase().split(/\.\s*|\n/)){
      const m = sen.match(/^(other )?(.+?) gets? ([+-]\d+)\/([+-]\d+)(?: and |$)/); if (!m) continue;
      let desc = m[2]; if (/^(~|equipped|enchanted|target|each|it|that|they)\b/.test(desc) || /until end of turn|for each|as long as/.test(sen)) continue;
      let who = 'any';
      if (/ you control$/.test(desc)){ who = 'you'; desc = desc.replace(/ you control$/, ''); }
      else if (/ (your opponents|an opponent) controls?$/.test(desc)){ who = 'opp'; desc = desc.replace(/ (your opponents|an opponent) controls?$/, ''); }
      if (who === 'you' && b.pid !== ownerPid) continue;
      if (who === 'opp' && b.pid === ownerPid) continue;
      if (m[1] && b.pid === ownerPid && s.id === c.id) continue;
      if (!descOk(c.k, desc, {tok:c.tok, face:faceOf(c)})) continue;
      dp += +m[3]; dt += +m[4];
    }
  }
  return [dp, dt];
}
function stats(c, pid=MYPID){
  const b = c && c.fd && c.fdc ? [2, 2] : ptOf(faceOf(c)); if (!b) return null;
  const [ap0, at0] = anthems(c, pid); const [xp, xt] = xAnthems(c, pid); const ap = ap0 + xp, at = at0 + xt; const d = (c.cp || 0) - (c.cm || 0); const pu = c.pu || [0, 0];
  const ax = attachFx(c, pid);
  const r = [b[0] + d + ap + pu[0] + ax.p, b[1] + d + at + pu[1] + ax.t];
  return c.sw ? [r[1], r[0]] : r;
}
function livePTFor(c, pid){
  if (!c.k || c.fd || !isCreatureCard(c)) return '';
  const s = stats(c, pid); if (!s) return ''; const b = ptOf(faceOf(c));
  return (s[0] !== b[0] || s[1] !== b[1] || c.dmg) ? `${s[0]}/${s[1]}${c.dmg ? ' · ' + c.dmg + ' dmg' : ''}` : '';
}
function livePT(c){ return livePTFor(c, MYPID); }
function protFrom(c){
  const out = [];
  for (const line of tname(textOf(c), cname(c)).toLowerCase().split('\n')){
    const m = line.match(/protection from ([a-z ,]+)/); if (!m) continue;
    m[1].split(/,\s*|\s+and\s+|\s+from\s+/).forEach(x => { x = x.trim().replace(/^from /, ''); if (x) out.push(x.replace(/s$/, '')); });
  }
  return out;
}
function protects(c, src){ // does c have protection from this source? src: {col, types}
  const p = protFrom(c); if (!p.length) return false;
  return p.some(x => x === 'everything' || (COLW[x] && (src.col || '').includes(COLW[x])) || (x === 'multicolored' && (src.col || '').length > 1) || (src.types && new RegExp('\\b' + x + '\\b', 'i').test(src.types)));
}
function wardOf(c){
  const t = tname(textOf(c), cname(c)); const m = t.match(/^ward\s*(?:—|-)?\s*(.+?)\.?$/im); if (!m) return null;
  const w = m[1].trim(); let q;
  if ((q = w.match(/^((?:\{[^}]+\})+)$/))) return {mana:q[1], label:q[1]};
  if ((q = w.match(/^pay (\d+) life/i))) return {life:+q[1], label:`pay ${q[1]} life`};
  return {other:w, label:w};
}
const playerShielded = pid => boardOf(pid).some(b => b.k && !b.fd && /you have (hexproof|shroud)/i.test(info(b.k)?.o || ''));

/* ---------- Targets ---------- */
const TVERB = /\s(gets?|gains?|loses?|deals?|draws?|discards?|sacrifices?|mills?|can't|attacks?|blocks?|becomes?|to |onto|on |unless|until|and |with (?:the )?(?:highest|lowest)|that |phases|explores|fights?|copies|for each|in |where|isn't)/;
function targetSpecs(t){
  const out = []; const low = ' ' + String(t || '').toLowerCase().replace(/\([^)]*\)/g, '').replace(/strive — [^.\n]*?beyond the first\./g, '').replace(/costs? \{[^.]*? more to cast for each target beyond the first\./g, '');   // Strive's cost line isn't a target (Twinflame)
  const re = /(?:\b(up to )?(one|two|three|four|x|any number of) )?(other )?\b(any )?target(?=[ .,;])/g; let m;
  while ((m = re.exec(low))){
    const before = low.slice(Math.max(0, m.index - 9), m.index);
    if (/counter $/.test(before)) continue;
    const n = m[2] && m[2] !== 'one' ? (m[2] === 'any number of' ? 99 : (wn(m[2]) || 1)) : 1;
    if (m[4]){ out.push({desc:'any', any:true, zone:'bf', n, upTo:!!m[1]}); continue; }
    const rest = low.slice(m.index + m[0].length + 1).split(/[.;,]/)[0] + ' ';
    const gy = /^(.*?card) (?:from|in) (your|a|an opponent's|target player's|their) graveyard/.exec(rest);
    if (gy){ out.push({desc:gy[1], zone:'gy', whose: gy[2] === 'your' ? 'you' : gy[2] === 'a' ? 'any' : 'opp', n, upTo:!!m[1] || m[2] === 'any number of', other:!!m[3]}); continue; }
    const v = TVERB.exec(rest); const desc = (v ? rest.slice(0, v.index) : rest).trim();
    if (/^(spell|activated|triggered|ability)/.test(desc) || /\b(spell|ability)\b/.test(desc)) continue;
    out.push({desc, zone:'bf', n, upTo:!!m[1] || m[2] === 'any number of', other:!!m[3]});
  }
  return out;
}
function targetCands(spec, src){
  const out = []; const d = spec.desc;
  const wantPlayers = spec.any || /\b(players?|opponents?)\b/.test(d);
  const oppOnly = /\bopponents?\b/.test(d) && !/\bplayers?\b/.test(d);
  let cardDesc = spec.any ? 'creature or planeswalker or battle' : d.replace(/\b(players?|opponents?)\b/g, '').replace(/^\s*(or|and)\s+|\s+(or|and)\s*$/g, '').trim();
  if (spec.zone === 'gy'){
    const lists = [];
    if (spec.whose !== 'opp') lists.push([MYPID, S.gy.map(c => ({id:c.id, k:c.k}))]);
    if (spec.whose !== 'you') for (const [pid, s] of OPP) lists.push([pid, (s.gy || []).map((k, i) => ({id:'g' + i, k}))]);
    for (const [pid, cards] of lists) cards.forEach(c => { if (c.k && descOk(c.k, d)) out.push({t:'gy', pid, id:c.id, k:c.k, nm:info(c.k)?.n || 'a card', ok:true}); });
    return out;
  }
  if (cardDesc){
    const cd = ctlDesc(cardDesc);
    for (const b of boardsAll()){
      if (cd.ctl === 'you' && b.pid !== MYPID) continue;
      if (cd.ctl === 'opp' && b.pid === MYPID) continue;
      for (const c of b.bf){
        if (!c.k || c.fd) continue;
        if (spec.other && b.pid === MYPID && c.id === src.id) continue;
        if (!descOk(c.k, cd.desc || 'permanent', {tok:c.tok, face:faceOf(c)})) continue;
        let why = '';
        if (b.pid !== src.pid && kwOf(c, 'hexproof', b.pid)) why = 'hexproof';
        else if (kwOf(c, 'shroud', b.pid)) why = 'shroud';
        else if (protects(c, src)) why = 'protection';
        else if (b.pid !== src.pid && /can't be the target of spells or abilities your opponents control/i.test(textOf(c))) why = "can't be targeted by you";
        out.push({t:'card', pid:b.pid, id:c.id, k:c.k, nm:info(c.k)?.n || 'a card', ok:!why, why});
      }
    }
  }
  if (wantPlayers) for (const p of players()){
    if (oppOnly && p.me) continue;
    const why = !p.me && playerShielded(p.pid) ? 'hexproof' : '';
    out.push({t:'player', pid:p.pid, nm:p.me ? `${p.nm} (you)` : p.nm, ok:!why, why});
  }
  return out;
}
function targetsAvailable(text, src){
  for (const sp of targetSpecs(text)){ if (sp.upTo) continue; if (!targetCands(sp, src).some(c => c.ok)) return `no legal target (${sp.any ? 'any target' : sp.desc})`; }
  return '';
}
function pickTargets(spec, src, title){
  const cands = targetCands(spec, src);
  const r = replayAns(); if (r !== undefined) return Promise.resolve(matchReplayTargets(r, cands));
  const legal = cands.filter(c => c.ok);
  if (!spec.upTo && !legal.length) return recAns(Promise.resolve([]));
  if (!spec.upTo && spec.harm && cands.every(c => c.t === 'player')){ const opp = legal.filter(c => c.pid !== MYPID); if (opp.length === 1) return recAns(Promise.resolve([opp[0]])); }
  return recAns(new Promise(res => openModal({type:'target', key:rid(4), title, spec, cands, sel:[], resolve:res, onClose:() => res(null)})));
}
function matchReplayTargets(r, cands){
  if (!Array.isArray(r)) return null; const used = new Set();
  return r.map(t => { let c = cands.find(x => x.ok && x.t === t.t && x.pid === t.pid && x.id === t.id && !used.has(x));
    if (!c) c = cands.find(x => x.ok && x.t === t.t && x.pid === t.pid && x.k === t.k && !used.has(x)); if (c) used.add(c); return c; }).filter(Boolean);
}
async function chooseTargets(text, src, name){
  const specs = targetSpecs(text); if (!specs.length) return [];
  const groups = [];
  for (const sp of specs){
    sp.harm = /\b(loses?|discards?|sacrifices?|damage)\b/i.test(text) && !/\bmills?\b/i.test(text);   // mill can be aimed at yourself (Brain Freeze, Thassa's Oracle lines): always ask
    const what = sp.any ? 'any target' : sp.desc;
    const picks = await pickTargets(sp, src, `${name}: choose ${sp.upTo ? 'up to ' : ''}${sp.n > 1 && sp.n < 99 ? sp.n + ' ' : ''}target ${what}`);
    if (picks == null) return null;
    groups.push(picks.map(p => ({t:p.t, pid:p.pid, id:p.id, k:p.k || null, nm:p.nm})));
  }
  return groups;
}
async function payWard(groups, name){
  for (const g of groups) for (const t of g){
    if (t.t !== 'card' || t.pid === MYPID) continue;
    const c = boardOf(t.pid).find(b => b.id === t.id); if (!c) continue;
    const w = wardOf(c); if (!w) continue;
    if (w.mana){
      const p = payPlan(parseCost(w.mana), S.pool);
      const y = await askYes(`${t.nm} has ward ${w.label}. Pay it, or ${name} is countered.`, p.err ? `Pay ${w.label} (${p.err})` : `Pay ${w.label}`, `Don't pay`);
      if (!y || p.err) return false; S.pool = p.pool; log(`paid ward ${w.label} for ${t.nm}`);
    } else if (w.life){
      if (!(await askYes(`${t.nm} has ward — ${w.label}. Pay it, or ${name} is countered.`, `Pay ${w.life} life`, `Don't pay`))) return false;
      S.life -= w.life; log(`paid ${w.life} life for ward`);
    } else if (!(await askYes(`${t.nm} has ward — ${w.label}. Did you pay it?`, 'Paid', 'Not paid'))) return false;
  }
  return true;
}
function targetStillThere(t){
  if (t.t === 'player') return t.pid === MYPID || OPP.has(t.pid);
  if (t.t === 'gy') return t.pid === MYPID ? S.gy.some(c => c.id === t.id) : (OPP.get(t.pid)?.gy || []).includes(t.k);
  return boardOf(t.pid).some(b => b.id === t.id && b.k === t.k);
}
const tgtLabel = groups => (groups || []).flat().map(t => t.t === 'player' ? t.nm.replace(' (you)', '') : t.pid === MYPID ? t.nm : `${nameOf(t.pid)}'s ${t.nm}`).join(', ');

/* ---------- Doing things to cards on any board ---------- */
function srcFlags(k, pid, card){
  const a = info(k) || {}; const c = card || {k};
  return {dt:kwOf(c, 'deathtouch', pid), wi:kwOf(c, 'wither', pid), inf:kwOf(c, 'infect', pid), ll:kwOf(c, 'lifelink', pid), col:a.c || '', types:a.t || ''};
}
function applyTo(t, op){
  if (t.pid === MYPID){ applyOp({...op, tid:t.id}, MYPID); return; }
  sendRq(t.pid, op.op, op.n || 0, op.src, {tid:t.id, d:op.d, f:op.f, c:op.c, ref:op.ref});
}
function single(c){ // a token stack can't be targeted as a whole: split one off
  if ((c.n || 1) <= 1) return c;
  c.n--; if ((c.tn || 0) > c.n) c.tn = c.n;
  const s = {id:S.nid++, k:c.k, tok:true, n:1, sk:c.sk, x:clamp((c.x || 0) + 60, 0, 1000), y:c.y}; S.bf.push(s); return s;
}
function destroyCard(c, why){
  if (kwOf(c, 'indestructible')){ log(`${cname(c)} is indestructible`); return; }
  if (c.regen > 0){ c.regen--; c.tap = true; c.dmg = 0; c.dtd = 0; log(`${cname(c)} regenerated`); return; }
  moveCard(c.id, 'gy', {quiet:true}); log(`${cname(c)} was destroyed${why ? ' (' + why + ')' : ''}`);
}
function damageCard(c, n, f={}){
  if (!c || n <= 0) return 0;
  const nm = cname(c); const tx = tname(textOf(c), nm).toLowerCase();
  if (protects(c, f)){ log(`damage to ${nm} prevented (protection)`); return 0; }
  if (/if damage would be dealt to ~, prevent that damage\. remove a \+1\/\+1 counter from ~/.test(tx)){ c.cp = Math.max(0, (c.cp || 0) - 1); log(`${nm}: damage prevented, removed a +1/+1 counter`); return 0; }
  if (/if damage would be dealt to ~, prevent that damage and put that many \+1\/\+1 counters on (~|it)/.test(tx)){ c.cp = (c.cp || 0) + n; log(`${nm}: damage prevented, ${n} +1/+1 counters instead`); return 0; }
  if (/prevent all damage that would be dealt to ~/.test(tx)){ log(`damage to ${nm} prevented`); return 0; }
  if (/if damage would be dealt to ~/.test(tx)) log(`⚠ ${nm} has a damage replacement effect — check it`);
  if (isPW(c) || isBattle(c)){ c.co = Math.max(0, (c.co || 0) - n); log(`${nm} loses ${n} ${isPW(c) ? 'loyalty' : 'defense'}`); return n; }
  if (f.inf || f.wi){ f24cmAdd(c, n); log(`${nm} gets ${n} −1/−1 counter${n > 1 ? 's' : ''}`); }
  else { c.dmg = (c.dmg || 0) + n; log(`${nm} takes ${n} damage`); }
  if (f.dt) c.dtd = 1;
  return n;
}
function damageMe(n, f={}, fromPid){
  if (n <= 0) return;
  if (S.bf.some(b => b.k && !b.fd && /prevent all damage that would be dealt to you/i.test(info(b.k)?.o || ''))){ log('damage to me prevented'); return; }
  if (f.inf){ S.psn += n; log(`gets ${n} poison → ${S.psn}`); }
  else { S.life -= n; log(`takes ${n} damage → ${S.life}`); }
  if (f.cmd && fromPid){ const key = fromPid + '|' + f.cmd; S.cdt[key] = (S.cdt[key] || 0) + n; log(`commander damage from ${info(f.cmd)?.n || 'a commander'}: ${S.cdt[key]}`); }
}
// deal damage from one of my sources to a target (card or player on any board)
function dealDamage(t, n, srcK, srcCard, extra={}){
  if (n <= 0) return;
  r7DamageEvent(t, n, srcK, srcCard);
  const f = {...srcFlags(srcK, MYPID, srcCard), ...extra};
  if (t.t === 'player'){ if (t.pid === MYPID) damageMe(n, f, MYPID); else { sendRq(t.pid, 'pdmg', n, info(srcK)?.n, {f}); log(`${info(srcK)?.n} deals ${n} damage to ${nameOf(t.pid)}`); } }
  else applyTo(t, {op:'dmg', n, src:info(srcK)?.n, f});
  if (f.ll && gainLife(n, 'lifelink')) log(`gained ${n} life (lifelink) → ${S.life}`);
  if (UI.rec && t.pid !== MYPID) UI.rec.loss[t.pid] = (UI.rec.loss[t.pid] || 0) + (t.t === 'player' ? n : 0);
}
function ownersCards(desc, pid=MYPID){ return S.bf.filter(c => !c.fd && descOk(c.k, desc, {tok:c.tok, face:faceOf(c)})); }
function applyOp(r, from){
  const c = r.tid != null ? S.bf.find(b => b.id === r.tid) : null;
  const who = from === MYPID ? '' : ` (${r.src || nameOf(from) + "'s card"})`;
  switch (r.op){
    case 'destroy': if (c) destroyCard(single(c), r.src); break;
    case 'exile': if (c) moveCard(single(c).id, 'ex', {quiet:true}), log(`${cname(c)} was exiled${who}`); break;
    case 'bounce': if (c){ const s = single(c); log(`${cname(s)} was returned to hand${who}`); moveCard(s.id, s.tok ? 'gy' : 'hand', {quiet:true}); } break;
    case 'tap': if (c){ const s = single(c); s.tap = true; log(`${cname(s)} was tapped${who}`); } break;
    case 'untap': if (c){ c.tap = false; c.tn = 0; log(`${cname(c)} was untapped${who}`); } break;
    case 'dmg': if (c) damageCard(single(c), r.n, r.f || {}); break;
    case 'pdmg': damageMe(r.n, r.f || {}, from); break;
    case 'pump': if (c){ const s = single(c); const f = r.f || {}; s.pu = [(s.pu || [0, 0])[0] + (f.p || 0), (s.pu || [0, 0])[1] + (f.t || 0)]; (f.kw || []).forEach(k => { s.ekw = [...new Set([...(s.ekw || []), k])]; }); log(`${cname(s)} gets ${f.p >= 0 ? '+' : ''}${f.p || 0}/${f.t >= 0 ? '+' : ''}${f.t || 0}${(f.kw || []).length ? ' and ' + f.kw.join(', ') : ''} until end of turn${who}`); } break;
    case 'psn': { const n = typeof playerCounterMod === 'function' ? playerCounterMod(r.n, from) : r.n; S.psn += n; log(`gets ${n} poison counter${n === 1 ? '' : 's'}${who} → ${S.psn}`); break; }
    case 'ctr': if (c){ const s = single(c); const kind = ['cm','co','lore'].includes(r.d) ? r.d : 'cp'; const n = addCounters(s, kind, r.n, from); log(`${cname(s)} gets ${n} ${kind === 'cp' ? '+1/+1' : kind === 'cm' ? '−1/−1' : ''} counter${n === 1 ? '' : 's'}${who}`); } break;
    case 'steal': if (c) giveAway(single(c), from, r.f || {}); break;
    case 'give': takeCard(r, from); break;
    case 'back': takeBack(r); break;
    case 'regen': if (c){ c.regen = (c.regen || 0) + 1; log(`${cname(c)} gets a regeneration shield`); } break;
    case 'wipe': case 'wipeEx': case 'bounceAll': {
      const list = ownersCards(r.d).filter(x => !(r.f && r.f.other && from === MYPID && x.id === r.f.srcId));
      if (list.length) log(`${r.op === 'wipe' ? 'destroying' : r.op === 'wipeEx' ? 'exiling' : 'returning'} ${list.length} ${r.d}${who}`);
      list.forEach(x => { if (r.op === 'wipe') destroyCard(x); else if (r.op === 'wipeEx') moveCard(x.id, 'ex', {quiet:true}); else moveCard(x.id, x.tok ? 'gy' : 'hand', {quiet:true}); });
      break;
    }
    case 'dmgAll': ownersCards(r.d || 'creature').forEach(x => damageCard(x, r.n, r.f || {})); break;
    case 'sac': case 'discard': addChoicePrompt(r.op, r.d || '', r.n || 1, from, r.src); break;
    case 'life': if (r.n > 0 && !canGain().ok){ log(`would gain ${r.n} life — ${canGain().why}`); break; } S.life += r.n; log(`${r.n < 0 ? 'lost' : 'gained'} ${Math.abs(r.n)} life${who} → ${S.life}`); break;
    case 'draw': draw(clamp(r.n, 0, 20)); break;
    case 'mill': mill(clamp(r.n, 0, 60)); break;
    case 'gytake': { const i = S.gy.findIndex(g => g.k === r.d); if (i >= 0){ const [g] = S.gy.splice(i, 1); const ref = rid(6); S.lent.push({ref, to:from, card:g, perm:true}); sendRq(from, 'give', 0, '', {ref, c:{k:g.k, cmd:g.cmd ? 1 : 0}, f:{...(r.f || {}), fromGy:1}}); log(`${nameOf(from)} took ${cname(g)} from my graveyard`); } break; }
  }
  commit();
}
function addCounters(c, kind, n, fromPid=MYPID){ return typeof modCounters === 'function' ? modCounters(c, kind, n, fromPid) : ((c[kind] = (c[kind] || 0) + n), cancelCounters(c), n); }

/* ---------- Gain control ---------- */
function giveAway(c, to, f){
  const i = S.bf.indexOf(c); if (i < 0) return;
  S.bf.splice(i, 1);
  const ref = rid(6); S.lent.push({ref, to, card:c});
  sendRq(to, 'give', 0, cname(c), {ref, c:{k:c.k, cp:c.cp || 0, cm:c.cm || 0, co:c.co || 0, tok:c.tok ? 1 : 0, fl:c.fl ? 1 : 0, tap:c.tap ? 1 : 0}, f});
  log(`${nameOf(to)} gained control of ${cname(c)}${f.eot ? ' until end of turn' : ''}`);
}
function takeCard(r, from){
  const d = r.c || {}; if (!d.k) return;
  const c = {id:S.nid++, k:d.k, cp:d.cp || 0, cm:d.cm || 0, co:d.co || 0, tok:!!d.tok, fl:!!d.fl, tap:!!d.tap && !(r.f && r.f.untap), sk:true, own:{pid:from, ref:r.ref}};
  if (r.f && r.f.eot) c.eot = 1;
  if (r.f && r.f.haste) c.ekw = ['haste'];
  place(c); S.bf.push(c);
  log(`gained control of ${cname(c)}${c.eot ? ' until end of turn' : ''}${r.f && r.f.fromGy ? ' from ' + nameOf(from) + "'s graveyard" : ''}`);
  if (r.f && r.f.fromGy) delete c.own; // reanimated from someone else's graveyard: stays with me until it leaves
  onEnter(c, r.f && r.f.fromGy ? 'gy' : 'bf', {});
}
function sendBack(c, to){
  const i = S.bf.indexOf(c); if (i >= 0) S.bf.splice(i, 1);
  sendRq(c.own.pid, 'back', 0, cname(c), {ref:c.own.ref, d:to});
  log(`${cname(c)} goes back to ${nameOf(c.own.pid)}${to === 'bf' ? '' : ' (' + ZNAME[to] + ')'}`);
}
function takeBack(r){
  const i = S.lent.findIndex(l => l.ref === r.ref); if (i < 0) return;
  const [l] = S.lent.splice(i, 1); const c = l.card; reset(c);
  const to = ['bf','gy','ex','hand','lib','cz'].includes(r.d) ? r.d : 'gy';
  if (c.tok && to !== 'bf') { log(`${cname(c)} token is gone`); return; }
  if (to === 'bf'){ place(c); c.sk = true; S.bf.push(c); log(`got ${cname(c)} back`); }
  else { (c.cmd && to !== 'cz' ? S.cz : S[to]).push(c); log(`${cname(c)} came back to my ${ZNAME[to]}`); }
}

/* ---------- Choices other players make (sacrifice, discard) ---------- */
function addChoicePrompt(kind, desc, n, from, src){
  const pool = kind === 'sac' ? S.bf.filter(c => !c.fd && descOk(c.k, desc || 'permanent', {tok:c.tok, face:faceOf(c)})) : S.hand.slice();
  if (!pool.length){ log(`has nothing to ${kind === 'sac' ? 'sacrifice' : 'discard'}${src ? ' for ' + src : ''}`); return; }
  if (kind === 'sac' && pool.length <= n){ pool.forEach(c => sacrificeOne(c)); log(`sacrificed ${pool.map(cname).join(', ')}${src ? ' for ' + src : ''}`); return; }
  if (kind === 'discard' && pool.length <= n){ pool.forEach(c => moveCard(c.id, 'gy')); return; }
  S.prm.push({id:rid(6), type:kind, d:desc, n, from, src, left:CHOICE_MS});
}
async function choosePrompt(p){
  const pool = p.type === 'sac' ? S.bf.filter(c => !c.fd && descOk(c.k, p.d || 'permanent', {tok:c.tok, face:faceOf(c)})) : S.hand.slice();
  const ids = await pickCards({title:`${p.src || nameOf(p.from)}: ${p.type === 'sac' ? 'sacrifice' : 'discard'} ${p.n} ${p.d || (p.type === 'sac' ? 'permanent' : 'card')}${p.n > 1 ? 's' : ''}`, cards:pool, min:Math.min(p.n, pool.length), max:Math.min(p.n, pool.length)});
  if (!ids) return;
  finishChoice(p, ids);
}
function finishChoice(p, ids){
  const i = S.prm.indexOf(p); if (i < 0) return; S.prm.splice(i, 1);
  ids.forEach(id => { const [z,,c] = find(id); if (!c) return; if (p.type === 'sac') sacrificeOne(c); else moveCard(id, 'gy'); });
  commit();
}
function randomChoice(p){
  const pool = p.type === 'sac' ? S.bf.filter(c => !c.fd && descOk(c.k, p.d || 'permanent', {tok:c.tok, face:faceOf(c)})) : S.hand.slice();
  shuffle(pool); log(`ran out of time — the game chose at random`); finishChoice(p, pool.slice(0, p.n).map(c => c.id));
}

/* ---------- Effects with targets ---------- */
function nextTargets(ctx){ const g = (ctx.tgts || [])[ctx.ti || 0] || []; ctx.ti = (ctx.ti || 0) + 1; const live = g.filter(targetStillThere); if (live.length) ctx.lastT = live; return live; }
function statsAny(t){ const c = boardOf(t.pid).find(b => b.id === t.id); return c ? stats(c, t.pid) : null; }
function srcCardOf(ctx){ return ctx.srcId != null ? find(ctx.srcId)[2] : ctx.card || null; }
function sentenceHasTarget(l){ return /\btarget\b/.test(l.replace(/counter target/, '')); }
async function doTargeted(s, l, ctx){
  let m; const name = ctx.name; const srcK = ctx.k; const srcC = srcCardOf(ctx);
  const T = () => sentenceHasTarget(l) ? nextTargets(ctx) : (ctx.lastT || []);
  const cards = ts => ts.filter(t => t.t === 'card');
  if (/^(it|they) can't be regenerated$/.test(l) || /^(that creature|it) can't be regenerated/.test(l)) return true;
  if ((m = l.match(/^destroy (?:up to \w+ )?(?:other )?target (.+?)(?:\. (?:it|they) can't be regenerated)?$/))){ cards(T()).forEach(t => applyTo(t, {op:'destroy', src:name})); return true; }
  if ((m = l.match(/^destroy (?:all|each) (other )?(.+)$/))){ const d = m[2].replace(/ you don't control$/, ''); const notMine = / you don't control$/.test(m[2]) || /your opponents control/.test(m[2]);
    if (!notMine) applyOp({op:'wipe', d:d.replace(/ you control$/, ''), f:{other:!!m[1], srcId:ctx.srcId}}, MYPID);
    if (!/ you control$/.test(m[2])) opponents().forEach(p => sendRq(p.pid, 'wipe', 0, name, {d:d.replace(/ your opponents control$/, '')}));
    return true; }
  if ((m = l.match(/^exile (?:up to \w+ )?(?:other )?target (.+)$/)) && !/graveyard/.test(m[1])){ cards(T()).forEach(t => applyTo(t, {op:'exile', src:name})); return true; }
  if ((m = l.match(/^exile all (.+)$/)) && !/graveyard/.test(m[1])){ applyOp({op:'wipeEx', d:m[1].replace(/ you control$/, '')}, MYPID); opponents().forEach(p => sendRq(p.pid, 'wipeEx', 0, name, {d:m[1]})); return true; }
  if ((m = l.match(/^return (?:up to \w+ )?(?:other )?target (.+?) to (?:its|their) owners?'s? hands?$/))){ cards(T()).forEach(t => applyTo(t, {op:'bounce', src:name})); return true; }
  if ((m = l.match(/^return all (.+?) to their owners' hands$/))){ applyOp({op:'bounceAll', d:m[1]}, MYPID); opponents().forEach(p => sendRq(p.pid, 'bounceAll', 0, name, {d:m[1]})); return true; }
  if ((m = l.match(/^(tap|untap) (?:up to \w+ )?(?:other )?target (.+)$/))){ cards(T()).forEach(t => applyTo(t, {op:m[1], src:name})); return true; }
  if ((m = l.match(/^(?:~|it) deals (\d+|x|that much) damage to (?:any target|(?:up to \w+ )?(?:other )?target .+?)$/))){
    const n = m[1] === 'that much' ? (ctx.much || 0) : await numOf(m[1], ctx, 'damage'); T().forEach(t => dealDamage(t, n, srcK, srcC)); return true; }
  if ((m = l.match(/^(?:~|it) deals damage equal to (?:its|~'s) power to (any target|(?:another )?target .+)$/))){
    const p = srcC ? (stats(srcC) || [0])[0] : 0; T().forEach(t => dealDamage(t, p, srcK, srcC)); return true; }
  if ((m = l.match(/^(?:~|it) deals (\d+|x) damage to each (creature|creature and each player|creature you don't control|creature your opponents control|opponent and each creature they control|player and each creature)(?: without flying| with flying)?$/))){
    const n = await numOf(m[1], ctx, 'damage'); const f = srcFlags(srcK, MYPID, srcC); const fly = /without flying/.test(l) ? 'creature without flying' : /with flying/.test(l) ? 'creature with flying' : 'creature';
    if (!/don't control|opponents control|opponent and/.test(m[2])) applyOp({op:'dmgAll', n, d:fly, f}, MYPID);
    opponents().forEach(p => { sendRq(p.pid, 'dmgAll', n, name, {d:fly, f}); if (/player|opponent/.test(m[2])) sendRq(p.pid, 'pdmg', n, name, {f}); });
    if (/each player/.test(m[2])) damageMe(n, f, MYPID);
    return true; }
  if ((m = l.match(/^(~|target creature(?: you control)?) fights (?:up to one )?(?:another )?target (.+)$/))){
    let a = m[1] === '~' ? (srcC ? {t:'card', pid:MYPID, id:srcC.id, k:srcC.k} : null) : nextTargets(ctx)[0];
    const b = nextTargets(ctx)[0]; if (!a || !b){ log(`${name}: fight didn't happen (a creature is gone)`); return true; }
    const sa = statsAny(a), sb = statsAny(b); if (!sa || !sb) return true;
    const ca = boardOf(a.pid).find(x => x.id === a.id), cb = boardOf(b.pid).find(x => x.id === b.id);
    if (a.pid === MYPID) dealDamage(b, sa[0], a.k, ca); else applyTo(b, {op:'dmg', n:sa[0], src:name, f:srcFlags(a.k, a.pid, ca)});
    if (b.pid === MYPID) dealDamage(a, sb[0], b.k, cb); else applyTo(a, {op:'dmg', n:sb[0], src:name, f:srcFlags(b.k, b.pid, cb)});
    log(`${a.nm || cname(ca)} fights ${b.nm}`); return true; }
  // pumps and keyword grants until end of turn
  if ((m = l.match(/^(~|target creature(?: you control)?|(?:up to \w+ )?target creatures?|it|that creature|creatures you control|other creatures you control) gets? ([+-]\d+)\/([+-]\d+)(?: and gains? ([a-z ,]+?))? until end of turn$/)) ||
      (m = l.match(/^(~|target creature(?: you control)?|it|that creature|creatures you control|other creatures you control) gains? ([a-z ,]+?)(?: and gets? ([+-]\d+)\/([+-]\d+))? until end of turn$/))){
    let p = 0, tt = 0, kws = [];
    if (/ gains? /.test(l) && !/ gets? .* and gains? /.test(l)){ kws = m[2].split(/,\s*|\s+and\s+/).filter(Boolean); if (m[3]){ p = +m[3]; tt = +m[4]; } }
    else { p = +m[2]; tt = +m[3]; if (m[4]) kws = m[4].split(/,\s*|\s+and\s+/).filter(Boolean); }
    const who = m[1]; const f = {p, t:tt, kw:kws.map(k => k.trim())};
    if (/^creatures you control|^other creatures you control/.test(who)){ S.bf.filter(c => isCreatureCard(c) && !(who.startsWith('other') && c.id === ctx.srcId)).forEach(c => applyOp({op:'pump', tid:c.id, f}, MYPID)); return true; }
    if (who === '~'){ if (srcC && find(srcC.id)[0] === 'bf') applyOp({op:'pump', tid:srcC.id, f}, MYPID); return true; }
    const ts = /target/.test(who) ? nextTargets(ctx) : (ctx.lastT || []);
    cards(ts).forEach(t => applyTo(t, {op:'pump', src:name, f})); return true; }
  if ((m = l.match(/^gain control of (?:up to \w+ )?target (.+?)( until end of turn)?$/))){
    const full = String(ctx.full || '').toLowerCase(); const f = {eot:!!m[2], untap:/untap (that|it|those)/.test(full), haste:/gains? haste/.test(full)};
    cards(T()).forEach(t => { if (t.pid !== MYPID) applyTo(t, {op:'steal', src:name, f}); else { const c = S.bf.find(x => x.id === t.id); if (c){ if (f.untap){ c.tap = false; c.tn = 0; } if (f.haste){ c.ekw = [...new Set([...(c.ekw || []), 'haste'])]; } log(`${name}: ${cname(c)} is already mine${f.untap ? ' — untapped' : ''}${f.haste ? ', haste' : ''}`); } } });   // my own permanent (Zealous Conscripts on Kiki-Jiki): untap + haste still happen
    ctx.stoleFlags = true; commit(); return true; }
  if (ctx.stoleFlags && /^(untap (that creature|that permanent|it|those creatures|those permanents)|(it|that creature|that permanent|they) gains? haste until end of turn)$/.test(l)) return true;
  if ((m = l.match(/^put (a|an|one|two|three|four|five|x|\d+) (\+1\/\+1|-1\/-1) counters? on (?:each of )?(?:up to \w+ )?(?:other )?target (.+)$/))){
    const n = await numOf(m[1], ctx, 'counters'); cards(T()).forEach(t => applyTo(t, {op:'ctr', n, src:name, d:m[2] === '+1/+1' ? 'cp' : 'cm'})); return true; }
  if ((m = l.match(/^(target player|target opponent|each opponent|each player|each other player) (sacrifices|discards) (a|an|one|two|three|x|\d+) (.+?)$/))){
    const n = await numOf(m[3], ctx, m[2]); let desc = m[4].replace(/s$/, ''); if (/^cards?$/.test(desc)) desc = '';
    let pids = [];
    if (/^target/.test(m[1])) pids = T().filter(t => t.t === 'player').map(t => t.pid);
    else if (m[1] === 'each opponent' || m[1] === 'each other player') pids = opponents().map(p => p.pid);
    else pids = players().map(p => p.pid);
    const op = m[2] === 'sacrifices' ? 'sac' : 'discard';
    pids.forEach(pid => { if (pid === MYPID) addChoicePrompt(op, desc, n, MYPID, name); else { sendRq(pid, op, n, name, {d:desc}); log(`${nameOf(pid)} ${m[2] === 'sacrifices' ? 'sacrifices' : 'discards'} ${n} ${desc || 'card'}${n > 1 ? 's' : ''}`); } });
    return true; }
  if ((m = l.match(/^target player mills (a|one|two|three|four|five|x|\d+) cards?$/))){ const n = await numOf(m[1], ctx, 'cards'); T().forEach(t => { if (t.pid === MYPID) mill(n); else { sendRq(t.pid, 'mill', n, name); log(`${t.nm} mills ${n}`); } }); return true; }
  if ((m = l.match(/^(?:its|that creature's|their) controller gains life equal to its power$/))){ (ctx.lastT || []).forEach(t => { const st = statsAny(t); const n = st ? Math.max(0, st[0]) : 0; if (t.pid === MYPID){ if (gainLife(n, name)) log(`gained ${n} life`); } else sendRq(t.pid, 'life', n, name); }); return true; }
  if ((m = l.match(/^return (?:up to \w+ )?target (.+?) card from (your|a|an opponent's) graveyard to (the battlefield|your hand)( tapped)?(?: under your control)?$/))){
    for (const t of T()){
      if (t.pid === MYPID){ const c = S.gy.find(g => g.id === t.id); if (!c) continue; if (m[3] === 'your hand') moveCard(c.id, 'hand', {quiet:true}); else { moveCard(c.id, 'bf', {quiet:true}); if (m[4]) c.tap = true; ctx.lastCardId = c.id; } log(`returned ${cname(c)} to ${m[3] === 'your hand' ? 'hand' : 'the battlefield'}`); }
      else if (m[3] === 'the battlefield'){ sendRq(t.pid, 'gytake', 0, name, {d:t.k, f:{tap:!!m[4]}}); log(`takes ${t.nm} from ${nameOf(t.pid)}'s graveyard`); }
    }
    return true; }
  if ((m = l.match(/^return ~ (?:from your graveyard )?to (the battlefield|your hand)( tapped)?$/))){
    const id = ctx.srcId ?? (ctx.card && ctx.card.id); const [z, , c] = find(id ?? -1); if (z === 'gy' || z === 'ex'){ moveCard(c.id, m[1] === 'your hand' ? 'hand' : 'bf', {quiet:true}); if (m[2]) c.tap = true; log(`returned ${cname(c)}`); } return true; }
  if ((m = l.match(/^regenerate (~|target creature)$/))){ if (m[1] === '~'){ const c = srcCardOf(ctx); if (c){ c.regen = (c.regen || 0) + 1; log(`${cname(c)} gets a regeneration shield`); } } else cards(T()).forEach(t => applyTo(t, {op:'regen', src:name})); return true; }
  if ((m = l.match(/^double (~|target creature|it|that creature)(?:'s)? power(?: and toughness)? until end of turn$/)) || (m = l.match(/^double the power(?: and toughness)? of (~|target creature|each creature you control|it) until end of turn$/))){
    const both = /and toughness/.test(l); const who = m[1];
    const apply = (c, pid) => { const st = stats(c, pid); if (!st) return; const f = {p:Math.max(0, st[0]), t:both ? Math.max(0, st[1]) : 0}; if (pid === MYPID) applyOp({op:'pump', tid:c.id, f}, MYPID); else applyTo({t:'card', pid, id:c.id}, {op:'pump', src:name, f}); };
    if (who === '~'){ const c = srcCardOf(ctx); if (c && find(c.id)[0] === 'bf') apply(c, MYPID); }
    else if (who === 'each creature you control') S.bf.filter(isCreatureCard).forEach(c => apply(c, MYPID));
    else (who === 'target creature' ? nextTargets(ctx) : (ctx.lastT || [])).forEach(t => { const c = boardOf(t.pid).find(x => x.id === t.id); if (c) apply(c, t.pid); });
    return true; }
  if ((m = l.match(/^create (?:a|one) token that's a copy of (~|target .+?|it|that creature)(, except it has haste)?(?:,? except (?:the token|it) isn't legendary)?$/))){
    let k = null;
    if (m[1] === '~'){ const c = srcCardOf(ctx); k = c && c.k; } else { const t = (/^target/.test(m[1]) ? nextTargets(ctx) : (ctx.lastT || []))[0]; k = (t && t.k) || (ctx.it && ctx.it.evk) || null; }
    if (!k){ log(`${name}: nothing to copy`); return true; }
    const tk = {id:S.nid++, k, tok:true, copy:true, n:1, sk:true}; if (m[2]) tk.ekw = ['haste']; place(tk); S.bf.push(tk); ctx.lastCardId = tk.id;
    log(`created a token copy of ${info(k)?.n}${m[2] ? ' with haste' : ''}`); emit({type:'enter', k, id:tk.id, tok:1}); return true; }
  if ((m = l.match(/^(sacrifice|exile) (?:it|that token|them|those tokens|that creature) at the beginning of the next end step$/))){
    if (ctx.lastCardId != null) S.dly.push({id:rid(6), eff:m[1] === 'sacrifice' ? 'Sacrifice ~.' : 'Exile it.', k:ctx.k, nm:name, srcId:ctx.lastCardId, op:m[1] === 'exile' ? 'exile' : undefined}); log(`${name}: ${m[1]} it at the next end step`); return true; }
  if ((m = l.match(/^exile the top (card|(?:two|three|four|five|six|seven|\d+) cards) of your library$/))){
    const n = m[1] === 'card' ? 1 : (wn(m[1].split(' ')[0]) || 1); const out = S.lib.splice(0, n); S.ex.push(...out); ctx.lastEx = out.map(c => c.id);
    if (out.length){ ctx.lastMV = info(out[out.length - 1].k)?.mv || 0; log(`exiled ${out.map(cname).join(', ')} from the top of their library`); }
    return true; }
  if ((m = l.match(/^(look at|reveal) the top (a|one|two|three|four|five|six|seven|eight|nine|ten|x|\d+) cards? of your library$/))){
    const n = await numOf(m[2], ctx, 'cards'); ctx.looked = true;
    const rest = String(ctx.full || '').replace(/\([^)]*\)/g, '').split(/\.\s+/).filter(x => /\b(them|the rest|those cards|of them|revealed)\b/i.test(x)).join('. ');
    log(`${m[1] === 'reveal' ? 'revealed' : 'looked at'} the top ${n} card${n === 1 ? '' : 's'}${m[1] === 'reveal' ? ': ' + S.lib.slice(0, n).map(cname).join(', ') : ''}`);
    await lookTopAwait(n, `${name}: top`, null, rest ? `The card says: ${rest.replace(/~/g, name)}.` : 'Move each card where the card says.'); return true; }
  if ((m = l.match(/^(?:you )?draw cards equal to (.+)$/))){ const n = await askNumber(`${name}: draw how many? (equal to ${m[1]})`, '', 1); if (n) draw(n); return true; }
  if ((m = l.match(/^at the beginning of the next end step, (.+)$/))){ S.dly.push({id:rid(6), eff:m[1], k:ctx.k, nm:name, srcId:ctx.lastCardId ?? ctx.srcId}); log(`${name}: “${m[1]}” at the next end step`); return true; }
  return false;
}

/* ---------- State-based actions ---------- */
function sba(){
  if (!S) return false; let ch = attachSBA();
  for (const c of S.bf.slice()){
    if (c.fd || !c.k) continue;
    if (isCreatureCard(c)){
      const st = stats(c); if (!st) continue;
      const ind = kwOf(c, 'indestructible');
      if (st[1] <= 0){ log(`${cname(c)} died (toughness ${st[1]})`); moveCard(c.id, 'gy', {quiet:true}); ch = true; continue; }
      if (!ind && ((c.dmg || 0) >= st[1] || (c.dtd && c.dmg > 0))){
        if (c.regen > 0){ c.regen--; c.tap = true; c.dmg = 0; c.dtd = 0; log(`${cname(c)} regenerated`); ch = true; continue; }
        log(`${cname(c)} died (lethal damage)`); moveCard(c.id, 'gy', {quiet:true}); ch = true; continue;
      }
    }
    if (isPW(c) && c.pw && (c.co || 0) <= 0){ log(`${cname(c)} has no loyalty left`); moveCard(c.id, 'gy', {quiet:true}); ch = true; continue; }
    if (isBattle(c) && c.bt && (c.co || 0) <= 0 && typeof battleDefeated === 'function'){ battleDefeated(c); ch = true; continue; }
  }
  const lostWhy = S.life <= 0 ? '0 life' : S.psn >= 10 ? '10 poison' : Object.values(S.cdt).some(v => v >= 21) ? '21 commander damage' : '';
  if (lostWhy && !S.lost){ S.lost = lostWhy; log(`☠ is out of the game (${lostWhy})`); toast(`You're out of the game: ${lostWhy}`); ch = true; }
  if (!lostWhy && S.lost) S.lost = '';
  if (ch) commit();
  return ch;
}
// once per turn change: "until end of turn" effects wear off, damage is removed, borrowed creatures go home
function turnChanged(){
  S.xc = 0; S.bd = '';
  for (const c of S.bf.slice()){
    c.pu = [0, 0]; c.ekw = []; c.sw = false; c.dmg = 0; c.dtd = 0; c.regen = 0; c.atk = ''; c.blk = null;
    if (c.own && c.eot) sendBack(c, 'bf');
  }
}

/* ---------- Graveyard casting ---------- */
function gyOptions(c){
  const a = info(c.k); if (!a) return []; const o = a.o || ''; const out = []; let m;
  if ((m = o.match(/^Flashback ((?:\{[^}]+\})+)/m))) out.push({kind:'flashback', label:`Flashback ${m[1]}`, mana:m[1], extra:[], after:'ex'});
  else if ((m = o.match(/^Flashback—([^\n(]+)/m))) out.push({kind:'flashback', label:`Flashback — ${m[1].trim()}`, mana:'', extra:m[1].replace(/\.$/, '').split(/,\s*|\s+and\s+/).map(extraPart), after:'ex'});
  if ((m = o.match(/^Escape—((?:\{[^}]+\})+), Exile (\w+) other cards? from your graveyard/m))) out.push({kind:'escape', label:`Escape ${m[1]}, exile ${m[2]} other cards`, mana:m[1], extra:[{t:'gyEx', n:wn(m[2]) || 1, label:`exile ${m[2]} other cards from your graveyard`}], after:''});
  if (/^Jump-start/m.test(o)) out.push({kind:'jumpstart', label:`Jump-start ${a.m} + discard a card`, mana:a.m, extra:[{t:'discard', desc:'', n:1, label:'discard a card'}], after:'ex'});
  if (/^Retrace/m.test(o)) out.push({kind:'retrace', label:`Retrace ${a.m} + discard a land`, mana:a.m, extra:[{t:'discard', desc:'land', n:1, label:'discard a land card'}], after:''});
  if ((m = o.match(/^Unearth ((?:\{[^}]+\})+)/m))) out.push({kind:'unearth', label:`Unearth ${m[1]}`, mana:m[1], ability:true});
  if ((m = o.match(/^Disturb ((?:\{[^}]+\})+)/m)) && a.back) out.push({kind:'disturb', label:`Disturb ${m[1]} (cast the back face)`, mana:m[1], extra:[], after:'ex', flip:true});
  if (/you may cast ~ from your graveyard/i.test(tname(o, a.n))) out.push({kind:'gycast', label:`Cast from graveyard ${a.m}`, mana:a.m, extra:[], after:''});
  return out;
}
function gyButtons(c){ return gyOptions(c).map((g, i) => `<button type="button" data-act="gyCast" data-id="${c.id}" data-i="${i}">${manaHTML(g.label)}</button>`).join(''); }
async function castFromGy(c, g){
  if (g.ability){ // unearth: an activated ability from the graveyard, sorcery speed
    if (!sorceryTime()){ toast('Unearth only as a sorcery'); return; }
    const p = payPlan(parseCost(g.mana), S.pool); if (p.err){ toast(`Not enough mana: ${p.err}`); return; }
    S.pool = p.pool;
    const it = {sid:rid(6), o:nextO(), kind:'ability', k:c.k, nm:cname(c), txt:'Unearth: return it to the battlefield. It gains haste. Exile it at the next end step or if it would leave.', srcId:c.id, op:'unearth'};
    S.stk.push(it); S.pass = 's:' + it.sid; log(`unearthed ${cname(c)} for ${g.mana}`); commit(); return;
  }
  return beginCast(c, 'gy', {gy:g});
}

/* ---------- Repeat ×N (loop shortcut) ---------- */
function recAct(a){ if (UI.rec && !UI.replay) UI.rec.acts.push(a); }
function recAns(p){ return p.then(v => { if (UI.rec && !UI.replay) UI.rec.ans.push(v && v.map ? v.map(x => (typeof x === 'object' && x) ? {...x} : x) : v); return v; }); }
function replayAns(){ if (!UI.replay) return undefined; if (!UI.replay.ans.length){ UI.replay.fail = 'it asked a question the recording did not have'; return null; } return UI.replay.ans.shift(); }
function startRecording(){ UI.rec = {acts:[], ans:[], loss:{}, life0:S.life}; UI.recDone = null; log('started recording a loop'); toast('Recording: do the loop once, then open Game ▾ → Repeat the loop'); commit(); }
function stopRecording(){ if (!UI.rec) return; UI.recDone = UI.rec; UI.rec = null; }
async function askRepeat(){
  stopRecording(); const rec = UI.recDone;
  if (!rec || !rec.acts.length){ toast('Nothing recorded yet: choose “Record a loop”, do it once, then Repeat'); return; }
  const per = Object.entries(rec.loss).filter(([, n]) => n > 0);
  let need = 0; for (const [pid, n] of per){ const s = OPP.get(pid); if (s) need = Math.max(need, Math.ceil(Math.max(1, s.life) / n)); }
  const opts = [{label:'Repeat a number of times', value:'n'}];
  if (need) opts.unshift({label:`Until every opponent is dead (${need} more time${need === 1 ? '' : 's'})`, value:'dead'});
  const v = await askChoice({title:`Repeat the loop (${rec.acts.length} action${rec.acts.length === 1 ? '' : 's'} each time)`, text: per.length ? `Each loop drains ${per.map(([pid, n]) => `${nameOf(pid)} ${n}`).join(', ')}.` : 'Opponents get one chance to respond before it runs.', options:opts});
  if (v == null) return;
  let n = need;
  if (v === 'n'){ n = await askNumber('Repeat how many times?', '', 5); if (!n) return; }
  n = clamp(n, 1, 500);
  const it = {sid:rid(6), o:nextO(), kind:'ability', k:null, nm:`Repeat loop ×${n}`, txt:`Repeat the recorded loop ${n} times${v === 'dead' ? ' (lethal)' : ''}.`, op:'loop', n};
  S.stk.push(it); S.pass = 's:' + it.sid; log(`wants to repeat a loop ${n} times${v === 'dead' ? ' — that is lethal for every opponent' : ''}`); commit();
}
function findForReplay(a){
  const zones = a.t === 'cast' ? [a.zone] : ['bf'];
  for (const z of zones){ const c = S[z].find(x => x.id === a.id); if (c) return c; }
  for (const z of zones){ const list = S[z].filter(x => x.k === a.k); const c = list.find(x => !x.tap) || list[0]; if (c) return c; }
  return null;
}
async function waitStack(ms=8000){ const t0 = Date.now(); while (Date.now() - t0 < ms){ if (!stackAll().length && !UI.resolving && !UI.casting) return true; await sleep(60); } return false; }
async function runLoop(n){
  const rec = UI.recDone; if (!rec) return;
  S.lp = 1; commit(); let done = 0, why = '';
  try {
    for (; done < n; done++){
      UI.replay = {ans:rec.ans.map(x => x && x.map ? x.map(y => (typeof y === 'object' && y) ? {...y} : y) : x)};
      for (const a of rec.acts){
        const c = findForReplay(a); if (!c){ why = `couldn't find ${info(a.k)?.n || 'a card'}`; break; }
        if (a.t === 'mana'){ const ab = manaAbs(c)[a.ai]; if (!ab || abilityReady(c, ab, true)){ why = `${cname(c)} can't make mana`; break; } await activateMana(c, ab, a.ch); }
        else if (a.t === 'ab'){ const ab = abilityList(c)[a.ai]; const r = ab ? abilityReady(c, ab, false) : 'gone'; if (!ab || (r && r !== 'Summoning sick')){ why = `${cname(c)}: ${r}`; break; } await activateAbility(c, ab); }
        else if (a.t === 'cast'){ await beginCast(c, a.zone, {free:a.free}); }
        if (UI.replay.fail){ why = UI.replay.fail; break; }
        if (!(await waitStack())){ why = 'the stack did not finish'; break; }
      }
      if (why) break;
      if (opponents().length && opponents().every(p => (p.s?.life ?? 1) <= 0)) { done++; break; }
    }
  } finally { UI.replay = null; S.lp = 0; }
  log(`repeated the loop ${done} time${done === 1 ? '' : 's'}${why ? ' — stopped: ' + why : ''}`);
  commit();
}
const loopActive = () => !!(S && (S.lp || [...OPP.values()].some(s => s.lp)));

/* ---------- Target picker dialog ---------- */
function renderTargetModal(m){
  const sp = m.spec; const max = Math.min(sp.n, 99);
  const okN = m.sel.length <= max && (sp.upTo ? true : m.sel.length === Math.min(max, m.cands.filter(c => c.ok).length));
  const by = new Map(); m.cands.forEach((c, i) => { const key = c.pid; if (!by.has(key)) by.set(key, []); by.get(key).push([c, i]); });
  const body = [...by].map(([pid, list]) => {
    const pl = list.filter(([c]) => c.t === 'player'); const cs = list.filter(([c]) => c.t !== 'player');
    return `<div class="tgroup" style="--seatc:${seatColor(pid)}"><div class="tghead"><b>${esc(pid === MYPID ? 'You' : nameOf(pid))}</b>${pl.map(([c, i]) => `<button type="button" class="btn small${m.sel.includes(i) ? ' primary' : ''}" data-act="tgtT" data-i="${i}" ${c.ok ? '' : 'disabled'}>${m.sel.includes(i) ? '✓ ' : ''}Target ${esc(c.nm)}${c.why ? ' (' + esc(c.why) + ')' : ''}</button>`).join('')}</div>` +
      (cs.length ? `<div class="vgrid tgrid2">${cs.map(([c, i]) => `<button type="button" class="vbtn vitem${m.sel.includes(i) ? ' chosen' : ''}" data-act="tgtT" data-i="${i}" ${c.ok ? '' : 'disabled'}>${cardHTML(c.k, {})}<span>${esc(c.nm)}</span>${c.why ? `<small class="why">${esc(c.why)}</small>` : ''}</button>`).join('')}</div>` : '') + '</div>';
  }).join('') || '<p class="hint">Nothing can be targeted.</p>';
  const head = `<button class="btn small primary" type="button" data-act="tgtDone" ${okN ? '' : 'disabled'}>Done (${m.sel.length}${max < 99 ? ' of ' + max : ''})</button>`;
  return {title:m.title, head, body};
}

/* ---------- Buttons ---------- */
Object.assign(ACT, {
  tgtT(el){ const m = UI.modal; const i = +el.dataset.i; const j = m.sel.indexOf(i); if (j >= 0) m.sel.splice(j, 1); else { if (m.spec.n === 1) m.sel = []; if (m.sel.length < m.spec.n) m.sel.push(i); } renderModal(); },
  tgtDone(){ const m = UI.modal; if (!m || m.type !== 'target') return; m.onClose = null; closeModal(); m.resolve(m.sel.map(i => m.cands[i])); },
  gyCast(el){ const [z,,c] = find(+el.dataset.id); if (z !== 'gy' || !c) return; const g = gyOptions(c)[+el.dataset.i]; if (!g) return; closeModal(); castFromGy(c, g); },
  choosePrm(el){ const p = S.prm.find(x => x.id === el.dataset.p); if (p) choosePrompt(p); },
  recLoop(){ closeMenu(); startRecording(); },
  repeatLoop(){ closeMenu(); askRepeat(); },
});
