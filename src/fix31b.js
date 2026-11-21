/* ===== fix31b: commander recast loops (Krenko, Mob Boss + Skirk Prospector + Goblin Warchief / Goblin Chieftain …) =====
   Each time round costs more (commander tax), so the steps can't simply be replayed. When you cast a commander that makes
   tokens with {T} from the command zone for the second time in a turn, and you have a creature you can sacrifice for mana,
   the table asks how many more times to go round, then for each round:
     tap the commander for tokens → sacrifice tokens for mana until the next cast is paid for → sacrifice the commander
     (it goes to the command zone) → cast it again (opponents can respond to each cast).
   It stops when it can't pay, the commander can't tap (no haste), or the chosen number of rounds is done. */
const CK = {T:'', casts:{}, asked:{}, run:null};
function ckSync(){ const T = turnStr(); if (CK.T !== T){ CK.T = T; CK.casts = {}; CK.asked = {}; CK.run = null; } }
// the commander's "{T}: Create … tokens" ability
function ckTapAbility(c){ try { const L = abilityList(c) || []; const i = L.findIndex(ab => /\{t\}/i.test(ab.cost || '') && /\bcreate\b[^.]*\btokens?\b/i.test(ab.eff || ab.txt || ab.text || '')); return i >= 0 ? {i, ab:L[i]} : null; } catch { return null; } }
// a battlefield permanent with "Sacrifice a <creature/Goblin…>: Add …" (Skirk Prospector, Ashnod's Altar, Phyrexian Altar)
function ckOutlet(cmdK){
  for (const c of S.bf){ if (c.fd) continue; let abs = []; try { abs = manaAbs(c) || []; } catch {}
    for (let i = 0; i < abs.length; i++){ const ab = abs[i]; const cost = String(ab.cost || '').toLowerCase(); const m = cost.match(/^sacrifice an? ([a-z ]+)$/); if (!m) continue;
      if (descOk(cmdK, m[1], {})) return {c, i, ab, desc:m[1]}; } }
  return null; }
const ckTokFor = (o, cmdK) => S.bf.filter(b => b.tok && !b.fd && descOk(b.k, o.desc, {tok:true}) && b.k !== cmdK).sort((a, b) => (b.n || 1) - (a.n || 1));
const ckCanCast = c => { try { const sc = spellCost(c, 'cz'); return !payPlan(sc.cost, S.pool).err; } catch { return false; } };
{ const bc = beginCast; beginCast = async function(c, zone){
    const r = await bc.apply(this, arguments);
    try { if (c && zone === 'cz' && !UI.replay && !UI.dry && !(typeof BOT !== 'undefined' && BOT.on) && !CK.run){ ckSync(); CK.casts[c.k] = (CK.casts[c.k] || 0) + 1;
        if (CK.casts[c.k] >= 2 && !CK.asked[c.k]){ const k = c.k; setTimeout(() => ckMaybeOffer(k).catch(e => console.warn('ck offer', e)), 300); } } } catch (e){ console.warn('ck cast', e); }
    return r; }; }
