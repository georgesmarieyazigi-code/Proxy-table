#!/usr/bin/env python3
# Summarise fuzz.js results: python3 fuzzsum.py [/tmp/fz] [-v]
import json, glob, sys, re, collections
d = sys.argv[1] if len(sys.argv) > 1 and not sys.argv[1].startswith('-') else '/tmp/fz'
V = '-v' in sys.argv
games = [json.load(open(f)) for f in sorted(glob.glob(d + '/g*.json'))]
print(f'{len(games)} games, players: {collections.Counter(g["np"] for g in games)}, turns: {sum(g["turns"] for g in games)}, statuses: {collections.Counter(re.sub(r"\(.*", "", g["status"]) for g in games)}')
def norm(s): return re.sub(r'\d+', '#', s)
err = collections.defaultdict(lambda: {'n': 0, 'games': set(), 'ex': None})
for g in games:
    for e in g['errors']:
        k = e['kind'] + ' | ' + norm(e['msg'])[:140]
        err[k]['n'] += e['n']; err[k]['games'].add(g['seed']); err[k]['ex'] = err[k]['ex'] or (g['seed'], e)
print('\n## errors (kind | message): occurrences, games')
for k, v in sorted(err.items(), key=lambda x: -len(x[1]['games'])):
    print(f'{v["n"]:5} {len(v["games"]):3}g  {k}   e.g. seed {v["ex"][0]}  {v["ex"][1]["stack"].splitlines()[0] if v["ex"][1]["stack"] else ""}')
ce = collections.defaultdict(lambda: {'n': 0, 'games': set(), 'ex': None})
for g in games:
    for e in g.get('cerr', []):
        k = e['kind'] + ' | ' + norm(e['msg'])[:120] + ' | ' + ((e['stack'].splitlines() or [''])[1:2] or [''])[0].strip()[:90]
        ce[k]['n'] += e['n']; ce[k]['games'].add(g['seed']); ce[k]['ex'] = ce[k]['ex'] or (g['seed'], e)
print('\n## in-page warnings/errors with context')
for k, v in sorted(ce.items(), key=lambda x: -len(x[1]['games'])):
    s, e = v['ex']; print(f'{v["n"]:5} {len(v["games"]):3}g  {k}   seed {s} turn {e["turn"]} {e["who"]}')
    if V: print('        act:', e['act'][:150]); print('        stack:', ' <- '.join(l.strip() for l in e['stack'].splitlines()[1:5])); print('        log:', '\n             '.join(e['log'][-8:]))
vio = collections.defaultdict(lambda: {'n': 0, 'games': set(), 'ex': []})
for g in games:
    for x in g['viol']:
        k = x['kind'] + ' | ' + x['key']
        vio[k]['n'] += 1; vio[k]['games'].add(g['seed'])
        if len(vio[k]['ex']) < 2: vio[k]['ex'].append((g['seed'], x))
print('\n## violations (kind | key): occurrences, games')
for k, v in sorted(vio.items(), key=lambda x: (x[0].split(' | ')[0], -len(x[1]['games']))):
    s, x = v['ex'][0]
    print(f'{v["n"]:5} {len(v["games"]):3}g  {k}   seed {s} turn {x["turn"]} {x["who"]}: {x["msg"][:160]}')
    if V:
        print('        last act:', x.get('act', '')[:160]); print('        acts:', ' || '.join(a[:90] for a in x.get('acts', [])[-5:]))
        print('        log:', '\n             '.join(x.get('log', [])[-12:]))
ds = collections.defaultdict(lambda: {'n': 0, 'games': set(), 'ex': None})
for g in games:
    for x in g['desync']:
        k = x['field']; ds[k]['n'] += 1; ds[k]['games'].add(g['seed']); ds[k]['ex'] = ds[k]['ex'] or (g['seed'], x)
print('\n## desyncs (field): occurrences, games')
for k, v in ds.items(): print(f'{v["n"]:5} {len(v["games"]):3}g  {k}  e.g. seed {v["ex"][0]}: {json.dumps(v["ex"][1])[:300]}')
print('\n## stuck games')
for g in games:
    for s in g['stuck']:
        print(f'seed {g["seed"]} turn {s["turn"]}:')
        for p in s['diag']:
            print('   ', json.dumps({k: p.get(k) for k in ('nm', 'ph', 'key', 'pass', 'box', 'stack', 'waiting', 'modal', 'casting', 'resolving', 'prm', 'lost')})[:400])
            if V: print('      acts:', p.get('acts')); print('      log:', '\n           '.join((p.get('log') or [])[-10:]))
asks = collections.Counter(); bh = collections.Counter()
for g in games:
    for a in g['asks']: asks[norm(a['title'])[:90]] += 1
    for a in g['byhand']: bh[(a['name'] + ': ' + a['text'])[:110]] += 1
print('\n## number questions asked (owner wants none for computable numbers)')
for k, n in asks.most_common(40): print(f'{n:4}  {k}')
print('\n## by-hand notes')
for k, n in bh.most_common(40): print(f'{n:4}  {k}')
be = collections.Counter()
for g in games:
    for e in g['botErr']: be[norm(e)[:150]] += 1
print('\n## bot/harness errors')
for k, n in be.most_common(20): print(f'{n:4}  {k}')
for g in games:
    if g.get('deckProblems'): print('deck problems seed', g['seed'], g['deckProblems'])
