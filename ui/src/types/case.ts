/**
 * TypeScript types derived from docs/API_CONTRACT.md §2 Core case representation
 * and docs/STATE_MACHINE.md §1 States.
 */

/** All case states from the state machine */
export type CaseState =
  | 'CHANGE_REQUESTED'
  | 'PENDING_NEW_ACCOUNT_AUTH'
  | 'PENDING_OLD_ACCOUNT_AUTH'
  | 'PENDING_REVIEW'
  | 'APPROVED_COOLING_OFF'
  | 'REJECTED'
  | 'EXPIRED'
  | 'ACTIVE_NEW_DESTINATION'
  /** Backend: the connected account is already the active destination (no change). */
  | 'ACTIVE';

/** Evidence status values from STATE_MACHINE.md §3 */
export type AuthStatus =
  | 'NOT_STARTED'
  | 'PENDING'
  | 'VALIDATED'
  | 'MATCHED'
  | 'NOT_MATCHED'
  | 'UNAVAILABLE'
  | 'FAILED'
  | 'EXPIRED'
  | 'INVALID';

export type ReviewStatus = 'NOT_REQUIRED_YET' | 'PENDING' | 'APPROVED' | 'REJECTED';
export type CoolingOffStatus = 'NOT_STARTED' | 'ACTIVE' | 'ELAPSED';

export type PolicyDecision =
  | 'ALLOW_NO_CHANGE'
  | 'HOLD'
  | 'REQUIRE_OLD_ACCOUNT_AUTH'
  | 'REQUIRE_MARKETPLACE_REVIEW'
  | 'APPROVE_COOLING_OFF'
  | 'ACTIVATE'
  | 'REJECT'
  | 'EXPIRED';

export type AiRecommendation =
  | 'CONTINUE_REQUIRED_VERIFICATION'
  | 'ASK_FOLLOW_UP'
  | 'ESCALATE_FOR_REVIEW';

export interface MaskedDestination {
  masked_payer_id: string;
}

export interface AuthEvidence {
  status: AuthStatus;
  verified_by: string | null;
  validated_at: string | null;
}

export interface AiAssessment {
  status: 'AVAILABLE' | 'UNAVAILABLE' | 'ERROR';
  reason_category: string;
  risk_signals: string[];
  /** Trusted backend facts (risk flags, wrong or missing current-account login), stated by the backend, not the model. */
  backend_flags?: string[];
  missing_information: string[];
  recommendation: AiRecommendation;
  advisory_only: true;
  /** True when the case changed after this assessment ran. */
  stale?: boolean;
  /** What the backend rules require at minimum. It can be stricter than the AI's own suggestion. */
  effective_recommendation?: AiRecommendation;
  summary?: string;
  claims?: string[];
  follow_up_questions?: string[];
  /** Reason code when the assessment is UNAVAILABLE. */
  unavailable_reason?: string;
}

export interface AuditEvent {
  event: string;
  actor: string;
  timestamp: string;
  previous_state: CaseState | null;
  new_state: CaseState | null;
  reason: string | null;
  simulated: boolean;
}

export interface DestinationChangeCase {
  case_id: string;
  tenant_id: string;
  seller_id: string;
  state: CaseState;
  created_at: string;
  updated_at: string;
  reason: {
    seller_text: string;
    category_claimed_by_seller: string;
  };
  destinations: {
    active: MaskedDestination;
    proposed: MaskedDestination | null;
  };
  authentication: {
    new_account: AuthEvidence;
    old_account: AuthEvidence;
  };
  marketplace_review: {
    status: ReviewStatus;
    decision: string | null;
  };
  cooling_off: {
    status: CoolingOffStatus;
    ends_at: string | null;
  };
  payout_control: {
    proposed_destination_usable: boolean;
    hold_reason: string | null;
  };
  ai_assessment: AiAssessment | null;
  policy: {
    decision: PolicyDecision;
    reason_codes: string[];
    may_activate_proposed_destination: boolean;
  };
  audit_trail: AuditEvent[];
  version: number;
  /** True for demo or fixture data created by the backend simulation. */
  simulation?: boolean;
  /** Reviewer-only hints from the backend, such as OLD_ACCOUNT_MISMATCH. */
  reviewer_findings?: string[];
  expires_at?: string | null;
  /** Parts of the case the backend could not return (shown to the operator, never hidden). */
  load_warnings?: string[];
  /** Evidence a marketplace reviewer recorded (reviewer view only). */
  marketplace_evidence?: { kind: string; reference: string; accepted: boolean; at: string | null }[];
}
