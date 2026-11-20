/* fix27b: loop fixes from helper b (top combos) */
// Repeating a loop that casts a spell from the top of the library by paying life (Bolas's Citadel): the replay
// cast it for free without paying the life. A free replayed cast from the top with a life way now pays the life.
{ const bc = beginCast;
  beginCast = async function(c, zone, o = {}){
    try { if (UI.replay && zone === 'lib' && o && o.free && !o.f27b && c && S.lib[0] === c && typeof r23fTopWays === 'function' && r23fTopWays(c).some(w => w.life)){
        const mv = info(c.k)?.mv || 0, n0 = S.stk.length; const r = await bc.call(this, c, zone, {...o, f27b:1});
        if (S.stk.length > n0){ S.life -= mv; log(`paid ${mv} life instead of the mana cost → ${S.life}`); commit(); } return r; } } catch (e){ console.warn('f27b citadel', e); }
    return bc.apply(this, arguments); }; }
// A loop whose last action opens a dialog (sacrifice a creature, choose a target …) was never offered: the loop check
// runs when the action starts, finds the dialog open and gives up. Check again once the dialog is closed.
function f27bRecheck(tries = 0){
  try { if (typeof F25 === 'undefined' || !F25.sh.length || f25quiet()) return;
    if (UI.f25wait || UI.modal){ if (tries < 40) setTimeout(() => f27bRecheck(tries + 1), 250); return; }
    f25check(); } catch (e){ console.warn('f27b recheck', e); } }
{ const cm = closeModal; closeModal = function(){ const r = cm.apply(this, arguments); try { if (S && !UI.replay) setTimeout(() => f27bRecheck(), 120); } catch {} return r; }; }
// …and once the action itself is done (a sacrifice with only one choice opens no dialog, but the check still ran too early)
const f27bAfter = f => async function(){ try { return await f.apply(this, arguments); } finally { try { if (S && !UI.replay) setTimeout(() => f27bRecheck(), 120); } catch {} } };
activateMana = f27bAfter(activateMana); activateAbility = f27bAfter(activateAbility); beginCast = f27bAfter(beginCast); activateLoyalty = f27bAfter(activateLoyalty);
// …and whenever the stack empties (actions with their own button, e.g. a graveyard ability, aren't wrapped above)
{ const rt = resolveTop; resolveTop = async function(){ try { return await rt.apply(this, arguments); } finally { try { if (S && !UI.replay && !S.stk.length) setTimeout(() => f27bRecheck(), 150); } catch {} } }; }
// Cloud Key and friends: "As ~ enters, choose artifact, creature, enchantment, instant, or sorcery." (a card type), then
// "Spells you cast of the chosen type cost {1} less to cast." Nothing asked for the type, so nothing got cheaper.
const F27B_TYPES = ['artifact', 'creature', 'enchantment', 'instant', 'sorcery', 'land', 'planeswalker', 'battle', 'kindred'];
function f27bTypeList(t){ const m = String(t).match(/(?:^|\n)as (?:~|this [a-z]+) enters(?: the battlefield)?, choose ((?:[a-z]+, )+or [a-z]+)\.?(?:\n|$)/); if (!m) return null;
  const L = m[1].split(/,\s*(?:or\s+)?/).map(x => x.trim()).filter(Boolean); return L.length >= 2 && L.every(x => F27B_TYPES.includes(x)) ? L : null; }
{ const oe = onEnter;
  onEnter = function(c, from, o = {}){ const r = oe.apply(this, arguments);
    try { if (c && S && S.bf.includes(c) && from !== 'bf' && !c.fd && !c.r21){ const L = f27bTypeList(r21Txt(c));
        if (L){ if (UI.dry) c.r21 = cap(L[0]);
          else (async () => { const v = await askChoice({title:`${cname(c)}: choose a card type`, options:L.map(x => ({label:cap(x), value:cap(x)}))}); if (v){ c.r21 = v; log(`${cname(c)}: chose ${v}`); commit(); } })(); } } } catch (e){ console.warn('f27b type', e); }
    return r; }; }
// cost reductions: "spells you cast of the chosen type …" and "historic spells you cast …" (Jhoira's Familiar)
const f27bHistoric = k => { const t = info(k)?.t || ''; return /\bLegendary\b/.test(t) || /\b(Artifact|Saga)\b/.test(t); };
{ const cm = costMods;
  costMods = function(c, caster){ const out = cm.apply(this, arguments);
    try { if (!S || !c || !c.k || (caster != null && caster !== MYPID)) return out; const ty = info(c.k)?.t || '';
      for (const x of r21Find(/(?:^|\n|\. )spells you cast of the chosen type cost \{(\d+)\} less to cast/)) if (x.pid === MYPID && x.b.r21 && new RegExp('\\b' + x.b.r21 + '\\b', 'i').test(ty)) out.less.push({n:+x.m[1], src:x.nm});
      if (f27bHistoric(c.k)) for (const x of r21Find(/(?:^|\n|\. )historic spells you cast cost \{(\d+)\} less to cast/)) if (x.pid === MYPID && !out.less.some(l => l.src === x.nm)) out.less.push({n:+x.m[1], src:x.nm});
    } catch (e){ console.warn('f27b cost', e); }
    return out; }; }
