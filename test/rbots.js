// rbots.js: bot players (stage 1). Playwright, real games, the fuzz.js invariant checker in every client.
// Usage: cd test && PTFILE=devBots.html PTPORT=19950 node rbots.js            (all parts)
//        ONLY=1v1,pod,mqtt,strength,hidden  GAMES=20 PAR=2 FMT=duel  (strength: number of games, parallel games, format)
process.env.ALL = '1';
const H = require('./h'); const fs = require('fs'); const path = require('path');
const ONLY = (process.env.ONLY || '1v1,pod,mqtt,hidden,strength').split(',');
const clean = t => t.split('\n').map(l => l.replace(/\s*\([A-Z0-9]{2,6}\)\s*[\w★-]*\s*(\*F\*)?\s*$/, '')).join('\n');
const realDeck = n => clean(fs.readFileSync(path.join(__dirname, '../decks/' + n + '.txt'), 'utf8'));
// all.json is sorted by EDHREC popularity: give the mock cards their rank so the card-role values use it
H.cards.forEach(c => { if (c.set === 'top' && !c.edhrec_rank) c.edhrec_rank = +c.collector_number - 999; });
// reuse fuzz.js: its random-but-legal player (our "scripted human") and its invariant checker (conservation, numbers, stuck dialogs)
const FZSRC = fs.readFileSync(path.join(__dirname, 'fuzz.js'), 'utf8');
const BOTSRC = FZSRC.slice(FZSRC.indexOf('function BOT(arg){'), FZSRC.indexOf('\n// ---------- Scryfall token search mock')).replace('try { await step(); }', 'try { if (!window.__FZNOSTEP) await step(); }');
const {tokenSearch} = new Function(FZSRC.slice(FZSRC.indexOf('const PRE = {'), FZSRC.indexOf('\n// ---------- one game')) + '\nreturn {tokenSearch};')();
const {randomDeck, rng} = new Function('H', FZSRC.slice(FZSRC.indexOf('function rng(seed)'), FZSRC.indexOf('// ---------- the bot and the invariant checker')) + '\nreturn {randomDeck, rng};')(H);
if (!/__FZNOSTEP/.test(BOTSRC)) throw new Error('could not adapt fuzz.js BOT');
const withT = (p, ms, what) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout: ' + what)), ms))]);
const step = async (what, ms, fn) => { try { return await withT(fn(), ms, what); } catch (e){ H.check(false, what + ': ' + e.message.split('\n')[0]); return null; } };
const botFrames = p => p.frames().filter(f => /[?&]ptbot=/.test(f.url()));

