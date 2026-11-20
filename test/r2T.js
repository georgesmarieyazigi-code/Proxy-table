process.env.ALL = '1';
// Round 25T: companions, starting-deck rules, deck legality and outside-the-game cards, in the lobby and in a real 2-player game
const CC = require('./cards');
// a few real cards that are not in the 7,000 (texts from Scryfall)
const SYN = (name, mana, cmc, type, text, ci, extra = {}) => ({object:'card', id:'t25-' + name.toLowerCase().replace(/[^a-z0-9]+/g, '-'), name, mana_cost:mana, cmc, type_line:type, oracle_text:text, colors:ci, color_identity:ci,
  keywords:[], layout:'normal', set:'t25', collector_number:String(cmc) + name.length, set_name:'T25', released_at:'2025-01-01', prices:{usd:'1'}, image_uris:{normal:''}, ...extra});
CC.cards.push(
  SYN('Burning Wish', '{1}{R}', 2, 'Sorcery', 'You may reveal a sorcery card you own from outside the game and put it into your hand. Exile Burning Wish.', ['R']),
  SYN('Igneous Inspiration', '{2}{R}', 3, 'Sorcery', 'Igneous Inspiration deals 3 damage to any target. Learn. (You may reveal a Lesson card you own from outside the game and put it into your hand, or discard a card to draw a card.)', ['R']),
  SYN('Environmental Sciences', '{2}', 2, 'Sorcery — Lesson', 'Search your library for a basic land card, reveal it, put it into your hand, then shuffle. You gain 2 life.', []),
  SYN('Expanded Anatomy', '{3}', 3, 'Sorcery — Lesson', 'Put two +1/+1 counters on target creature. It gains vigilance until end of turn.', []),
  SYN('Chancellor of the Dross', '{4}{B}{B}{B}', 7, 'Creature — Phyrexian Vampire', 'You may reveal this card from your opening hand. If you do, at the beginning of the first upkeep, each opponent loses 3 life, then you gain life equal to the life lost this way.\nFlying, lifelink', ['B'], {power:'6', toughness:'6'}),
);
const H = require('./h'); const {check, sleep, put, waitFor} = H;
const passAll = async (ps) => { for (let i = 0; i < 6; i++){ for (const p of ps) await p.evaluate(() => { if (myBox()) doPass(); }); await sleep(200); } };
const AUTO = () => { window.__want = window.__want || null; window.__tgt = window.__tgt || null; setInterval(() => { const m = UI.modal; if (!m || m.__done) return; const w = window.__want ? new RegExp(window.__want, 'i') : null;
  try {
    if (m.type === 'pick' && m.resolve){ const pool = (m.cards || []); const pref = w ? pool.filter(c => w.test(cname(c))) : []; const n = Math.max(m.min || 0, Math.min(m.max || 0, pref.length || (m.min || 0) || (m.max ? 1 : 0))); const ids = (pref.length ? pref : pool).slice(0, n).map(c => c.id); m.__done = 1; m.resolve(ids); closeModal(); }
    else if (m.type === 'choice' && m.resolve){ const o = (m.options || []).filter(x => !x.disabled); const pick = (w && o.find(x => w.test(String(x.label)))) || o[0]; m.__done = 1; m.resolve(pick ? pick.value : null); closeModal(); }
    else if (m.type === 'target' && m.resolve){ if (!window.__tgt) return; const re = new RegExp(window.__tgt, 'i'); const c = (m.cands || []).find(x => x.ok && re.test(x.nm)); if (!c) return; m.__done = 1; m.resolve([c]); closeModal(); }
    else if (m.run){ m.__done = 1; const d = m.def ?? 1; m.run(d); closeModal(); }
  } catch (e){ console.warn('auto', e); } }, 120); };
