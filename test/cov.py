import json; import os; p=json.load(open(os.environ.get('OUTP','/tmp/all')+'per.json')); a=json.load(open('all.json'))
bad=set(x[0] for x in p)
print(' '.join(f"{N}:{100*(N-sum(1 for c in a[:N] if c['n'] in bad))/N:.0f}%" for N in [100,300,1000,2000,4000,7000]))
