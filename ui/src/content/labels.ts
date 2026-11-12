/**
 * Humanized label mappings for machine codes and enums.
 * Referenced by BRIEF_MOTION_GRAPHS_SCHEMAS.md § 10.2
 *
 * Rules:
 * - 1 to 4 words per label
 * - No raw enum strings in primary UI
 * - Raw codes preserved in tooltips or details view
 */

export const STATE_LABELS: Record<string, { label: string; sentence: string; chip: string; tone: 'held' | 'cooling' | 'active' | 'blocked' | 'expired' }> = {
  CHANGE_REQUESTED: {
    label: 'Change Requested',
    chip: 'Held',
    sentence: 'The new account cannot be paid yet.',
    tone: 'held',
  },
  PENDING_NEW_ACCOUNT_AUTH: {
    label: 'Awaiting New Account Login',
    chip: 'Held',
    sentence: 'The new account cannot be paid yet.',
    tone: 'held',
  },
  PENDING_OLD_ACCOUNT_AUTH: {
    label: 'Awaiting Prior Account Login',
    chip: 'Held',
    sentence: 'The new account cannot be paid yet.',
    tone: 'held',
  },
  PENDING_REVIEW: {
    label: 'Held for Operator Review',
    chip: 'Held',
    sentence: 'The new account cannot be paid yet.',
    tone: 'held',
  },
  APPROVED_COOLING_OFF: {
    label: 'Cooling-Off Period Active',
    chip: 'Cooling off',
    sentence: 'Approved. Waiting for cooling-off period to elapse.',
    tone: 'cooling',
  },
  ACTIVE_NEW_DESTINATION: {
    label: 'Active & Verified',
    chip: 'Active',
    sentence: 'The approved account now receives payouts.',
    tone: 'active',
  },
  REJECTED: {
    label: 'Blocked / Rejected',
    chip: 'Blocked',
    sentence: 'The change was rejected. The proposed account stays unused.',
    tone: 'blocked',
  },
  EXPIRED: {
    label: 'Request Expired',
    chip: 'Expired',
    sentence: 'The request expired without the required evidence.',
    tone: 'expired',
  },
};

export const AUTH_STATUS_LABELS: Record<string, string> = {
  VALIDATED: 'Verified',
  MATCHED: 'Matched',
  NOT_MATCHED: 'Mismatch',
  PENDING: 'Pending',
  NOT_STARTED: 'Not started',
  UNAVAILABLE: 'Unavailable',
  FAILED: 'Failed',
  EXPIRED: 'Expired',
  INVALID: 'Invalid',
};

export const POLICY_DECISION_LABELS: Record<string, string> = {
  REQUIRE_MARKETPLACE_REVIEW: 'Needs operator review',
  ALLOW_NO_CHANGE: 'No change required',
  HOLD: 'Payout hold enforced',
  REQUIRE_OLD_ACCOUNT_AUTH: 'Prior account auth required',
  APPROVE_COOLING_OFF: 'Approved for cooling-off',
  ACTIVATE: 'Approved for activation',
  REJECT: 'Change rejected',
  EXPIRED: 'Request expired',
  PENDING_REVIEW: 'Waiting for the operator',
  REJECTED: 'Change rejected',
  ACTIVE_NEW_DESTINATION: 'Change complete',
};

export const REASON_CODE_LABELS: Record<string, string> = {
  ALL_AUTH_COMPLETE: 'All authentication completed',
  MARKETPLACE_REVIEW_REQUIRED: 'Marketplace review required',
  OPERATOR_APPROVED: 'Operator approved',
  COOLING_OFF_STARTED: 'Cooling-off started',
  OLD_ACCOUNT_AUTH_UNAVAILABLE: 'Prior account inaccessible',
  MARKETPLACE_EVIDENCE_REQUIRED: 'Marketplace recovery evidence required',
  THIRD_PARTY_PAYEE_SUSPECTED: 'Third-party recipient requested',
  SUSPECTED_TAKEOVER: 'Account compromise risk signal',
  POLICY_REVIEW_REQUIRED: 'Policy evaluation required',
  NEW_ACCOUNT_AUTH_REQUIRED: 'New account not verified yet',
  OLD_ACCOUNT_AUTH_REQUIRED: 'Current account not verified yet',
  OPERATOR_REVIEW_REQUIRED: 'Waiting for the operator',
  WAIT_FOR_COOLING_OFF: 'Safety wait running',
  COOLING_OFF_ELAPSED: 'Safety wait finished',
  APPROVAL_STALE: 'Approval is out of date',
  ACTIVE_DESTINATION_CHANGED: 'The paid account changed',
  REQUEST_DEADLINE_ELAPSED: 'Request ran out of time',
  CHANGE_CLOSED: 'Request is closed',
  CHANGE_COMPLETE: 'Change is complete',
  SAME_DESTINATION: 'Same account as today',
  COOLING_PERIOD_INCREASED: 'Safety wait got longer',
  COOLING_CONFIGURATION_MISSING: 'Safety wait is not set',
  SIMULATION_NOT_AUTHORIZATION: 'Simulated data cannot authorize',
};