STATIC_KNOWN.push(/^spells you cast of the chosen type cost \{\d+\} less to cast$/);
// "Return a Forest you control to its owner's hand" as a cost (Quirion Ranger, Scryb Ranger …) was paid by hand.
// Counts permanents that are that type right now (Ashaya makes nontoken creatures Forests).
{ const pp = payPart; payPart = async function(p, c){
    try { const m = String(p).toLowerCase().trim().match(/^return (an?|another) (.+?) you control to its owner's hand$/);
      if (m && S){ const d = m[2]; const one = /^[a-z]+$/.test(d);
        const list = S.bf.filter(b => !b.fd && (m[1] !== 'another' || b.id !== c.id) && (descOk(b.k, d, {tok:b.tok}) || (one && new RegExp('\\b' + d + '\\b', 'i').test(typeOf(b) || ''))));
        if (!list.length){ toast(`You need ${m[1]} ${d} to return`); return false; }
        const ids = list.length === 1 ? [list[0].id] : await pickCards({title:`${cname(c)}: return ${m[1]} ${d} you control to its owner's hand`, cards:list, min:1, max:1});
        if (!ids || !ids[0]) return false; const b = find(ids[0])[2]; moveCard(ids[0], 'hand'); log(`returned ${b ? cname(b) : 'it'} to hand (cost)`); return true; } } catch (e){ console.warn('f27b bounce cost', e); }
    return pp.apply(this, arguments); }; }
// Triggered abilities that return the card itself from the graveyard (Forsaken Miner "Whenever you commit a crime, you may
// pay {B}. If you do, return this card from your graveyard to the battlefield.") work only from the graveyard
// (CR 113.6k). Only "if ~ is in your graveyard, …" wordings were watched there, so these never triggered.
const F27B_GYSELF = /\b(?:return|put) ~ from your graveyard (?:to|onto) (?:the battlefield|your hand)/i;
const f27bGySelf = t => !!t && F27B_GYSELF.test(String(t.eff || '')) && !(typeof W25_GYRE !== 'undefined' && W25_GYRE.test(String(t.eff || '').trim()));
{ const he = handleEvent;
  handleEvent = function(pid, ev){ const r = he.apply(this, arguments);
    try { if (S && ev && !UI.dry && typeof w25EvMatch === 'function') for (const c of S.gy.slice()) for (const t of trigsOf(c.k, false)){
        if (!f27bGySelf(t) || t.ev === 'step') continue; if (t.subj === 'self' && ev.id === c.id) continue;
        if (w25EvMatch(t, c, ev, pid)) pushTrigger({k:c.k, id:c.id, fl:false}, t, ev, pid); } } catch (e){ console.warn('f27b gy trig', e); }
    return r; };
  const pt = pushTrigger;
  pushTrigger = function(src, t, ev, evPid){
    try { if (S && src && t.ev !== 'step' && f27bGySelf(t) && !S.gy.some(g => g.id === src.id)) return; } catch {}
    return pt.apply(this, arguments); }; }
// Orcish Bowmasters: "When ~ enters and whenever an opponent draws a card except the first one they draw in each of
// their draw steps, …" only knew the enters half, so an opponent drawing (Peer into the Abyss) never triggered it.
{ const ct = classifyTrig;
  classifyTrig = function(w, c){
    try { const m = String(c).match(/^~ enters and whenever an opponent draws a card(?: except the first one they draw in each of their draw steps)?$/);
      if (m && w === 'when'){ const ex = /except the first/.test(c);
        return {ev:'enter', evs:['enter', 'draw'], subj:'any', ctl:'any', desc:'', qf:(s, ev, pid) => {
          if (ev.type === 'enter') return pid === MYPID && !!s && ev.id === s.id;
          if (ev.type !== 'draw' || pid === MYPID) return false;
          if (ex){ const p = phaseNow(); if (p && p.pid === pid && p.n === 2 && (ev.nth || 1) === 1) return false; }
          return true; }}; } } catch (e){ console.warn('f27b bowmasters', e); }
    return ct.apply(this, arguments); }; }
// Peregrin Took ("those tokens plus an additional Food token"): engine12 skipped any line that itself creates a single
// Food/Treasure/Clue (to avoid looping on its own extra token), so "Create a Treasure token." (Warren Soultrader) got no Food.
{ const cft = createFromText; let busy = 0;
  const nTok = nm => S.bf.filter(c => c.tok && cname(c) === nm).reduce((a, c) => a + (c.n || 1), 0);
  createFromText = async function(s, ctx){
    const m = !busy && S && !UI.dry && String(s).trim().match(/^create an? (food|treasure|clue) token\.?$/i);
    const L = m ? rulesOn('tokExtra').filter(x => !x.only || new RegExp(x.only, 'i').test(s)) : [];
    const before = L.map(x => nTok(x.name)); const r = await cft.apply(this, arguments);
    try { if (L.length){ busy = 1; try { for (let i = 0; i < L.length; i++){ const x = L[i]; const own = x.name.toLowerCase() === m[1].toLowerCase() ? 1 : 0;
            if (nTok(x.name) - before[i] <= own) await cft.call(this, `Create a ${x.name} token`, ctx); } } finally { busy = 0; } } } catch (e){ console.warn('f27b tokExtra', e); }
    return r; }; }
