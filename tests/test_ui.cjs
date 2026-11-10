// Component render checks with a DOM double, not a real-browser/layout test.
const fs = require('fs'), vm = require('vm'), assert = require('assert');
const html = fs.readFileSync('static/index.html', 'utf8');
const ids = new Set([...html.matchAll(/id="([^"]+)"/g)].map(m => m[1]));
class Element {
  constructor(tag) { this.tag = tag; this.children = []; this._text = ''; this.hidden = false; this.className = ''; this.classList = {toggle() {}}; }
  set textContent(value) { this._text = String(value); this.children = []; }
  get textContent() { return this._text + this.children.map(c => c.textContent || '').join(''); }
  append(...nodes) { this.children.push(...nodes); }
  replaceChildren(...nodes) { this._text = ''; this.children = nodes; }
  setAttribute() {}
}
const elements = new Map([...ids].map(id => [id, new Element('div')]));
const el = id => { assert(ids.has(id), `Missing HTML element ${id}`); return elements.get(id); };
const ctx = { document: {getElementById: el, createElement: tag => new Element(tag),
    createTextNode: value => ({tag: '#text', textContent: value}), querySelectorAll: () => []},
  fetch: () => new Promise(() => {}), setInterval() {}, clearInterval() {}, setTimeout() {},
  location: {hash: ''}, window: {location: {assign() {}}}, console, Date };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync('static/app.js', 'utf8'), ctx);
const fixture = {case: {id:'case-001',state:'AWAITING_APPROVAL',mode:'sandbox',amount:'0.01',currency:'USD',
  original_item_id:'ITEM',paypal_status:'UNCLAIMED',reason:null,status_checked_at:1,
  identity:{payer_id:'PAYER',verified_account:true,mode:'sandbox',authenticated_at:1},
  proposal:{action:'change_destination',explanation:'Review required'},approval:null,replacement:null,
  cancellation_error:null,messages:[{role:'user',content:'<img src=x onerror=alert(1)>'}]},
  payee:{name:'Creator',expected_payer_id:'PAYER',record_source:'Fixture'},
  match:{sufficient:true,reason:'Exact match'},audit:[]};
ctx.fixture = fixture;
vm.runInContext("session={user:{role:'recipient'},mode:'sandbox',ai_mode:'NVIDIA'};render(fixture)", ctx);
assert(el('approval-actions').hidden);
assert(!el('message-form').hidden);
assert(el('simulate').hidden);
assert(el('reason').textContent.includes('cause not yet identified'));
assert.equal(el('messages').children[0].children[1].tag, '#text');
assert.equal(el('messages').children[0].children[1].textContent, '<img src=x onerror=alert(1)>');
vm.runInContext("session.user.role='operator';render(fixture)", ctx);
assert(!el('approval-actions').hidden);
assert(el('message-form').hidden);
assert(el('auth-actions').hidden);
fixture.case.state = 'CANCELLATION_PENDING'; fixture.case.cancellation_error = 'HTTP 500';
vm.runInContext('render(fixture)', ctx);
assert(el('approval-actions').hidden);
assert(el('simulate').hidden);
assert(el('cancellation-result').textContent.includes('No replacement sent'));
vm.runInContext("session.mode='demo';render(fixture)", ctx);
assert(!el('simulate').hidden);
fixture.case.state='CLOSED_SIMULATED';
fixture.case.replacement={id:'SIM-ONLY',status:'SIMULATED_SUCCESS',amount:'0.01',currency:'USD'};
vm.runInContext('render(fixture)', ctx);
assert(el('simulate').hidden);
assert(el('replacement').textContent.includes('SIMULATED ONLY'));
assert(el('replacement').textContent.includes('No PayPal funds moved'));
console.log('PASS: role controls, sandbox/simulation separation, unknown cause, failure state and text-only user content (DOM double).');
fixture.case.state='NEEDS_INFORMATION'; fixture.case.proposal={action:'clarify',explanation:'Why change?'};
vm.runInContext("session.user.role='recipient';render(fixture)", ctx);
assert(!el('review-request-form').hidden);
fixture.match.sufficient=false;
vm.runInContext('render(fixture)', ctx);
assert(el('review-request-form').hidden);
fixture.match.sufficient=true;
vm.runInContext("session.user.role='operator';render(fixture)", ctx);
assert(el('review-request-form').hidden);
console.log('PASS: explicit review request is shown only to a verified matching recipient before approval.');
