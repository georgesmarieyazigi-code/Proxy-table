#!/bin/bash
mkdir -p out
sleep 60
cd test && node -e "
const {chromium}=require('playwright'); (async()=>{ const b=await chromium.launch({args:['--autoplay-policy=no-user-gesture-required']}); const p=await b.newPage(); await p.goto('https://georgesmarieyazigi-code.github.io/Proxy-table/'); await p.waitForTimeout(2000);
const r=await p.evaluate(async()=>{ const out={}; for (const n of [...Object.values(SND_FILES), ...SND_MUSIC]){ out[n]=await new Promise(res=>{ const a=new Audio(SND_BASE+n); a.onloadedmetadata=()=>res(+a.duration.toFixed(2)); a.onerror=()=>res('ERROR'); setTimeout(()=>res('timeout'),15000); }); } return out; }); console.log(JSON.stringify(r)); await b.close(); })();"
