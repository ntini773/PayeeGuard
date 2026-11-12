/** Seller cancellation through the real UI/client with HTTP fixtures only. */
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
const base=new URL(process.env.PAYEEGUARD_UI_URL ?? 'http://127.0.0.1:5175');
assert(['localhost','127.0.0.1','[::1]'].includes(base.hostname));
const browser=await chromium.launch({channel:'chrome',headless:true});
const context=await browser.newContext({viewport:{width:1280,height:1000}});
await context.addCookies([{name:'fixture_session',value:'synthetic-only',url:base.origin}]);
const page=await context.newPage();
const errors=[];
page.on('pageerror',e=>errors.push(e.message));
const id='chg_'+'1'.repeat(32);
let state='PENDING_REVIEW', role='recipient', outcome='success', writes=[];
const view=()=>({case_id:id,state,version:4,simulation:true,created_at:1700000000,destinations:{active:{masked_payer_id:'***-AAAA'},proposed:{masked_payer_id:'***-BBBB'}},reason:{seller_text:'Synthetic test request'},cooling_off:{status:state==='APPROVED_COOLING_OFF'?'WAITING':'NOT_STARTED',ends_at:2000000000},payout_control:{proposed_destination_usable:false}});
await page.route(url=>url.pathname.startsWith('/api/'),async route=>{
 const req=route.request(),path=new URL(req.url()).pathname;
 const send=(data,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(data)});
 if(path==='/api/session') return send({user:{id:'fixture-seller',role},csrf:'synthetic-csrf',mode:'demo',ai_mode:'unavailable'});
 if(req.method()==='POST') {
  writes.push({path,headers:await req.allHeaders(),body:req.postData()});
  if(path===`/api/v1/destination-change-requests/${id}/cancel`) {
   if(outcome==='conflict') {state='ACTIVE_NEW_DESTINATION';return send({error:{code:'CASE_STATE_CONFLICT'}},409);}
   if(outcome==='forbidden') return send({error:{code:'REQUEST_DENIED'}},403);
   state='REJECTED';return send(view());
  }
  return send({error:{code:'UNEXPECTED_WRITE'}},400);
 }
 if(path==='/api/v1/destination-change-requests') return send({cases:[view()]});
 if(path==='/api/v1/marketplace-payouts') return send({earnings:[],payouts:[]});
 return send({});
});
const visit=async()=>{await page.goto(new URL('/seller',base).href);await page.getByTestId('session-bar').waitFor();};
const cancel=()=>page.getByRole('button',{name:'Cancel this request',exact:true});
try {
 for(const s of ['CHANGE_REQUESTED','PENDING_NEW_ACCOUNT_AUTH','PENDING_OLD_ACCOUNT_AUTH','PENDING_REVIEW','APPROVED_COOLING_OFF']) {
  state=s;await visit();assert(await cancel().isVisible());
 }
 console.log('PASS: seller cancel available in all open states and the safety wait');
 await cancel().click();
 const dialog=page.getByRole('dialog',{name:'Cancel this request?',exact:true});
 await dialog.waitFor();
 assert.equal(await page.evaluate(()=>document.activeElement.textContent),'Keep request');
 await page.keyboard.press('Escape');
 await dialog.waitFor({state:'hidden'});
 assert.equal(writes.length,0);
 await cancel().click();await dialog.getByRole('button',{name:'Keep request',exact:true}).click();
 assert.equal(writes.length,0);
 console.log('PASS: confirmation defaults to keeping request; Escape and dismiss send no request');
 await cancel().click();await dialog.getByRole('button',{name:'Yes, cancel request',exact:true}).click();
 await page.getByTestId('request-cancelled').waitFor();
 assert.equal(await page.getByTestId('request-cancelled').textContent(),'Request cancelled. Payouts still go to your current account.');
 assert.equal(writes.length,1);
 assert.equal(writes[0].path,`/api/v1/destination-change-requests/${id}/cancel`);
 assert.equal(writes[0].body,'{}');
 assert.equal(writes[0].headers['x-csrf-token'],'synthetic-csrf');
 assert(writes[0].headers.cookie.includes('fixture_session=synthetic-only'));
 assert.equal(await cancel().count(),0);
 console.log('PASS: confirmation posts once with CSRF/session and renders backend success');
 state='APPROVED_COOLING_OFF';outcome='conflict';await visit();
 await cancel().click();await dialog.getByRole('button',{name:'Yes, cancel request',exact:true}).click();
 await page.getByText('This request can no longer be cancelled. Its state changed; check the latest status below.',{exact:true}).waitFor();
 await page.getByTestId('next-done').waitFor();
 assert.equal(await page.getByTestId('request-cancelled').count(),0);
 assert.equal(await cancel().count(),0);
 console.log('PASS: activation race refreshes case on 409, without a false cancellation success');
 state='PENDING_REVIEW';outcome='forbidden';await visit();
 await cancel().click();await dialog.getByRole('button',{name:'Yes, cancel request',exact:true}).click();
 await page.getByText('Your account is not allowed to change payout accounts. Ask the marketplace for access.',{exact:true}).waitFor();
 assert.equal(await page.getByTestId('request-cancelled').count(),0);
 assert(await cancel().isVisible());
 console.log('PASS: forbidden cancellation displays error and retains the current request');
 for(const s of ['ACTIVE_NEW_DESTINATION','REJECTED','EXPIRED']) {state=s;await visit();assert.equal(await cancel().count(),0);}
 role='operator';state='PENDING_REVIEW';await visit();
 await page.getByTestId('not-a-seller').waitFor();assert.equal(await cancel().count(),0);
 assert.deepEqual(errors,[]);
 console.log('PASS: no cancel control for closed/active cases or operator; no uncaught errors');
 console.log('6 browser check groups passed. All API traffic intercepted; no database mutation or PayPal calls.');
} finally {await browser.close();}
