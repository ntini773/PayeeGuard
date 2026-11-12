import { USE_MOCK_DATA, API_BASE_URL } from '../config';
import type { DestinationChangeCase } from '../types/case';
import mockCases from '../mock/cases.json';
import { adaptCase } from './adapter';

let cachedCsrfToken: string | null = null;

/** Thrown when the backend says there is no valid session (HTTP 401). */
export class AuthRequiredError extends Error {
  constructor() {
    super('Sign in to view the operator queue.');
    this.name = 'AuthRequiredError';
  }
}

export interface SessionInfo {
  user: { id: string; role: string } | null;
  csrf: string | null;
  mode: string;
  ai_mode: string;
}

/** GET /api/session. The backend names the token field `csrf`. */
export async function fetchSession(): Promise<SessionInfo> {
  if (USE_MOCK_DATA) {
    return { user: { id: 'mock-operator', role: 'operator' }, csrf: 'mock-csrf-token', mode: 'mock', ai_mode: 'mock' };
  }
  const res = await fetch('/api/session', { credentials: 'include' });
  if (!res.ok) {
    // The dev proxy answers 500 or 502 when nothing listens on the backend port.
    throw new Error(res.status >= 500
      ? `The backend is not reachable (HTTP ${res.status}). Start it with "pixi run start" (or "pixi run demo"), then reload.`
      : `Session check failed: ${res.status}`);
  }
  const data = await res.json();
  cachedCsrfToken = typeof data.csrf === 'string' ? data.csrf : null;
  return {
    user: data.user ?? null,
    csrf: cachedCsrfToken,
    mode: String(data.mode ?? ''),
    ai_mode: String(data.ai_mode ?? ''),
  };
}

/** POST /api/login. The session cookie is HttpOnly. The UI never sees or stores it. */
export async function login(username: string, password: string): Promise<void> {
  const res = await fetch('/api/login', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) {
    throw new Error(res.status === 429 ? 'Too many attempts. Wait a minute.' : 'Invalid username or password.');
  }
  cachedCsrfToken = null;
}

export async function logout(): Promise<void> {
  if (USE_MOCK_DATA) return;
  const csrf = await getCsrfToken();
  await fetch('/api/logout', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(csrf ? { 'X-CSRF-Token': csrf } : {}) },
    body: '{}',
  });
  cachedCsrfToken = null;
}

export async function getCsrfToken(): Promise<string | null> {
  if (USE_MOCK_DATA) return 'mock-csrf-token';
  if (cachedCsrfToken) return cachedCsrfToken;
  try {
    return (await fetchSession()).csrf;
  } catch {
    return null;
  }
}

async function getJson(url: string): Promise<unknown> {
  const res = await fetch(url, { credentials: 'include' });
  if (res.status === 401) throw new AuthRequiredError();
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(`Request failed (${res.status}${body?.error?.code ? ' ' + body.error.code : ''})`);
  }
  return res.json();
}

/**
 * Fetch the operator queue: GET /api/v1/cases, following next_cursor (docs/archive/HANDOFF_UI.md).
 * Rows are short summaries. Detail comes from fetchCase().
 */
export async function fetchCases(): Promise<DestinationChangeCase[]> {
  if (USE_MOCK_DATA) {
    return Promise.resolve(mockCases as unknown as DestinationChangeCase[]);
  }
  const all: DestinationChangeCase[] = [];
  let cursor: string | null = null;
  for (let page = 0; page < 10; page += 1) {
    const url: string = `${API_BASE_URL}/cases?limit=50${cursor ? `&before=${encodeURIComponent(cursor)}` : ''}`;
    const data = (await getJson(url)) as { cases?: unknown[]; next_cursor?: string | null };
    for (const row of data.cases ?? []) all.push(adaptCase(row));
    cursor = data.next_cursor ?? null;
    if (!cursor) break;
  }
  return all;
}

/**
 * Fetch a single case by ID.
 * GET /api/v1/destination-change-requests/{case_id}
 */
