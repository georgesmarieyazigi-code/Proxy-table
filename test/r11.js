const H = require('./h'); const {check, waitFor} = H;
(async () => {
  const browser = await H.chromium.launch();
  try {
    const ctx = await browser.newContext({viewport:{width:1300, height:900}}); const L = await ctx.newPage();
    L.on('pageerror', e => check(false, 'page error: ' + e.message));
    await H.route(L); await L.goto(H.FILE);
    check(!!(await L.$('[data-act="topCheck"]')), 'lobby has “Check the most-played commanders”');
    await L.click('[data-act="topCheck"]');
    const okf = await waitFor(L, () => UI.modal && UI.modal.finished, null, 90000); if (!okf) console.log('   modal', await L.evaluate(() => JSON.stringify(UI.modal && {t:UI.modal.type, ti:UI.modal.title, d:UI.modal.done}))); check(okf, 'it looks them up and checks them');
    const r = await L.evaluate(() => [UI.modal.rows.length, UI.modal.report.split('\n')[0], S === null]);
    console.log('   ', r);
    check(r[0] >= 20 && r[2], `checked ${r[0]} commanders found in the test data; no game started`);
    await L.screenshot({path:'shot-topcheck.png'});
  } catch (e){ console.log('ERROR', e.message); check(false, 'no exceptions'); }
  finally { await browser.close(); console.log(`\n${H.results.length - H.fails()} passed, ${H.fails()} failed`); process.exit(0); }
})();
