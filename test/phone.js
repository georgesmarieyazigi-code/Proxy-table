// Phone check: iPhone-sized screen with touch. Lobby → bot game → tap a fetch land and Lotus Petal the way a phone does.
process.env.ALL = '1';
const H = require('./h'); const fs = require('fs'); const path = require('path'); const {sleep, check} = H;
const {devices} = require('playwright');
const OUT = process.env.SHOTDIR || '/tmp/phone'; fs.mkdirSync(OUT, {recursive:true});
const realDeck = n => fs.readFileSync(path.join(__dirname, '../decks/' + n + '.txt'), 'utf8').split('\n').map(l => l.replace(/\s*\([A-Z0-9]{2,6}\)\s*[\w★-]*\s*(\*F\*)?\s*$/, '')).join('\n');
let shot = 0; const snap = async (p, name) => { await p.screenshot({path:`${OUT}/${String(++shot).padStart(2, '0')}-${name}.png`}); };
(async () => {
  const server = H.http.createServer(); H.ws.createServer({server}, H.aedes.handle); await new Promise(r => server.listen(H.PORT, r));
  const browser = await H.chromium.launch();
  const ctx = await browser.newContext({...devices['iPhone 13']});
  await ctx.addInitScript(port => { window.PT_BROKERS = ['ws://localhost:' + port]; }, H.PORT);
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => { errs.push(e.message); console.log('  [pageerror]', e.message); });
  if (!process.env.REAL) await H.route(p); else await H.route(p);
  await p.goto(H.FILE); await sleep(1500);
  await snap(p, 'lobby');
  await p.evaluate(() => lobbyPage('decks')); await snap(p, 'decks');
  await p.fill('#deckIn', realDeck('edgar') + '\n1 Bloodstained Mire\n1 Lotus Petal\n1 Volcanic Island\n1 Farewell\n'); await p.tap('#loadBtn');
  await p.waitForFunction(() => /Deck ready/.test(document.querySelector('#deckStatus').textContent), null, {timeout:90000}).catch(() => {});
  await sleep(800); await snap(p, 'deck-loaded');
  await p.evaluate(() => lobbyPage('check')); await sleep(800); await snap(p, 'deck-page');
  await p.evaluate(() => lobbyPage('play')); await sleep(500); await snap(p, 'play-page');
  await p.fill('#nameIn', 'Georges').catch(() => {});
  await p.tap('#botPanel [data-botn="1"]').catch(async () => { await p.evaluate(() => document.querySelector('#botPanel [data-botn="1"]')?.click()); });
  await snap(p, 'bot-setup');
  await p.evaluate(() => { BOTUI.speed = 0.3; });
  await p.evaluate(() => document.querySelector('#botStart').scrollIntoView()); await p.tap('#botStart');
  await p.waitForSelector('#game:not([hidden])', {timeout:30000}); await sleep(4000); await snap(p, 'game-start');
  // keep the hand if asked
  for (let i = 0; i < 10; i++){ const k = await p.$('[data-act="keep"], #modal [data-v="keep"], #modal button:has-text("Keep")'); if (k){ await k.tap().catch(() => k.click()); await sleep(800); break; } await sleep(500); }
  await sleep(2000); await snap(p, 'game-kept');
  for (let i = 0; i < 20; i++){ const b = await p.$('#topbar [data-act="goFirst"]'); if (b && await b.isVisible()){ await b.tap().catch(() => b.click()); await sleep(1500); break; } await sleep(500); }
  // wait for my turn / main phase
  for (let i = 0; i < 60; i++){ const ok = await p.evaluate(() => phaseNow().mine && phaseNow().ph === 3 && !stackAll().length); if (ok) break; await p.evaluate(() => { if (phaseNow().mine && !UI.modal && !stackAll().length) nextAction(); if (myBox()) doPass(); }); await sleep(500); }
  await snap(p, 'my-main-phase');
  // put a Bloodstained Mire and a Lotus Petal on the battlefield, Volcanic Island on top of the library
  await p.evaluate(() => { const f = n => [...DICT.values()].find(a => a.n === n)?.k; S.bf.push({id:S.nid++, k:f('Bloodstained Mire'), x:10, y:20, sk:false}, {id:S.nid++, k:f('Lotus Petal'), x:30, y:20, sk:false});
    const v = S.lib.findIndex(c => cname(c) === 'Volcanic Island'); if (v > 0) S.lib.unshift(S.lib.splice(v, 1)[0]); commit(); renderGame(); });
  await sleep(800); await snap(p, 'board');
  // Lotus Petal: tap it like a phone does
  { const ps = await p.evaluate(() => { const c = S.bf.find(x => cname(x) === 'Lotus Petal'); S.pool = emptyPool(); return `#bf [data-id="${c.id}"]`; });
    await p.evaluate(sel => document.querySelector(sel).scrollIntoView({block:'center'}), ps); await sleep(300);
    const bb = await (await p.$(ps)).boundingBox(); await p.touchscreen.tap(bb.x + bb.width / 2, bb.y + 12); await sleep(800); await snap(p, 'tap-petal');
    const st = await p.evaluate(() => ({menu:[...document.querySelectorAll('#menu .mi, .menu button, #popmenu button')].filter(b => b.offsetParent).map(b => b.textContent.trim()).slice(0, 10), menuBox:(() => { const m = document.querySelector('#menu, .menu, #popmenu'); if (!m || !m.offsetParent) return null; const r = m.getBoundingClientRect(); return [r.left, r.top, r.width, r.height, innerWidth, innerHeight]; })(), pool:S.pool, log:S.log.slice(-2).map(e => e.s)}));
    console.log('  after tapping Lotus Petal:', JSON.stringify(st));
    console.log('  menu buttons:', JSON.stringify(await p.evaluate(() => [...document.querySelectorAll('#menu button')].slice(0, 6).map(b => [b.dataset.act, Object.entries(b.dataset).map(([k, v]) => k + '=' + v).join(' '), b.textContent.trim().slice(0, 50)]))));
    const first = await p.$('#menu button[data-act="manaAb"]');
    if (first && await first.isVisible()){ const b2 = await first.boundingBox(); await p.touchscreen.tap(b2.x + b2.width / 2, b2.y + b2.height / 2); await sleep(800); }
    await snap(p, 'petal-colours');
    console.log('  colour menu:', JSON.stringify(await p.evaluate(() => { const m = document.querySelector('#menu'); const r = m.getBoundingClientRect(); return {hidden:m.hidden, box:[r.left, r.top, r.width, r.height], vh:innerHeight, btns:[...m.querySelectorAll('button')].map(b => b.textContent.trim())}; })));
    const red = await p.$('#menu button[data-act="manaGo"][data-ch="3"]');
    if (red){ const b3 = await red.boundingBox(); console.log('  red button box', JSON.stringify(b3)); await p.touchscreen.tap(b3.x + b3.width / 2, b3.y + b3.height / 2); await sleep(800); }
    console.log('  after picking a colour:', JSON.stringify(await p.evaluate(() => ({pool:S.pool, petal:S.bf.some(x => cname(x) === 'Lotus Petal'), log:S.log.slice(-2).map(e => e.s)}))));
    await snap(p, 'petal-done'); }
  const mireSel = await p.evaluate(() => { const c = S.bf.find(x => cname(x) === 'Bloodstained Mire'); return `#bf [data-id="${c.id}"]`; });
  const el = await p.$(mireSel); console.log('  Mire on screen:', !!el, el && JSON.stringify(await el.boundingBox()));
  if (el){ await p.evaluate(sel => document.querySelector(sel).scrollIntoView({block:'center'}), mireSel); await sleep(300); const bm = await el.boundingBox(); await p.touchscreen.tap(bm.x + bm.width / 2, bm.y + 12); await sleep(900); await snap(p, 'tap-mire');
    const menu = await p.evaluate(() => ({modal:UI.modal && [UI.modal.type, UI.modal.title, (UI.modal.options || []).map(o => o.label)], menu:[...document.querySelectorAll('.cmenu button, #cardMenu button, .menu button')].filter(b => b.offsetParent).map(b => b.textContent.trim()).slice(0, 12), tapped:S.bf.find(x => cname(x) === 'Bloodstained Mire')?.tap, log:S.log.slice(-3).map(e => e.s)}));
    console.log('  after tapping the Mire:', JSON.stringify(menu));
    console.log('  Mire menu buttons:', JSON.stringify(await p.evaluate(() => [...document.querySelectorAll('#menu button')].slice(0, 5).map(b => [b.dataset.act, b.textContent.trim().slice(0, 60)]))));
    await p.evaluate(() => { window.__want = ['Volcanic Island']; const m = () => { const md = UI.modal; if (md && md.type === 'pick' && md.resolve){ const c = (md.cards || []).find(x => cname(x) === 'Volcanic Island'); if (c){ md.resolve([c.id]); closeModal(); return; } } setTimeout(m, 200); }; m(); });
    const ab = await p.$('#menu button[data-act="actAb"], #menu button[data-act="ab"], #menu button[data-act="activate"], #menu button[data-act="ability"]');
    if (ab && await ab.boundingBox()){ const bb2 = await ab.boundingBox(); await p.touchscreen.tap(bb2.x + bb2.width / 2, bb2.y + bb2.height / 2); await sleep(2500); }
    await snap(p, 'mire-search');
    console.log('  search modal:', JSON.stringify(await p.evaluate(() => UI.modal ? {type:UI.modal.type, title:UI.modal.title, n:(UI.modal.cards || []).length, names:(UI.modal.cards || []).map(cname).slice(0, 8), vi:S.lib.some(c => cname(c) === 'Volcanic Island')} : {none:true, vi:S.lib.findIndex(c => cname(c) === 'Volcanic Island'), libN:S.lib.length})));
    console.log('  after the Mire ability:', JSON.stringify(await p.evaluate(() => ({bf:S.bf.map(cname), life:S.life, log:S.log.slice(-4).map(e => e.s)})))); }
  await snap(p, 'after-mire');
  // modes on a phone: Farewell, pick two then "That's all"
  { await p.evaluate(() => { S.stk = []; const c = S.lib.find(x => cname(x) === 'Farewell') || S.gy.find(x => cname(x) === 'Farewell'); if (c){ S.lib.splice(S.lib.indexOf(c), 1); S.hand.push(c); } S.pool = {...emptyPool(), W:2, C:4}; commit(); beginCast(S.hand.find(x => cname(x) === 'Farewell'), 'hand'); });
    await sleep(900); await snap(p, 'modes-1');
    const tapBtn = async re => { for (const b of await p.$$('#modal button')){ const t = (await b.textContent()).trim(); if (re.test(t)){ await b.scrollIntoViewIfNeeded(); const bb = await b.boundingBox(); await p.touchscreen.tap(bb.x + bb.width / 2, bb.y + bb.height / 2); await sleep(700); return t; } } return null; };
    const a = await tapBtn(/artifacts/); const b = await tapBtn(/graveyards/); await snap(p, 'modes-2'); const c = await tapBtn(/^Done/);
    console.log('  modes on phone:', JSON.stringify({a, b, c, stack:await p.evaluate(() => stackAll().map(i => i.nm + ' ' + JSON.stringify(i.modes || null))), modal:await p.evaluate(() => UI.modal && UI.modal.title)})); }
  fs.writeFileSync(`${OUT}/errors.txt`, errs.join('\n'));
  console.log('page errors:', errs.length);
  await browser.close(); server.close(); process.exit(0);
})().catch(e => { console.log('FATAL', e); process.exit(1); });
