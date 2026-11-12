/** Computed typography at normal zoom; API responses are synthetic fixtures. */
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
const base=new URL(process.env.PAYEEGUARD_UI_URL ?? 'http://127.0.0.1:5175');
assert(['localhost','127.0.0.1','[::1]'].includes(base.hostname));
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1000},deviceScaleFactor:1});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
let role=null;
const caseData={case_id:'chg_'+'1'.repeat(32),state:'PENDING_REVIEW',version:1,simulation:true,created_at:1700000000,destinations:{active:{masked_payer_id:'***-AAAA'},proposed:{masked_payer_id:'***-BBBB'}},reason:{seller_text:'Synthetic request for readability checks'}};
await page.route(url=>url.pathname.startsWith('/api/'),route=>{
 const p=new URL(route.request().url()).pathname;
 let body={};
 if(p==='/api/session')body={user:role?{id:'fixture-user',role}:null,csrf:null,mode:'demo',ai_mode:'unavailable'};
 else if(p.includes('destination-change-requests')||p==='/api/v1/cases')body={cases:[caseData]};
 else if(p.includes('marketplace-payouts'))body={earnings:[],payouts:[]};
 return route.fulfill({status:route.request().method()==='GET'?200:403,contentType:'application/json',body:JSON.stringify(body)});
});
const audit=()=>page.evaluate(()=>{
 const small=[];
 for(const el of document.querySelectorAll('body *')) {
  if(!(el instanceof HTMLElement)||['SCRIPT','STYLE','OPTION'].includes(el.tagName))continue;
  const style=getComputedStyle(el);
  if(!el.getClientRects().length||style.visibility==='hidden'||style.display==='none')continue;
  const ownText=[...el.childNodes].filter(n=>n.nodeType===Node.TEXT_NODE).map(n=>n.textContent.trim()).join('').trim();
  if((ownText||el.matches('input,textarea,select'))&&parseFloat(style.fontSize)<13.99)small.push({tag:el.tagName,text:ownText.slice(0,45),size:style.fontSize,className:el.className});
 }
 return {small,overflow:document.documentElement.scrollWidth>innerWidth,zoom:visualViewport.scale};
});
try {
 const pages=[['/',null,'h1'],['/seller',null,'[data-testid="login-form"]'],['/console',null,'[data-testid="login-form"]'],['/seller','recipient','[data-testid="session-bar"]'],['/console','operator','.ag-root'],['/how-it-works',null,'h1'],['/schema',null,'[class*="treePane"]']];
 for(const width of [1440,390,320]) {
  await page.setViewportSize({width,height:1000});
  for(const [path,as,ready] of pages) {
   role=as;await page.goto(new URL(path,base).href);await page.locator(ready).first().waitFor();await page.waitForTimeout(300);
   const r=await audit();
   assert.equal(r.zoom,1);
   assert.deepEqual(r.small,[],`${path} ${as??'public'} at ${width}px has undersized text`);
   assert.equal(r.overflow,false,`${path} overflows at ${width}px`);
   if (process.env.PAYEEGUARD_READABILITY_SCREENSHOTS && path==='/' && width===390) {await page.locator('[class*="payoutIllustration"]').scrollIntoViewIfNeeded();await page.screenshot({path:'/tmp/payeeguard-readable-mobile.png'});}
   console.log(`PASS: ${path} ${as??'public'} at ${width}px, 100% zoom: readable text and no horizontal overflow`);
  }
 }
 assert.deepEqual(errors,[]);
 console.log('21 page/viewport checks passed; no API mutations or PayPal calls.');
} finally {await browser.close();}
