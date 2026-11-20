process.env.TOP = '1';
const H = require('./h'); const {check, waitFor} = H; const fs = require('fs');
(async () => {
  const browser = await H.chromium.launch();
  try {
    const ctx = await browser.newContext({viewport:{width:1300, height:900}}); const L = await ctx.newPage();
    L.on('pageerror', e => check(false, 'page error: ' + e.message));
    await H.route(L); await L.goto(H.FILE);
    await L.click('[data-act="topCheck"]');
    const okf = await waitFor(L, () => UI.modal && UI.modal.finished, null, 600000);
    check(okf, 'top check finished');
    const r = await L.evaluate(() => ({n:UI.modal.rows.length, bad:UI.modal.bad.length, rep:UI.modal.report}));
    fs.writeFileSync('/tmp/topreport.txt', r.rep);
    console.log(`   ${r.n} checked, ${r.n - r.bad} fully understood, ${r.bad} with gaps`);
    check(r.n >= 190, 'all real commanders loaded');
    if (process.env.MIN) check(r.n - r.bad >= +process.env.MIN, `at least ${process.env.MIN} fully understood`);
  } catch (e){ console.log('ERROR', e.message); check(false, 'no exceptions'); }
  finally { await browser.close(); console.log(`\n${H.results.length - H.fails()} passed, ${H.fails()} failed`); process.exit(0); }
})();
