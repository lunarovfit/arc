import { chromium } from 'playwright';
const b = await chromium.launch(); const p = await b.newPage({ viewport:{width:390,height:844}, deviceScaleFactor:2 });
await p.goto('http://localhost:4173'); await p.waitForTimeout(900);
await p.screenshot({ path: process.argv[2]+'/splash.png' }); await b.close();