export async function fetchCase(caseId: string): Promise<DestinationChangeCase> {
  if (USE_MOCK_DATA) {
    const cases = mockCases as unknown as DestinationChangeCase[];
    const found = cases.find((c) => c.case_id === caseId);
    if (!found) throw new Error(`Case not found: ${caseId}`);
    return Promise.resolve(found);
  }

  const base = `${API_BASE_URL}/destination-change-requests/${encodeURIComponent(caseId)}`;
  // The detail view is required. Summary (reviewer policy findings) and events are
  // optional, so one failing side endpoint does not hide the case from the operator.
  const [view, summary, events] = await Promise.allSettled([
    getJson(base), getJson(`${base}/summary`), getJson(`${base}/events`),
  ]);
  if (view.status === 'rejected') throw view.reason;
  const settled = <T,>(r: PromiseSettledResult<T>): T | undefined => (r.status === 'fulfilled' ? r.value : undefined);
  const eventList = settled(events) as { events?: unknown } | undefined;
  const loaded = adaptCase(view.value, settled(summary), eventList?.events);
  const missing = [summary.status === 'rejected' ? 'policy summary' : '', events.status === 'rejected' ? 'audit events' : '']
    .filter(Boolean);
  return missing.length ? { ...loaded, load_warnings: missing } : loaded;
}

/** Plain-English text for backend error codes shown after a review attempt. */
export function reviewErrorText(code: string | undefined): string {
  switch (code) {
    case 'CASE_VERSION_CONFLICT': return 'Someone changed this case. Reload.';
    case 'POLICY_REVIEW_REQUIRED': return 'Approval is blocked until marketplace evidence is recorded and confirms the request. Record the evidence first.';
    case 'CASE_STATE_CONFLICT': return 'This case is no longer waiting for review.';
    case 'REQUEST_DENIED':
    case 'SELLER_SCOPE_DENIED': return 'Your account has no review permission for this seller.';
    case 'AUTH_REQUIRED': return 'Your session ended. Sign in again.';
    default: return `The backend refused this action (${code ?? 'unknown'}).`;
  }
}

/**
 * Submit operator review authorization.
 * POST /api/v1/destination-change-requests/{case_id}/review
 */
export async function submitReview(
  caseId: string,
  decision: 'APPROVE' | 'REJECT',
  reason: string,
  expectedVersion: number
): Promise<{ success: boolean; conflict?: boolean; error?: string }> {
  if (USE_MOCK_DATA) {
    return Promise.resolve({ success: true });
  }

  const csrf = await getCsrfToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (csrf) {
    headers['X-CSRF-Token'] = csrf;
  }

  const res = await fetch(`${API_BASE_URL}/destination-change-requests/${caseId}/review`, {
    method: 'POST',
    headers,
    credentials: 'include',
    body: JSON.stringify({
      decision,
      reason,
      expected_version: expectedVersion,
    }),
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    const code: string = errData?.error?.code || `HTTP_${res.status}`;
    // Only a version conflict means "reload". Other 409 codes explain what the backend needs.
    return { success: false, conflict: code === 'CASE_VERSION_CONFLICT', error: code };
  }

  return { success: true };
}

// ---------------------------------------------------------------------------
// Seller side. These call the same documented endpoints the operator UI uses.
// The seller never approves anything: the backend decides every step.
// ---------------------------------------------------------------------------

export class ApiError extends Error {
  constructor(public code: string, public status: number) {
    super(code);
    this.name = 'ApiError';
  }
}

async function postJson(path: string, body: unknown, idempotencyKey?: string): Promise<unknown> {
  const csrf = await getCsrfToken();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (csrf) headers['X-CSRF-Token'] = csrf;
  if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST', headers, credentials: 'include', body: JSON.stringify(body),
  });
  if (res.status === 401) throw new AuthRequiredError();
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data?.error?.code || `HTTP_${res.status}`, res.status);
  return data;
}

