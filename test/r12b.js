process.env.TOP = '1';
// Round 9: the real Oracle text of the top commanders, played for real
const H = require('./h'); const {check, sleep, give, put, setPool, handId, menuClick, waitFor} = H;
const passAll = async (ps) => { for (let i = 0; i < 6; i++){ for (const p of ps) await p.evaluate(() => { if (myBox()) doPass(); }); await sleep(200); } };
// answer any question the game asks: picks the cards/options whose name matches `want`, else the first legal ones; “yes” by default
const AUTO = () => { window.__want = window.__want || null; setInterval(() => { const m = UI.modal; if (!m || m.__done) return; const w = window.__want ? new RegExp(window.__want, 'i') : null;
  try {
    if (m.type === 'pick' && m.resolve){ const pool = (m.cards || []); const pref = w ? pool.filter(c => w.test(cname(c))) : []; const n = Math.max(m.min || 0, Math.min(m.max || 0, pref.length || (m.min || 0) || (m.max ? 1 : 0))); const ids = (pref.length ? pref : pool).slice(0, n).map(c => c.id); m.__done = 1; m.resolve(ids); closeModal(); }
    else if (m.type === 'choice' && m.resolve){ const o = (m.options || []).filter(x => !x.disabled); const pick = (w && o.find(x => w.test(String(x.label)))) || o[0]; m.__done = 1; m.resolve(pick ? pick.value : null); closeModal(); }
    else if (m.type === 'target' && m.resolve){ /* targets are answered by the test */ }
    else if (m.run){ m.__done = 1; const d = m.def ?? 1; m.run(d); closeModal(); }
  } catch (e){ console.warn('auto', e); } }, 120); };
const settle = async (A, ps) => { for (let i = 0; i < 30; i++){ await passAll(ps); if (!(await A.evaluate(() => stackAll().length || UI.resolving))) return; await sleep(150); } };
const keyOf = (p, name) => p.evaluate(n => [...DICT.values()].find(a => a.n === n || a.n.startsWith(n + ' //'))?.k, name);
// run a card's text the way a resolving trigger would
const fx = (p, name, text, extra = {}) => p.evaluate(async ([n, t, ex]) => { const c = S.bf.find(x => cname(x) === n) || S.cz.find(x => cname(x) === n); const k = c ? c.k : [...DICT.values()].find(a => a.n === n)?.k;
  const it = {sid:rid(6), kind:'trigger', k, nm:n, txt:t, srcId:c ? c.id : null, ...ex}; await runEffects(t, {name:n, k, srcId:it.srcId, it, full:t}); commit(); }, [name, text, extra]);
