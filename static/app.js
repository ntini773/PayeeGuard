'use strict';
const $ = id => document.getElementById(id);
let session, selected = null, current = null, busy = false, pollTimer, statusTimer;
const human = value => (value || '').toLowerCase().replaceAll('_', ' ').replace(/^./, c => c.toUpperCase());
const text = (id, value) => { $(id).textContent = value ?? ''; };
const show = (id, visible) => { $(id).hidden = !visible; };
function notify(message, error = false) {
  const id = error ? 'error' : 'status'; text(id, message); show(id, true);
  if (!error) setTimeout(() => show(id, false), 4500);
}
async function api(path, body) {
  const options = {credentials: 'same-origin', headers: {}};
  if (body !== undefined) {
    options.method = 'POST'; options.headers['Content-Type'] = 'application/json';
    options.headers['X-CSRF-Token'] = session?.csrf || ''; options.body = JSON.stringify(body);
  }
  const response = await fetch(path, options);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Request failed');
  return data;
}
async function task(fn) {
  if (busy) return;
  busy = true; show('error', false);
  document.querySelectorAll('button').forEach(b => { b.disabled = true; });
  try { await fn(); } catch (error) { notify(error.message, true); }
  finally { busy = false; document.querySelectorAll('button').forEach(b => { b.disabled = false; }); }
}
async function boot() {
  session = await api('/api/session');
  text('environment', session.mode === 'demo' ? 'SIMULATED DEMO' : 'PAYPAL SANDBOX');
  text('viewer', session.user ? `${session.user.id} · ${session.user.role}` : '');
  show('logout', !!session.user); show('login-view', !session.user); show('workspace', !!session.user);
  clearInterval(pollTimer);
  clearInterval(statusTimer);
  if (!session.user) return;
  const operator = session.user.role === 'operator';
  text('subtitle', operator ? 'Review recipient evidence and approve a safe next step.' : 'Tell us what happened. Verify your destination. Follow your case.');
  text('mode-banner', session.mode === 'demo' ? `SIMULATION · All accounts, PayPal statuses, cancellation failures and replacements in this workspace are simulated. AI: ${session.ai_mode}.` : 'SANDBOX · PayPal login and status checks are real sandbox calls. Marketplace records are fixtures. Cancellation may fail; replacement sending is disabled.');
  text('ai-label', session.ai_mode === 'NVIDIA' ? 'NVIDIA assistant' : 'Scripted demo');
  selected = location.hash.slice(1) || selected;
  await loadCases();
  // Poll local case state only; remote PayPal polling is an explicit Refresh status action.
  pollTimer = setInterval(async () => {
    if (!busy && selected) { try { await loadCases(false); } catch (_) { /* Keep current evidence visible if polling is interrupted. */ } }
  }, 5000);
  statusTimer = setInterval(() => {
    if (!busy && selected && current && !['CLOSED_SIMULATED', 'ORIGINAL_PAID'].includes(current.case.state)) {
      task(() => action('refresh'));
    }
  }, 30000);
}
async function loadCases(selectFirst = true) {
  const data = await api('/api/cases');
  if (!data.cases.some(c => c.id === selected)) selected = selectFirst ? data.cases[0]?.id : null;
  $('cases').replaceChildren(); text('case-count', data.cases.length);
  data.cases.forEach(c => {
    const button = document.createElement('button'); button.className = 'case-button' + (c.id === selected ? ' selected' : '');
    button.setAttribute('aria-current', c.id === selected ? 'page' : 'false');
    const name = document.createElement('span'); name.className = 'case-name'; name.textContent = `${c.id} · ${c.currency} ${c.amount}`;
    const meta = document.createElement('span'); meta.className = 'case-meta'; meta.textContent = human(c.state);
    button.append(name, meta); button.onclick = () => task(async () => { selected = c.id; location.hash = selected; await loadCases(false); });
    $('cases').append(button);
  });
  show('case-detail', !!selected); show('empty-state', !selected);
  if (selected) render(await api('/api/cases/' + selected));
}
function render(data) {
  const previous = current;
  current = data;
  const c = data.case, operator = session.user.role === 'operator', demo = session.mode === 'demo';
  const simulationComplete = demo && c.mode === 'demo' && c.state === 'CLOSED_SIMULATED' &&
    c.replacement?.simulated === true && c.replacement.status === 'SIMULATED_SUCCESS';
  text('case-id', c.id); text('case-state', simulationComplete ? 'Completed (simulation)' : human(c.state));
  text('case-title', simulationComplete ? 'Demo completed' : c.state === 'CANCELLATION_PENDING' ? 'Original payout still unresolved' : 'Payout destination verification');
  text('amount', `${c.currency} ${c.amount}`); text('paypal-status', simulationComplete ? 'RETURNED (simulated)' : c.paypal_status);
  text('original-id', `Original item · ${c.original_item_id}`);
  text('last-checked', c.status_checked_at ? new Date(c.status_checked_at * 1000).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}) : 'Not checked');
  const reasonText = {
    RECEIVER_UNREGISTERED: 'The original payout email has no registered PayPal sandbox account. Your marketplace login and your separately authenticated PayPal account can still be valid.',
    RECEIVER_UNCONFIRMED: 'The original payout destination is unconfirmed in PayPal. This is separate from your marketplace login.'
  };
  text('reason', simulationComplete ? 'Demo complete: the original return and replacement were simulated. No PayPal funds moved.' : c.reason ? `${reasonText[c.reason] || 'PayPal reported a payout issue.'} (${c.reason})` : c.paypal_status === 'UNCLAIMED' ? 'Unclaimed — cause not yet identified.' : 'Use Refresh status to retrieve current provider evidence.');
  text('original-destination', c.original_destination?.receiver ? `Originally sent to: ${c.original_destination.receiver} (${c.original_destination.recipient_type || 'destination'})` : 'Original destination will appear after a successful status refresh.');
  text('payee-name', data.payee.name); text('expected-payer', `Expected payer ID · ${data.payee.expected_payer_id}`);
  text('record-source', data.payee.record_source);
  text('authenticated-payer', c.identity ? c.identity.payer_id : 'Not authenticated');
  text('verification', c.identity ? `${c.identity.mode === 'demo' ? 'SIMULATED · ' : ''}Account verified: ${c.identity.verified_account ? 'Yes' : 'No'} · ${new Date(c.identity.authenticated_at * 1000).toLocaleTimeString()}` : 'The intended recipient must authenticate this destination.');
  show('review-request-form', !operator && data.match.sufficient && !['ESCALATED', 'AWAITING_APPROVAL', 'APPROVED', 'CANCELLATION_PENDING', 'RETURNED_NO_REPLACEMENT', 'CLOSED_SIMULATED', 'ORIGINAL_PAID'].includes(c.state));
  text('match-result', data.match.reason); $('match-result').classList.toggle('good', data.match.sufficient);
  text('proposal-title', c.proposal ? human(c.proposal.action) : 'Investigation needed');
  text('proposal-copy', c.proposal?.explanation || 'Start with the recipient’s message and actual payout status.');
  const oldMessages = $('messages').textContent;
  const nodes = c.messages.map(m => {
    const block = document.createElement('div'); block.className = 'message ' + (m.role === 'user' ? 'user' : 'assistant');
    const by = document.createElement('span'); by.className = 'by'; by.textContent = m.role === 'user' ? 'Recipient' : m.scripted ? 'Scripted demonstration' : 'Resolution assistant';
    block.append(by, document.createTextNode(m.content)); return block;
  });
  if (!nodes.length) { const empty = document.createElement('div'); empty.className = 'message empty-message'; empty.textContent = 'Every resolution starts with understanding what happened. Share your payout issue below.'; nodes.push(empty); }
  $('messages').replaceChildren(...nodes);
  if ($('messages').textContent !== oldMessages) $('messages').scrollTop = $('messages').scrollHeight;
  show('message-form', !operator); show('operator-chat-note', operator);
  show('clear-conversation', !operator && c.messages.length > 0);
  const canAuth = !operator && !['CANCELLATION_PENDING','RETURNED_NO_REPLACEMENT','CLOSED_SIMULATED','ORIGINAL_PAID'].includes(c.state);
  show('auth-actions', canAuth); show('mismatch', canAuth && demo);
  text('authenticate', demo ? 'Simulate matching PayPal login' : 'Authenticate PayPal ↗');
  show('approval-actions', operator && c.state === 'AWAITING_APPROVAL');
  text('approval-note', c.approval ? `${c.approval.approved ? 'Approved' : 'Rejected'} by ${c.approval.operator}. Approval is bound to this destination and proposal.` : operator ? (c.proposal ? 'Approval requires sufficient evidence and a destination-change proposal.' : 'No proposal has been recorded yet. The recipient must ask the assistant to prepare a destination-change proposal; a chat statement alone is not an approval request.') : 'Your marketplace operator reviews and approves any destination change.');
  show('cancel-payout', operator && c.state === 'APPROVED');
  text('cancel-payout', demo ? 'Simulate cancellation failure' : 'Attempt original cancellation (sandbox)');
  show('cancellation-result', !simulationComplete && (!!c.cancellation_error || c.state === 'CANCELLATION_PENDING' || c.state === 'RETURNED_NO_REPLACEMENT'));
  text('cancellation-result', `${c.cancellation_error || ''} ${c.state === 'RETURNED_NO_REPLACEMENT' ? 'Original returned. Replacement sending remains disabled in this fallback.' : 'No replacement sent. The original must be confirmed RETURNED before recovery.'}`);
  show('simulate', operator && demo && c.state === 'CANCELLATION_PENDING');
  show('replacement', !!c.replacement);
  text('replacement-title', simulationComplete ? 'Demo completed — simulated recovery' : 'Replacement record');
  text('replacement-copy', c.replacement ? `SIMULATED ONLY · ${c.replacement.currency} ${c.replacement.amount} replacement demonstrated. No PayPal funds moved.` : '');
  text('replacement-id', c.replacement ? `${c.replacement.status} · ${c.replacement.id}` : '');
  show('cancellation-history', simulationComplete && !!c.cancellation_error);
  text('cancellation-history-copy', c.cancellation_error ? `${c.cancellation_error}. This was an earlier step in the demonstration, before the simulated return and replacement. It is retained as history; it does not mean PayPal cancellation was fixed.` : '');
  if (!previous || previous.case.id !== c.id || previous.case.state !== c.state) $('cancellation-history').open = false;
  $('audit-list').replaceChildren(...data.audit.slice().reverse().map(a => {
    const li = document.createElement('li'), time = document.createElement('span'), detail = document.createElement('div');
    time.className = 'audit-time'; time.textContent = new Date(a.at * 1000).toLocaleTimeString();
    const event = document.createElement('div'); event.className = 'audit-event'; event.textContent = human(a.event);
    const actor = document.createElement('div'); actor.className = 'audit-actor'; actor.textContent = a.actor;
    const details = document.createElement('details'), summary = document.createElement('summary'), pre = document.createElement('pre');
    summary.textContent = 'View evidence'; pre.textContent = JSON.stringify(a.data, null, 2); details.append(summary, pre); detail.append(event, actor, details); li.append(time, detail); return li;
  }));
}
async function action(name, body = {}) {
  const result = await api(`/api/cases/${selected}/${name}`, body);
  if (result.url) { window.location.assign(result.url); return; }
  render(result); await loadCases(false);
}
$('login-form').onsubmit = e => { e.preventDefault(); task(async () => { const data = Object.fromEntries(new FormData(e.target)); await api('/api/login', data); e.target.reset(); await boot(); }); };
$('logout').onclick = () => task(async () => { await api('/api/logout', {}); selected = null; current = null; location.hash = ''; await boot(); });
$('refresh-list').onclick = () => task(() => loadCases());
$('refresh-status').onclick = () => task(() => action('refresh'));
$('message-form').onsubmit = e => { e.preventDefault(); task(async () => { notify('Investigating your message…'); await action('message', {message: $('message').value}); $('message').value = ''; show('status', false); }); };
$('clear-conversation').onclick = () => task(async () => { await action('clear-conversation'); $('message').value = ''; notify('Conversation cleared. Verification, proposals and case activity are preserved.'); });
$('review-request-form').onsubmit = e => { e.preventDefault(); task(async () => { await action('request-review', {reason: $('review-reason').value, confirmed: $('review-confirmed').checked}); e.target.reset(); notify('Proposal recorded. Your operator can now review it.'); }); };
$('authenticate').onclick = () => task(async () => { await action(session.mode === 'demo' ? 'simulate-auth' : 'authenticate', {account: 'match'}); if (session.mode === 'demo') notify('Simulated identity recorded. Ask the assistant to verify your destination.'); });
$('mismatch').onclick = () => task(() => action('simulate-auth', {account: 'mismatch'}));
$('approve').onclick = () => task(() => action('approve', {version: current.case.version}));
$('reject').onclick = () => task(() => action('reject', {version: current.case.version}));
$('cancel-payout').onclick = () => task(() => action('cancel'));
$('simulate').onclick = () => task(() => action('simulate-recovery'));
boot().catch(error => notify(error.message, true));