async function ckMaybeOffer(k){
  if (!(await waitStack(30000))) return; await sleep(200);
  const c = S.bf.find(b => b.k === k); if (!c || !ckTapAbility(c)) return; const o = ckOutlet(k); if (!o) return;
  if (CK.asked[k]) return; CK.asked[k] = 1;
  while (UI.modal) await sleep(150);
  const nm = cname(c), on = cname(o.c);
  const v = await askChoice({title:`${nm} loop`, text:`You've cast ${nm} from the command zone ${CK.casts[k]} times this turn. Each round: tap ${nm} for tokens, sacrifice tokens to ${on} for mana, sacrifice ${nm} (it goes back to the command zone), cast it again. Each cast costs {2} more (commander tax). How many more rounds?`,
    options:[{label:'As many as I can pay for', value:'max'}, {label:'A number of rounds…', value:'n'}, {label:"No — I'll do it by hand", value:'no'}]});
  if (!v || v === 'no') return;
  let n = 99; if (v === 'n'){ n = await askNumber('How many more rounds?', '', 5) || 0; if (!n) return; }
  await ckRun(k, n);
}
async function ckRun(k, n){
  const T = turnStr(); CK.run = {done:0}; S.lp = 1; commit(); let why = ''; const sv = UI.cmdz;
  log(`${info(k)?.n} loop: going round ${n >= 99 ? 'as many times as you can pay for' : n + ' more time' + (n === 1 ? '' : 's')}`);
  try {
    for (let r = 0; r < n; r++){
      if (turnStr() !== T){ why = 'the turn ended'; break; }
      if (!(await waitStack(60000))){ why = 'the stack did not finish'; break; }
      let c = S.bf.find(b => b.k === k); if (!c){ why = `${info(k)?.n} isn't on the battlefield`; break; }
      const t = ckTapAbility(c); if (!t){ why = 'no tap ability'; break; }
      const rd = abilityReady(c, t.ab, false); if (rd){ why = `${cname(c)}: ${rd}`; break; }
      await activateAbility(c, t.ab); if (!(await waitStack(60000))){ why = 'the stack did not finish'; break; }
      const o = ckOutlet(k); if (!o){ why = 'no sacrifice outlet'; break; }
      // first check that the tokens (and the commander itself) can pay for the next cast at all — don't waste them if not
      { const sc = spellCost(c, 'cz'); const yieldN = /\{c\}\{c\}/i.test(o.ab.eff || o.ab.line || '') ? 2 : 1;
        const col = (String(o.ab.eff || o.ab.line || '').match(/\{([WUBRGC])\}/) || [])[1] || 'C';
        const avail = ckTokFor(o, k).reduce((x, b) => x + (b.n || 1), 0) + 1; const pool = {...S.pool}; pool[col] = (pool[col] || 0) + avail * yieldN;
        if (payPlan(sc.cost, pool).err){ why = `the tokens can't pay for the next cast (${costStr(sc.cost)}) — you keep them`; break; } }
      // sacrifice tokens until the next cast is paid for
      let guard = 0;
      while (!ckCanCast(c) && guard++ < 400){
        const tok = ckTokFor(o, k)[0]; if (!tok) break;
        UI.replay = {ans:[[tok.id]]}; try { await activateMana(o.c, o.ab, 0); } finally { UI.replay = null; }
        await sleep(20);
      }
      if (!ckCanCast(c)){ // the commander's own sacrifice adds mana too: try it
        const sc = spellCost(c, 'cz'); const p0 = {...S.pool}; const yieldN = /\{c\}\{c\}/i.test(o.ab.eff || o.ab.line || '') ? 2 : 1;
        const tryPool = {...p0}; const col = (String(o.ab.eff || o.ab.line || '').match(/\{([WUBRGC])\}/) || [])[1] || 'C'; tryPool[col] = (tryPool[col] || 0) + yieldN;
        if (payPlan(sc.cost, tryPool).err){ why = `not enough tokens to pay for the next cast (${costStr(sc.cost)})`; break; } }
      UI.cmdz = true; UI.replay = {ans:[[c.id]]};
      try { await activateMana(o.c, o.ab, 0); } finally { UI.replay = null; }
      await sleep(150); UI.cmdz = sv;
      const inCz = S.cz.find(x => x.k === k); if (!inCz){ why = `${info(k)?.n} didn't go to the command zone`; break; }
      if (!ckCanCast(inCz)){ why = `can't pay for ${info(k)?.n} (${costStr(spellCost(inCz, 'cz').cost)})`; break; }
      await beginCast(inCz, 'cz');
      CK.run.done++;
      if (!(await waitStack(60000))){ why = 'the stack did not finish'; break; }
    }
  } catch (e){ console.warn('ck run', e); why = 'an error stopped it'; }
  finally { UI.cmdz = sv; UI.replay = null; S.lp = 0; const d = CK.run.done; CK.run = null;
    const toks = S.bf.filter(b => b.tok).reduce((x, b) => x + (b.n || 1), 0);
    log(`${info(k)?.n} loop: went round ${d} time${d === 1 ? '' : 's'} — you have ${toks} tokens${why ? ' (stopped: ' + why + ')' : ''}`); commit(); }
}
// The general "this looks like a loop" check replays steps as they were: a recast from the command zone costs more each
// time, so it can't. Leave those to the commander loop above.
{ const ff = f25find; f25find = function(){ const h = ff.apply(this, arguments); try { if (h && (h.last || []).some(e => e.a && e.a.t === 'cast' && e.a.zone === 'cz')) return null; } catch {} return h; }; }
