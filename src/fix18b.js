/* =================== fix18b: leaving the game, characteristic-defining P/T, number words ===================
   (helper J, v18 — BUGS.md 1–5)
   1. A loss is final. The outermost state-based-action check latches S.lost into S.j18out (published as b27lost / c27lost),
      so gaining life afterwards can't undo it. With three or more players seated, CR 800.4a applies: the loser leaves the game.
      Their client empties every zone they own (stack, delayed triggers and mana pool too), hands back what they control
      through a control effect, and passes the turn if it was theirs. Every other client returns the cards it lent to them,
      removes the permanents it controls that they own, takes its attackers off them, skips them in turn order and drops them
      from players() (so from targets, attack options, "each opponent", priority waits). The loser sees a "spectating" banner.
      With two players a loss ends the game: both clients show who won, and nothing is removed.
   4. Characteristic-defining abilities with a fixed part (Nighthawk Scavenger "1 plus the number of …", Barrowgoyf
      "… and its toughness is equal to that number plus 1").
   5. The engine's local number-word tables learn everything main.js's NUMW knows (one … ninety-nine, hundred, thousand). */
const J18 = {all:false, skip:null, gone:new Set()};
const j18Seated = () => 1 + (OPP ? OPP.size : 0);
const j18Multi = () => j18Seated() >= 3;
// has this player lost? (me: the latched flag; others: their published flag)
function j18Lost(pid){ if (!S) return false; if (pid === MYPID) return !!S.j18out; const s = OPP.get(pid); return !!(s && s.b27lost); }
// has this player left the game (multiplayer loss)?
function j18Out(pid){ return j18Multi() && j18Lost(pid); }

/* ---------- the latch ---------- */
function j18Lose(why){
  S.j18out = String(why || 'lost the game'); S.lost = S.j18out; try { clearUndo(); } catch {}
  if (!j18Multi()){ log(`☠ has lost the game (${S.j18out}) — the game is over`); toast(`You lost the game (${S.j18out})`); commit(); return; }
  S.j18left = 1; log(`☠ has lost the game (${S.j18out}) and leaves it — everything they own leaves with them`);
  toast(`You lost the game (${S.j18out}). You're now spectating.`);
  j18Sweep(true);
  try { const [n, pid] = currentTurn(); if (n > 0 && pid === MYPID) passTurn(); } catch (e){ console.warn('j18 pass', e); }
  commit();
}
// the leaver's own client: everything they own leaves the game; control effects in their favour end (CR 800.4a)
function j18Sweep(first){
  let ch = false;
  for (const c of S.bf.slice()) if (c.own && c.own.pid && c.own.ref){ try { sendBack(c, 'bf'); ch = true; } catch (e){ console.warn(e); } }
  for (const z of ['bf', 'hand', 'lib', 'gy', 'ex', 'cz']) if (S[z] && S[z].length){ S[z] = []; ch = true; }
  if (S.stk && S.stk.length){ S.stk = []; ch = true; }
  if (S.dly && S.dly.length){ S.dly = []; ch = true; }
  if (S.lent && S.lent.length){ S.lent = []; ch = true; }
  if (S.pool && poolTotal(S.pool)){ S.pool = emptyPool(); ch = true; }
  if (S.cb){ S.cb = null; ch = true; }
  if (ch && !first) commit();
  return ch;
}
// another client: a player has left — undo everything that ties my objects to them
function j18Gone(pid){
  if (!S || UI.dry) return; let ch = false; const nm = nameOf(pid);
  // permanents I control that they own leave the game with them
  for (const c of S.bf.slice()) if (c.own && c.own.pid === pid){ S.bf.splice(S.bf.indexOf(c), 1); log(`${cname(c)} leaves the game with its owner ${nm}`); ch = true; }
  // control effects giving them my things end; things they merely control (reanimated, played from my exile/library) are exiled
  for (const l of (S.lent || []).slice()) if (l.to === pid){ try { takeBack({ref:l.ref, d:l.perm || l.ex ? 'ex' : 'bf'}); if (typeof r21Unlist === 'function') r21Unlist(l.ref); ch = true; } catch (e){ console.warn('j18 takeBack', e); } }
  // my attackers attacking them (or their planeswalkers) are removed from combat
  for (const c of S.bf) if (c.atk){ try { const d = parseDef(c.atk); if (d && d.pid === pid){ c.atk = ''; ch = true; } } catch {} }
  if (ch) commit();
}
{
  const sb = sba;
  sba = function(...a){
    // nothing in the engine clears S.lost outside this check, so an empty S.lost here means the loss was reset by hand
    // (a two-player table's "take that back"); a player who has left a multiplayer game stays out
    try { if (S && S.j18out && !S.j18left){
        if (!S.lost) S.j18out = '';
        // two players, lost at 0 life, and the life total was put back up by hand (the life buttons / a direct edit, not a life gain):
        // that is the table taking the loss back, like the base engine always allowed. Gaining life (gainLife, a 'life' request) never does.
        else if (!j18Multi() && /0 life/.test(S.j18out) && S.life > 0 && S.j18life != null && S.life > S.j18life){ log(`life put back to ${S.life} by hand — the loss is taken back`); S.j18out = ''; S.lost = ''; S.g23lost = 0; S.r23kLost = 0; }
      } } catch {}
    const r = sb.apply(this, a);
    try {
      if (S && !UI.dry){
        if (S.j18out){ if (S.lost !== S.j18out) S.lost = S.j18out; S.j18life = S.life; if (S.j18left) j18Sweep(false); }
        else if (S.lost && !UI.resolving && currentTurn()[0] > 0){ j18Lose(S.lost); S.j18life = S.life; }
        j18TurnWatch();
      }
    } catch (e){ console.warn('j18 lost', e); }
    return r;
  };
}
// it's the turn of a player who has left (their client closed before passing it): the next player still in the game takes over
function j18TurnWatch(){
  const [n, pid, g = 0] = currentTurn(); if (!(n > 0) || pid === MYPID || !j18Out(pid) || S.j18out){ J18.skip = null; return; }
  const key = `${g}.${n}.${pid}`; if (!J18.skip || J18.skip.key !== key){ J18.skip = {key, at:Date.now()}; return; }
  if (Date.now() - J18.skip.at < 1500) return;
  if (j18NextLive(pid) !== MYPID) return;
  J18.skip = null; S.turn = [n + 1, MYPID, g]; log(`${nameOf(pid)} has left the game — their turn is skipped`); commit();
}
function j18AllPlayers(){ const k = J18.all; J18.all = true; try { return players(); } finally { J18.all = k; } }
function j18NextLive(pid){ const all = j18AllPlayers(); const i = all.findIndex(p => p.pid === pid);
  for (let d = 1; d <= all.length; d++){ const p = all[((i < 0 ? -1 : i) + d) % all.length]; if (!j18Out(p.pid)) return p.pid; } return null; }

