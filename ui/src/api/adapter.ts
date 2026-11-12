/**
 * Adapters from the real backend JSON (docs/archive/HANDOFF_UI.md, rescue/destination_service.py)
 * to the UI's DestinationChangeCase. The backend sends epoch seconds and its own enum
 * spellings. This file only renames and converts. It never decides anything: policy,
 * approval and cooling-off values are copied from the backend as received.
 */
import type {
  AiAssessment, AiRecommendation, AuditEvent, AuthEvidence, AuthStatus, CaseState,
  CoolingOffStatus, DestinationChangeCase, PolicyDecision, ReviewStatus,
} from '../types/case';

type Json = Record<string, unknown>;
const obj = (v: unknown): Json => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Json) : {});
const str = (v: unknown, fallback = ''): string => (typeof v === 'string' ? v : fallback);
const list = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);

/** Epoch seconds (or an ISO string) to an ISO string. Missing or invalid gives null. */
export function toIso(value: unknown): string | null {
  if (typeof value === 'number' && Number.isFinite(value)) return new Date(value * 1000).toISOString();
  if (typeof value === 'string' && !Number.isNaN(Date.parse(value))) return value;
  return null;
}

const COOLING: Record<string, CoolingOffStatus> = {
  WAITING: 'ACTIVE', COMPLETE: 'ELAPSED', NOT_STARTED: 'NOT_STARTED', INVALIDATED: 'NOT_STARTED',
};

const POLICY: Record<string, PolicyDecision> = {
  ALLOW_NO_CHANGE: 'ALLOW_NO_CHANGE', HOLD: 'HOLD', REQUIRE_OLD_ACCOUNT_AUTH: 'REQUIRE_OLD_ACCOUNT_AUTH',
  REQUIRE_MARKETPLACE_REVIEW: 'REQUIRE_MARKETPLACE_REVIEW', PENDING_REVIEW: 'REQUIRE_MARKETPLACE_REVIEW',
  APPROVE_COOLING_OFF: 'APPROVE_COOLING_OFF', ACTIVATE: 'ACTIVATE', ACTIVE_NEW_DESTINATION: 'ACTIVATE',
  REJECTED: 'REJECT', REJECT: 'REJECT', EXPIRED: 'EXPIRED',
};

const KNOWN_STATES = new Set<string>([
  'CHANGE_REQUESTED', 'PENDING_NEW_ACCOUNT_AUTH', 'PENDING_OLD_ACCOUNT_AUTH', 'PENDING_REVIEW',
  'APPROVED_COOLING_OFF', 'REJECTED', 'EXPIRED', 'ACTIVE_NEW_DESTINATION', 'ACTIVE',
]);

function adaptState(raw: unknown): CaseState {
  const s = str(raw);
  // An unknown state is shown as the most restrictive known one, never as approved.
  return (KNOWN_STATES.has(s) ? s : 'PENDING_REVIEW') as CaseState;
}

function adaptAuth(raw: unknown): AuthEvidence {
  const a = obj(raw);
  return {
    status: (str(a.status, 'NOT_STARTED') as AuthStatus),
    verified_by: typeof a.verified_by === 'string' ? a.verified_by : null,
    validated_at: toIso(a.validated_at),
  };
}

function adaptAssessment(raw: unknown): AiAssessment | null {
  const outer = obj(raw);
  if (!Object.keys(outer).length) return null;
  const inner = obj(outer.assessment);
  const effective = str(outer.effective_recommendation) || str(inner.recommendation, 'ESCALATE_FOR_REVIEW');
  // Show the AI's own suggestion. The rules' minimum is kept next to it, because it can be stricter.
  const recommendation = str(inner.recommendation) || effective;
  return {
    status: inner.status === 'UNAVAILABLE' ? 'UNAVAILABLE' : 'AVAILABLE',
    reason_category: str(inner.reason_category, 'UNKNOWN'),
    risk_signals: list(inner.risk_signals),
    // Trusted flags stated by the backend. Undefined for an assessment saved before the backend sent them.
    backend_flags: Array.isArray(inner.backend_flags) ? list(inner.backend_flags) : undefined,
    missing_information: list(inner.missing_information),
    recommendation: recommendation as AiRecommendation,
    effective_recommendation: effective as AiRecommendation,
    advisory_only: true,
    stale: outer.stale === true,
    summary: typeof inner.summary === 'string' ? inner.summary : undefined,
    claims: list(inner.claims),
    follow_up_questions: list(inner.follow_up_questions),
    unavailable_reason: typeof inner.reason_code === 'string' ? inner.reason_code : undefined,
  };
}

