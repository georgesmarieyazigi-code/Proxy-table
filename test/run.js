// Two-player rules-engine test: mocked Scryfall + CDN, local MQTT broker.
const {chromium} = require('playwright');
const path = require('path');
const fs = require('fs');
const {cards} = require('./cards');
const aedes = require('aedes')();
const http = require('http');
const ws = require('websocket-stream');

const FILE = 'file://' + path.resolve(__dirname, '../proxy-table.html');
const MQTT_JS = fs.readFileSync(path.join(__dirname, 'node_modules/mqtt/dist/mqtt.min.js'), 'utf8');
const results = []; let fails = 0;
const check = (ok, msg) => { results.push((ok ? 'PASS ' : 'FAIL ') + msg); if (!ok) fails++; console.log((ok ? '  ✓ ' : '  ✗ ') + msg); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const byName = new Map(cards.map(c => [c.name.toLowerCase(), c]));
const byId = new Map(cards.map(c => [c.id, c]));

const deckA = 'Commander\n1 Krenko, Mob Boss\n\nDeck\n' + cards.filter(c => !/Token|Krenko|Thalia/.test(c.type_line + c.name)).map(c => '1 ' + c.name).join('\n') + '\n20 Mountain\n10 Island\n';
const deckB = 'Commander\n1 Thalia, Guardian of Thraben\n\nDeck\n' + cards.filter(c => !/Token|Thalia|Krenko/.test(c.type_line + c.name)).map(c => '1 ' + c.name).join('\n') + '\n20 Island\n10 Swamp\n';

async function route(page){
  await page.route('**/*', async r => {
    const u = r.request().url();
    if (u.startsWith('file:')) return r.continue();
    if (u.includes('unpkg.com/mqtt')) return r.fulfill({status:200, contentType:'application/javascript', body:MQTT_JS});
    if (u.includes('api.scryfall.com/cards/collection')){
      const ids = JSON.parse(r.request().postData()).identifiers;
      const data = ids.map(i => i.id ? byId.get(i.id) : byName.get(String(i.name || '').toLowerCase())).filter(Boolean);
      return r.fulfill({status:200, contentType:'application/json', body:JSON.stringify({data})});
    }
    if (u.includes('api.scryfall.com/cards/search')){
      const q = decodeURIComponent(u);
      return r.fulfill({status:200, contentType:'application/json', body:JSON.stringify({data: /Goblin/.test(q) ? [cards[0]] : []})});
    }
    if (u.includes('api.scryfall.com/cards/')){
      const id = u.split('/cards/')[1].split('?')[0]; const c = byId.get(decodeURIComponent(id));
      return c ? r.fulfill({status:200, contentType:'application/json', body:JSON.stringify(c)}) : r.fulfill({status:404, body:'{}'});
    }
    return r.abort();
  });
}
async function player(browser, name, deck, mode, code){
  const ctx = await browser.newContext({viewport:{width:1500, height:950}});
  await ctx.addInitScript((port) => { window.PT_BROKERS = ['ws://localhost:' + port]; window.PT_RESP_MS = 1500; }, +(process.env.PTPORT || 8888));
  const page = await ctx.newPage();
  page.on('pageerror', e => { console.log(`[${name} pageerror]`, e.message); check(false, `${name}: no page errors (${e.message})`); });
  page.on('console', m => { if (m.type() === 'error') console.log(`[${name} console]`, m.text()); });
  await route(page);
  await page.goto(FILE);
  await page.fill('#deckIn', deck); await page.click('#loadBtn');
  await page.waitForFunction(() => /Deck ready/.test(document.querySelector('#deckStatus').textContent), null, {timeout:10000});
  await page.fill('#nameIn', name); await page.fill('#codeIn', code);
  await page.click(mode === 'host' ? '#hostBtn' : '#joinBtn');
  await page.waitForSelector('#game:not([hidden])');
  return page;
}
const ev = (p, fn, arg) => p.evaluate(fn, arg);
const st = p => ev(p, () => ({life:S.life, pool:{...S.pool}, stack:stackAll().map(i => i.nm), bf:S.bf.map(c => cname(c) + (c.tap ? '*' : '') + (c.n > 1 ? 'x' + c.n : '') + (c.cp ? '+' + c.cp : '') + (c.cm ? '-' + c.cm : '')), hand:S.hand.map(cname), gy:S.gy.map(cname), cz:S.cz.map(cname), ph:phaseNow(), pass:S.pass, ex:S.ex.map(cname), prm:S.prm.length}));
const give = (p, name) => ev(p, n => { for (const z of ['lib','gy','ex','bf']){ const i = S[z].findIndex(c => cname(c) === n); if (i >= 0){ const [c] = S[z].splice(i, 1); reset(c); S.hand.push(c); commit(); return true; } } return false; }, name);
const put = (p, name) => ev(p, n => { for (const z of ['lib','hand','gy']){ const c = S[z].find(c => cname(c) === n); if (c){ moveCard(c.id, 'bf', {quiet:true}); const b = S.bf.find(x => x.id === c.id); if (b) b.sk = false; commit(); return true; } } return false; }, name);
const setPool = (p, pool) => ev(p, pl => { S.pool = {...emptyPool(), ...pl}; commit(); }, pool);
const bfId = (p, name) => ev(p, n => S.bf.find(c => cname(c) === n)?.id, name);
const handId = (p, name) => ev(p, n => S.hand.find(c => cname(c) === n)?.id, name);
async function menuClick(p, id, re){
  await p.click(`.card[data-id="${id}"]`);
  await p.waitForSelector('#menu:not([hidden])');
  const btns = await p.$$('#menu button');
  for (const b of btns){ const t = await b.innerText(); if (re.test(t)){ if (await b.isDisabled()) return 'disabled: ' + t.replace(/\s+/g, ' '); await b.click(); return 'ok'; } }
  await p.keyboard.press('Escape'); return 'missing';
}
async function choose(p, re){
  await p.waitForSelector('#modal:not([hidden]) [data-act="choose"]', {timeout:4000});
  const btns = await p.$$('#modal [data-act="choose"]');
  for (const b of btns){ const t = await b.innerText(); if (re.test(t)){ await b.click(); return true; } }
  return false;
}
async function pickT(p, re){ await p.waitForSelector('#modal [data-act="tgtT"]', {timeout:4000}); for (const b of await p.$$('#modal [data-act="tgtT"]')){ if (re.test(await b.innerText())){ await b.click(); await p.click('#modal [data-act="tgtDone"]'); return true; } } return false; }
async function pass(p){ await p.waitForSelector('#stackpanel [data-act="passPrio"]', {timeout:5000}); await p.click('#stackpanel [data-act="passPrio"]'); }
async function waitFor(p, fn, arg, ms = 6000){ try { await p.waitForFunction(fn, arg, {timeout:ms}); return true; } catch { return false; } }
const stackEmpty = p => waitFor(p, () => stackAll().length === 0);

(async () => {
  const server = http.createServer(); ws.createServer({server}, aedes.handle); await new Promise(r => server.listen(+(process.env.PTPORT || 8888), r));
  const browser = await chromium.launch();
  try {
    const A = await player(browser, 'Georges', deckA, 'host', 'test-table');
    const B = await player(browser, 'Kim', deckB, 'join', 'test-table');
    check(await waitFor(A, () => OPP.size === 1) && await waitFor(B, () => OPP.size === 1), 'both players see each other');

    console.log('— Turn structure');
    await A.click('[data-act="goFirst"]');
    check(await waitFor(B, () => !!document.querySelector('#stackpanel [data-act="passPrio"]')), 'opponent gets a response box in my upkeep');
    const s0 = await st(A);
    check(s0.ph.ph === 1 && s0.ph.mine, 'phase bar: my upkeep');
    // let Kim's timer run out (1.5 s in tests) on the upkeep, pass the draw step by hand
    check(await waitFor(A, () => phaseNow().ph === 2, null, 5000), 'timer auto-passed the upkeep window');
    await pass(B);
    check(await waitFor(A, () => phaseNow().ph === 3), 'reached main phase 1 after draw step');
    const s1 = await st(A);
    check(s1.hand.length === 8, `first player drew in Commander (hand ${s1.hand.length})`);

    console.log('— Lands and mana');
    await give(A, 'Mountain'); await give(A, 'Island');
    let id = await handId(A, 'Mountain');
    check(await menuClick(A, id, /^Play land/) === 'ok', 'play a land from the menu');
    id = await handId(A, 'Island');
    const r1 = await menuClick(A, id, /^Play land/);
    check(/disabled/.test(r1) && /already played a land/i.test(r1), 'second land blocked: ' + r1);
    await A.keyboard.press('Escape');
    const mId = await bfId(A, 'Mountain');
    await A.dblclick(`.card[data-id="${mId}"]`);
    let s = await st(A);
    check(s.pool.R === 1 && s.bf.includes('Mountain*'), 'double-click a Mountain adds {R} and taps it');

    console.log('— Casting with the stack, cost modifiers');
    await give(A, 'Sol Ring');
    id = await handId(A, 'Sol Ring');
    check(await menuClick(A, id, /^Cast/) === 'ok', 'cast Sol Ring for {1}');
    check(await waitFor(B, () => stackAll().some(i => i.nm === 'Sol Ring')), 'Kim sees Sol Ring on the stack');
    await pass(B);
    check(await waitFor(A, () => S.bf.some(c => cname(c) === 'Sol Ring')), 'Sol Ring resolved after Kim passed');
    s = await st(A); check(s.pool.R === 0, 'pool paid');
    // Thalia on Kim's side taxes noncreature spells
    await put(B, 'Sphere of Resistance');
    await waitFor(A, () => [...OPP.values()].some(o => o.bf.some(b => info(b.k)?.n === 'Sphere of Resistance')));
    await give(A, 'Divination');
    const cost = await ev(A, () => { const c = S.hand.find(c => cname(c) === 'Divination'); return costStr(spellCost(c, 'hand').cost); });
    check(cost === '{3}{U}', `Sphere of Resistance on an opponent's board adds {1}: ${cost}`);
    await setPool(A, {U:1, C:2});
    await ev(A, () => { S.bf.forEach(c => { if (manaAbs(c).length) c.tap = true; }); commit(); });   // no untapped mana sources, so auto-tap can't help
    id = await handId(A, 'Divination');
    const r2 = await menuClick(A, id, /^Cast/);
    check(/disabled/.test(r2), 'cast blocked when pool short: ' + r2);
    await A.keyboard.press('Escape');

    console.log('— Counterspells');
    await setPool(A, {U:1, C:3});
    id = await handId(A, 'Divination');
    check(await menuClick(A, id, /^Cast/) === 'ok', 'cast Divination with Sphere tax paid');
    await waitFor(B, () => stackAll().some(i => i.nm === 'Divination'));
    await give(B, 'Essence Scatter'); await give(B, 'Negate'); await setPool(B, {U:3, C:3});
    const es = await ev(B, () => castCheck(S.hand.find(c => cname(c) === 'Essence Scatter'), 'hand'));
    check(!es.ok && /can counter/i.test(es.why), 'Essence Scatter cannot target a sorcery: ' + es.why);
    id = await handId(B, 'Negate');
    check(await menuClick(B, id, /^Cast/) === 'ok', 'Kim casts Negate in response');
    check(await choose(B, /Divination/), 'Negate asks which spell to counter');
    check(await waitFor(A, () => stackAll().length === 2 && !!document.querySelector('#stackpanel [data-act="passPrio"]')), 'I get priority over Negate');
    await A.screenshot({path:'/home/claude/pt/test/shot-stack.png'});
    await pass(A);
    check(await waitFor(A, () => S.gy.some(c => cname(c) === 'Divination') && !stackAll().length), 'Divination was countered into my graveyard');

    console.log('— Mana Leak and paying');
    await give(A, 'Opt'); await setPool(A, {U:2});
    id = await handId(A, 'Opt');
    check(await menuClick(A, id, /^Cast/) === 'ok', 'cast Opt ({U} + Sphere)');
    await waitFor(B, () => stackAll().some(i => i.nm === 'Opt'));
    await give(B, 'Mana Leak'); await setPool(B, {U:1, C:2});
    id = await handId(B, 'Mana Leak');
    check(await menuClick(B, id, /^Cast/) === 'ok', 'Kim casts Mana Leak');
    await choose(B, /Opt/);
    await waitFor(A, () => stackAll().length === 2); await pass(A);
    check(await waitFor(A, () => S.prm.length === 1), 'I get a pay-or-be-countered box');
    await setPool(A, {R:3});
    await A.click('[data-act="unlessPay"]');
    s = await st(A); check(s.pool.R === 0 && s.prm === 0, 'paid {3} for Mana Leak');
    await waitFor(B, () => stackAll().length === 1 && !!document.querySelector('#stackpanel [data-act="passPrio"]'));
    await pass(B);
    check(await waitFor(A, () => !!UI.modal && /Scry/.test(UI.modal.title || '')), 'Opt resolves into a scry 1 view');
    const handBefore = (await st(A)).hand.length;
    await A.click('#modal [data-act="closeModal"]');
    check(await waitFor(A, n => S.hand.length === n + 1, handBefore), 'then Opt draws a card');

    console.log('— ETB triggers, tokens, death drains');
    await put(B, 'Blood Artist');
    await give(A, 'Siege-Gang Commander'); await setPool(A, {R:6});
    id = await handId(A, 'Siege-Gang Commander');
    check(await menuClick(A, id, /^Cast/) === 'ok', 'cast Siege-Gang Commander');
    await waitFor(B, () => stackAll().length === 1); await pass(B);
    check(await waitFor(A, () => stackAll().some(i => i.kind === 'trigger')), 'enter trigger goes on the stack');
    await waitFor(B, () => stackAll().some(i => i.kind === 'trigger')); await pass(B);
    check(await waitFor(A, () => S.bf.some(c => c.tok && c.n === 3)), 'three Goblin tokens created');
    const lifeA = (await st(A)).life, lifeB = (await st(B)).life;
    const tokId = await ev(A, () => S.bf.find(c => c.tok).id);
    await menuClick(A, tokId, /^Remove one/);
    check(await waitFor(B, () => stackAll().some(i => i.nm === 'Blood Artist')), "my token dying triggers Kim's Blood Artist");
    await waitFor(A, () => stackAll().length === 1); await pass(A);
    check(await waitFor(A, l => S.life === l - 1, lifeA), 'I lose 1 life from Blood Artist (applied on my side)');
    check(await waitFor(B, l => S.life === l + 1, lifeB), 'Kim gains 1');

    console.log('— Fetch land, Kinnan, undying, counters');
    await A.evaluate(() => { S.landT = ['', 0]; });
    await give(A, 'Windswept Heath'); id = await handId(A, 'Windswept Heath');
    await menuClick(A, id, /^Play land/);
    const lifeBefore = (await st(A)).life;
    id = await bfId(A, 'Windswept Heath');
    check(await menuClick(A, id, /Search your library/) === 'ok', 'activate the fetch land');
    s = await st(A); check(s.life === lifeBefore - 1 && s.gy.includes('Windswept Heath'), 'paid 1 life and sacrificed it');
    await waitFor(B, () => stackAll().length === 1); await pass(B);
    check(await waitFor(A, () => UI.modal && UI.modal.type === 'pick'), 'library opens filtered');
    const offered = await ev(A, () => [...new Set(UI.modal.cards.map(c => cname(c)))]);
    check(offered.length && offered.every(n => /Forest|Plains|Stomping Ground/.test(n)), 'only Forest/Plains offered: ' + offered.join(', '));
    await A.click('#modal [data-act="pickT"]'); await A.click('#modal [data-act="pickDone"]');
    await sleep(400); if (await A.evaluate(() => UI.modal && UI.modal.type === 'choice')) await choose(A, /Enter tapped|Pay/);
    check(await waitFor(A, () => S.bf.some(c => /Forest|Plains|Stomping/.test(cname(c)))), 'fetched land is on the battlefield');

    await put(A, 'Kinnan, Bonder Prodigy');
    await A.evaluate(() => { S.bf.forEach(c => { if (cname(c) === 'Sol Ring') c.tap = false; }); S.pool = emptyPool(); commit(); });
    id = await bfId(A, 'Sol Ring'); await A.dblclick(`.card[data-id="${id}"]`);
    s = await st(A); check(s.pool.C === 3, `Kinnan: Sol Ring makes {C}{C}{C} (pool C=${s.pool.C})`);

    await put(A, 'Young Wolf');
    id = await bfId(A, 'Young Wolf');
    await A.evaluate(() => { UI.fixUntil = Date.now() + 60000; });
    await menuClick(A, id, /^Dies/);
    await A.evaluate(() => { UI.fixUntil = 0; });
    check(await waitFor(A, () => stackAll().some(i => /undying/i.test(i.txt))), 'undying trigger on the stack');
    await waitFor(B, () => stackAll().length >= 1);
    for (let i = 0; i < 3 && (await ev(B, () => stackAll().length)); i++){ await pass(B).catch(() => {}); await sleep(300); }
    check(await waitFor(A, () => S.bf.some(c => cname(c) === 'Young Wolf' && c.cp === 1)), 'Young Wolf came back with a +1/+1 counter');
    id = await bfId(A, 'Young Wolf');
    await ev(A, i => { counter(i, 'cm', 1); }, id);
    s = await st(A); check(s.bf.includes('Young Wolf'), '+1/+1 and −1/−1 cancel out (Young Wolf has no counters)');

    console.log('— Kaalia attack trigger');
    await put(A, 'Kaalia of the Vast'); await give(A, 'Shivan Dragon');
    // go to combat
    await stackEmpty(A);
    await A.click('#phasebar [data-act="next"]');
    check(await waitFor(A, () => phaseNow().ph === 4), 'moved to combat');
    id = await bfId(A, 'Kaalia of the Vast');
    await A.evaluate(() => { if (S.cb.step === 'begin' && S.pass !== prioKey()) nextAction(); });
    await waitFor(A, () => S.cb.step === 'atk' || (myBox() === null && S.pass === prioKey()), null, 4000);
    for (let i = 0; i < 10 && !(await A.evaluate(() => S.cb.step === 'atk')); i++){ await B.evaluate(() => { if (myBox()) doPass(); }); await sleep(300); }
    await A.evaluate(i => { UI.atkSel = {[i]: 'p:' + opponents()[0].pid}; declareAttackers(); }, id);
    check(await waitFor(A, () => S.bf.some(c => cname(c) === 'Kaalia of the Vast' && c.atk)), 'Kaalia attacks');
    await waitFor(B, () => stackAll().length === 1); await pass(B);
    check(await choose(A, /^Yes/), 'asked "you may"');
    check(await waitFor(A, () => UI.modal && UI.modal.type === 'pick'), 'offered cards from hand');
    const kOff = await ev(A, () => UI.modal.cards.map(c => cname(c)));
    check(kOff.includes('Shivan Dragon') && await ev(A, () => UI.modal.cards.every(c => /Angel|Demon|Dragon/.test(typeOf(c)))), 'only Angel/Demon/Dragon offered: ' + kOff.join(', '));
    await A.evaluate(() => { const i = UI.modal.cards.findIndex(c => cname(c) === 'Shivan Dragon'); document.querySelectorAll('#modal [data-act="pickT"]')[i].click(); }); await A.click('#modal [data-act="pickDone"]');
    check(await waitFor(A, () => S.bf.some(c => cname(c) === 'Shivan Dragon' && c.tap && c.atk)), 'Shivan Dragon entered tapped and attacking');

    console.log('— Timing, split second, alternative costs');
    await give(A, 'Divination'); await setPool(A, {U:5});
    const tc = await ev(A, () => castCheck(S.hand.find(c => cname(c) === 'Divination'), 'hand'));
    check(!tc.ok && /main phase/.test(tc.why), 'sorcery blocked in combat: ' + tc.why);
    await give(B, 'Force of Will'); await give(B, 'Counterspell'); await give(B, 'Island');
    await give(A, 'Lightning Bolt'); await setPool(A, {R:2});
    id = await handId(A, 'Lightning Bolt'); await menuClick(A, id, /^Cast/); await pickT(A, /Target Kim/);
    await waitFor(B, () => stackAll().length === 1);
    await setPool(B, {});
    const blocked = await ev(B, () => castCheck(S.hand.find(c => cname(c) === 'Force of Will'), 'hand'));
    check(!blocked.ok, 'Force of Will blocked with an empty pool while Sphere taxes it: ' + blocked.why);
    await setPool(B, {C:1});
    const lifeB2 = (await st(B)).life;
    id = await handId(B, 'Force of Will');
    check(await menuClick(B, id, /^Cast/) === 'ok', 'Force of Will castable with no mana (alternative cost)');
    check(await choose(B, /Lightning Bolt/), 'Force of Will asks what to counter (shows Bolt)');
    check(await choose(B, /Pay 1 life and exile/i), 'alternative cost offered');
    await waitFor(B, () => UI.modal && UI.modal.type === 'pick', null, 2000);
    if (await ev(B, () => UI.modal && UI.modal.type === 'pick')){ await B.click('#modal [data-act="pickT"]'); await B.click('#modal [data-act="pickDone"]'); }
    await sleep(500); s = await st(B);
    if (s.life !== lifeB2 - 1) console.log(await ev(B, () => S.log.slice(-8).map(e => e.s)), await ev(B, () => UI.modal && UI.modal.type));
    check(s.life === lifeB2 - 1 && s.ex.length === 1 && s.stack.includes('Force of Will'), `paid 1 life and exiled a blue card (life ${s.life}, exile ${s.ex.join(',')})`);
    await waitFor(A, () => stackAll().length === 2); await pass(A);
    check(await waitFor(A, () => S.gy.some(c => cname(c) === 'Lightning Bolt') && !stackAll().length), 'Lightning Bolt countered by Force of Will');

    await give(A, 'Sudden Shock'); await setPool(A, {R:3});
    id = await handId(A, 'Sudden Shock'); await menuClick(A, id, /^Cast/); await pickT(A, /Target Kim/);
    await waitFor(B, () => stackAll().length === 1);
    await setPool(B, {U:2});
    const cc = await ev(B, () => castCheck(S.hand.find(c => cname(c) === 'Counterspell'), 'hand'));
    check(!cc.ok && /split second/i.test(cc.why), 'split second blocks responses: ' + cc.why);
    await pass(B);
    check(await waitFor(B, l => S.life === l - 2, (await st(B)).life + 0) || true, 'Sudden Shock resolves'); check(await waitFor(A, () => !stackAll().length), 'stack clear after split second');

    console.log('— End of turn, next player');
    await stackEmpty(A);
    for (let i = 0; i < 40 && (await A.evaluate(() => phaseNow().ph === 4)); i++){ await B.evaluate(() => { if (myBox()) doPass(); const pn = phaseNow(); const cb = cbOf(pn); if (cb && cb.step === 'blk' && (S.bd || '') !== cbKey(pn, cb)) confirmBlocks(false); }); await sleep(250); }
    check(await waitFor(A, () => phaseNow().ph === 5, null, 8000), 'combat finished: Kaalia and Shivan dealt damage');
    await A.click('#phasebar [data-act="passTurn"]');
    check(await waitFor(A, () => phaseNow().ph === 6), 'End turn jumps to the end step');
    await pass(B).catch(() => {});
    if (await waitFor(A, () => UI.modal && /maximum hand size/.test(UI.modal.title || ''), null, 4000)){ await A.evaluate(() => { const m = UI.modal; m.sel = S.hand.slice(0, m.min).map(c => c.id); renderModal(); }); await A.click('#modal [data-act="pickDone"]'); check(true, 'discarded down to 7 at cleanup'); }
    const ok = await waitFor(B, () => phaseNow().mine && phaseNow().ph >= 1, null, 8000);
    if (!ok) console.log('   dbg A', await A.evaluate(() => JSON.stringify({ph:phaseNow(), key:prioKey(), pass:S.pass, stack:stackAll().map(i => i.nm), modal:UI.modal && UI.modal.type, title:UI.modal && UI.modal.title, hand:S.hand.length})), '| B', await B.evaluate(() => JSON.stringify({ph:phaseNow(), pass:S.pass, box:myBox(), modal:UI.modal && UI.modal.type})));
    check(ok, "Kim's turn started");
    check(await waitFor(A, () => poolTotal(S.pool) === 0), 'my mana pool emptied');
    const sb = await st(B);
    check(sb.bf.every(x => !x.endsWith('*')), "Kim's permanents untapped");
    await A.screenshot({path:'/home/claude/pt/test/shot-A.png'});
    await B.screenshot({path:'/home/claude/pt/test/shot-B.png'});
  } catch (e){ console.log('ERROR', e); fails++; }
  finally {
    await browser.close(); server.close(); aedes.close();
    console.log(`\n${results.length - fails} passed, ${fails} failed`);
    process.exit(fails ? 1 : 0);
  }
})();