/* ---------- players who have left are no longer players ---------- */
{
  const pl = players;
  players = function(){ const l = pl(); if (J18.all || !S || !j18Multi()) return l; return l.filter(p => p.me || !j18Lost(p.pid)); };
  const sc = seatColor;
  seatColor = function(pid){ const k = J18.all; J18.all = true; try { return sc(pid); } finally { J18.all = k; } };
  // turn order skips players who have left (CR 800.4k); an extra turn for me still works
  passTurn = function(){
    const [n, pid, g = 0] = currentTurn(); const all = j18AllPlayers();
    const i = all.findIndex(p => p.pid === pid);
    let next = all[(i < 0 ? 0 : i + 1) % all.length];
    if (n > 0){ const np = j18NextLive(pid); if (np) next = all.find(p => p.pid === np) || next; }
    if (n > 0 && pid === MYPID && !S.j18out && r7PassTurnNext()){ next = all.find(p => p.me) || next; log('takes an extra turn'); }
    S.turn = [n + 1, next.pid, g];
    log(n === 0 ? `${next.pid === MYPID ? 'goes first' : 'chose ' + next.nm + ' to go first'}` : `passed the turn to ${next.me ? 'themself' : next.nm}`);
    commit();
  };
  const sa = skipAway;
  skipAway = function(){ const pn = phaseNow(); if (!pn.mine && pn.n > 0 && j18Out(pn.pid)){ const np = j18NextLive(pn.pid); if (np){ S.turn = [pn.n + 1, np, pn.g]; log(`moved the game on — ${nameOf(pn.pid)} has left the game`); commit(); } return; } return sa(); };
  const smt = startMyTurn;
  startMyTurn = function(...a){ if (S && S.j18left){ const [n] = currentTurn(); S.untapN = n; passTurn(); return; } return smt.apply(this, a); };
  // a player who has left can't gain life, create tokens, cast spells, play lands or activate abilities
  const cg = canGain;
  canGain = function(){ if (S && S.j18left) return {ok:false, why:'you have left the game'}; return cg(); };
  const ct = createToken;
  createToken = function(k, n, near, o){ if (S && S.j18left){ log('no token is created — they have left the game'); return; } return ct(k, n, near, o); };
  const bc = beginCast;
  beginCast = async function(c, ...a){ if (S && S.j18left){ toast("You've lost the game — you're spectating"); return; } return bc(c, ...a); };
  const pld = playLand;
  playLand = function(c, ...a){ if (S && S.j18left){ toast("You've lost the game — you're spectating"); return; } return pld(c, ...a); };
  const aa = activateAbility;
  activateAbility = async function(c, ...a){ if (S && S.j18left){ toast("You've lost the game — you're spectating"); return; } return aa(c, ...a); };
}

