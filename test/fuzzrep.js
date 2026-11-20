// Deterministic repros for bugs found by fuzz.js.  cd test && PTPORT=18975 CASE=<name> node fuzzrep.js   (CASE=all runs every case)
// Cases: lost · besieged · kwline · xzero · sacart · tokstack · cdapt · treasure
process.env.ALL = '1';
const H = require('./h'); const fs = require('fs'); const path = require('path');
const clean = t => t.split('\n').map(l => l.replace(/\s*\([A-Z0-9]{2,6}\)\s*[\w★-]*\s*(\*F\*)?\s*$/, '')).join('\n');
const deck = n => clean(fs.readFileSync(path.join(__dirname, '../decks/' + n + '.txt'), 'utf8'));
const mk = (cmd, list, basics) => 'Commander\n1 ' + cmd + '\n\nDeck\n' + list.map(n => '1 ' + n).join('\n') + '\n' + basics + '\n';
const passAll = async P => { for (let i = 0; i < 6; i++){ for (const p of P) await p.evaluate(() => { if (myBox()) doPass(); }).catch(() => {}); await H.sleep(200); } };
const toMain = async (p, P) => { for (let i = 0; i < 40; i++){ if (await p.evaluate(() => phaseNow().ph) === 3) return true; await p.evaluate(() => { if (!stackAll().length && !UI.modal) nextAction(); }); await passAll(P); } return false; };
const logs = (p, n = 12) => p.evaluate(k => [...LOGS.values()].sort((a, b) => a.t - b.t).slice(-k).map(e => (e.pid === MYPID ? S.nm : nameOf(e.pid)) + ': ' + e.s), n);
const toHand = (p, names) => p.evaluate(ns => { for (const n of ns){ const c = S.lib.find(c => cname(c) === n); if (c){ S.lib.splice(S.lib.indexOf(c), 1); S.hand.push(c); } } commit(); }, names);
// answers every prompt: first enabled choice (or one matching window.__want), X = window.__X, picks nothing, targets the first opponent
const AUTO = () => setInterval(() => { const m = UI.modal; if (!m) return; const w = window.__want ? new RegExp(window.__want) : null;
  if (m.type === 'choice'){ const o = (w && m.options.find(x => !x.disabled && w.test(x.label))) || m.options.find(x => !x.disabled); m.onClose = null; closeModal(); m.resolve(o ? o.value : null); }
  else if (m.type === 'ask'){ (window.__asks = window.__asks || []).push(m.title); m.onClose = null; closeModal(); m.run(window.__X ?? 1); }
  else if (m.type === 'pick'){ m.onClose = null; closeModal(); m.resolve(m.cards.slice(0, m.min || 0).map(c => c.id)); }
  else if (m.type === 'target'){ const i = m.cands.findIndex(c => c.ok && c.pid !== MYPID); m.onClose = null; closeModal(); m.resolve(i >= 0 ? [m.cands[i]] : []); }
  else closeModal(); }, 120);
