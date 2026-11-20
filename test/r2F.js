process.env.TOP = '1';
// Round 23 helper F: automation for ranks 0–2264 (mana add-ons on auto-pay, Chaos Warp, Living Death, Animate Dead, damage multipliers, opponent choices on their own screen …)
const CC = require('./cards');
const WANT = ['Chaos Warp', 'Wild Growth', 'Mana Reflection', 'High Tide', 'Rampant Growth', 'Divination', 'Living Death', 'Blasphemous Edict', 'Rise of the Dark Realms', 'Animate Dead',
  'Torment of Hailfire', 'Braids, Arisen Nightmare', 'Plaguecrafter', 'Talon Gates of Madara', 'Veil of Summer', 'City on Fire', 'Torbran, Thane of Red Fell', 'Lightning Bolt', 'Syr Konrad, the Grim',
  "Urza's Saga", "Bolas's Citadel", 'Wishclaw Talisman', 'Culling Ritual', 'Grizzly Bears', 'Llanowar Elves', 'Sol Ring', 'Greater Good', 'Krenko, Tin Street Kingpin', 'Solemn Simulacrum', 'Harmonic Prodigy', 'Counterspell', 'Opt', 'Elvish Mystic', 'Fyndhorn Elves', 'Memnite', 'Ornithopter', 'Birds of Paradise', "Orim's Chant", 'Obscuring Haze', 'Single Combat'];
CC.cards.push(...CC.topCards('all.json').filter(c => WANT.includes(c.name)), ...CC.topCards('extra.json').filter(c => WANT.includes(c.name) && !CC.cards.some(x => x.name === c.name)));
const H = require('./h'); const {check, sleep, put, waitFor} = H;
const passAll = async (ps) => { for (let i = 0; i < 6; i++){ for (const p of ps) await p.evaluate(() => { if (myBox()) doPass(); }); await sleep(200); } };
const AUTO = () => { window.__want = window.__want || null; window.__tgt = window.__tgt || null; setInterval(() => { const m = UI.modal; if (!m || m.__done) return; const w = window.__want ? new RegExp(window.__want, 'i') : null;
  try {
    if (m.type === 'pick' && m.resolve){ const pool = (m.cards || []); const pref = w ? pool.filter(c => w.test(cname(c))) : []; const n = Math.max(m.min || 0, Math.min(m.max || 0, pref.length || (m.min || 0) || (m.max ? 1 : 0))); const ids = (pref.length ? pref : pool).slice(0, n).map(c => c.id); m.__done = 1; m.resolve(ids); closeModal(); }
    else if (m.type === 'choice' && m.resolve){ const o = (m.options || []).filter(x => !x.disabled); const pick = (w && o.find(x => w.test(String(x.label)))) || o[0]; m.__done = 1; m.resolve(pick ? pick.value : null); closeModal(); }
    else if (m.type === 'target' && m.resolve){ if (!window.__tgt) return; const re = new RegExp(window.__tgt, 'i'); const c = (m.cands || []).find(x => x.ok && re.test(x.nm)); if (!c) return; m.__done = 1; m.resolve([c]); closeModal(); }
    else if (m.run){ m.__done = 1; const d = window.__num != null ? window.__num : (m.def ?? 1); m.run(d); closeModal(); }
  } catch (e){ console.warn('auto', e); } }, 120); };