// life gained through the engine after a loss moves the by-hand baseline with it
{
  const gl = gainLife;
  gainLife = function(n, ...a){ const b = S ? S.life : 0; const r = gl(n, ...a); try { if (S && S.j18out && S.j18life != null && S.life > b) S.j18life += S.life - b; } catch {} return r; };
  const ao = applyOp;
  applyOp = function(r, ...a){ const b = S ? S.life : 0; const out = ao(r, ...a); try { if (S && S.j18out && S.j18life != null && S.life > b) S.j18life += S.life - b; } catch {} return out; };
}

/* ---------- publishing: only the latched loss goes out ---------- */
{
  const ep = enginePublic;
  enginePublic = function(){ const o = ep(); try { if (S && S.j18out) o.b27lost = 1; else delete o.b27lost; if (S && S.j18out) o.j18why = String(S.j18out).slice(0, 60); } catch {} return o; };
  const ps = publicState;
  publicState = function(){ const o = ps(); try { if (S && S.j18out) o.c27lost = 1; else delete o.c27lost; } catch {} return o; };
  const se = sanitizeEngine;
  sanitizeEngine = function(s){ const o = se(s); try { o.j18why = s && typeof s.j18why === 'string' ? s.j18why.slice(0, 60) : ''; } catch {} return o; };
  const ors = onRemoteState;
  onRemoteState = function(pid, s){
    const r = ors(pid, s);
    try { if (s){ s.lost = s.b27lost && j18Multi() ? (s.j18why || 'lost the game') : '';
        if (s.b27lost && j18Multi()){ if (!J18.gone.has(pid)){ J18.gone.add(pid); addSysLog(`${s.nm || nameOf(pid)} has lost the game and left it`); } j18Gone(pid); }
        else J18.gone.delete(pid); } } catch (e){ console.warn('j18 remote', e); }
    return r;
  };
}

/* ---------- what the table shows ---------- */
{
  const ro = renderOpps;
  renderOpps = function(...a){
    const k = J18.all; J18.all = true; let r; try { r = ro.apply(this, a); } finally { J18.all = k; }
    try { const opps = j18AllPlayers().filter(p => !p.me); const els = [...document.querySelectorAll('#opps > .opp')];
      if (els.length === opps.length) opps.forEach((p, i) => { if (!j18Lost(p.pid)) return; const el = els[i]; el.style.opacity = '0.55'; const h = el.querySelector('header .nm');
        if (h && !el.querySelector('.j18tag')) h.insertAdjacentHTML('afterend', `<span class="j18tag" style="color:var(--bad);font-weight:600;margin-left:6px">☠ lost${j18Multi() ? ' — left the game' : ''}</span>`); }); } catch {}
    return r;
  };
  const rt = renderTop;
  renderTop = function(...a){
    const r = rt.apply(this, a);
    try { if (!S || !$('#topbar')) return r; let msg = '';
      const alive = j18AllPlayers().filter(p => !j18Lost(p.pid));
      if (S.j18out) msg = S.j18left ? `☠ You lost the game (${esc(S.j18out)}) — spectating` : `☠ You lost the game (${esc(S.j18out)}) — game over`;
      else if (OPP.size && alive.length === 1 && alive[0].me) msg = '🏆 You won the game — every opponent has lost';
      if (msg) $('#topbar').insertAdjacentHTML('beforeend', `<span class="j18ban" style="margin-left:8px;padding:2px 8px;border-radius:6px;background:var(--bad);color:#fff;font-weight:600">${msg}</span>`); } catch {}
    return r;
  };
}