/** Plain-English text for a backend error code on a seller action. */
export function sellerErrorText(code: string): string {
  switch (code) {
    case 'CASE_STATE_CONFLICT': return 'You already have an open request, or this step is not available now.';
    case 'REQUEST_DENIED':
    case 'SELLER_SCOPE_DENIED': return 'Your account is not allowed to change payout accounts. Ask the marketplace for access.';
    case 'RATE_LIMITED': return 'Too many tries. Wait a minute and try again.';
    case 'INVALID_REQUEST': return 'The backend did not accept that text. Shorten it and try again.';
    case 'PAYPAL_AUTH_PENDING': return 'PayPal login is not available in this mode.';
    case 'PAYPAL_CALLBACK_INVALID': return 'PayPal login was not accepted. Start the login again from this page.';
    default: return `The backend refused this action (${code}).`;
  }
}

/** The signed-in seller's own requests, newest first. */
export async function listMyCases(): Promise<DestinationChangeCase[]> {
  const data = (await getJson(`${API_BASE_URL}/destination-change-requests?limit=20`)) as { cases?: unknown[] };
  return (data.cases ?? []).map((c) => adaptCase(c));
}

export async function createRequest(reasonText: string, category: string): Promise<DestinationChangeCase> {
  const key = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : String(Date.now());
  const body: Record<string, string> = { reason_text: reasonText };
  if (category) body.reason_category = category;
  return adaptCase(await postJson('/destination-change-requests', body, key));
}

/** Seller intent only. The backend checks ownership and whether cancellation is still allowed. */
export async function cancelRequest(caseId: string): Promise<DestinationChangeCase> {
  return adaptCase(await postJson(`/destination-change-requests/${encodeURIComponent(caseId)}/cancel`, {}));
}

/** Starts a PayPal login. Returns the PayPal URL to send the browser to. */
export async function beginPayPalLogin(caseId: string, purpose: 'NEW' | 'OLD'): Promise<string> {
  const data = (await postJson(`/destination-change-requests/${encodeURIComponent(caseId)}/auth/${purpose}`, {})) as {
    authorization_url?: string;
  };
  if (!data.authorization_url) throw new ApiError('NO_AUTHORIZATION_URL', 200);
  return data.authorization_url;
}

export async function requestRecovery(caseId: string, reasonText: string): Promise<DestinationChangeCase> {
  return adaptCase(await postJson(`/destination-change-requests/${encodeURIComponent(caseId)}/recovery`, { reason_text: reasonText }));
}

// ---------------------------------------------------------------------------
// Seller help chat and the operator's live AI review.
// ---------------------------------------------------------------------------

export interface GuideTurn { role: 'user' | 'assistant'; text: string }

/** The help chat never sees a case. If the AI is down, the backend answers from a fixed script. */
export async function askSellerGuide(history: GuideTurn[]): Promise<{ reply: string; source: 'ai' | 'scripted' }> {
  const data = (await postJson('/seller-guide', { messages: history.slice(-8) })) as { reply?: string; source?: string };
  return { reply: String(data.reply ?? ''), source: data.source === 'ai' ? 'ai' : 'scripted' };
}

/** The dashboard assistant picks one pre-built view from a fixed menu. Two separate model calls (router, then checker) and code-parsed days. */
export interface AssistAnswer { view: string | null; title?: string; days?: number | null; source?: 'ai' | 'rules'; verified?: boolean; message?: string; suggestions?: string[] }
export async function askDashboard(question: string): Promise<AssistAnswer> {
  const d = (await postJson('/dashboard-assist', { question })) as Record<string, unknown>;
  return {
    view: typeof d.view === 'string' ? d.view : null, title: typeof d.title === 'string' ? d.title : undefined,
    days: typeof d.days === 'number' ? d.days : null, source: d.source === 'ai' ? 'ai' : 'rules', verified: d.verified === true,
    message: typeof d.message === 'string' ? d.message : undefined, suggestions: Array.isArray(d.suggestions) ? d.suggestions.map(String).slice(0, 4) : undefined,
  };
}