async function newPage(browser, o = {}){
  const ctx = await browser.newContext({viewport:{width:1400, height:900}});
  await ctx.addInitScript(port => { window.PT_BROKERS = ['ws://localhost:' + port]; window.PT_RESP_MS = 1500; }, H.PORT);
  const page = await ctx.newPage(); page.__errs = [];
  page.on('pageerror', e => { page.__errs.push(e.message); console.log('  [pageerror]', e.message); });
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|net::ERR|WebSocket/.test(m.text())) console.log('  [console]', m.text().slice(0, 200)); });
  await H.route(page); await page.route('**/api.scryfall.com/cards/search**', tokenSearch);
  if (o.offline) await page.route('**/unpkg.com/**', r => r.abort());
  await page.goto(H.FILE);
  return page;
}
async function loadSave(page, name, text){
  await page.evaluate(() => lobbyPage('decks'));
  await page.fill('#deckIn', text); await page.click('#loadBtn');
  await page.waitForFunction(() => /Deck ready/.test(document.querySelector('#deckStatus').textContent), null, {timeout:60000});
  await page.evaluate(n => { LOBBY.deckName = n; const i = document.querySelector('#deckNameIn'); if (i) i.value = n; }, name);
  const b = await page.$('[data-act="saveDeck"]'); if (b && await b.isVisible()) await b.click(); else await page.evaluate(() => saveDeck());
  return page.evaluate(n => savedDecks().find(r => r.name === n)?.id, name);
}
async function waitBots(page, n, ms = 60000){
  return H.waitFor(page, n => BOTHOST.bots.length === n && BOTHOST.bots.every(b => b.st && b.st.kept && b.st.pid) && OPP.size >= n, n, ms);
}
async function injectCheckers(page, seed, human){
  if (human) await page.evaluate(`(${BOTSRC})(${JSON.stringify({seed})})`);
  for (const f of botFrames(page)) await f.evaluate(`window.__FZNOSTEP = 1; (${BOTSRC})(${JSON.stringify({seed:seed + 1})})`);
}
// run until turn >= turns (or the game ends), watching for stalls; returns the last turn
async function runTurns(pages, turns, maxS){
  const t0 = Date.now(); let last = 0, lastT = Date.now(), status = '';
  while (true){
    await H.sleep(2000);
    const ts = await Promise.all(pages.map(p => p.evaluate(() => ({turn:currentTurn()[0], lost:!!(S.lost || S.j18out), opps:[...OPP.values()].map(o => !!o.b27lost)})).catch(() => ({turn:0}))));
    const turn = Math.max(...ts.map(x => x.turn || 0));
    if (turn !== last){ last = turn; lastT = Date.now(); process.stdout.write(` t${turn}`);
      if (process.env.SHOTDIR){ try { fs.mkdirSync(process.env.SHOTDIR, {recursive:true}); H.__shot = (H.__shot || 0) + 1; await pages[0].screenshot({path:`${process.env.SHOTDIR}/game${String(H.__shot).padStart(3, '0')}-t${turn}.png`}); } catch {} } }
    const over = ts.some(x => x.lost && x.opps && x.opps.length <= 1) || ts.some(x => x.opps && x.opps.length && x.opps.every(Boolean) && x.opps.length === 1);
    if (turn >= turns){ status = 'done'; break; }
    if (over){ status = 'game over'; break; }
    if (Date.now() - lastT > 120000){ status = 'stalled'; break; }
    if (Date.now() - t0 > maxS * 1000){ status = 'time limit'; break; }
  }
  process.stdout.write('\n');
  return {turn:last, status};
}
// everything the checkers saw, from the human page and every bot frame
async function collect(page){
  const out = {viol:[], cerr:[], botErr:[], bot:[], byhand:[]};
  const clients = [page, ...botFrames(page)];
  for (const c of clients){
    const d = await c.evaluate(() => ({nm:S && S.nm, viol:window.__FZ ? __FZ.viol : [], cerr:window.__FZ ? Object.values(__FZ.cerr) : [], botErr:window.__FZ ? __FZ.botErr.slice(0, 5) : [],
      bot:typeof BOT !== 'undefined' && BOT.cfg ? {nm:S.nm, level:BOT.cfg.level, tally:BOT.tally, errs:BOT.errs.slice(0, 5), peeks:BOT.peeks.slice(0, 5), notes:BOT.notes, acts:BOT.acts.slice(), n:BOT.n} : null,
      log:S ? S.log.map(e => e.s) : []})).catch(e => ({err:e.message}));
    if (d.err){ out.botErr.push(d.err); continue; }
    d.viol.forEach(v => out.viol.push({who:d.nm, ...v})); d.cerr.forEach(e => out.cerr.push({who:d.nm, ...e})); out.botErr.push(...d.botErr);
    if (d.bot) out.bot.push({...d.bot, log:d.log});
  }
  return out;
}
function judge(tag, page, c, res){
  const conserv = c.viol.filter(v => v.kind === 'conservation'); const stuck = c.viol.filter(v => v.kind === 'stuck');
  const uncaught = c.cerr.filter(e => e.kind === 'uncaught' || e.kind === 'rejection');
  H.check(page.__errs.length === 0 && uncaught.length === 0, `${tag}: 0 page errors (${page.__errs.length} + ${uncaught.length} in frames${uncaught[0] ? ': ' + uncaught[0].msg : ''})`);
  H.check(conserv.length === 0, `${tag}: 0 card-conservation violations${conserv[0] ? ' — ' + conserv[0].msg : ''}`);
  H.check(stuck.length === 0 && res.status !== 'stalled', `${tag}: no stalls (${res.status}${stuck[0] ? ', ' + stuck[0].msg : ''})`);
  const be = c.bot.flatMap(b => b.errs.map(e => b.nm + ': ' + e));
  H.check(be.length === 0, `${tag}: bots made no internal errors${be[0] ? ' — ' + be[0].slice(0, 160) : ''}`);
  H.check(c.bot.every(b => !b.peeks.length), `${tag}: no bot looked outside its own seat (runtime trap)`);
  const other = c.viol.filter(v => !['conservation', 'stuck', 'info'].includes(v.kind));
  if (other.length) console.log(`  (info) ${other.length} other checker reports, e.g. ${other.slice(0, 3).map(v => v.kind + ': ' + v.msg.slice(0, 90)).join(' | ')}`);
  const notes = c.bot.reduce((s, b) => s + b.notes, 0); if (notes) console.log(`  (info) bots skipped ${notes} do-by-hand note(s)`);
}