export const REVIEW_STATUS_LABELS: Record<string, string> = {
  NOT_REQUIRED_YET: 'Not yet',
  PENDING: 'Waiting for the operator',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
};

export const COOLING_STATUS_LABELS: Record<string, string> = {
  NOT_STARTED: 'Not started',
  ACTIVE: 'Running',
  ELAPSED: 'Finished',
};

export const VERIFIED_BY_LABELS: Record<string, string> = {
  PAYPAL_CALLBACK: 'PayPal login',
  DEMO_SIMULATION: 'simulated login',
};

export const EVENT_LABELS: Record<string, string> = {
  DESTINATION_CHANGE_REQUESTED: 'Seller asked for the change',
  AI_ASSESSMENT_RECORDED: 'AI assessment saved',
  NEW_ACCOUNT_AUTH_STARTED: 'New account login started',
  NEW_ACCOUNT_AUTH_VALIDATED: 'New account verified',
  OLD_ACCOUNT_AUTH_STARTED: 'Current account login started',
  OLD_ACCOUNT_AUTH_MATCHED: 'Current account verified',
  OLD_ACCOUNT_AUTH_NOT_MATCHED: 'A different account logged in',
  RECOVERY_REQUESTED: 'Seller asked for a recovery review',
  MARKETPLACE_EVIDENCE_RECORDED: 'Evidence recorded',
  DESTINATION_CHANGE_APPROVE: 'Operator approved',
  DESTINATION_CHANGE_REJECT: 'Operator rejected',
  DESTINATION_CHANGE_ACTIVE_NEW_DESTINATION: 'New account is now paid',
  DESTINATION_CHANGE_PENDING_REVIEW: 'Sent back for review',
  DESTINATION_CHANGE_EXPIRED: 'Request expired',
  SELLER_MESSAGE_ADDED: 'Seller sent a message',
  MARKETPLACE_RISK_UPDATED: 'Marketplace updated the risk flag',
  PAYOUT_INTENT_RECORDED: 'Payout prepared',
  PAYOUT_DISPATCH_RECORDED: 'Payout sent to PayPal',
  PAYOUT_RECONCILED: 'Payout checked with PayPal',
  PAYOUT_RECONCILE_FAILED: 'Payout check failed',
};

/** SOME_CODE to "Some code". Last resort for a code nobody wrote a label for. */
export function plainCode(code: string): string {
  const words = String(code).toLowerCase().replace(/_/g, ' ').trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export function humanizeReviewStatus(status: string): string {
  return REVIEW_STATUS_LABELS[status] ?? plainCode(status);
}

export function humanizeCooling(status: string): string {
  return COOLING_STATUS_LABELS[status] ?? plainCode(status);
}

export function humanizeVerifiedBy(by: string): string {
  return VERIFIED_BY_LABELS[by] ?? plainCode(by);
}

export const REVIEWER_FINDING_LABELS: Record<string, string> = {
  OLD_ACCOUNT_MISMATCH: 'A different PayPal account logged in as the seller\'s current account.',
};

export function humanizeFinding(code: string): string {
  return REVIEWER_FINDING_LABELS[code] ?? plainCode(code);
}

export function humanizeEvent(event: string): string {
  return EVENT_LABELS[event] ?? plainCode(event);
}

export const AI_RECOMMENDATION_LABELS: Record<string, string> = {
  CONTINUE_REQUIRED_VERIFICATION: 'Continue verification',
  ASK_FOLLOW_UP: 'Ask follow-up questions',
  ESCALATE_FOR_REVIEW: 'Escalate to human reviewer',
};

export function humanizeState(state: string): string {
  return STATE_LABELS[state]?.label ?? plainCode(state);
}

export function humanizeAuthStatus(status: string): string {
  return AUTH_STATUS_LABELS[status] ?? plainCode(status);
}

export function humanizePolicyDecision(decision: string): string {
  return POLICY_DECISION_LABELS[decision] ?? plainCode(decision);
}

export function humanizeReasonCode(code: string): string {
  return REASON_CODE_LABELS[code] ?? plainCode(code);
}

export function humanizeAiRecommendation(rec: string): string {
  return AI_RECOMMENDATION_LABELS[rec] ?? rec;
}

/** Policy reason codes that mean risk (the individual flags, not the generic "blocks approval" summary code). */
export function isRiskFlagCode(code: string): boolean {
  return /^(NEW_DEVICE_RECENT|PASSWORD_RESET_RECENT|COUNTRY_CHANGE_RECENT|DESTINATION_CHANGE_RECENT|PAYPAL_ACCOUNT_YOUNG|PAYPAL_NAME_MISMATCH|PAYPAL_COUNTRY_MISMATCH|POSSIBLE_COMPROMISE)$/.test(code);
}
