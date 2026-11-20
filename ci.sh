#!/bin/bash
# What the GitHub machine runs (edit + push to start a run). Output goes in ./out
OUT=/tmp/game.html python3 build.py
cp /tmp/game.html test/game.html
cd test
mkdir -p ../out
# lane A: three more online bot games with real cards and art, different seats
( for L in hard,hard,hard veryhard,veryhard,master master,master,master; do
    echo "== pod $L"; ONLINE=1 REAL=1 LEVELS=$L TURNSP=60 PTFILE=test/game.html PTPORT=9710 SHOTDIR=../out/pod-$L ONLY=pod timeout 2400 node rbots.js 2>&1 | grep -E "✓|✗|bots:|pageerror"
  done ) > ../out/laneA.txt 2>&1 &
# lane B: the full regression suite (mocked Scryfall, as in the sandbox)
( for t in rdeck r2T rlobby rdecks r28a r26a r2 r3 r4 r5 r6 r7 r8 r9 r10 r11 r12 r13 r2A r2B r2C r2C2 r2D r2E r2F r2G r2H r2S rfinal rtrainer rcoach; do
    echo "== $t"; PTFILE=test/game.html PTPORT=9800 timeout 900 node $t.js 2>&1 | grep -E "✗|passed|failed|FATAL" | tail -12
  done ) > ../out/laneB.txt 2>&1 &
wait
cat ../out/laneA.txt ../out/laneB.txt
