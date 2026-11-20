const {chromium} = require('playwright'); const path = require('path'); const fs = require('fs');
const {cards} = require('./cards');
const byName = new Map(cards.map(c => [c.name.toLowerCase(), c])); const byId = new Map(cards.map(c => [c.id, c]));
const FILE = 'file://' + path.resolve(__dirname, '../proxy-table.html');
let fails = 0; const check = (ok, m) => { console.log((ok ? '  ✓ ' : '  ✗ ') + m); if (!ok) fails++; };
const deck = 'Commander\n1 Krenko, Mob Boss\n\nDeck\n1 Goblin Warchief\n1 Siege-Gang Commander\n1 Impact Tremors\n1 Rootbound Crag\n1 Stomping Ground\n40 Mountain\n';
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({viewport:{width:1400, height:900}}); const p = await ctx.newPage();
  p.on('pageerror', e => check(false, 'page error ' + e.message));
  await p.route('**/*', async r => { const u = r.request().url(); if (u.startsWith('file:')) return r.continue();
    if (u.includes('cards/collection')){ const ids = JSON.parse(r.request().postData()).identifiers; return r.fulfill({status:200, contentType:'application/json', body:JSON.stringify({data:ids.map(i => i.id ? byId.get(i.id) : byName.get(i.name.toLowerCase())).filter(Boolean)})}); }
    if (u.includes('cards/search')) return r.fulfill({status:200, contentType:'application/json', body:JSON.stringify({data:[cards[0]]})});
    return r.abort(); });
  await p.goto(FILE); await p.fill('#deckIn', deck); await p.click('#loadBtn');
  await p.waitForFunction(() => /Deck ready/.test(document.querySelector('#deckStatus').textContent));
  await p.click('#soloBtn'); await p.click('[data-act="goFirst"]');
  await p.waitForFunction(() => phaseNow().ph === 3, null, {timeout:4000}).then(() => check(true, 'solo: straight to main phase'), () => check(false, 'solo: straight to main phase'));
  const r = await p.evaluate(async () => {
    const out = {};
    const g = n => { let c = S.hand.find(c => cname(c) === n); if (c) return c; const i = S.lib.findIndex(c => cname(c) === n); [c] = S.lib.splice(i, 1); S.hand.push(c); return c; };
    // Rootbound Crag with no Mountain: tapped. Then with a Mountain: untapped
    const crag = g('Rootbound Crag'); playLand(crag); out.cragTapped = crag.tap;
    S.landT = ['', 0]; const sg = g('Stomping Ground'); playLand(sg); await new Promise(r => setTimeout(r, 200));
    out.shockAsk = UI.modal && UI.modal.type === 'choice';
    ACT.choose({dataset:{i:'0'}}); await new Promise(r => setTimeout(r, 100)); out.shockUntapped = !sg.tap; out.life = S.life;
    // Warchief reduces Siege-Gang by 1 and gives haste
    const wc = g('Goblin Warchief'); moveCard(wc.id, 'bf', {quiet:true});
    const sgc = g('Siege-Gang Commander'); out.sgCost = costStr(spellCost(sgc, 'hand').cost);
    const tr = g('Impact Tremors'); moveCard(tr.id, 'bf', {quiet:true});
    S.pool = {...emptyPool(), R:4}; await beginCast(sgc, 'hand', {});
    for (let i = 0; i < 60 && (stackAll().length || UI.resolving); i++) await new Promise(r => setTimeout(r, 100));
    out.tokens = S.bf.filter(c => c.tok).reduce((a, c) => a + (c.n || 1), 0);
    out.hasteTok = hasHaste(S.bf.find(c => c.tok)) === true;
    // Krenko from the command zone: cost includes no tax first time
    const kr = S.cz[0]; out.krCost = costStr(spellCost(kr, 'cz').cost);
    S.pool = {...emptyPool(), R:3}; await beginCast(kr, 'cz', {});
    for (let i = 0; i < 60 && (stackAll().length || UI.resolving); i++) await new Promise(r => setTimeout(r, 100));
    const k = S.bf.find(c => cname(c) === 'Krenko, Mob Boss'); out.krOnBf = !!k; out.tax = S.tax[kr.k];
    out.stackLeft = stackAll().map(i => i.nm); out.log0 = S.log.slice(-10).map(e => e.s); if (!k) return out; const ab = abilityList(k)[0]; out.krAb = ab && ab.cost; out.krReady = abilityReady(k, ab, false);
    await activateAbility(k, ab);
    for (let i = 0; i < 60 && (stackAll().length || UI.resolving); i++) await new Promise(r => setTimeout(r, 100));
    out.tokens2 = S.bf.filter(c => c.tok).reduce((a, c) => a + (c.n || 1), 0);
    out.log = S.log.slice(-6).map(e => e.s);
    return out;
  });
  console.log(r);
  check(r.cragTapped === true, 'check land enters tapped with no Mountain/Forest');
  check(r.shockAsk && r.shockUntapped && r.life === 38, 'shock land asks to pay 2 life');
  check(r.sgCost === '{2}{R}{R}', 'Goblin Warchief reduces Siege-Gang to ' + r.sgCost);
  check(r.tokens === 3 && r.hasteTok, 'Siege-Gang made 3 goblins with haste from Warchief');
  check(r.krCost === '{1}{R}{R}' && r.krOnBf && r.tax === 1, 'Krenko cast from the command zone, tax counter now 1');
  check(r.krReady === '', 'Krenko can tap right away (Warchief haste): ' + r.krReady);
  check(r.tokens2 === 3 + 6, 'Krenko made X = 6 goblins (Krenko, Warchief, Siege-Gang, 3 tokens): ' + r.tokens2);
  await p.reload(); await p.click('#resumeBtn');
  const after = await p.evaluate(() => ({ph:phaseNow().ph, bf:S.bf.length}));
  check(after.ph === 3 && after.bf > 5, 'resume after reload keeps phase and board');
  await p.screenshot({path:'shot-solo.png'});
  await b.close(); console.log(fails ? fails + ' failed' : 'all passed'); process.exit(fails ? 1 : 0);
})();