const settle = async (ps) => { for (let i = 0; i < 40; i++){ await passAll(ps); let busy = false; for (const p of ps) busy = busy || await p.evaluate(() => !!(stackAll().length || UI.resolving || UI.casting)); if (!busy) return; await sleep(150); } };
const toHand = (p, n) => p.evaluate(n => { for (const z of ['lib', 'gy', 'ex', 'bf']){ const i = S[z].findIndex(c => cname(c) === n); if (i >= 0){ const [c] = S[z].splice(i, 1); reset(c); S.hand.push(c); commit(); return c.id; } } return S.hand.find(c => cname(c) === n)?.id; }, n);
const toZone = (p, n, z2) => p.evaluate(([n, z2]) => { for (const z of ['lib', 'hand', 'gy', 'ex', 'bf']){ const i = S[z].findIndex(c => cname(c) === n); if (i >= 0){ const [c] = S[z].splice(i, 1); reset(c); if (z2 === 'lib') S.lib.unshift(c); else S[z2].push(c); commit(); return c.id; } } return null; }, [n, z2]);
const cast = (p, n) => p.evaluate(async n => { const c = S.hand.find(x => cname(x) === n); if (!c) return 'not in hand'; await beginCast(c, 'hand'); return S.hand.includes(c) ? 'not cast' : 'ok'; }, n);
const clearBf = p => p.evaluate(() => { for (const c of S.bf.slice()) if (!isLand(c.k) || true){ const i = S.bf.indexOf(c); S.bf.splice(i, 1); if (!c.tok){ reset(c); S.lib.push(c); } } S.poz = []; commit(); });
let PA = null, PB = null; const step = async (name, fn) => { if (process.env.ONLY && !name.includes(process.env.ONLY)) return; console.log('— ' + name); const f0 = H.fails(); try { await fn(); } catch (e){ console.log('  ERROR', e.message.split('\n')[0]); check(false, name + ' ran without errors'); }
  if (H.fails() > f0 && PA) for (const [nm, p] of [['Georges', PA], ['Kim', PB]]) console.log(`    ${nm} LOG:`, (await p.evaluate(() => S.log.slice(-14).map(e => e.s).join(' | ') + ' || modal=' + JSON.stringify(UI.modal && {t:UI.modal.type, ti:UI.modal.title})))); };
