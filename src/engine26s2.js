/* ===================== Round 26 SP: speed — “Start your engines!” and “Max speed” (CR 702.178, 702.179, 704.5z) ===================== */
// A player's speed lives in S.speed (undefined = no speed yet). It is published as `spd` so every other client sees it
// (their screens, and their checks of my permanents' max speed abilities).
//  • 704.5z: controlling a permanent with start your engines! while having no speed sets it to 1 (checked on every commit).
//  • 702.179d: whenever one or more opponents lose life during your turn, if your speed is less than 4, it increases by 1 —
//    only once each turn. Opponents' life loss arrives as their 'loselife' event.
//  • 702.178a: “Max speed — [ability]” only exists while the controller's speed is 4. tname() drops the label, so the
//    gate is applied where abilities are read: mana abilities (manaAbs), activated abilities (abilityReady), triggers
//    (trigsOf), static rules (staticRulesOf → staticRules) and spell cost changes (costMods).
//  • “your speed” counts (The Speed Demon), “increase your speed by N” effects.

const SP_MAX = 4;
function spSpeed(pid = MYPID){
  try { if (!S) return 0; if (pid === MYPID) return S.speed || 0; const o = OPP.get(pid); return o && o.spd || 0; } catch { return 0; }
}
const spMax = pid => spSpeed(pid) >= SP_MAX;
function spSetSpeed(n, why){
  if (!S || UI.dry) return;
  const was = S.speed || 0; const v = Math.max(0, Math.min(SP_MAX, n));
  if (S.speed != null && v === was) return;
  S.speed = v;
  log(`speed ${was ? was + ' → ' : 'is now '}${v}${v >= SP_MAX ? ' (max speed)' : ''}${why ? ' — ' + why : ''}`);
}
// 702.179c: no speed + “increase your speed by N” → speed becomes N
function spIncrease(n, why){ if (!S || UI.dry) return; const cur = S.speed || 0; if (cur >= SP_MAX) return; spSetSpeed(cur + n, why); }