async function table(browser, decks){
  const code = 'rep' + Date.now() % 1e6; const P = []; const names = ['Ana', 'Ben', 'Cy'];
  for (let i = 0; i < decks.length; i++) P.push(await H.player(browser, names[i], decks[i], i ? 'join' : 'host', code));
  for (const p of P) await H.waitFor(p, n => OPP.size === n, decks.length - 1, 30000);
  for (const p of P) await p.evaluate(AUTO);
  await P[0].click('[data-act="goFirst"]'); await toMain(P[0], P); return P;
}
const ED = mk('Edgar Markov', ['Mirrodin Besieged', 'Electrodominance', 'Mental Journey', "Lórien Revealed", 'Ravenform', 'Smothering Tithe', 'Helm of the Host'], '30 Swamp\n20 Mountain\n10 Island');
const CASES = {
  // CR 104.3a / 800.4a: a player at 0 life has lost and leaves the game
  async lost(browser){
    const [A, B, C] = await table(browser, [ED, ED, ED]);
    await B.evaluate(() => { S.life = 0; commit(); }); await H.sleep(2500);
    const opts = await A.evaluate(() => defOpts().map(o => o.label));
    await B.evaluate(() => { S.life = 3; commit(); }); await H.sleep(1500); const back = await B.evaluate(() => S.lost);
    await B.evaluate(() => { S.life = 0; commit(); }); await H.sleep(1500);
    await A.evaluate(() => passTurn()); await H.sleep(2500); const next = await A.evaluate(() => nameOf(currentTurn()[1]));
    console.log(`  Ben at 0 life → Ana's attack targets: ${opts.join(', ')}  (expected: Cy only)`);
    console.log(`  Ben gains 3 life after losing → S.lost = ${JSON.stringify(back)}  (expected: still lost)`);
    console.log(`  Ana passes the turn → it goes to ${next}  (expected: Cy)`);
    return opts.includes('Ben') || !back || next === 'Ben';
  },
  // Mirrodin Besieged (Phyrexian): "if there are fifteen or more artifact cards in your graveyard, target opponent loses the game"
  async besieged(browser){
    const P = await table(browser, [ED, ED]); const [A, B] = P;
    await A.evaluate(() => { window.__want = 'Phyrexian'; const c = S.lib.find(c => cname(c) === 'Mirrodin Besieged'); moveCard(c.id, 'bf'); commit(); }); await H.sleep(1500); await passAll(P);
    const arts = await A.evaluate(() => S.gy.filter(c => /Artifact/.test(info(c.k)?.t || '')).length);
    await A.evaluate(() => setPhase(6)); for (let i = 0; i < 6; i++){ await passAll(P); await H.sleep(400); }
    const lost = await B.evaluate(() => S.lost);
    console.log(`  artifact cards in Ana's graveyard: ${arts}; Ben lost: ${JSON.stringify(lost)}  (expected: not lost)`);
    return !!lost;
  },
  // keyword lines on instants/sorceries are run as effects when the spell resolves → "do by hand" notes
  async kwline(browser){
    const P = await table(browser, [ED, ED]); const [A] = P; await toHand(A, ['Mental Journey', 'Lórien Revealed', 'Ravenform']);
    const notes = [];
    for (const n of ['Mental Journey', 'Lórien Revealed']){
      await A.evaluate(n => { UI.notes = []; S.pool = {W:0, U:9, B:9, R:9, G:0, C:9}; const c = S.hand.find(c => cname(c) === n); beginCast(c, 'hand'); }, n);
      for (let i = 0; i < 5; i++){ await passAll(P); await H.sleep(300); }
      notes.push(...await A.evaluate(() => (UI.notes || []).map(x => x.name + ': ' + x.text)));
    }
    console.log('  by-hand notes after casting them normally:', JSON.stringify(notes), ' (expected: none)');
    return notes.length > 0;
  },
  // numOf(): X = 0 is treated as "unknown" and the player is asked for the number again
  async xzero(browser){
    const P = await table(browser, [ED, ED]); const [A] = P; await toHand(A, ['Electrodominance']);
    await A.evaluate(() => { window.__X = 0; window.__asks = []; for (let i = 0; i < 2; i++){ const c = S.lib.find(c => cname(c) === 'Mountain'); moveCard(c.id, 'bf', {quiet:true}); } commit(); });
    await A.evaluate(() => { const c = S.hand.find(c => cname(c) === 'Electrodominance'); beginCast(c, 'hand'); });
    for (let i = 0; i < 5; i++){ await passAll(P); await H.sleep(300); }
    const asks = await A.evaluate(() => window.__asks);
    console.log('  number prompts for Electrodominance with X=0:', JSON.stringify(asks), ' (expected: only "Choose X")');
    return asks.length > 1;
  },
  // additional cost "sacrifice an artifact or creature" with a noncreature artifact: n24payAdds reads stats(b)[0] (null for noncreatures)
  async sacart(browser){
    const P = await table(browser, [mk('Edgar Markov', ['Deadly Dispute', 'Sol Ring'], '30 Swamp\n30 Plains'), ED]); const [A] = P; await toHand(A, ['Deadly Dispute']);
    await A.evaluate(() => { window.__err = []; window.addEventListener('unhandledrejection', e => __err.push(String(e.reason && e.reason.message))); const oc = console.warn; console.warn = (...a) => { __err.push(a.map(x => x && x.message || String(x)).join(' ').slice(0, 120)); oc(...a); };
      const c = S.lib.find(c => cname(c) === 'Sol Ring'); moveCard(c.id, 'bf', {quiet:true}); S.pool = {W:0, U:0, B:5, R:0, G:0, C:0}; commit(); });
    await A.evaluate(() => { window.__pickAll = 1; const c = S.hand.find(c => cname(c) === 'Deadly Dispute'); beginCast(c, 'hand'); });
    for (let i = 0; i < 5; i++){ await passAll(P); await H.sleep(300); }
    const r = await A.evaluate(() => ({err:window.__err, solRing:S.bf.some(c => cname(c) === 'Sol Ring'), gy:S.gy.map(cname), hand:S.hand.length, log:S.log.slice(-4).map(e => e.s)}));
    console.log('  Deadly Dispute sacrificing Sol Ring:', JSON.stringify(r));
    return r.err.some(e => /null|undefined/.test(e));
  },
  // createToken() merges a new token into an existing untapped stack of the same token and marks the WHOLE stack summoning sick
  async tokstack(browser){
    const P = await table(browser, [ED, ED]); const [A] = P;
    const r = await A.evaluate(async () => { const k = customToken('Vampire', '1/1', 'B'); createToken(k, 1); const t = S.bf.find(c => c.k === k); t.sk = false; /* it has been here since last turn */
      const a0 = canAttack(t); createToken(k, 1); const st = S.bf.filter(c => c.k === k); return {stacks:st.length, n:st[0].n, before:a0, after:canAttack(st[0])}; });
    console.log('  old Vampire token, then a new one is created:', JSON.stringify(r), ' (expected: the old token can still attack)');
    return r.stacks === 1 && r.after !== '';
  },
  // printed P/T like "*/1+*" (Barrowgoyf) or "1+*/3" (Nighthawk Scavenger) doesn't parse: stats() is null
  async cdapt(browser){
    const P = await table(browser, [mk('Edgar Markov', ['Barrowgoyf', 'Nighthawk Scavenger', 'Tarmogoyf'], '30 Swamp\n30 Forest'), ED]); const [A] = P;
    const r = await A.evaluate(() => { S.gy.push(...['Swamp', 'Forest'].map(n => { const c = S.lib.find(x => cname(x) === n); S.lib.splice(S.lib.indexOf(c), 1); return c; }));
      return ['Barrowgoyf', 'Nighthawk Scavenger', 'Tarmogoyf'].map(n => { const c = [...S.lib, ...S.hand].find(x => cname(x) === n); if (!c) return n + ': not in deck'; moveCard(c.id, 'bf', {quiet:true}); const b = S.bf.find(x => x.id === c.id); return `${n} printed ${info(b.k).p} → stats ${JSON.stringify(stats(b))}`; }); });
    console.log('  ' + r.join('\n  '));
    return r.some(x => /stats null/.test(x));
  },
  // offline / no-match token fallback: "Create a Treasure token" makes a creature with no P/T and no mana ability
  async treasure(browser){
    const P = await table(browser, [ED, ED]); const [A] = P;
    const r = await A.evaluate(async () => { const k = S.lib.find(c => cname(c) === 'Smothering Tithe').k; await createFromText('create a Treasure token', {k, name:'Smothering Tithe'}); const t = S.bf.find(c => c.tok); return {type:typeOf(t), creature:isCreatureCard(t), stats:stats(t), manaAbs:manaAbs(t).length}; });
    console.log('  Treasure from the fallback path:', JSON.stringify(r), ' (expected: Token Artifact — Treasure with a mana ability)');
    return r.creature || !r.manaAbs;
  },
};
(async () => {
  const server = H.http.createServer(); H.ws.createServer({server}, H.aedes.handle); await new Promise(r => server.listen(H.PORT, r));
  const browser = await H.chromium.launch(); const which = process.env.CASE || 'all';
  for (const [n, f] of Object.entries(CASES)){ if (which !== 'all' && which !== n) continue; console.log('— ' + n); try { const bug = await f(browser); console.log(bug ? '  BUG REPRODUCED' : '  not reproduced'); } catch (e){ console.log('  harness error', e.message.split('\n')[0]); } }
  await browser.close(); server.close(); process.exit(0);
})();