(async () => {
  const server = H.http.createServer(); H.ws.createServer({server}, H.aedes.handle); await new Promise(r => server.listen(H.PORT, r));
  const browser = await H.chromium.launch();
  const A = await H.player(browser, 'Georges', H.deckFor('Edgar Markov'), 'host', 'r2f');
  const B = await H.player(browser, 'Kim', H.deckFor('Thalia, Guardian of Thraben'), 'join', 'r2f');
  PA = A; PB = B; await waitFor(A, () => OPP.size === 1); await A.click('[data-act="goFirst"]');
  await settle([A, B]); await waitFor(A, () => phaseNow().ph === 3, null, 10000);
  await A.evaluate(AUTO); await B.evaluate(AUTO);
  const life = p => p.evaluate(() => S.life);
  const zones = p => p.evaluate(() => ({gy:S.gy.map(cname), ex:S.ex.map(cname), hand:S.hand.length, lib:S.lib.length, bf:S.bf.map(cname), poz:(S.poz || []).map(cname)}));
  const reset2 = async () => { await clearBf(A); await clearBf(B); await A.evaluate(() => { S.pool = emptyPool(); window.__tgt = null; window.__want = null; window.__num = null; commit(); }); await B.evaluate(() => { S.pool = emptyPool(); window.__tgt = null; window.__want = null; window.__num = null; commit(); }); await sleep(600); };
  try {
    await step('Wild Growth: auto-pay taps the enchanted Forest and gets the extra {G} (Rampant Growth paid by one land)', async () => {
      await reset2(); await put(A, 'Forest'); await put(A, 'Wild Growth');
      await A.evaluate(() => { const f = S.bf.find(c => cname(c) === 'Forest'); const w = S.bf.find(c => cname(c) === 'Wild Growth'); w.att = {pid:MYPID, id:f.id}; commit(); });
      await toHand(A, 'Rampant Growth'); await A.evaluate(() => { window.__want = 'Forest|Plains'; });
      const r = await cast(A, 'Rampant Growth'); check(r === 'ok', `Rampant Growth ({1}{G}) cast with only one Forest untapped: ${r}`);
      await settle([A, B]); await sleep(600);
    });
    await step('Mana Reflection + High Tide: an Island auto-tapped gives {U}{U} + {U}{U} (Divination paid by one Island)', async () => {
      await reset2(); await put(A, 'Island'); await put(A, 'Mana Reflection');
      await toHand(A, 'High Tide'); await A.evaluate(() => { S.pool = {...emptyPool(), U:1}; commit(); });
      check(await cast(A, 'High Tide') === 'ok', 'cast High Tide'); await settle([A, B]);
      await toHand(A, 'Divination'); await A.evaluate(() => { S.pool = emptyPool(); commit(); });
      const h0 = (await zones(A)).hand; const r = await cast(A, 'Divination'); await settle([A, B]); await sleep(500);
      const pool = await A.evaluate(() => ({...S.pool}));
      check(r === 'ok', `Divination ({2}{U}) cast off one Island: ${r}`);
      check(pool.U === 0, `exactly 3 mana: Island {U}{U} (doubled) + High Tide {U}; nothing left over: U=${pool.U}`);
      check((await zones(A)).hand - h0 === 1, 'drew two (net +1 after casting)');
    });
    await step("Chaos Warp: Kim's own client shuffles her creature into her library and reveals the top card", async () => {
      await reset2(); await put(B, 'Birds of Paradise'); await sleep(600); const b0 = await zones(B);
      await toHand(A, 'Chaos Warp'); await A.evaluate(() => { S.pool = {...emptyPool(), R:3}; window.__tgt = 'Birds of Paradise'; commit(); });
      check(await cast(A, 'Chaos Warp') === 'ok', 'cast Chaos Warp at Kim\'s Birds of Paradise'); await settle([A, B]); await sleep(1500);
      const b1 = await zones(B); const log = await B.evaluate(() => S.log.slice(-25).map(e => e.s).join(' | '));
      check(!b1.bf.includes('Birds of Paradise') || b1.lib === b0.lib, 'Birds of Paradise left Kim\'s battlefield (or came straight back as the revealed permanent)');
      check(/shuffled Birds of Paradise into their library|Birds of Paradise was shuffled into its owner's library/.test(log) && /revealed/.test(log), `Kim's log: ${log.slice(0, 200)}`);
    });
    await step('Living Death: both players swap graveyard creatures and battlefield creatures, each on their own client', async () => {
      await reset2(); await put(A, 'Llanowar Elves'); await toZone(A, 'Memnite', 'gy'); await put(B, 'Grizzly Bears'); await toZone(B, 'Elvish Mystic', 'gy'); await sleep(600);
      await toHand(A, 'Living Death'); await A.evaluate(() => { S.pool = {...emptyPool(), B:5}; window.__want = 'Grizzly|Plains|Forest'; commit(); });
      check(await cast(A, 'Living Death') === 'ok', 'cast Living Death'); await settle([A, B]); await sleep(2000); await settle([A, B]);
      const a = await zones(A), b = await zones(B);
      check(a.bf.includes('Memnite') && a.gy.includes('Llanowar Elves'), `Georges: Memnite back, Elves in graveyard (${a.bf.join(',')})`);
      check(b.bf.includes('Elvish Mystic') && b.gy.includes('Grizzly Bears'), `Kim: Elvish Mystic back, Bears in graveyard (${b.bf.join(',')})`);
    });
    await step('Blasphemous Edict: Kim (2 creatures) sacrifices both on her side; Plaguecrafter-free check', async () => {
      await reset2(); await put(B, 'Grizzly Bears'); await put(B, 'Elvish Mystic'); await sleep(600);
      await toHand(A, 'Blasphemous Edict'); await A.evaluate(() => { S.pool = {...emptyPool(), B:7}; commit(); });
      check(await cast(A, 'Blasphemous Edict') === 'ok', 'cast Blasphemous Edict'); await settle([A, B]); await sleep(1500);
      const b = await zones(B); check(!b.bf.includes('Grizzly Bears') && !b.bf.includes('Elvish Mystic'), `Kim's creatures are gone (${b.bf.join(',')})`);
    });
    await step("Rise of the Dark Realms: Kim's graveyard creature comes to Georges", async () => {
      await reset2(); await toZone(B, 'Grizzly Bears', 'gy'); await sleep(600);
      await toHand(A, 'Rise of the Dark Realms'); await A.evaluate(() => { S.pool = {...emptyPool(), B:9}; commit(); });
      check(await cast(A, 'Rise of the Dark Realms') === 'ok', 'cast Rise of the Dark Realms'); await settle([A, B]); await sleep(1500);
      check((await zones(A)).bf.includes('Grizzly Bears') && !(await zones(B)).gy.includes('Grizzly Bears'), "Kim's Bears moved to Georges's battlefield");
    });
    await step("Animate Dead: reanimate Kim's creature, attach; when the Aura leaves, the creature is sacrificed", async () => {
      await reset2(); await toZone(B, 'Solemn Simulacrum', 'gy'); await sleep(700);
      await toHand(A, 'Animate Dead'); await A.evaluate(() => { S.pool = {...emptyPool(), B:2}; window.__tgt = 'Solemn'; window.__want = 'Solemn'; commit(); });
      const r = await cast(A, 'Animate Dead'); check(r === 'ok', `cast Animate Dead (${r})`); await settle([A, B]); await sleep(2000); await settle([A, B]);
      const st = await A.evaluate(() => { const c = S.bf.find(x => cname(x) === 'Solemn Simulacrum'); const au = S.bf.find(x => cname(x) === 'Animate Dead'); return {c:!!c, att:!!(c && au && au.att && au.att.id === c.id), p:c ? stats(c)[0] : null}; });
      check(st.c && st.att, `Solemn Simulacrum is on Georges's battlefield with Animate Dead attached ${JSON.stringify(st)}`);
      await A.evaluate(() => { const au = S.bf.find(x => cname(x) === 'Animate Dead'); if (au) moveCard(au.id, 'gy'); }); await sleep(1500);
      check(!(await zones(A)).bf.includes('Solemn Simulacrum'), 'Animate Dead left: the creature was sacrificed');
    });
    await step("Torment of Hailfire (X=2): Kim makes her own choices; with nothing to give she loses 3 life twice", async () => {
      await reset2(); await B.evaluate(() => { S.hand.splice(0).forEach(c => S.lib.push(c)); commit(); }); const lb = await life(B);
      await toHand(A, 'Torment of Hailfire'); await A.evaluate(() => { S.pool = {...emptyPool(), B:4}; window.__num = 2; commit(); });
      check(await cast(A, 'Torment of Hailfire') === 'ok', 'cast Torment of Hailfire with X=2'); await settle([A, B]); await sleep(2000);
      check(lb - await life(B) === 6, `Kim lost 6 life (${lb} → ${await life(B)})`);
    });
    await step("Braids, Arisen Nightmare: Kim declines on her screen — she loses 2, Georges draws", async () => {
      await reset2(); await put(A, 'Braids, Arisen Nightmare'); await put(A, 'Llanowar Elves'); await put(B, 'Fyndhorn Elves'); await sleep(600);
      await B.evaluate(() => { window.__want = "Don't"; }); await A.evaluate(() => { window.__want = 'Llanowar|Sacrifice|Yes'; });
      const lb = await life(B), h0 = (await zones(A)).hand;
      await A.evaluate(async () => { const c = S.bf.find(x => cname(x) === 'Braids, Arisen Nightmare'); const ctx = {k:c.k, name:cname(c), srcId:c.id, full:tname(info(c.k).o, info(c.k).n).split('\n')[0].replace(/^At the beginning of your end step, /, ''), it:{kind:'trigger'}, tgts:null}; UI.curCtx = ctx; await runEffects(ctx.full, ctx); });
      await sleep(2000);
      check(!(await zones(A)).bf.includes('Llanowar Elves'), 'Georges sacrificed Llanowar Elves');
      check((await zones(B)).bf.includes('Fyndhorn Elves'), "Kim kept her Fyndhorn Elves (declined on her own screen)");
      check(lb - await life(B) === 2 && (await zones(A)).hand - h0 === 1, `Kim lost 2 life (${lb}→${await life(B)}) and Georges drew a card`);
    });
    await step('Plaguecrafter: Kim has no creature, so she discards a card instead', async () => {
      await reset2(); await toHand(B, 'Lightning Bolt'); const h0 = (await zones(B)).hand; await A.evaluate(() => { window.__want = null; });
      await toHand(A, 'Plaguecrafter'); await A.evaluate(() => { S.pool = {...emptyPool(), B:3}; commit(); });
      check(await cast(A, 'Plaguecrafter') === 'ok', 'cast Plaguecrafter'); await settle([A, B]); await sleep(3000); await settle([A, B]);
      check((await zones(B)).hand === h0 - 1, `Kim discarded a card (${h0} → ${(await zones(B)).hand})`);
    });
    await step("Talon Gates of Madara: Kim's creature phases out on her client", async () => {
      await reset2(); await put(B, 'Memnite'); await sleep(600); await A.evaluate(() => { window.__tgt = 'Memnite'; });
      await put(A, 'Talon Gates of Madara'); await sleep(800); await settle([A, B]); await sleep(1200);
      const b = await zones(B); check(!b.bf.includes('Memnite') && b.poz.includes('Memnite'), `Memnite phased out (${JSON.stringify(b.poz)})`);
    });
    await step("Veil of Summer: Kim cast a blue spell, so Georges draws; Georges's spells can't be countered this turn", async () => {
      await reset2(); await toHand(B, 'Opt'); await B.evaluate(() => { S.pool = {...emptyPool(), U:1}; commit(); });
      check(await cast(B, 'Opt') === 'ok', 'Kim cast Opt (blue) on Georges\'s turn'); await settle([A, B]); await sleep(800);
      await toHand(A, 'Veil of Summer'); const h0 = (await zones(A)).hand; await A.evaluate(() => { S.pool = {...emptyPool(), G:1}; commit(); });
      check(await cast(A, 'Veil of Summer') === 'ok', 'cast Veil of Summer'); await settle([A, B]); await sleep(1200);
      check((await zones(A)).hand === h0, `Georges drew a card (hand ${h0} → ${(await zones(A)).hand}, Veil cast from it)`);
      await toHand(A, 'Lightning Bolt'); await A.evaluate(() => { S.pool = {...emptyPool(), R:1}; window.__tgt = 'Kim'; commit(); }); await cast(A, 'Lightning Bolt'); await sleep(800);
      const r = await B.evaluate(() => { const it = stackAll().find(i => i.nm === 'Lightning Bolt'); return it ? counterLegal(it, counterSpec('Counter target spell.')) : 'no bolt'; });
      check(r && r.ok === false, `Kim cannot counter Georges's Bolt: ${JSON.stringify(r)}`); await settle([A, B]); await sleep(600);
    });
    await step('City on Fire triples, Torbran adds 2: Lightning Bolt to Kim deals (3+2)×3 = 15', async () => {
      await reset2(); await put(A, 'City on Fire'); await put(A, 'Torbran, Thane of Red Fell'); const lb = await life(B);
      await toHand(A, 'Lightning Bolt'); await A.evaluate(() => { S.pool = {...emptyPool(), R:1}; window.__tgt = 'Kim'; commit(); });
      check(await cast(A, 'Lightning Bolt') === 'ok', 'cast Lightning Bolt at Kim'); await settle([A, B]); await sleep(1200);
      check(lb - await life(B) === 15, `Kim lost ${lb - await life(B)} (expected 15)`);
    });
    await step('Syr Konrad: a creature card milled from Georges\'s library deals 1 to Kim', async () => {
      await reset2(); await put(A, 'Syr Konrad, the Grim'); await toZone(A, 'Ornithopter', 'lib'); const lb = await life(B);
      await A.evaluate(() => { mill(1); commit(); }); await sleep(800); await settle([A, B]); await sleep(1000);
      check(lb - await life(B) === 1, `Kim took 1 (${lb} → ${await life(B)})`);
    });
    await step("Urza's Saga chapter I: the Saga gains \"{T}: Add {C}\"", async () => {
      await reset2(); await put(A, "Urza's Saga"); await sleep(800); await settle([A, B]); await sleep(800);
      const r = await A.evaluate(() => { const c = S.bf.find(x => cname(x) === "Urza's Saga"); return c ? {lore:c.lore, abs:manaAbs(c).map(a => a.eff)} : null; });
      check(r && r.abs.some(e => /add \{c\}/i.test(e)), `Urza's Saga mana abilities: ${JSON.stringify(r)}`);
    });
    await step("Bolas's Citadel: cast the top card of the library paying life equal to its mana value", async () => {
      await reset2(); await put(A, "Bolas's Citadel"); await toZone(A, 'Divination', 'lib'); const l0 = await life(A); const h0 = (await zones(A)).hand;
      const ways = await A.evaluate(() => r23fTopWays(S.lib[0]).length); check(ways > 0, 'the top card can be played thanks to the Citadel');
      await A.evaluate(() => r23fPlayTop(true)); await sleep(500); await settle([A, B]); await sleep(800);
      check(l0 - await life(A) === 3 && (await zones(A)).hand - h0 === 2, `paid 3 life (${l0}→${await life(A)}) and Divination drew 2`);
    });
    await step('Wishclaw Talisman: after use an opponent gains control of it', async () => {
      await reset2(); await put(A, 'Wishclaw Talisman'); await sleep(400);
      await A.evaluate(async () => { const c = S.bf.find(x => cname(x) === 'Wishclaw Talisman'); await runEffects('An opponent gains control of ~.', {k:c.k, name:cname(c), srcId:c.id, it:{kind:'ability'}, tgts:null}); }); await sleep(1200);
      check(!(await zones(A)).bf.includes('Wishclaw Talisman') && (await zones(B)).bf.includes('Wishclaw Talisman'), 'Kim controls Wishclaw Talisman now');
    });
    await step('Culling Ritual: destroys two cheap permanents and adds {B}/{G} for each', async () => {
      await reset2(); await put(A, 'Sol Ring'); await put(B, 'Llanowar Elves'); await sleep(600);
      await toHand(A, 'Culling Ritual'); await A.evaluate(() => { S.pool = {...emptyPool(), B:3, G:1}; window.__want = '2 \\{B\\}'; commit(); });
      check(await cast(A, 'Culling Ritual') === 'ok', 'cast Culling Ritual'); await settle([A, B]); await sleep(1200);
      const pool = await A.evaluate(() => ({...S.pool})); check(pool.B + pool.G === 2, `added 2 mana (${JSON.stringify(pool)})`);
      check(!(await zones(B)).bf.includes('Llanowar Elves'), "Kim's Llanowar Elves was destroyed");
    });
    await step("Orim's Chant: Kim can't cast spells this turn (checked on her own client)", async () => {
      await reset2(); await toHand(A, "Orim's Chant"); await A.evaluate(() => { S.pool = {...emptyPool(), W:1}; window.__tgt = 'Kim'; commit(); });
      const rr = await cast(A, "Orim's Chant"); check(rr === 'ok', `cast Orim's Chant at Kim (${rr})`); if (rr !== 'ok') console.log('    modal', await A.evaluate(() => JSON.stringify(UI.modal && {t:UI.modal.type, ti:UI.modal.title, o:(UI.modal.options || []).map(x => x.label)}))); await settle([A, B]); await sleep(1200);
      const why = await B.evaluate(() => { S.pool = {...emptyPool(), U:1}; const c = S.lib.find(x => cname(x) === 'Opt') || S.hand.find(x => cname(x) === 'Opt'); const r = castCheck(c, 'hand').why || 'allowed'; S.pool = emptyPool(); return r; });
      check(/can't cast spells this turn/.test(why), `Kim can't cast Opt: ${why}`);
      await B.evaluate(() => { S.r23noCast = null; commit(); }); await A.evaluate(() => { window.__tgt = null; });
    });
    await step("Obscuring Haze (Kim's): damage from Georges's creature is prevented on Georges's client", async () => {
      await reset2(); await put(A, 'Grizzly Bears'); await toHand(B, 'Obscuring Haze'); await B.evaluate(() => { S.pool = {...emptyPool(), G:3}; commit(); });
      check(await cast(B, 'Obscuring Haze') === 'ok', 'Kim cast Obscuring Haze'); await settle([A, B]); await sleep(1500);
      const lb = await life(B); await A.evaluate(() => { const c = S.bf.find(x => cname(x) === 'Grizzly Bears'); dealDamage({t:'player', pid:[...OPP.keys()][0]}, 2, c.k, c); commit(); }); await sleep(1000);
      check(await life(B) === lb, `the Bears' damage to Kim was prevented (${lb} → ${await life(B)})`);
    });
    await step('Single Combat: each player keeps one creature (Kim chooses on her screen), then no creature spells', async () => {
      await reset2(); await put(A, 'Grizzly Bears'); await put(A, 'Llanowar Elves'); await put(B, 'Elvish Mystic'); await put(B, 'Fyndhorn Elves'); await sleep(700);
      await A.evaluate(() => { window.__want = 'Grizzly'; }); await B.evaluate(() => { window.__want = 'Fyndhorn'; });
      await toHand(A, 'Single Combat'); await A.evaluate(() => { S.pool = {...emptyPool(), W:5}; commit(); });
      check(await cast(A, 'Single Combat') === 'ok', 'cast Single Combat'); await settle([A, B]); await sleep(2000);
      const a = await zones(A), b = await zones(B);
      check(a.bf.includes('Grizzly Bears') && !a.bf.includes('Llanowar Elves'), `Georges kept Grizzly Bears (${a.bf.join(',')})`);
      check(b.bf.includes('Fyndhorn Elves') && !b.bf.includes('Elvish Mystic'), `Kim kept Fyndhorn Elves on her own screen (${b.bf.join(',')})`);
      const why = await B.evaluate(() => r23fNoCrOn() ? "Single Combat: players can't cast creature or planeswalker spells now" : 'allowed');
      check(/Single Combat/.test(why), `Kim's client sees the ban on creature spells: ${why}`);
    });
    await step('Krenko / Greater Good counting: numbers come from the board, nobody is asked', async () => {
      await reset2(); await put(A, 'Grizzly Bears'); await put(A, 'Solemn Simulacrum');
      const r = await A.evaluate(async () => { let asked = 0; const om = openModal; openModal = m => { if (m && m.type === 'ask') asked++; return om(m); }; const h0 = S.hand.length;
        await runEffects('Draw cards equal to the greatest power among creatures you control.', {k:null, name:'Rishkar\'s Expertise', it:{kind:'spell'}, tgts:null}); openModal = om; return {asked, drew:S.hand.length - h0}; });
      check(r.asked === 0 && r.drew === 2, `drew ${r.drew} (greatest power 2) without a question (${r.asked} asks)`);
    });
  } catch (e){ console.log('ERROR', e.message); check(false, 'no exceptions'); }
  finally { await browser.close(); server.close(); console.log(`\n${H.results.length - H.fails()} passed, ${H.fails()} failed`); process.exit(0); }
})();
