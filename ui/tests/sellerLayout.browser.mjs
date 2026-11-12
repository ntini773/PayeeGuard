/** Synthetic HTTP fixtures: seller chat containment and primary-step ordering. */
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
const base=new URL(process.env.PAYEEGUARD_UI_URL ?? 'http://127.0.0.1:5175');
assert(['localhost','127.0.0.1','[::1]'].includes(base.hostname));
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1000}});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
let releaseReply, notify;
const reply=('This is synthetic, read-only guidance. '+ 'longword'.repeat(40)+'\n\n').repeat(9);
const fixture={case_id:'chg_'+'1'.repeat(32),state:'PENDING_NEW_ACCOUNT_AUTH',simulation:true,version:1,created_at:1700000000,destinations:{active:{masked_payer_id:'***-AAAA'},proposed:{masked_payer_id:'***-BBBB'}},reason:{seller_text:'Synthetic test'}};
await page.route(url=>url.pathname.startsWith('/api/'), async route=>{
 const path=new URL(route.request().url()).pathname;
 let body={};
 if(path==='/api/session')body={user:{id:'fixture-seller',role:'recipient'},csrf:'fixture-csrf',mode:'demo',ai_mode:'unavailable'};
 else if(path==='/api/v1/destination-change-requests')body={cases:[fixture]};
 else if(path==='/api/v1/marketplace-payouts')body={earnings:[],payouts:[]};
 else if(path==='/api/v1/seller-guide') {await new Promise(resolve=>{releaseReply=resolve;notify();});body={reply,source:'scripted'};}
 else if(route.request().method()!=='GET')return route.abort();
 return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)});
});
try {
 for(const width of [1440,390,320]) {
  await page.setViewportSize({width,height:1000});
  await page.goto(new URL('/seller',base).href);
  await page.getByTestId('next-new').waitFor();
  const order=await page.evaluate(()=>{
   const next=document.querySelector('[data-testid="next-new"]');
   const cancel=document.querySelector('[data-testid="seller-cancel"]');
   return next.contains(cancel);
  });
  assert(order,'Cancel must be inside the PayPal step box');
  const chat=page.getByTestId('guide-chat');
  await chat.getByRole('textbox',{name:'Message to the help chat'}).fill('long-message-'.repeat(35));
  const called=new Promise(resolve=>{notify=resolve;});
  await chat.getByRole('button',{name:'Send',exact:true}).click();
  await called;
  const before=await page.evaluate(()=>scrollY);
  releaseReply();
  await chat.getByText('Built-in guide',{exact:true}).waitFor();
  await page.waitForTimeout(100);
  const result=await chat.evaluate(el=>{
   const panel=el.getBoundingClientRect(),log=el.querySelector('[role="log"]');
   const bubbles=[...log.children];
   return {
    pageOverflow:document.documentElement.scrollWidth>innerWidth,
    panelOverflow:el.scrollWidth>el.clientWidth,
    logOverflowX:log.scrollWidth>log.clientWidth,
    logScrolls:log.scrollHeight>log.clientHeight,
    atBottom:Math.abs(log.scrollHeight-log.clientHeight-log.scrollTop)<3,
    controlsFit:[...el.querySelectorAll('button,input')].every(x=>{const b=x.getBoundingClientRect();return b.left>=panel.left&&b.right<=panel.right+1;}),
    bubblesFit:bubbles.every(x=>{const b=x.getBoundingClientRect();return b.left>=panel.left&&b.right<=panel.right+1;}),
    scrollY,
   };
  });
  assert.equal(result.pageOverflow,false);
  assert.equal(result.panelOverflow,false);
  assert.equal(result.logOverflowX,false);
  assert(result.controlsFit&&result.bubblesFit);
  assert(result.logScrolls&&result.atBottom);
  assert(Math.abs(result.scrollY-before)<=3,`Reply scrolled the page by ${result.scrollY-before}px`);
  console.log(`PASS: ${width}px: PayPal before Cancel, long chat contained, internal scrolling, no page jump`);
 }
 assert.deepEqual(errors,[]);
 console.log('3 viewport checks passed; all API responses synthetic, no PayPal calls.');
} finally {await browser.close();}