async function oneVsOne(browser, level, seed){
  console.log(`\n== 1v1: scripted human vs ${level}`);
  const page = await newPage(browser);
  const ids = await step('load and save decks', 120000, async () => ({human:await loadSave(page, 'Elminster + Rhystic', realDeck('elminster') + '\n1 Rhystic Study\n'), bot:await loadSave(page, 'Edgar', realDeck('edgar'))}));
  if (!ids) return;
  // the lobby: my deck is Elminster (+ Rhystic Study); one bot, chosen level, the Edgar deck
  await step('start from the lobby UI', 60000, async () => {
    await page.evaluate(id => ACT.loadSaved({dataset:{id}}), ids.human);
    await page.fill('#nameIn', 'Georges');
    await page.evaluate(() => lobbyPage('play'));
    await page.click('#botPanel [data-botn="2"]');
    await page.selectOption('#botPanel [data-seat="0"] [data-botf="level"]', level);
    await page.selectOption('#botPanel [data-seat="0"] [data-botf="deck"]', 'saved:' + ids.bot);
    await page.fill('#botPanel [data-seat="0"] [data-botf="name"]', 'Bot ' + level);
    await page.evaluate(() => { BOTUI.speed = 0.15; });
    await page.click('#botStart');
    await page.waitForSelector('#game:not([hidden])', {timeout:20000});
  });
  H.check(await waitBots(page, 1), `${level}: the bot sat down and decided on its opening hand`);
  const mull = await botFrames(page)[0].evaluate(() => S.log.map(e => e.s).find(s => /keeps \d+ cards/.test(s)) || '');
  H.check(!!mull, `${level}: the bot made a mulligan decision ("${mull}")`);
  // like fuzz.js's BOOST: both sides start with 3 basic lands; the bot also gets two creatures (fliers first) and I get two ground creatures,
  // so the bot has safe attacks and I have something to attack it with
  const boost = (o) => { const mv = c => { moveCard(c.id, 'bf', {quiet:true}); const b = S.bf.find(x => x.id === c.id); if (b){ b.tap = false; b.sk = false; } };
    let k = 0; for (const c of S.lib.slice()){ if (k >= 3) break; if (/Basic Land/.test(info(c.k)?.t || '')){ mv(c); k++; } }
    const crs = S.lib.filter(c => /Creature/.test(info(c.k)?.t || '') && !/Legendary/.test(info(c.k)?.t || '') && (info(c.k)?.mv || 0) <= 4);
    const fly = c => /\bFlying\b/i.test(info(c.k)?.o || '');
    crs.sort((a, b) => o.fly ? fly(b) - fly(a) : fly(a) - fly(b)).slice(0, 2).forEach(mv); commit(); };
  await page.evaluate(`(${boost})({fly:false})`); await botFrames(page)[0].evaluate(`(${boost})({fly:true})`);
  H.check(await H.put(page, 'Rhystic Study'), `${level}: Rhystic Study is on my battlefield`);
  await injectCheckers(page, seed, true);
  await page.click('[data-act="goFirst"]');
  const res = await runTurns([page], +(process.env.TURNS1 || 11), 600);
  const c = await collect(page); const b = c.bot[0] || {acts:[], log:[]};
  H.check(res.turn >= 10 || res.status === 'game over', `${level}: ran ${res.turn} turns (${res.status})`);
  const T = b.tally || {}; console.log('  bot tally: ' + JSON.stringify(T));
  H.check(T.land > 0, `${level}: the bot played lands (${T.land})`);
  H.check(T.cast > 0, `${level}: the bot cast spells (${T.cast})`);
  H.check(T.attack > 0, `${level}: the bot attacked (${T.attack} times, ${T.attackers} attackers)`);
  H.check(T.block > 0, `${level}: the bot declared blocks when attacked (${T.block} times, ${T.blockers} blockers)`);
  const rh = b.log.filter(s => /Rhystic Study/.test(s) && /paid|didn't pay/.test(s));
  console.log(`  (info) Rhystic Study during the game: ${rh.length ? rh.join(' | ') : 'the bot was not asked (my random player declined the draw)'}`);
  // cross-player prompts on the bot's own screen, asked directly so the check doesn't depend on the random game
  await page.evaluate(() => { if (window.__FZ) __FZ.on = false; });
  const fr = botFrames(page)[0]; const bpid = await fr.evaluate(() => MYPID);
  const t0 = Date.now(); const paid = await step('Rhystic pay-or-not', 70000, () => page.evaluate(pid => askOpponentPay(pid, '{1}', 'Rhystic Study'), bpid));
  const pl = await fr.evaluate(() => S.log.map(e => e.s).filter(s => /\(Rhystic Study\)/.test(s)).pop() || '');
  H.check(paid !== null && Date.now() - t0 < 20000 && /paid|didn't pay/.test(pl), `${level}: the bot answered "Rhystic Study: pay {1}?" on its own screen in ${((Date.now() - t0) / 1000).toFixed(1)} s (${pl})`);
  const vote = await step('vote', 40000, () => page.evaluate(pid => q24Ask(pid, {kind:'choice', title:'vote for a player', opts:['Georges', 'the bot']}, "Council's Judgment"), bpid));
  H.check(vote === '0' || vote === '1', `${level}: the bot cast a vote on its own screen (option ${vote})`);
  const before = await fr.evaluate(() => ({hand:S.hand.length, bf:S.bf.reduce((n, c) => n + (c.n || 1), 0)}));
  await page.evaluate(pid => { sendRq(pid, 'discard', 1, 'Mind Rot'); sendRq(pid, 'sac', 1, 'Fleshbag Marauder', {d:'permanent'}); commit(); }, bpid);
  const ok = await H.waitFor(fr, b => S.prm.length === 0 && S.hand.length === Math.max(0, b.hand - 1) && S.bf.reduce((n, c) => n + (c.n || 1), 0) === Math.max(0, b.bf - 1), before, 30000);
  H.check(ok, `${level}: the bot chose a discard and a sacrifice for another player's spells (hand/permanents ${before.hand}/${before.bf} → ${JSON.stringify(await fr.evaluate(() => [S.hand.length, S.bf.reduce((n, c) => n + (c.n || 1), 0), S.prm.length]))})`);
  if (process.env.DUMP){ console.log(b.log.join('\n')); console.log(b.acts.join('\n')); }
  judge(level + ' 1v1', page, c, res);
  console.log(`  bot actions: ${b.n}; last: ${b.acts.slice(-4).join(' · ')}`);
  await page.context().close();
}

async function pod(browser, seed){
  console.log('\n== 4-player pod, offline: scripted human + Easy + Intermediate + Intermediate (network blocked)');
  const page = await newPage(browser, {offline:true});
  H.check(await page.evaluate(() => typeof mqtt === 'undefined'), 'pod: the multiplayer library is blocked (no internet)');
  const ids = await step('load and save decks', 180000, async () => ({edgar:await loadSave(page, 'Edgar', realDeck('edgar')), elm:await loadSave(page, 'Elminster', realDeck('elminster')), gaa:await loadSave(page, 'GAA', realDeck('gaa')), bf:await loadSave(page, 'Blue Farm', realDeck('bluefarm'))}));
  if (!ids) return;
  await page.route('**/*', r => r.request().url().startsWith('file:') ? r.continue() : r.abort());     // from here on nothing leaves the page
  await step('start a 4-player pod', 60000, async () => {
    await page.evaluate(id => ACT.loadSaved({dataset:{id}}), ids.edgar);
    await page.fill('#nameIn', 'Georges'); await page.evaluate(() => lobbyPage('play'));
    await page.click('#botPanel [data-botn="4"]');
    const seats = [['easy', ids.elm], ['intermediate', ids.gaa], ['intermediate', 'randomPool']];
    for (let i = 0; i < 3; i++){ await page.selectOption(`#botPanel [data-seat="${i}"] [data-botf="level"]`, seats[i][0]); await page.selectOption(`#botPanel [data-seat="${i}"] [data-botf="deck"]`, seats[i][1].length > 12 || /^random/.test(seats[i][1]) ? seats[i][1] : 'saved:' + seats[i][1]); }
    await page.evaluate(() => { BOTUI.speed = 0.1; });
    await page.click('#botStart'); await page.waitForSelector('#game:not([hidden])', {timeout:20000});
  });
  H.check(await waitBots(page, 3, 90000), 'pod: three bots sat down and kept their hands');
  const lv = await page.evaluate(() => BOTHOST.bots.map(b => b.cfg.level + ':' + b.cfg.deckName));
  console.log('  bots:', lv.join(' | '));
  H.check(await page.evaluate(() => NET.clients.length === 1 && NET.clients[0].__loop === true), 'pod: the table runs on the loopback relay');
  await injectCheckers(page, seed, true);
  await page.click('[data-act="goFirst"]');
  const t0 = Date.now(); const cpu0 = process.cpuUsage();
  const res = await runTurns([page], +(process.env.TURNSP || 16), 900);
  const c = await collect(page);
  H.check(res.turn >= 8 || res.status === 'game over', `pod: ran ${res.turn} turns (${res.status}) in ${Math.round((Date.now() - t0) / 1000)} s`);
  c.bot.forEach(b => H.check(b.n > 20 && /\bplayed\b/.test(b.log.join('\n')), `pod: ${b.nm} (${b.level}) took part (${b.n} actions)`));
  judge('pod', page, c, res);
  const mem = await page.evaluate(() => performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1e6) : 0);
  console.log(`  host page JS heap ~${mem} MB; ${c.bot.length} bot frames`);
  await page.context().close();
}

async function mixed(browser, seed){
  console.log('\n== MQTT table (local broker): 2 humans + 1 bot added from the Game menu');
  const a = await newPage(browser), b = await newPage(browser);
  const code = 'rb-' + (Date.now() % 100000);
  await step('two humans sit at an MQTT table', 120000, async () => {
    for (const [p, nm, mode] of [[a, 'Ana', 'host'], [b, 'Ben', 'join']]){
      await p.fill('#deckIn', realDeck(nm === 'Ana' ? 'edgar' : 'elminster')); await p.click('#loadBtn');
      await p.waitForFunction(() => /Deck ready/.test(document.querySelector('#deckStatus').textContent), null, {timeout:60000});
      await p.evaluate(() => saveDeck());
      await p.fill('#nameIn', nm); await p.fill('#codeIn', code); await p.click(mode === 'host' ? '#hostBtn' : '#joinBtn'); await p.waitForSelector('#game:not([hidden])');
    }
  });
  H.check(await H.waitFor(a, () => OPP.size === 1, null, 20000), 'mqtt: the two humans see each other');
  await step('add a bot from the Game menu', 30000, async () => {
    await a.click('[data-act="gameMenu"]'); await a.click('#menu [data-act="botAddMenu"]');
    await H.choose(a, /^Intermediate/);
  });
  H.check(await H.waitFor(a, () => BOTHOST.bots.length === 1 && BOTHOST.bots[0].st.kept && OPP.size === 2, null, 60000), 'mqtt: the bot joined the table through the relay');
  H.check(await H.waitFor(b, () => OPP.size === 2, null, 20000), 'mqtt: the other human sees the bot too');
  H.check(await a.evaluate(() => BOTHOST.bots[0].cfg.net === 'mqtt'), 'mqtt: the bot uses MQTT, not the loopback relay');
  await injectCheckers(a, seed, true); await injectCheckers(b, seed + 50, true);
  await a.click('[data-act="goFirst"]');
  const res = await runTurns([a, b], +(process.env.TURNSM || 7), 600);
  H.check(res.turn >= 6 || res.status === 'game over', `mqtt: ran ${res.turn} turns (${res.status})`);
  const ca = await collect(a), cb = await collect(b);
  // sync: what each human sees of the bot = the bot's own state
  const bf = botFrames(a)[0]; const own = await bf.evaluate(() => ({pid:MYPID, life:S.life, hc:S.hand.length, bf:S.bf.map(c => c.id).sort((x, y) => x - y).join(',')}));
  await H.sleep(1500);
  const seen = await Promise.all([a, b].map(p => p.evaluate(pid => { const o = OPP.get(pid); return o && {life:o.life, hc:o.hc, bf:(o.bf || []).map(c => c.id).sort((x, y) => x - y).join(',')}; }, own.pid)));
  H.check(seen.every(s => s && s.life === own.life && s.hc === own.hc), `mqtt: both humans see the bot's life and hand size correctly (${own.life}/${own.hc})`);
  judge('mqtt A', a, ca, res); judge('mqtt B', b, {...cb, bot:[]}, res);
  await a.context().close(); await b.context().close();
}

async function hidden(browser){
  console.log('\n== hidden information');
  // structural: the decision code (levels, card roles, the view and helpers) never names anything outside its own seat
  const src = fs.readFileSync(path.join(__dirname, '../src/bots.js'), 'utf8');
  const view = src.slice(src.indexOf('/* ---- the view a level decides from'), src.indexOf('/* ---- the driver ---- */'));
  const helpers = src.slice(src.indexOf('/* ---------------------------------------------------------------- 5.'));
  const levels = fs.readFileSync(path.join(__dirname, '../src/botlevels.js'), 'utf8'), roles = fs.readFileSync(path.join(__dirname, '../src/cardroles.js'), 'utf8');
  const code = [view, helpers, levels, roles].join('\n').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  const FORBID = [[/\bparent\b/, 'window.parent'], [/\btop\s*\.|\btop\b(?=\s*[\[)])/, 'window.top'], [/\bframes\b/, 'frames'], [/\bopener\b/, 'opener'], [/localStorage|sessionStorage|indexedDB|store\.get/, 'storage'],
    [/postMessage|BroadcastChannel/, 'messaging'], [/BOTHOST|PTLOOP|\.cfg\.deck\b/, 'the host / other bots'], [/S\.lib\s*\[|S\.lib\.(?!length)/, 'my library order'], [/OPP\.get\([^)]*\)\s*\.\s*(?:hand|lib)\b|\.hand\b(?=[^\n]*\bOPP\b)/, "another player's hand or library"],
    [/\.lib\b(?!\.length|N)/, 'a library']];
  for (const [re, what] of FORBID){ const m = code.match(re); H.check(!m, `hidden info (structural): decision code never touches ${what}${m ? ' — found "' + m[0] + '"' : ''}`); }
  // runtime: the trap in a bot frame records any look outside its window while deciding (positive control), and a live game records none
  const page = await newPage(browser);
  await step('load a deck', 60000, () => loadSave(page, 'Edgar', realDeck('edgar')));
  await page.evaluate(() => ACT.loadSaved({dataset:{id:savedDecks()[0].id}}));
  await page.evaluate(() => botsStartGame([{level:'intermediate', deck:'mine', name:'Watcher', speed:0}]));
  H.check(await waitBots(page, 1), 'hidden: bot seated');
  const fr = botFrames(page)[0];
  const ctl = await fr.evaluate(() => { const n0 = BOT.peeks.length; BOT.deciding = true; try { void window.parent; localStorage.getItem('pt.save'); } finally { BOT.deciding = false; } const n1 = BOT.peeks.length; BOT.peeks.splice(n0); return n1 - n0; });
  H.check(ctl === 2, `hidden (runtime trap): the trap fires on a deliberate peek (${ctl} of 2 recorded)`);
  // the human's private things are in their own page only: a bot's view has no hand, library or face-down identities of others
  const leak = await fr.evaluate(() => { const v = botView(); const s = JSON.stringify(v.opps, (k, x) => (k === 'k' && x == null) ? '∅' : x); return {hasHand:/"hand"|"lib"\b|"libList"/.test(s), keys:Object.keys(v.opps[0] || {})}; });
  H.check(!leak.hasHand, `hidden: a bot's view of an opponent is public state only (${leak.keys.join(', ')})`);
  await page.evaluate(() => { const c = S.hand[0]; if (c){ moveCard(c.id, 'bf', {quiet:true}); const b = S.bf.find(x => x.id === c.id); if (b){ b.fd = true; } commit(); } });
  await H.sleep(1500);
  const fd = await fr.evaluate(() => { const o = [...OPP.values()][0]; return (o.bf || []).filter(c => c.fd).map(c => c.k); });
  H.check(fd.length >= 1 && fd.every(k => k == null), `hidden: a face-down card reaches the bot without its identity (${JSON.stringify(fd)})`);
  await page.context().close();
}

async function strength(browser){
  const games = +(process.env.GAMES || 20), par = +(process.env.PAR || 2), fmt = process.env.FMT || 'duel', cap = +(process.env.CAP || 40);
  console.log(`\n== strength: Intermediate vs Easy, ${games} games, same deck both sides (${fmt}), seeded, think delay 0, ${par} at a time`);
  const DECKS = (process.env.SDECKS || 'random,random,edgar').split(',');
  let wins = 0, losses = 0, draws = 0, done = 0, turnsSum = 0, secsSum = 0; const rows = []; const TALLY = {};
  const cpu0 = process.cpuUsage(); const T0 = Date.now();
  async function game(i){
    const deck = DECKS[i % DECKS.length]; const interFirst = i % 2 === 0; const seed = 1000 + i;
    const page = await newPage(browser);
    try {
      await page.evaluate(f => setFmt(f), fmt);
      const rd = deck === 'random' ? randomDeck(rng(seed * 7919 + 1)) : null;
      await loadSave(page, rd ? rd.name : deck, rd ? rd.txt : realDeck(deck));
      await page.evaluate(() => ACT.loadSaved({dataset:{id:savedDecks()[0].id}}));
      await page.evaluate(f => setFmt(f), fmt);
      const seats = interFirst ? [{level:'intermediate', name:'Inter'}, {level:'easy', name:'Easy'}] : [{level:'easy', name:'Easy'}, {level:'intermediate', name:'Inter'}];
      const t0 = Date.now();
      await page.evaluate(([s, seed, f]) => botsStartGame(s.map(x => ({...x, deck:'mine', speed:0})), {watch:true, seed, fmt:f, first:0}), [seats, seed, fmt]);
      let res = 'draw', turn = 0, why = '';
      const deadline = Date.now() + 900000;
      while (Date.now() < deadline){
        await H.sleep(1500);
        const st = await page.evaluate(() => BOTHOST.bots.map(b => ({nm:b.cfg.name, lost:b.st.lost, turn:b.st.turn || 0, life:b.st.life, errs:b.st.errs})));
        turn = Math.max(...st.map(x => x.turn));
        const l = st.filter(x => x.lost);
        if (l.length){ res = l[0].nm === 'Inter' ? 'easy' : 'inter'; why = l.map(x => x.nm + ' lost at ' + x.life).join(', '); break; }
        if (turn > cap){ res = 'draw'; why = 'turn cap, life ' + st.map(x => x.nm + ' ' + x.life).join(' / '); break; }
      }
      const secs = Math.round((Date.now() - t0) / 1000);
      const errs = await page.evaluate(() => BOTHOST.bots.reduce((s, b) => s + (b.st.errs || 0), 0));
      for (const f of botFrames(page)){ const d = await f.evaluate(() => ({lv:BOT.cfg.level, T:BOT.tally})).catch(() => null); if (!d) continue; const t = TALLY[d.lv] = TALLY[d.lv] || {cast:0, atk:0, blk:0, land:0};
        const y = d.T || {}; t.cast += y.cast || 0; t.atk += y.attack || 0; t.blk += y.blockers || 0; t.land += y.land || 0; }
      if (res === 'inter') wins++; else if (res === 'easy') losses++; else draws++;
      done++; turnsSum += turn; secsSum += secs;
      rows.push(`  game ${i + 1} (${rd ? rd.name : deck}, ${interFirst ? 'Intermediate' : 'Easy'} first, seed ${seed}): ${res === 'inter' ? 'Intermediate won' : res === 'easy' ? 'Easy won' : 'draw'} at turn ${turn} in ${secs}s — ${why}${errs ? ` (${errs} bot errors)` : ''}${page.__errs.length ? ' PAGE ERRORS: ' + page.__errs[0] : ''}`);
      console.log(rows[rows.length - 1]);
      H.check(!page.__errs.length, `strength game ${i + 1}: no page errors`);
    } catch (e){ console.log('  game', i + 1, 'harness error', e.message.split('\n')[0]); draws++; done++; }
    finally { await page.context().close().catch(() => {}); }
  }
  let next = 0; await Promise.all(Array.from({length:par}, async () => { while (next < games){ const i = next++; await game(i); } }));
  const cpu = process.cpuUsage(cpu0); const wall = (Date.now() - T0) / 1000;
  const rate = wins / Math.max(1, done);
  console.log(`  RESULT: Intermediate ${wins} – Easy ${losses} – draws ${draws} of ${done}: win rate ${(rate * 100).toFixed(0)}%; avg ${(turnsSum / Math.max(1, done)).toFixed(1)} turns, ${(secsSum / Math.max(1, done)).toFixed(0)} s per game; wall ${Math.round(wall)} s`);
  console.log('  per level, all games: ' + Object.entries(TALLY).map(([k, t]) => `${k}: ${t.land} lands, ${t.cast} casts, ${t.atk} attacks, ${t.blk} blockers`).join(' · '));
  Object.entries(TALLY).forEach(([k, t]) => H.check(t.cast > 0 && t.atk > 0 && t.blk > 0, `strength: ${k} bots cast, attacked and blocked over the games`));
  H.check(done >= Math.min(20, games) && rate >= 0.7, `strength: Intermediate beats Easy in >= 70% of ${done} games (${wins}/${done} = ${(rate * 100).toFixed(0)}%)`);
}

(async () => {
  const server = H.http.createServer(); H.ws.createServer({server}, H.aedes.handle); await new Promise(r => server.listen(H.PORT, r));
  const browser = await H.chromium.launch({headless:!process.env.HEADFUL});
  try {
    if (ONLY.includes('1v1')){ if (process.env.LV !== 'intermediate') await oneVsOne(browser, 'easy', 11); if (process.env.LV !== 'easy') await oneVsOne(browser, 'intermediate', 23); }
    if (ONLY.includes('pod')) await pod(browser, 31);
    if (ONLY.includes('mqtt')) await mixed(browser, 41);
    if (ONLY.includes('hidden')) await hidden(browser);
    if (ONLY.includes('strength')) await strength(browser);
  } catch (e){ H.check(false, 'harness: ' + e.message.split('\n')[0]); }
  await browser.close(); server.close();
  console.log(`\n${H.results.filter(r => r.startsWith('PASS')).length} passed, ${H.fails()} failed`);
  process.exit(H.fails() ? 1 : 0);
})();
