#!/bin/bash
mkdir -p out
MAXPAGES=40 LIMIT=100 PER=3 node tools/topdecks.mjs
