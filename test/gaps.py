import json,sys; import os; p=json.load(open(os.environ.get('OUTP','/tmp/all')+'per.json')); a=json.load(open('all.json'))
d={x[0]:x[1] for x in p}; lo,hi=int(sys.argv[1]),int(sys.argv[2])
for i,c in enumerate(a[lo:hi]):
  if c['n'] in d: print(lo+i, c['n'], '||', ' ## '.join(t[:140] for t in d[c['n']]))