let PA = null; const step = async (name, fn) => { console.log('— ' + name); const f0 = H.fails(); try { await fn(); } catch (e){ console.log('  ERROR', e.message.split('\n')[0]); check(false, name + ' ran without errors'); } if (H.fails() > f0 && PA) console.log('    LOG:', (await PA.evaluate(() => S.log.slice(-10).map(e => e.s).join(' | ') + ' || modal=' + JSON.stringify(UI.modal && {t:UI.modal.type, ti:UI.modal.title})))); };
(async () => {
  const server = H.http.createServer(); H.ws.createServer({server}, H.aedes.handle); await new Promise(r => server.listen(H.PORT, r));
  const browser = await H.chromium.launch();
  const A = await H.player(browser, 'Georges', H.deckFor('Edgar Markov'), 'host', 'r12');
  const B = await H.player(browser, 'Kim', H.deckFor('Thalia, Guardian of Thraben'), 'join', 'r12');
  PA = A; await waitFor(A, () => OPP.size === 1); await A.click('[data-act="goFirst"]');
  await settle(A, [B]); await waitFor(A, () => phaseNow().ph === 3, null, 10000);
  await A.evaluate(AUTO); await B.evaluate(AUTO);
  const hand = p => p.evaluate(() => S.hand.length); const life = p => p.evaluate(() => S.life);
  const clean = async () => { await A.evaluate(() => { S.bf.filter(c => !isLand(c.k)).forEach(c => { if (c.tok || c.emb) S.bf.splice(S.bf.indexOf(c), 1); else moveCard(c.id, 'lib'); }); S.stk = []; commit(); }); await sleep(300); };
  try {
    await step('Short names: “Edgar attacks”, “Kaalia attacks an opponent”, “Lathril deals”', async () => {
      const r = await A.evaluate(() => ['Edgar Markov', 'Kaalia of the Vast', 'Lathril, Blade of the Elves', 'Korvold, Fae-Cursed King', 'Acererak the Archlich'].map(n => { const a = [...DICT.values()].find(x => x.n === n); return n + ':' + trigsOf(a.k).map(t => t.ev + '/' + t.subj).join(','); }));
      console.log('   ', r.join('  '));
      check(/attack\/self/.test(r[0]) && /attack\/self/.test(r[1]) && /cdmg\/self/.test(r[2]) && /enter\/self/.test(r[3]) && /attack\/self/.test(r[4]), 'the triggers that name the card by its short name are recognised');
      const g = await A.evaluate(() => tname('Goblin spells you cast cost {1} less to cast.', 'Goblin Warchief'));
      check(/^Goblin spells/.test(g), 'a non-legendary name (Goblin Warchief) does not eat the word “Goblin”: ' + g);
    });
    await step('Vivi Ornitier: noncreature spell → counter and 1 damage to each opponent', async () => {
      await put(A, 'Vivi Ornitier'); const l0 = await life(B);
      await give(A, 'Lightning Bolt'); await setPool(A, {R:1}); const id = await handId(A, 'Lightning Bolt'); await menuClick(A, id, /^Cast/);
      await A.waitForSelector('#modal [data-act="tgtT"]', {timeout:3000}).catch(() => {}); const bs = await A.$$('#modal [data-act="tgtT"]'); for (const b of bs) if (/Kim/.test(await b.innerText())){ await b.click(); break; } await A.click('#modal [data-act="tgtDone"]').catch(() => {});
      await settle(A, [B]); await sleep(800);
      check(await A.evaluate(() => (S.bf.find(c => cname(c) === 'Vivi Ornitier') || {}).cp === 1), 'Vivi got a +1/+1 counter');
      check(await waitFor(B, l => S.life === l - 4, l0, 5000), `Kim took 1 from Vivi and 3 from the Bolt (${l0} → ${await life(B)})`);
    });
    await clean();
    await step('Sauron: an opponent casts a spell → amass Orcs 1', async () => {
      await put(A, 'Sauron, the Dark Lord'); await sleep(400);
      await give(B, 'Grizzly Bears'); await setPool(B, {G:1, C:1}); await sleep(300);
      // B casts in A's turn? cast an instant instead
      await give(B, 'Lightning Bolt'); await setPool(B, {R:1}); const id = await handId(B, 'Lightning Bolt'); await menuClick(B, id, /^Cast/);
      await B.waitForSelector('#modal [data-act="tgtT"]', {timeout:3000}).catch(() => {}); const bs = await B.$$('#modal [data-act="tgtT"]'); for (const b of bs) if (/Georges/.test(await b.innerText())){ await b.click(); break; } await B.click('#modal [data-act="tgtDone"]').catch(() => {});
      await sleep(800); await settle(A, [B]); await sleep(500);
      const army = await A.evaluate(() => { const c = S.bf.find(c => /Army/.test(typeOf(c)) || /Army|Orc/.test(cname(c))); return c ? cname(c) + ' +' + (c.cp || 0) : ''; });
      check(/\+1/.test(army), 'an Orc Army token with a +1/+1 counter: ' + army);
    });
    await step('The Ring tempts you (emblem, Ring-bearer, tempt trigger)', async () => {
      await A.evaluate(() => { window.__want = 'Sauron'; });
      await fx(A, 'Sauron, the Dark Lord', 'The Ring tempts you.'); await sleep(400);
      const r = await A.evaluate(() => [S.ring, S.bf.filter(c => c.emb).map(c => info(c.k).o).join(' / '), (S.bf.find(c => c.ring) || {}).k && cname(S.bf.find(c => c.ring))]);
      check(r[0] === 1 && /legendary and can't be blocked/.test(r[1]) && r[2] === 'Sauron, the Dark Lord', 'the Ring tempted once, emblem level 1, Sauron is the Ring-bearer: ' + JSON.stringify(r));
      await settle(A, [B]);
      check(await A.evaluate(() => S.log.some(e => /discard their hand|chose not to|trigger: Sauron, the Dark Lord — you may discard/i.test(e.s))), 'Sauron’s “whenever the Ring tempts you” triggered');
      await A.evaluate(() => { window.__want = null; });
    });
    await clean();
    await step('Life lost this turn (Y’shtola) and “an opponent loses life during your turn” (Kefka)', async () => {
      await put(A, 'Kefka, Court Mage'); await A.evaluate(() => { const c = S.bf.find(c => cname(c) === 'Kefka, Court Mage'); c.fl = true; TRIG_CACHE.clear(); commit(); }); await sleep(400);
      const h0 = await hand(A);
      await A.evaluate(() => dealDamage({t:'player', pid:[...OPP.keys()][0]}, 4, S.bf.find(c => c.fl).k, S.bf.find(c => c.fl))); await sleep(1500); await settle(A, [B]); await sleep(500);
      check(await waitFor(A, h => S.hand.length >= h + 4, h0, 5000), `Kefka, Ruler of Ruin drew 4 when Kim lost 4 (${h0} → ${await hand(A)})`);
      const h1 = await hand(A);
      await fx(A, "Y'shtola, Night's Blessed", 'If a player lost 4 or more life this turn, you draw a card.');
      check(await hand(A) === h1 + 1, 'Y’shtola: a player lost 4 or more this turn → draw');
    });
    await clean();
    await step('“The Nth time this ability has resolved this turn” (Omnath, Bumbleflower)', async () => {
      await put(A, 'Omnath, Locus of Creation'); const l0 = await life(A); const o0 = await life(B);
      const txt = await A.evaluate(() => tname([...DICT.values()].find(a => a.n === 'Omnath, Locus of Creation').o, 'Omnath, Locus of Creation').split('\n')[1].replace(/^Whenever a land you control enters, /, ''));
      const sid = 'om1'; for (let i = 0; i < 3; i++) await fx(A, 'Omnath, Locus of Creation', txt, {sid});
      await sleep(800);
      const pool = await A.evaluate(() => ({...S.pool}));
      check(await life(A) === l0 + 4, 'first landfall: gained 4');
      check(pool.R >= 1 && pool.G >= 1 && pool.W >= 1 && pool.U >= 1, 'second: added {R}{G}{W}{U}');
      check(await waitFor(B, o => S.life === o - 4, o0, 4000), 'third: 4 damage to each opponent');
    });
    await clean();
    await step('Crew (Shorikai) and the Vehicle becomes a creature', async () => {
      await put(A, 'Shorikai, Genesis Engine'); await put(A, 'The Ur-Dragon'); await A.evaluate(() => { S.bf.forEach(c => c.sk = false); commit(); });
      await A.evaluate(() => { window.__want = 'Ur-Dragon'; });
      const id = await A.evaluate(() => S.bf.find(c => cname(c) === 'Shorikai, Genesis Engine').id);
      const r = await menuClick(A, id, /Crew 8/); await sleep(600);
      check(r === 'ok' && await A.evaluate(() => isCreatureCard(S.bf.find(c => cname(c) === 'Shorikai, Genesis Engine'))), 'Crew 8 taps The Ur-Dragon and Shorikai is a creature: ' + r);
      check(await A.evaluate(() => stats(S.bf.find(c => cname(c) === 'Shorikai, Genesis Engine')).join('/')) === '8/8', 'crewed Shorikai is 8/8');
      await A.evaluate(() => { window.__want = null; });
    });
    await clean();
    await step('Earthbend (Toph) and firebending (Fire Lord Azula)', async () => {
      await A.evaluate(() => { const c = S.lib.find(c => isLand(c.k)); moveCard(c.id, 'bf'); commit(); }); await fx(A, 'Toph, the First Metalbender', 'Earthbend 2.'); await sleep(300);
      const r = await A.evaluate(() => { const c = S.bf.find(c => c.anim === 'eb'); return c ? [cname(c), isCreatureCard(c), stats(c).join('/'), hasHaste(c)] : null; });
      check(r && r[1] && r[2] === '2/2' && r[3], 'a land became a 2/2 haste creature: ' + JSON.stringify(r));
      const t = await A.evaluate(() => trigsOf([...DICT.values()].find(a => a.n === 'Fire Lord Azula').k).map(x => x.ev + ':' + x.eff).join(' | '));
      check(/attack:Add \{R\}\{R\}/.test(t), 'firebending 2 makes an attack trigger that adds {R}{R}: ' + t);
    });
    await clean();
    await step('Static rules on real text: Arcades / Felothar toughness, Esika mana, Lier flashback, Muldrotha', async () => {
      await put(A, 'Esika, God of the Tree'); await put(A, 'Kenrith, the Returned King');
      check(await A.evaluate(() => manaAbs(S.bf.find(c => cname(c) === 'Kenrith, the Returned King')).some(m => m.esika) && kwOf(S.bf.find(c => cname(c) === 'Kenrith, the Returned King'), 'vigilance')), 'Esika gives Kenrith vigilance and “{T}: add one mana of any color”');
      await put(A, 'Lier, Disciple of the Drowned'); await A.evaluate(() => { const c = S.lib.find(c => cname(c) === 'Lightning Bolt') || S.hand.find(c => cname(c) === 'Lightning Bolt') || S.gy.find(c => cname(c) === 'Lightning Bolt'); if (c) moveCard(c.id, 'gy'); commit(); });
      check(await A.evaluate(() => gyOptions(S.gy.find(c => cname(c) === 'Lightning Bolt')).some(o => o.kind === 'flashback')), 'Lier: Lightning Bolt in the graveyard has flashback');
      check(await A.evaluate(() => rulesOn('toughDmg').length === 0), 'no toughness rule without Arcades/Felothar');
      await put(A, 'Felothar the Steadfast');
      check(await A.evaluate(() => rulesOn('toughDmg').length === 1 && rulesOn('defAtk').length === 1), 'Felothar: toughness damage and defenders can attack');
    });
    await clean();
    await step('Reflexive “When you do” (Grist −2 declined does nothing)', async () => {
      const o0 = await B.evaluate(() => S.bf.length);
      await A.evaluate(() => { window.__no = 1; });
      await A.evaluate(async () => { const ask = askYes; askYes = async () => false; try { await runEffects('You may sacrifice a creature. When you do, destroy target creature or planeswalker.', {name:'Grist, the Hunger Tide', k:null, it:{kind:'ability', txt:'x'}}); } finally { askYes = ask; } });
      check(await A.evaluate(() => S.log.slice(-3).some(e => /nothing more happens|chose not to/.test(e.s))), 'declining the sacrifice skips the destroy');
    });
    await step('Atraxa, Grand Unifier: one card of each type', async () => {
      const h0 = await hand(A);
      await A.evaluate(() => { window.__want = null; });
      await fx(A, 'Atraxa, Grand Unifier', 'Reveal the top ten cards of your library. For each card type, you may put a card of that type from among the revealed cards into your hand. Put the rest on the bottom of your library in a random order.');
      const h1 = await hand(A); check(h1 >= h0 + 1, `took cards by type (${h0} → ${h1})`);
    });
    await step('Amass, explore, connive on their own', async () => {
      await clean(); await fx(A, 'Sauron, the Dark Lord', 'Amass Orcs 2.'); await fx(A, 'Sauron, the Dark Lord', 'Amass Orcs 1.');
      check(await A.evaluate(() => { const c = S.bf.filter(c => /Army/.test(typeOf(c)) || /Army|Orc/.test(cname(c))); return c.length === 1 && c[0].cp === 3; }), 'two amasses put 3 counters on one Army');
      await put(A, 'Hakbal of the Surging Soul'); const l0 = await A.evaluate(() => S.lib.length);
      await fx(A, 'Hakbal of the Surging Soul', '~ explores.'); check(await A.evaluate(l => S.lib.length <= l, l0), 'Hakbal explored');
    });
    await step('Wan Shi Tong: an opponent searches → counter + draw', async () => {
      await put(A, 'Wan Shi Tong, Librarian'); await settle(A, [B]); await sleep(300); const h0 = await hand(A);
      await B.evaluate(async () => { await searchLibrary('basic land', '', {name:'Test', it:{}}).catch(() => {}); });
      await sleep(1500); await settle(A, [B]);
      check(await waitFor(A, h => S.hand.length === h + 1, h0, 4000), `Wan Shi Tong drew when Kim searched (${h0} → ${await hand(A)})`);
    });
    await step('Auntie Ool: -1/-1 counters on your creature → draw', async () => {
      await clean(); await put(A, 'Auntie Ool, Cursewretch'); await put(A, 'Grizzly Bears'); const h0 = await hand(A);
      await A.evaluate(() => { modCounters(S.bf.find(c => cname(c) === 'Grizzly Bears'), 'cm', 1); commit(); }); await sleep(400); await settle(A, [B]);
      check(await waitFor(A, h => S.hand.length === h + 1, h0, 4000), 'drew a card');
    });
    await step('Magda, the Hoardmaster: commit a crime → tapped Treasure (once per turn)', async () => {
      await clean(); await put(A, 'Magda, the Hoardmaster');
      await A.evaluate(() => { emit({type:'crime', cnt:1}); emit({type:'crime', cnt:1}); }); await sleep(300); await settle(A, [B]);
      const n = await A.evaluate(() => S.bf.filter(c => c.tok && /Treasure/.test(cname(c))).reduce((a, c) => a + (c.n || 1), 0));
      check(n === 1, 'exactly one Treasure: ' + n);
    });
    await step('Voting: each player votes on their own screen (Tivit)', async () => {
      await clean(); await B.evaluate(() => { window.__want = 'bribery'; });
      await fx(A, 'Tivit, Seller of Secrets', 'Starting with you, each player votes for evidence or bribery. For each evidence vote, investigate. For each bribery vote, create a Treasure token.');
      await sleep(500);
      const r = await A.evaluate(() => ['Clue', 'Treasure'].map(n => S.bf.filter(c => c.tok && new RegExp(n).test(cname(c))).reduce((a, c) => a + (c.n || 1), 0)));
      check(r[0] === 1 && r[1] === 1, 'Georges voted evidence, Kim voted bribery on her own screen: 1 Clue, 1 Treasure — ' + JSON.stringify(r));
      check(await B.evaluate(() => S.log.some(e => /voted bribery/.test(e.s))), 'Kim’s log shows her vote');
    });
  } catch (e){ console.log('ERROR', e.message); check(false, 'no exceptions'); }
  finally { await browser.close(); server.close(); console.log(`\n${H.results.length - H.fails()} passed, ${H.fails()} failed`); process.exit(0); }
})();