/** Drafts the request text from the chat. It only returns text: the seller must confirm, and the page submits it, never the model. */
export async function draftSellerRequest(history: GuideTurn[]): Promise<{ reason_text: string; reason_category: string }> {
  const d = (await postJson('/seller-guide/draft', { messages: history.slice(-8) })) as { reason_text?: string; reason_category?: string };
  return { reason_text: String(d.reason_text ?? ''), reason_category: String(d.reason_category ?? 'other') };
}

export interface AiReviewEvent { seq: number; at: number; kind: string; label: string; detail?: string }
export interface AiReviewStatus { run_id: string; status: 'running' | 'done' | 'failed'; events: AiReviewEvent[] }

/** Starts a read-only AI review of one case. Operators only. */
export async function startAiReview(caseId: string): Promise<string> {
  const data = (await postJson(`/destination-change-requests/${encodeURIComponent(caseId)}/ai-review`, {})) as { run_id?: string };
  if (!data.run_id) throw new ApiError('NO_RUN_ID', 200);
  return data.run_id;
}

export async function getAiReview(caseId: string, runId: string): Promise<AiReviewStatus> {
  return (await getJson(`${API_BASE_URL}/destination-change-requests/${encodeURIComponent(caseId)}/ai-review/${runId}`)) as AiReviewStatus;
}

/** Reviewer-only: record what the marketplace's own records show. Needed before the backend accepts an approval. */
export async function recordEvidence(
  caseId: string,
  evidence: { kind: 'SELLER_ENTITLEMENT' | 'ACCOUNT_RECOVERY'; reference: string; reason: string; accepted: boolean; expectedVersion: number },
): Promise<DestinationChangeCase> {
  return adaptCase(await postJson(`/destination-change-requests/${encodeURIComponent(caseId)}/evidence`, {
    kind: evidence.kind, reference: evidence.reference, reason: evidence.reason,
    accepted: evidence.accepted, expected_version: evidence.expectedVersion,
  }));
}

/** Seller: a note to the marketplace on an open request. The backend treats it as an untrusted claim. */
export async function sendSellerMessage(caseId: string, message: string): Promise<DestinationChangeCase> {
  const key = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : String(Date.now());
  return adaptCase(await postJson(`/destination-change-requests/${encodeURIComponent(caseId)}/messages`, { message }, key));
}

// ---------------------------------------------------------------------------
// Marketplace payouts (operator). The gate pays only the backend-stored active account.
// There is no way to choose an amount or an account from the UI.
// ---------------------------------------------------------------------------

export interface PayoutOperation {
  status: string;
  provider_status: string;
  amount: string;
  currency: string;
  needs_attention: boolean;
  simulation: boolean;
}
export interface Earning { earning_id: string; amount: string; currency: string; received_at?: number; payout: PayoutOperation | null }

export async function listEarnings(): Promise<Earning[]> {
  const data = (await getJson(`${API_BASE_URL}/marketplace-payouts`)) as { earnings?: Earning[] };
  return data.earnings ?? [];
}

export async function executePayout(earningId: string): Promise<PayoutOperation> {
  const data = (await postJson(`/marketplace-payouts/${encodeURIComponent(earningId)}/execute`, {})) as { operation: PayoutOperation };
  return data.operation;
}

export async function reconcilePayout(earningId: string): Promise<PayoutOperation> {
  const data = (await postJson(`/marketplace-payouts/${encodeURIComponent(earningId)}/reconcile`, {})) as { operation: PayoutOperation };
  return data.operation;
}

export function payoutErrorText(code: string): string {
  switch (code) {
    case 'PAYOUT_HELD': return 'The payout gate is holding payouts for this seller right now.';
    case 'SIMULATION_FORBIDDEN': return 'This payout mode does not match the backend mode.';
    case 'REQUEST_DENIED':
    case 'SELLER_SCOPE_DENIED': return 'Only a marketplace operator can run payouts.';
    default: return `The backend refused this action (${code}).`;
  }
}
