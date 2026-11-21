const out = [];
const log = (...a) => { const s = a.map(x => typeof x === 'string' ? x : JSON.stringify(x)).join(' '); console.log(s); out.push(s); };
async function get(u, o = {}){ try { const r = await fetch(u, {headers:{'user-agent':'Mozilla/5.0 ProxyTable', ...(o.headers || {})}, ...o}); const t = await r.text(); return {s:r.status, t}; } catch (e){ return {s:0, t:String(e)}; } }
let r = await get('https://www.mtgtop8.com/format?f=cEDH');
log('cEDH links', [...new Set((r.t.match(/href=["']?[^"' >]*(archetype|event)\?[^"' >]+/g) || []))].slice(0, 40));
const i = r.t.indexOf('archetype'); log('cEDH snippet', r.t.slice(Math.max(0, i - 600), i + 1500));
r = await get('https://www.mtgtop8.com/format?f=EDH');
log('EDH links', [...new Set((r.t.match(/href=["']?[^"' >]*(archetype|event)\?[^"' >]+/g) || []))].slice(0, 40));
const a = (r.t.match(/archetype\?a=\d+&(?:amp;)?meta=\d+&(?:amp;)?f=EDH/) || [])[0]; log('first archetype', a);
if (a){ const p = await get('https://www.mtgtop8.com/' + a.replace(/&amp;/g, '&')); log('arch page', p.s, [...new Set((p.t.match(/event\?e=\d+&(?:amp;)?d=\d+[^"' >]*/g) || []))].slice(0, 10));
  const d = (p.t.match(/event\?e=\d+&(?:amp;)?d=(\d+)/) || [])[1]; if (d){ const t = await get('https://www.mtgtop8.com/mtgo?d=' + d); log('deck export', t.s, t.t.slice(0, 1500)); } }
// edhtop16 commander page (server rendered?)
r = await get('https://edhtop16.com/commander/Kinnan%2C%20Bonder%20Prodigy'); log('edhtop16 page', r.s, r.t.length, [...new Set((r.t.match(/https?:\/\/(?:www\.)?(?:moxfield\.com|topdeck\.gg|archidekt\.com)[^"' <]+/g) || []))].slice(0, 10));
r = await get('https://json.edhrec.com/pages/average-decks/edgar-markov.json'); const j = JSON.parse(r.t); log('edhrec avg keys', Object.keys(j), JSON.stringify(j.deck || j.cardlist || '').slice(0, 500));
r = await get('https://json.edhrec.com/pages/commanders/year.json'); const y = JSON.parse(r.t); log('edhrec year keys', Object.keys(y), JSON.stringify(y.container?.json_dict?.cardlists?.[0]?.cardviews?.slice(0, 3) || '').slice(0, 600));
(await import('fs')).writeFileSync('out/probe.txt', out.join('\n\n'));
