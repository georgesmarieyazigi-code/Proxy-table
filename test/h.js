const {chromium} = require('playwright');
const path = require('path');
const fs = require('fs');
const {cards} = require('./cards');
const aedes = require('aedes')();
const http = require('http');
const ws = require('websocket-stream');

const FILE = 'file://' + path.resolve(__dirname, '../' + (process.env.PTFILE || 'proxy-table.html'));
const MQTT_JS = fs.readFileSync(path.join(__dirname, 'node_modules/mqtt/dist/mqtt.min.js'), 'utf8');
const results = []; let fails = 0;
const check = (ok, msg) => { results.push((ok ? 'PASS ' : 'FAIL ') + msg); if (!ok) fails++; console.log((ok ? '  ✓ ' : '  ✗ ') + msg); };
const PORT = +(process.env.PTPORT || 8888);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const byName = new Map(cards.flatMap(c => [[c.name.toLowerCase(), c], [c.name.split(" // ")[0].toLowerCase(), c]]));
const byId = new Map(cards.map(c => [c.id, c]));

exports.deckA = undefined; const deckA = 'Commander\n1 Krenko, Mob Boss\n\nDeck\n' + cards.filter(c => !/Token|Krenko|Thalia/.test(c.type_line + c.name)).map(c => '1 ' + c.name).join('\n') + '\n20 Mountain\n10 Island\n';
const deckB = 'Commander\n1 Thalia, Guardian of Thraben\n\nDeck\n' + cards.filter(c => !/Token|Thalia|Krenko/.test(c.type_line + c.name)).map(c => '1 ' + c.name).join('\n') + '\n20 Island\n10 Swamp\n';

async function route(page){
  await page.route('**/*', async r => {
    const u = r.request().url();
    if (u.startsWith('file:')) return r.continue();
    if (u.includes('unpkg.com/mqtt')) return r.fulfill({status:200, contentType:'application/javascript', body:MQTT_JS});
    if (process.env.REAL && /api\.scryfall\.com|scryfall\.io|cloudfront\.net|fonts\.g/.test(u)) return r.continue();
    if (u.includes('api.scryfall.com/cards/collection')){
      const ids = JSON.parse(r.request().postData()).identifiers;
      const data = ids.map(i => i.id ? byId.get(i.id) : byName.get(String(i.name || '').toLowerCase())).filter(Boolean);
      return r.fulfill({status:200, contentType:'application/json', body:JSON.stringify({data})});
    }
    if (u.includes('api.scryfall.com/cards/search')){
      const q = decodeURIComponent(u);
      return r.fulfill({status:200, contentType:'application/json', body:JSON.stringify({data: /Goblin/.test(q) ? [cards[0]] : []})});
    }
    if (u.includes('api.scryfall.com/cards/named')){
      const q = new URL(u).searchParams; const n = String(q.get('exact') || q.get('fuzzy') || '').toLowerCase(); const c = byName.get(n);
      return c ? r.fulfill({status:200, contentType:'application/json', body:JSON.stringify(c)}) : r.fulfill({status:404, contentType:'application/json', body:JSON.stringify({object:'error', status:404})});
    }
    if (u.includes('api.scryfall.com/cards/autocomplete')){
      const q = String(new URL(u).searchParams.get('q') || '').toLowerCase();
      return r.fulfill({status:200, contentType:'application/json', body:JSON.stringify({object:'catalog', data:[...new Set(cards.map(c => c.name))].filter(n => n.toLowerCase().includes(q)).slice(0, 20)})});
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
  await ctx.addInitScript((port) => { window.__PTB = 'ws://localhost:' + port; window.PT_BROKERS = [window.__PTB || 'ws://localhost:8888']; window.PT_RESP_MS = 1500; }, PORT);
  const page = await ctx.newPage();
  page.on('pageerror', e => { console.log(`[${name} pageerror]`, e.message, (e.stack || '').split('\n').slice(1, 4).join(' <- ')); check(false, `${name}: no page errors (${e.message})`); });
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
async function pass(p){ await p.waitForSelector('#stackpanel [data-act="passPrio"]', {timeout:5000}); await p.click('#stackpanel [data-act="passPrio"]'); }
async function waitFor(p, fn, arg, ms = 6000){ try { await p.waitForFunction(fn, arg, {timeout:ms}); return true; } catch { return false; } }
const stackEmpty = p => waitFor(p, () => stackAll().length === 0);


module.exports = {PORT, route, FILE, chromium, check, sleep, cards, player, ev, st, give, put, setPool, bfId, handId, menuClick, choose, pass, waitFor, stackEmpty, results, aedes, http, ws, deckFor, fails:()=>fails};
function deckFor(cmd){ return 'Commander\n1 ' + cmd + '\n\nDeck\n' + cards.filter(c => !/Token/.test(c.type_line) && c.name !== cmd).map(c => '1 ' + c.name).join('\n') + '\n15 Mountain\n10 Island\n10 Swamp\n10 Plains\n'; }
