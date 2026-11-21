const out = [];
const log = (...a) => { const s = a.map(x => typeof x === 'string' ? x : JSON.stringify(x)).join(' '); console.log(s); out.push(s); };
async function get(u, o = {}){ try { const r = await fetch(u, {headers:{'user-agent':'ProxyTable/1.0 (playtest app)', accept:'application/json, text/html', ...(o.headers || {})}, ...o}); const t = await r.text(); return {s:r.status, t}; } catch (e){ return {s:0, t:String(e)}; } }
const gql = async (q, v = {}) => { const r = await get('https://edhtop16.com/api/graphql', {method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify({query:q, variables:v})}); return r; };
let r = await gql(`{ __schema { queryType { fields { name args { name } } } } }`); log('edhtop16 schema', r.s, r.t.slice(0, 3000));
r = await gql(`{ __type(name:"Commander"){ fields { name args { name } type { name kind ofType { name } } } } }`); log('Commander type', r.s, r.t.slice(0, 3000));
r = await gql(`{ __type(name:"Entry"){ fields { name type { name kind ofType { name } } } } }`); log('Entry type', r.s, r.t.slice(0, 3000));
r = await get('https://api2.moxfield.com/v3/decks/all/BS9Qyb-JY0CsJqo8Tk0xBg'); log('moxfield', r.s, r.t.slice(0, 300));
r = await get('https://www.mtgtop8.com/format?f=cEDH'); log('mtgtop8 cEDH', r.s, r.t.length, (r.t.match(/archetype\?a=\d+[^"]*"[^>]*>[^<]+/g) || []).slice(0, 30));
r = await get('https://www.mtgtop8.com/format?f=EDH'); log('mtgtop8 EDH', r.s, r.t.length, (r.t.match(/archetype\?a=\d+[^"]*"[^>]*>[^<]+/g) || []).slice(0, 30));
r = await get('https://json.edhrec.com/pages/average-decks/edgar-markov.json'); log('edhrec avg', r.s, r.t.slice(0, 400));
r = await get('https://json.edhrec.com/pages/commanders/year.json'); log('edhrec top', r.s, r.t.slice(0, 400));
(await import('fs')).writeFileSync('out/probe.txt', out.join('\n\n'));
