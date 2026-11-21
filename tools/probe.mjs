const out = []; const log = (...a) => { const s = a.map(x => typeof x === 'string' ? x : JSON.stringify(x)).join(' '); console.log(s); out.push(s); };
async function get(u){ try { const r = await fetch(u, {headers:{'user-agent':'Mozilla/5.0 ProxyTable'}}); return {s:r.status, t:await r.text()}; } catch (e){ return {s:0, t:String(e)}; } }
for (const f of ['cEDH', 'EDH']){
  const r = await get('https://www.mtgtop8.com/event?e=' + (f === 'cEDH' ? 94126 : 94108) + '&f=' + f);
  const t = r.t.replace(/<script[\s\S]*?<\/script>/g, '').replace(/\s+/g, ' ');
  const i = t.indexOf('&d='); log(f, 'event', r.s, t.length); log(t.slice(Math.max(0, i - 2500), i + 3500));
  const d = (t.match(/[?&]d=(\d+)/) || [])[1]; const x = await get('https://www.mtgtop8.com/mtgo?d=' + d); log('export', x.s, x.t.slice(0, 800));
  const x2 = await get('https://www.mtgtop8.com/dec?d=' + d); log('dec', x2.s, x2.t.slice(0, 800));
}
const fm = await get('https://www.mtgtop8.com/format?f=cEDH'); const ft = fm.t.replace(/<script[\s\S]*?<\/script>/g, '').replace(/\s+/g, ' ');
const j = ft.indexOf('meta='); log('format meta', ft.slice(Math.max(0, j - 1500), j + 2500));
(await import('fs')).writeFileSync('out/probe.txt', out.join('\n\n'));
