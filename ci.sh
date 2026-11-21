#!/bin/bash
OUT=/tmp/game.html python3 build.py
cp /tmp/game.html test/game.html
cd test
ONLINE=1 REAL=1 LEVELS=hard,veryhard,master TURNSP=40 PTFILE=test/game.html PTPORT=9710 SHOTDIR=../out/pod ONLY=pod timeout 2400 node rbots.js 2>&1 | grep -E "✓|✗|bots:|pageerror|ERROR"