/* ---------- 4. characteristic-defining abilities with a fixed part ---------- */
const J18CDA = [
  // Barrowgoyf, Tarmogoyf: "~'s power is equal to the number of X and its toughness is equal to that number plus N"
  [/^(?:~'s|its) power is equal to the number of (.+?) and its toughness is equal to that number plus (\d+)$/, m => ({what:m[1], p:0, t:+m[2], both:true})],
  // Nighthawk Scavenger: "~'s power is equal to N plus the number of X"
  [/^(?:~'s|its) power is equal to (\d+) plus the number of (.+)$/, m => ({what:m[2], p:+m[1], both:false})],
  [/^(?:~'s|its) power and toughness are each equal to (\d+) plus the number of (.+)$/, m => ({what:m[2], p:+m[1], t:+m[1], both:true})],
];
STATIC_RULES.unshift(...J18CDA.map(([re]) => [re, m => ({kind:'j18cda', who:'you'})]));
function j18CdaOf(c){
  const f = faceOf(c); const o = f && f.o; if (!o || !/plus the number of|that number plus/i.test(o)) return null;
  for (const sen of tname(o, f.n).toLowerCase().split(/\.\s*|\n/)){ const s = sen.trim(); for (const [re, mk] of J18CDA){ const m = s.match(re); if (m) return mk(m); } }
  return null;
}
// "card types among cards in all graveyards / your graveyard / your opponents' graveyards" (Tarmogoyf family)
const J18TYPES = ['artifact', 'battle', 'creature', 'enchantment', 'instant', 'kindred', 'tribal', 'land', 'planeswalker', 'sorcery'];
function j18TypesIn(keys){ const T = new Set(); for (const k of keys){ const t = String(info(k)?.t || '').split('—')[0].toLowerCase(); for (const x of J18TYPES) if (new RegExp('\\b' + x + '\\b').test(t)) T.add(x === 'tribal' ? 'kindred' : x); } return T.size; }
{
  const co = countOf;
  countOf = function(phrase, ctx, ...a){
    try { const p = String(phrase || '').trim().toLowerCase().replace(/\.$/, ''); const m = p.match(/^card types among cards in (all graveyards|your graveyard|your opponents' graveyards|opponents' graveyards)$/);
      if (m){ const mine = S.gy.map(c => c.k); const theirs = []; for (const pl of opponents()) theirs.push(...(((OPP.get(pl.pid) || {}).gy) || []).filter(Boolean));
        return j18TypesIn(m[1] === 'your graveyard' ? mine : m[1] === 'all graveyards' ? mine.concat(theirs) : theirs); } } catch (e){ console.warn('j18 count', e); }
    return co(phrase, ctx, ...a);
  };
}
{
  const st = stats;
  stats = function(c, pid = MYPID){
    let r = st(c, pid);
    try { if (r && c && c.k && !c.fd && S && (pid || MYPID) === MYPID && S.bf.includes(c)){ const d = j18CdaOf(c); if (d){
      const n = countOf(d.what, {k:c.k, srcId:c.id}) || 0; const b = ptOf(faceOf(c)) || [0, 0];
      const sw = !!c.sw; const P = sw ? 1 : 0, T = sw ? 0 : 1; r = r.slice();
      r[P] = r[P] - b[0] + d.p + n; if (d.both) r[T] = r[T] - b[1] + (d.t || 0) + n; } } } catch (e){ console.warn('j18 cda', e); }
    return r;
  };
}

/* ---------- 5. every local number-word table knows the full list ---------- */
try { const tabs = [typeof R21_W !== 'undefined' ? R21_W : null, typeof H23W !== 'undefined' ? H23W : null, typeof J_W !== 'undefined' ? J_W : null, typeof N24W !== 'undefined' ? N24W : null, typeof F27N !== 'undefined' ? F27N : null];
  for (const o of tabs) if (o && typeof o === 'object') for (const [w, v] of Object.entries(NUMW)) if (!(w in o) && !/^an?$/.test(w)) o[w] = v; } catch (e){ console.warn('j18 numw', e); }
