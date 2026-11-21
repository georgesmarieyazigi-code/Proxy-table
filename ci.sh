#!/bin/bash
mkdir -p out
MAXPAGES=2 LIMIT=5 PER=2 node tools/topdecks.mjs