const settle = async (ps) => { for (let i = 0; i < 40; i++){ await passAll(ps); let busy = false; for (const p of ps) busy = busy || await p.evaluate(() => !!(stackAll().length || UI.resolving || UI.casting)); if (!busy) return; await sleep(150); } };
const TO = (pr, ms = 20000) => Promise.race([new Promise(r => setTimeout(() => r('timeout'), ms)), pr]);
const toHand = (p, n) => p.evaluate(n => { for (const z of ['lib', 'gy', 'ex', 'bf']){ const i = S[z].findIndex(c => cname(c) === n); if (i >= 0){ const [c] = S[z].splice(i, 1); reset(c); S.hand.push(c); commit(); return c.id; } } const j = (S.side || []).findIndex(c => cname(c) === n); if (j >= 0){ const [c] = S.side.splice(j, 1); S.hand.push(c); commit(); return c.id; } return S.hand.find(c => cname(c) === n)?.id; }, n);
const cast = (p, n) => TO(p.evaluate(async n => { const c = S.hand.find(x => cname(x) === n); if (!c) return 'not in hand'; S.pool = {...emptyPool(), W:9, U:9, B:9, R:9, G:9, C:9}; commit(); await beginCast(c, 'hand'); return S.hand.includes(c) ? 'not cast' : 'ok'; }, n));
const activate = (p, n, re) => TO(p.evaluate(async ([n, re]) => { const c = S.bf.find(x => cname(x) === n); if (!c) return 'missing'; c.sk = false; c.tap = false; c.pw = 0; S.pool = {...emptyPool(), W:9, U:9, B:9, R:9, G:9, C:9}; const ab = abilityList(c).find(a => new RegExp(re, 'i').test(a.eff)); if (!ab) return 'no ability: ' + abilityList(c).map(a => a.eff).join(' / '); await activateAbility(c, ab); return 'ok'; }, [n, re]));
const loyalty = (p, n, i) => TO(p.evaluate(async ([n, i]) => { const c = S.bf.find(x => cname(x) === n); if (!c) return 'missing'; c.lu = ''; await activateLoyalty(c, i); return 'ok'; }, [n, i]));
const want = (p, w, t) => p.evaluate(([w, t]) => { window.__want = w; window.__tgt = t; }, [w, t]);
let PA = null, PB = null; const step = async (name, fn) => { if (process.env.ONLY && !name.includes(process.env.ONLY)) return; console.log('— ' + name); const f0 = H.fails(); try { const r = await TO(fn(), 60000); if (r === 'timeout') check(false, name + ' finished in time'); } catch (e){ console.log('  ERROR', e.message.split('\n')[0]); check(false, name + ' ran without errors'); }
  if (H.fails() > f0 && PA) for (const [nm, p] of [['Georges', PA], ['Kim', PB]]) console.log(`    ${nm} LOG:`, (await p.evaluate(() => S ? S.log.slice(-14).map(e => e.s).join(' | ') + ' || modal=' + JSON.stringify(UI.modal && {t:UI.modal.type, ti:UI.modal.title}) : 'no game'))); };

const fill = (n, land) => `${n} ${land}`;
const LEGAL = 'Commander\n1 Thalia, Guardian of Thraben\n\nCompanion\n1 Lurrus of the Dream-Den\n\nDeck\n1 Sol Ring\n1 Wall of Omens\n1 Gemstone Caverns\n' + fill(96, 'Plains') + '\n\nSideboard\n1 Basalt Monolith\n';
const BAD = 'Commander\n1 Krenko, Mob Boss\n\nCompanion\n1 Yorion, Sky Nomad\n\nDeck\n2 Sol Ring\n5 Rat Colony\n10 Nazgûl\n1 Wall of Omens\n1 Lurrus of the Dream-Den\n' + fill(70, 'Mountain') + '\n\nMaybeboard\n1 Thrasios, Triton Hero\n1 Tymna the Weaver\n1 Jaheira, Friend of the Forest\n1 Agent of the Iron Throne\n1 Gyruda, Doom of Depths\n1 Kaheera, the Orphanguard\n1 Jegantha, the Wellspring\n1 Zirda, the Dawnwaker\n';
const DECK_A = 'Commander\n1 Thalia, Guardian of Thraben\n\nCompanion\n1 Lurrus of the Dream-Den\n\nDeck\n1 Sol Ring\n1 Wall of Omens\n1 Gemstone Caverns\n1 Burning Wish\n1 Igneous Inspiration\n' + fill(94, 'Plains') +
  '\n\nSideboard\n1 Basalt Monolith\n1 Karn, the Great Creator\n1 Gyruda, Doom of Depths\n1 Environmental Sciences\n1 Expanded Anatomy\n';