/* ---------- which lines of a card are “Max speed — …” (in the form consumers see after tname) ---------- */
const SP_MS = new Map();
function spFace(k, fl){ const a = info(k); if (!a) return null; return fl && a.back ? a.back : a; }
function spMsLines(k, fl){
  const key = k + (fl ? '|b' : ''); if (SP_MS.has(key)) return SP_MS.get(key);
  const f = spFace(k, fl); const out = [];
  if (f && /(^|\n)Max speed — /.test(f.o || '')) for (const raw of String(f.o).split('\n')){ const m = raw.trim().match(/^Max speed — (.+)$/); if (m) out.push(tname(m[1], f.n).trim()); }
  if (f) SP_MS.set(key, out); return out;
}
const spIsMs = (k, fl, line) => { const ls = spMsLines(k, fl); return !!ls.length && ls.includes(String(line || '').trim()); };
const spSye = (k, fl) => { const f = spFace(k, fl); return !!f && /(^|\n)Start your engines!\s*(\(|$|\n)/im.test(f.o || ''); };
function spCtlOf(c){
  try { if (!c) return MYPID; if (S.bf.includes(c) || S.bf.some(b => b.id === c.id && b.k === c.k)) return MYPID;
    for (const [pid, s] of OPP) if ((s.bf || []).includes(c)) return pid; } catch {}
  return MYPID;
}

/* ---------- publish speed / read opponents' speed ---------- */
{
  const ps = publicState;
  publicState = function(){ const o = ps(); try { if (S && S.speed != null) o.spd = S.speed; } catch {} return o; };
  const ss = sanitizeState;
  sanitizeState = function(s){ const o = ss(s); try { if (o && s && Number.isFinite(s.spd)) o.spd = Math.max(0, Math.min(SP_MAX, Math.floor(s.spd))); } catch {} return o; };
}

/* ---------- 704.5z: start your engines! gives speed 1 (state-based action, checked whenever state is committed) ---------- */
function spSba(){
  if (!S || UI.dry || S.speed != null) return;
  const c = S.bf.find(b => b && !b.fd && b.k && spSye(b.k, b.fl));
  if (c) spSetSpeed(1, `${cname(c)}: start your engines!`);
}
{
  const cm = commit;
  commit = function(...a){ try { spSba(); } catch (e){ console.warn('sp sba', e); } return cm.apply(this, a); };
}

/* ---------- 702.179d: the inherent speed trigger ---------- */
{
  const he = handleEvent;
  handleEvent = function(pid, ev){
    try {
      if (S && !UI.dry && ev && ev.type === 'loselife' && pid !== MYPID && (ev.amt || 0) > 0 && S.speed >= 1 && S.speed < SP_MAX && phaseNow().pid === MYPID && S.spT !== turnStr()){
        S.spT = turnStr(); spIncrease(1, `${nameOf(pid)} lost life during your turn`); commit();
      }
    } catch (e){ console.warn('sp trigger', e); }
    return he(pid, ev);
  };
}

/* ---------- 702.178a: max speed abilities exist only at speed 4 ---------- */
{
  const ma = manaAbs;
  manaAbs = function(c){ const out = ma(c); try { if (c && c.k && spMsLines(c.k, c.fl).length && !spMax(spCtlOf(c))) return out.filter(ab => !spIsMs(c.k, c.fl, ab.line)); } catch (e){ console.warn('sp mana', e); } return out; };
  const ar = abilityReady;
  abilityReady = function(c, ab, mana){ try { if (c && ab && c.k && spIsMs(c.k, c.fl, ab.line) && !spMax(MYPID)) return `Max speed only (your speed is ${spSpeed(MYPID)})`; } catch {} return ar(c, ab, mana); };
  const aa = activateAbility;
  activateAbility = async function(c, ab){ try { if (c && ab && c.k && spIsMs(c.k, c.fl, ab.line) && !spMax(MYPID)){ toast(`${cname(c)}: max speed only (your speed is ${spSpeed(MYPID)})`); return; } } catch {} return aa(c, ab); };
  const tg = trigsOf;
  trigsOf = function(k, fl){ const out = tg(k, fl); try { if (k && spMsLines(k, fl).length && !spMax(MYPID)) return out.filter(t => !spIsMs(k, fl, t.raw)); } catch (e){ console.warn('sp trig', e); } return out; };
}
// static rules: tag the ones that come only from a max speed line, then keep them only while their controller has max speed
function spStaticKinds(lines){
  const out = [];
  for (const line of lines) for (const s of senSplit(String(line).toLowerCase().replace(/\.$/, ''))) for (const [re, mk] of STATIC_RULES){ const m = s.match(re); if (m){ try { out.push(mk(m).kind); } catch {} break; } }
  return out;
}
{
  const sro = staticRulesOf;
  staticRulesOf = function(k, fl){
    const out = sro(k, fl);
    try {
      const ms = spMsLines(k, fl); if (!ms.length || !out || !out.length) return out;
      const f = spFace(k, fl); const other = tname(f.o, f.n).split('\n').map(x => x.trim()).filter(x => x && !ms.includes(x));
      const msK = new Set(spStaticKinds(ms)), oK = new Set(spStaticKinds(other));
      if (![...msK].some(x => !oK.has(x))) return out;
      return out.map(r => msK.has(r.kind) && !oK.has(r.kind) ? {...r, spMS:1} : r);
    } catch (e){ console.warn('sp statics', e); return out; }
  };
  const sr = staticRules;
  staticRules = function(){ const out = sr(); try { if (out.some(r => r.spMS)) return out.filter(r => !r.spMS || spMax(r.pid)); } catch {} return out; };
}
// spell cost changes read straight from the text (Racers' Scoreboard: “Max speed — Spells you cast cost {1} less to cast.”)
const SP_COST_RE = /spells?(?: you cast| your opponents cast)?(?: during (?:your|each opponent's) turn)? costs? \{\d+\} (?:more|less) to cast/i;
{
  const cm = costMods;
  costMods = function(c, caster){
    const out = cm(c, caster);
    try {
      const gate = e => {
        const holders = []; for (const b of boardsAll()) for (const x of b.bf) if (x && x.k && !x.fd && info(x.k) && (spFace(x.k, x.fl) || {}).n === e.src) holders.push([b.pid, x]);
        if (!holders.length) return true;
        return holders.some(([pid, x]) => { const ms = spMsLines(x.k, x.fl); if (!ms.some(l => SP_COST_RE.test(l))) return true; const f = spFace(x.k, x.fl); const rest = tname(f.o, f.n).split('\n').map(y => y.trim()).filter(y => y && !ms.includes(y)); if (rest.some(l => SP_COST_RE.test(l))) return true; return spMax(pid); });
      };
      out.less = out.less.filter(gate); out.more = out.more.filter(gate);
    } catch (e){ console.warn('sp cost', e); }
    return out;
  };
}

/* ---------- “your speed”, “max speed” and “increase your speed” in effects ---------- */
{
  const co = countOf;
  countOf = function(phrase, ctx, ...a){ try { const p = String(phrase || '').trim().toLowerCase().replace(/\.$/, ''); if (p === 'your speed') return spSpeed(MYPID); } catch {} return co(phrase, ctx, ...a); };
}
const SP_NUM = {a:1, one:1, two:2, three:3, four:4};
async function doRound26SPPre(s, l, ctx){
  let m;
  if ((m = l.match(/^(?:increase your speed by|your speed increases by) (\d|one|two|three|four)$/))){ const n = SP_NUM[m[1]] || +m[1]; spIncrease(n, ctx && ctx.name); commit(); return true; }
  if (/^(?:increase your speed|your speed increases)$/.test(l)){ spIncrease(1, ctx && ctx.name); commit(); return true; }
  if ((m = l.match(/^if you (don't )?have max speed, (.+)$/))){ const ok = spMax(MYPID) !== !!m[1]; if (ok) await runEffects(cap(m[2]) + '.', ctx); return true; }
  return false;
}
{
  const ds = doSentence;
  doSentence = async function(s0, ctx){ const s = String(s0).replace(/\.$/, '').trim(); const l = s.toLowerCase(); if (l && await doRound26SPPre(s, l, ctx)) return; return ds(s0, ctx); };
}

/* ---------- the rules check: “Max speed — …” passes only when the gate above really covers that kind of line ---------- */
function spGated(line){
  const t = String(line).trim();
  if (/^[^:"]+:\s*add\b/i.test(t)) return true;                         // mana ability → manaAbs
  const kind = lineKind(t);
  if (kind === 'ability' || kind === 'loyalty') return true;           // activated → abilityReady / activateAbility
  if (kind === 'trigger') return true;                                   // → trigsOf (a trigger it can't classify is flagged by the normal check)
  const sens = senSplit(t.toLowerCase().replace(/\.$/, ''));
  return sens.every(s => STATIC_RULES.some(([re]) => re.test(s)) || SP_COST_RE.test(s));
}
{
  const cc = checkCard;
  checkCard = async function(k){
    const r = await cc(k);
    try {
      if (r && r.issues && !String(k).startsWith('r26chk|')){
        const a = info(k); const faces = a ? [a, a.back].filter(Boolean) : [];
        for (const f of faces) for (const raw of String(f.o || '').split('\n')){ const m = raw.trim().match(/^Max speed — (.+)$/); if (!m) continue;
          const t = tname(m[1], f.n).trim();
          if (!spGated(t)){ const text = 'Max speed — ' + t.replace(/~/g, f.n); if (!r.issues.some(x => x.text === text)) r.issues.push({kind:'static', text}); } }
      }
    } catch (e){ console.warn('sp check', e); }
    return r;
  };
}

/* ---------- show everyone's speed ---------- */
{
  const ch = r7Chips;
  r7Chips = function(){
    let h = ch();
    try {
      if (S){ const parts = []; if (S.speed != null) parts.push(`You <b>${S.speed}</b>${S.speed >= SP_MAX ? ' (max)' : ''}`);
        for (const [pid, s] of OPP) if (s && s.spd) parts.push(`${esc(s.nm || nameOf(pid))} <b>${s.spd}</b>${s.spd >= SP_MAX ? ' (max)' : ''}`);
        if (parts.length) h += `<span class="chip3 spchip" title="Speed (start your engines!): goes up by 1, once per turn, when an opponent loses life during your turn. At 4 (max speed) “Max speed —” abilities work.">Speed: ${parts.join(' · ')}</span>`; }
    } catch {}
    return h;
  };
  const ro = renderOpps;
  renderOpps = function(...a){
    const r = ro.apply(this, a);
    try { const opps = players().filter(p => !p.me); const els = document.querySelectorAll('#opps .opp');
      els.forEach((el, i) => { const p = opps[i]; const v = p && p.s && p.s.spd; const meta = el.querySelector('header .meta'); if (!v || !meta || meta.querySelector('.spd')) return;
        const sp = document.createElement('span'); sp.className = 'spd'; sp.title = 'Their speed (start your engines!)'; sp.innerHTML = `speed <b>${v}</b>${v >= SP_MAX ? ' (max)' : ''}`; meta.prepend(sp); }); } catch {}
    return r;
  };
}