export function adaptEvents(raw: unknown, simulated: boolean): AuditEvent[] {
  const events = Array.isArray(raw) ? raw : [];
  return events.map((e) => {
    const ev = obj(e);
    const d = obj(ev.details);
    return {
      event: str(ev.event, 'UNKNOWN'),
      actor: str(ev.actor, 'backend'),
      timestamp: toIso(ev.at) ?? '',
      previous_state: (d.previous_state ? adaptState(d.previous_state) : null),
      new_state: (d.new_state ? adaptState(d.new_state) : null),
      reason: typeof d.reason === 'string' ? d.reason : null,
      simulated,
    };
  });
}

/** One backend case (list row or detail view) plus optional summary and events. */
export function adaptCase(rawView: unknown, rawSummary?: unknown, rawEvents?: unknown): DestinationChangeCase {
  const v = obj(rawView);
  const summary = obj(rawSummary);
  const findings = obj(summary.policy_findings);
  const state = adaptState(v.state);
  const simulated = v.simulation === true;
  const dest = obj(v.destinations);
  const review = obj(v.marketplace_review);
  const cooling = obj(v.cooling_off);
  const payout = obj(v.payout_control);
  const auth = obj(v.authentication);
  const reason = obj(v.reason);
  const created = toIso(v.created_at) ?? '';
  const decisionRaw = str(findings.decision) || str(v.policy_decision);
  const proposed = obj(dest.proposed).masked_payer_id;

  return {
    case_id: str(v.case_id),
    tenant_id: str(v.tenant_id),
    seller_id: str(v.seller_id),
    state,
    created_at: created,
    updated_at: toIso(v.updated_at) ?? created,
    reason: {
      seller_text: str(reason.seller_text),
      category_claimed_by_seller: str(reason.category_claimed_by_seller),
    },
    destinations: {
      active: { masked_payer_id: str(obj(dest.active).masked_payer_id, '—') },
      proposed: typeof proposed === 'string' ? { masked_payer_id: proposed } : null,
    },
    authentication: { new_account: adaptAuth(auth.new_account), old_account: adaptAuth(auth.old_account) },
    marketplace_review: {
      status: (review.decision === 'APPROVED' ? 'APPROVED' : review.decision === 'REJECTED' ? 'REJECTED'
        : state === 'PENDING_REVIEW' ? 'PENDING' : 'NOT_REQUIRED_YET') as ReviewStatus,
      decision: typeof review.decision === 'string' ? review.decision : null,
    },
    cooling_off: {
      status: COOLING[str(cooling.status, 'NOT_STARTED')] ?? 'NOT_STARTED',
      ends_at: toIso(cooling.ends_at),
    },
    payout_control: {
      proposed_destination_usable: payout.proposed_destination_usable === true,
      hold_reason: typeof payout.hold_reason === 'string' ? payout.hold_reason : null,
    },
    ai_assessment: adaptAssessment(v.ai_assessment),
    policy: {
      decision: POLICY[decisionRaw] ?? 'HOLD',
      reason_codes: list(findings.reason_codes),
      may_activate_proposed_destination: findings.may_activate_proposed_destination === true,
    },
    audit_trail: adaptEvents(rawEvents, simulated),
    version: typeof v.version === 'number' ? v.version : 0,
    simulation: simulated,
    reviewer_findings: list(v.reviewer_findings),
    expires_at: toIso(v.expires_at),
    marketplace_evidence: Array.isArray(summary.marketplace_evidence)
      ? (summary.marketplace_evidence as Json[]).map((e) => ({
          kind: str(e.kind), reference: str(e.reference), accepted: e.accepted === true, at: toIso(e.at),
        }))
      : undefined,
  };
}