const DECK_B = 'Commander\n1 Krenko, Mob Boss\n\nCompanion\n1 Yorion, Sky Nomad\n\nDeck\n1 Chancellor of the Dross\n1 Gemstone Caverns\n1 Sol Ring\n1 Wall of Omens\n' + fill(95, 'Mountain') + '\n';

(async () => {
  const server = H.http.createServer(); H.ws.createServer({server}, H.aedes.handle); await new Promise(r => server.listen(H.PORT, r));
  const browser = await H.chromium.launch();
  try {
    /* ---------- lobby ---------- */
    const ctx = await browser.newContext({viewport:{width:1400, height:950}}); const L = await ctx.newPage(); L.on('pageerror', e => check(false, 'lobby: no page errors (' + e.message + ')'));
    await H.route(L); await L.goto(H.FILE);
    const load = async text => { await L.evaluate(t => { LOBBY.deck = null; deckStatus(''); loadDeck(t); }, text); await L.waitForFunction(() => /Deck ready/.test(document.querySelector('#deckStatus').textContent), null, {timeout:15000}); await sleep(300); };
    await step('Lobby: a legal deck with a Companion and a Sideboard section', async () => {
      await load(LEGAL);
      const r = await L.evaluate(() => ({comp:info(LOBBY.deck.comp)?.n, side:(LOBBY.deck.side || []).map(e => info(e.k)?.n), main:LOBBY.deck.main.reduce((s, e) => s + e.q, 0), panel:document.querySelector('#deckSum .t25legal')?.innerText || '', txt:deckText(LOBBY.deck)}));
      check(r.comp === 'Lurrus of the Dream-Den', `companion read from the Companion section (${r.comp})`);
      check(r.side.join() === 'Basalt Monolith' && r.main === 99, `sideboard kept apart: [${r.side}], main ${r.main}`);
      check(/legal/.test(r.panel) && !/problem/.test(r.panel) && /Companion Lurrus of the Dream-Den: condition met/.test(r.panel), 'lobby panel: deck is legal and Lurrus\'s condition is met');
      check(/Companion\n1 Lurrus/.test(r.txt) && /Sideboard\n1 Basalt Monolith/.test(r.txt), 'Copy list keeps Companion and Sideboard sections');
      const ed = await L.evaluate(() => { renderDeckEdit(); return document.querySelector('#deckEdit .t25sec')?.innerText || ''; });
      check(/Deck rules/.test(ed) && /Companion/.test(ed) && /Basalt Monolith/.test(ed), 'Edit & test page shows the deck rules, the companion and the sideboard');
    });
    await step('Lobby: a deck with problems — Yorion, singleton, Nazgûl limit, colour identity; maybeboard becomes the sideboard', async () => {
      await load(BAD);
      const r = await L.evaluate(() => ({panel:document.querySelector('#deckSum .t25legal')?.innerText || '', side:(LOBBY.deck.side || []).length}));
      check(/Yorion, Sky Nomad: Commander decks are exactly 100 cards/.test(r.panel), 'Yorion\'s condition can\'t be met in Commander');
      check(/Too many copies: 2 Sol Ring, 10 Nazgûl \(/.test(r.panel) && !/Too many copies[^\n✗]*Rat Colony/.test(r.panel), 'singleton: 2 Sol Ring and 10 Nazgûl flagged, 5 Rat Colony allowed');
      check(/Outside the colour identity \(R\): .*Wall of Omens, Lurrus/.test(r.panel), 'Wall of Omens and Lurrus are outside Krenko\'s colour identity');
      check(/90 cards: a Commander deck has exactly 100/.test(r.panel), 'deck size flagged (89 + commander = 90 cards)');
      check(r.side === 8, `maybeboard (8 cards) is the sideboard: ${r.side}`);
      const pr = await L.evaluate(() => { const K = n => [...DICT.keys()].find(k => info(k)?.n === n); return [t25PairOk(K('Thrasios, Triton Hero'), K('Tymna the Weaver')).ok, t25PairOk(K('Thrasios, Triton Hero'), K('Krenko, Mob Boss')).ok, t25PairOk(K('Jaheira, Friend of the Forest'), K('Agent of the Iron Throne')).ok]; });
      check(pr.join() === 'true,false,true', `commander pairs: partner+partner ok, partner+Krenko not, Choose a Background + Background ok (${pr})`);
      const cc = await L.evaluate(() => { const K = n => [...DICT.keys()].find(k => info(k)?.n === n); const P = K('Plains') || K('Mountain'); const deck = (comp, main, cmd) => t25CompCheck({comp:K(comp), cmd:cmd.map(K), main:main.map(n => ({k:K(n), q:1}))}, 'std');
        return { gyrOk:deck('Gyruda, Doom of Depths', ['Wall of Omens', 'Mountain'], ['Krenko, Mob Boss']).ok, gyrBad:deck('Gyruda, Doom of Depths', ['Sol Ring'], ['Krenko, Mob Boss']).ok,
          kahBad:deck('Kaheera, the Orphanguard', ['Wall of Omens'], ['Krenko, Mob Boss']).ok, jegOk:deck('Jegantha, the Wellspring', ['Wall of Omens', 'Sol Ring'], ['Thalia, Guardian of Thraben']).ok,
          jegBad:deck('Jegantha, the Wellspring', ['Mountain'], ['Krenko, Mob Boss']).ok, zirBad:deck('Zirda, the Dawnwaker', ['Wall of Omens'], ['Krenko, Mob Boss']).ok, zirOk:deck('Zirda, the Dawnwaker', ['Sol Ring', 'Mountain'], ['Krenko, Mob Boss']).ok }; });
      check(cc.gyrOk && !cc.gyrBad, `Gyruda: even mana values only (Krenko 4 + Wall 2 ok, Sol Ring 1 not) ${JSON.stringify(cc)}`);
      check(!cc.kahBad, 'Kaheera: Wall of Omens (Wall) and Krenko (Goblin) fail');
      check(cc.jegOk && !cc.jegBad, `Jegantha: Thalia/Wall/Sol Ring ok; commander Krenko {2}{R}{R} has two {R} — fails (ok=${cc.jegOk}, bad=${cc.jegBad})`);
      check(cc.zirOk && !cc.zirBad, 'Zirda: Sol Ring and Mountain have activated abilities, Wall of Omens does not');
    });
    await step('Lobby: the rules-text check starts with the deck rules', async () => {
      await L.evaluate(() => runDeckCheck()); await L.waitForFunction(() => UI.modal && UI.modal.finished && UI.modal.t25, null, {timeout:30000});
      const r = await L.evaluate(() => ({body:document.querySelector('#modal')?.innerText || '', rep:UI.modal.report}));
      check(/Deck rules — Commander: \d+ problems?/.test(r.body) && /^Deck rules \(Commander\):/.test(r.rep), 'deck check modal and report include the deck rules');
      await L.evaluate(() => closeModal());
    });
    await ctx.close();

    /* ---------- game ---------- */
    const A = await H.player(browser, 'Georges', DECK_A, 'host', 'r2t');
    const B = await H.player(browser, 'Kim', DECK_B, 'join', 'r2t');
    PA = A; PB = B; await waitFor(A, () => OPP.size === 1); await waitFor(B, () => OPP.size === 1);
    await A.evaluate(AUTO); await B.evaluate(AUTO);
    const after = async () => { await sleep(500); await settle([A, B]); await sleep(1000); await settle([A, B]); await sleep(300); };
    await step('Game start: Lurrus is revealed in the command zone; Yorion can\'t be a companion and stays in the sideboard', async () => {
      const a = await A.evaluate(() => ({cz:S.cz.map(c => cname(c) + (c.comp ? '*' : '')), side:S.side.map(cname), lib:S.lib.length + S.hand.length, log:S.log.map(e => e.s).join('|')}));
      check(a.cz.includes('Lurrus of the Dream-Den*') && a.cz.includes('Thalia, Guardian of Thraben'), `Georges's command zone: ${a.cz}`);
      check(a.side.length === 5 && a.lib === 99, `5 sideboard cards outside the game, 99 in library+hand (${a.side.length}, ${a.lib})`);
      check(/revealed Lurrus of the Dream-Den as their companion/.test(a.log), 'log: revealed Lurrus as companion');
      const b = await B.evaluate(() => ({cz:S.cz.map(cname), side:S.side.map(cname), log:S.log.map(e => e.s).join('|')}));
      check(!b.cz.includes('Yorion, Sky Nomad') && b.side.includes('Yorion, Sky Nomad') && /Yorion, Sky Nomad can't be the companion/.test(b.log), `Kim: Yorion in sideboard, log explains (${b.cz})`);
      const v = await B.evaluate(() => [...OPP.values()][0].cz.map(c => info(c.k)?.n)); check(v.includes('Lurrus of the Dream-Den'), 'Kim sees Georges\'s revealed companion');
    });
    await step('Chancellor of the Dross revealed from Kim\'s opening hand drains at the first upkeep', async () => {
      const id = await toHand(B, 'Chancellor of the Dross'); const r = await H.menuClick(B, id, /Reveal it from your opening hand/); check(r === 'ok', `reveal button (${r})`);
      await A.click('[data-act="goFirst"]'); await waitFor(A, () => phaseNow().ph === 3, null, 10000); await after(); await sleep(800); await after();
      const life = [await A.evaluate(() => S.life), await B.evaluate(() => S.life)]; check(life[0] === 37 && life[1] === 43, `Georges 40→${life[0]}, Kim 40→${life[1]}`);
    });
    await step('Gemstone Caverns: Kim (not the starting player) begins with it + luck counter and exiles a card; Georges (starting player) can\'t', async () => {
      await want(B, 'Mountain', null); const hb = await B.evaluate(() => S.hand.length);
      const id = await toHand(B, 'Gemstone Caverns'); const r = await H.menuClick(B, id, /Begin the game with it/); check(r === 'ok', `Kim's button (${r})`); await sleep(800);
      const b = await B.evaluate(() => { const c = S.bf.find(x => cname(x) === 'Gemstone Caverns'); return {luck:c && c.nc && c.nc.luck, hand:S.hand.length, ex:S.ex.map(cname)}; });
      check(b.luck === 1 && b.hand === hb - 1 && b.ex.length === 1, `luck counter ${b.luck}, a card exiled (${b.ex}), hand ${hb}→${b.hand}`);
      const ida = await toHand(A, 'Gemstone Caverns'); await H.menuClick(A, ida, /Begin the game with it/); await sleep(500);
      const a = await A.evaluate(() => S.hand.some(c => cname(c) === 'Gemstone Caverns') && !S.bf.some(c => cname(c) === 'Gemstone Caverns')); check(a, 'Georges is the starting player: Gemstone Caverns stays in hand');
    });
    await step('Companion: {3} special action puts Lurrus into Georges\'s hand, once', async () => {
      const cz = await A.evaluate(() => { const c = S.cz.find(x => x.comp); return {id:c.id, chk:castCheck(c, 'cz').ok}; }); check(!cz.chk, 'Lurrus can\'t be cast from the command zone');
      await A.evaluate(() => { S.pool = emptyPool(); S.bf.forEach(c => { if (isLand(c.k)) c.tap = true; }); commit(); });
      await A.click(`.card[data-id="${cz.id}"]`); await A.waitForSelector('#menu:not([hidden])'); const dis = await A.evaluate(() => document.querySelector('#menu [data-act="t25comp"]')?.disabled); await A.keyboard.press('Escape');
      check(dis === true, 'button disabled with no mana');
      for (let i = 0; i < 3; i++) await put(A, 'Plains'); await sleep(300);
      const r = await H.menuClick(A, cz.id, /Companion: pay/); check(r === 'ok', `special action (${r})`); await sleep(300);
      const a = await A.evaluate(() => ({hand:S.hand.some(c => cname(c) === 'Lurrus of the Dream-Den'), cz:S.cz.map(cname), tapped:S.bf.filter(c => cname(c) === 'Plains' && c.tap).length, used:!!S.t25compUsed}));
      check(a.hand && !a.cz.includes('Lurrus of the Dream-Den') && a.tapped >= 3 && a.used, `Lurrus in hand, three Plains tapped (${a.tapped})`);
    });
    await step('Karn, the Great Creator: −2 fetches Basalt Monolith from the sideboard; +1 animates Sol Ring; Kim\'s artifacts can\'t activate', async () => {
      await toHand(A, 'Karn, the Great Creator'); await A.evaluate(() => { const c = S.hand.find(x => cname(x) === 'Karn, the Great Creator'); moveCard(c.id, 'bf', {quiet:true}); const b = S.bf.find(x => x.id === c.id); b.co = 5; commit(); });
      await put(A, 'Sol Ring'); await after();
      await want(A, 'Basalt Monolith', null); const r = await loyalty(A, 'Karn, the Great Creator', 1); check(r === 'ok', `−2 (${r})`); await after();
      const a = await A.evaluate(() => ({hand:S.hand.some(c => cname(c) === 'Basalt Monolith'), side:S.side.map(cname)})); check(a.hand && !a.side.includes('Basalt Monolith'), `Basalt Monolith in hand, sideboard now ${a.side}`);
      const sid = await A.evaluate(() => S.bf.find(c => cname(c) === 'Sol Ring').id);
      await want(A, null, 'Sol Ring'); await A.evaluate(id => { window.__tgtId = id; }, sid);
      await A.evaluate(() => { const m0 = UI.modal; }); const r2 = await loyalty(A, 'Karn, the Great Creator', 0); check(r2 === 'ok', `+1 (${r2})`); await after();
      const s = await A.evaluate(id => { const c = S.bf.find(x => x.id === id); return {cr:isCreatureCard(c), st:stats(c).join('/')}; }, sid); check(s.cr && s.st === '1/1', `Sol Ring is a ${s.st} artifact creature (${s.cr})`);
      await put(B, 'Sol Ring'); await after();
      const ban = await B.evaluate(() => { const c = S.bf.find(x => cname(x) === 'Sol Ring'); const ab = abilityList(c)[0] || manaAbs(c)[0]; return typeof abilityReady === 'function' && ab ? abilityReady(c, ab) : 'n/a'; });
      check(typeof ban === 'string' && /Karn/.test(ban), `Kim's Sol Ring can't be activated: ${ban}`);
    });
    await step('Gyruda: each player mills four, Georges takes the even creature (Wall of Omens) from Kim\'s milled cards', async () => {
      await B.evaluate(() => { const i = S.lib.findIndex(c => cname(c) === 'Wall of Omens'); if (i >= 0){ const [c] = S.lib.splice(i, 1); S.lib.unshift(c); } commit(); });
      await A.evaluate(() => { const i = S.lib.findIndex(c => cname(c) === 'Wall of Omens'); if (i >= 0){ const [c] = S.lib.splice(i, 1); S.lib.splice(4, 0, c); } commit(); });
      await toHand(A, 'Gyruda, Doom of Depths'); await want(A, "Kim's graveyard", null); check(await cast(A, 'Gyruda, Doom of Depths') === 'ok', 'cast Gyruda'); await after(); await sleep(2500); await after();
      const a = await A.evaluate(() => S.bf.map(cname)); const b = await B.evaluate(() => ({gy:S.gy.map(cname)}));
      check(a.includes('Wall of Omens') && !b.gy.includes('Wall of Omens'), `Georges controls Kim's Wall of Omens (Kim's gy: ${b.gy.join(', ')})`);
    });
    await step('Burning Wish gets a sorcery from the sideboard; Igneous Inspiration learns the other Lesson', async () => {
      await want(A, 'Environmental Sciences', null); await toHand(A, 'Burning Wish'); check(await cast(A, 'Burning Wish') === 'ok', 'cast Burning Wish'); await after();
      let a = await A.evaluate(() => ({hand:S.hand.map(cname), side:S.side.map(cname), ex:S.ex.map(cname)}));
      check(a.hand.includes('Environmental Sciences') && !a.side.includes('Environmental Sciences') && a.ex.includes('Burning Wish'), `wished for Environmental Sciences; Burning Wish exiled (${a.ex})`);
      await want(A, 'Lesson|Expanded', 'Kim'); await toHand(A, 'Igneous Inspiration'); check(await cast(A, 'Igneous Inspiration') === 'ok', 'cast Igneous Inspiration'); await after();
      a = await A.evaluate(() => ({hand:S.hand.map(cname), side:S.side.map(cname)}));
      check(a.hand.includes('Expanded Anatomy') && !a.side.includes('Expanded Anatomy'), `learned Expanded Anatomy (sideboard left: ${a.side})`);
      const kl = await B.evaluate(() => S.life); check(kl === 40, `Kim took 3 (43→${kl})`);
    });
  } catch (e){ console.log('ERROR', e.message); check(false, 'no exceptions'); }
  finally { await browser.close(); server.close(); console.log(`\n${H.results.length - H.fails()} passed, ${H.fails()} failed`); process.exit(0); }
})();
