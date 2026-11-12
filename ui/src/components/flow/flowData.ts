import type { DestinationChangeCase } from '../../types/case';

export type NodeType = 'untrusted' | 'trusted' | 'human' | 'advisory' | 'external';
export type NodeState = 'done' | 'active' | 'pending' | 'blocked';

export interface FlowNodeMeta {
  id: string;
  label: string;
  sublabel: string;
  type: NodeType;
  governingRule: string;
  description: string;
  x: number;
  y: number;
}

export interface FlowEdgeMeta {
  id: string;
  source: string;
  target: string;
  label?: string;
  isDashed?: boolean;
  isAdvisory?: boolean;
}

/**
 * All 10 canonical nodes + 1 side advisory node.
 * Hand-placed coordinates optimized for wide desktop and horizontal sequence.
 */
export const CANONICAL_NODES: FlowNodeMeta[] = [
  {
    id: 'node_seller_session',
    label: '1. Seller Sign-in',
    sublabel: 'Untrusted session',
    type: 'untrusted',
    governingRule: 'POLICY.md § 1 (Core Invariant)',
    description: 'Seller signs in to marketplace. A marketplace login proves session ownership, not destination authorization.',
    x: 40,
    y: 40,
  },
  {
    id: 'node_request_change',
    label: '2. Request Change',
    sublabel: 'Seller free text',
    type: 'untrusted',
    governingRule: 'API_CONTRACT.md § 3 (POST /destination-change-requests)',
    description: 'Seller declares intent to update payout account. Reason is treated as an untrusted hint.',
    x: 280,
    y: 40,
  },
  {
    id: 'node_create_case_hold',
    label: '3. Create Case & Hold',
    sublabel: 'Payout hold enforced',
    type: 'trusted',
    governingRule: 'STATE_MACHINE.md § 1 (CHANGE_REQUESTED)',
    description: 'Backend persists change case and immediately enforces a payout hold on proposed destination B.',
    x: 520,
    y: 40,
  },
  {
    id: 'node_new_auth',
    label: '4. Proposed Login (B)',
    sublabel: 'Direct PayPal callback',
    type: 'external',
    governingRule: 'AGENTS.md Rule 2 & 3 (Direct Callback)',
    description: 'Direct PayPal OAuth callback returns payer ID B to backend. Bypasses AI completely.',
    x: 760,
    y: 40,
  },
  {
    id: 'node_old_auth',
    label: '5. Prior Login (A)',
    sublabel: 'Must match stored A',
    type: 'external',
    governingRule: 'AGENTS.md Rule 5 & POLICY.md T3',
    description: 'Prior account re-authentication callback must exactly equal stored Account A in marketplace records.',
    x: 1000,
    y: 40,
  },
  {
    id: 'node_policy_eval',
    label: '6. Deterministic Policy',
    sublabel: 'Side-effect free rules',
    type: 'trusted',
    governingRule: 'POLICY.md § 3 (Decision Table)',
    description: 'Deterministic rules check required evidence, tenant scope, and risk signals. Generates outcome code.',
    x: 40,
    y: 230,
  },
  {
    id: 'node_operator_review',
    label: '7. Operator Review',
    sublabel: 'Authorized human review',
    type: 'human',
    governingRule: 'API_CONTRACT.md § 3 & STATE_MACHINE.md § 2',
    description: 'Marketplace operator verifies recovery evidence, records rationale, and supplies current case version.',
    x: 280,
    y: 230,
  },
  {
    id: 'node_cooling_off',
    label: '8. Cooling-Off Window',
    sublabel: 'Server-side clock delay',
    type: 'trusted',
    governingRule: 'STATE_MACHINE.md § 4 Invariant 7',
    description: 'Mandatory waiting period evaluated against server-side policy. Browser clocks cannot shorten cooling-off.',
    x: 520,
    y: 230,
  },
  {
    id: 'node_activate_dest',
    label: '9. Activate Destination',
    sublabel: 'Atomic backend write',
    type: 'trusted',
    governingRule: 'STATE_MACHINE.md § 4 Invariant 8',
    description: 'Backend atomically updates active payout payee record from stored A to approved B.',
    x: 760,
    y: 230,
  },
  {
    id: 'node_payout_gate',
    label: '10. Payout Gate & Send',
    sublabel: 'Reads stored active only',
    type: 'trusted',
    governingRule: 'POLICY.md § 7 & AGENTS.md Rule 7',
    description: 'Payout gate loads stored active destination from backend storage and executes payout via PayPal Payouts.',
    x: 1000,
    y: 230,
  },
  // Side node: AI Investigator
  {
    id: 'node_ai_investigator',
    label: 'AI Investigator',
    sublabel: 'Advisory only (No write path)',
    type: 'advisory',
    governingRule: 'AGENTS.md Rule 1 (AI never authorizes or executes)',
    description: 'Interprets untrusted seller text, extracts claims, and suggests follow-up questions for the operator. Has NO write path to policy or money movement.',
    x: 520,
    y: 420,
  },
];

/**
 * Canonical flow edges.
 * CRITICAL SECURITY INVARIANT:
 * Node 'node_ai_investigator' has only an incoming read-only edge from 'node_create_case_hold'
 * and an outgoing advisory edge to 'node_operator_review'.
 * It has NO EDGE to 'node_policy_eval', 'node_activate_dest', 'node_cooling_off', or 'node_payout_gate'.
 */
export const CANONICAL_EDGES: FlowEdgeMeta[] = [
  { id: 'e1-2', source: 'node_seller_session', target: 'node_request_change' },
  { id: 'e2-3', source: 'node_request_change', target: 'node_create_case_hold' },
  { id: 'e3-4', source: 'node_create_case_hold', target: 'node_new_auth' },
  { id: 'e4-5', source: 'node_new_auth', target: 'node_old_auth' },
  { id: 'e5-6', source: 'node_old_auth', target: 'node_policy_eval' },
  { id: 'e6-7', source: 'node_policy_eval', target: 'node_operator_review' },
  { id: 'e7-8', source: 'node_operator_review', target: 'node_cooling_off' },
  { id: 'e8-9', source: 'node_cooling_off', target: 'node_activate_dest' },
  { id: 'e9-10', source: 'node_activate_dest', target: 'node_payout_gate' },

  // Read-only advisory edges for AI node:
  {
    id: 'e-read-case-data',
    source: 'node_create_case_hold',
    target: 'node_ai_investigator',
    isDashed: true,
    isAdvisory: true,
  },
  {
    id: 'e-advisory-summary',
    source: 'node_ai_investigator',
    target: 'node_operator_review',
    label: 'Advisory notes only',
    isDashed: true,
    isAdvisory: true,
  },
];

/**
 * Determine the status of each node given a specific case state.
 */
export function computeNodeStates(caseData?: DestinationChangeCase): Record<string, NodeState> {
  const result: Record<string, NodeState> = {
    node_seller_session: 'done',
    node_request_change: 'done',
    node_create_case_hold: 'done',
    node_new_auth: 'pending',
    node_old_auth: 'pending',
    node_policy_eval: 'pending',
    node_operator_review: 'pending',
    node_cooling_off: 'pending',
    node_activate_dest: 'pending',
    node_payout_gate: 'pending',
    node_ai_investigator: 'active',
  };

  if (!caseData) return result;

  // The AI node reflects what the backend really stored. It is advisory and never gates a step.
  const ai = caseData.ai_assessment;
  result.node_ai_investigator = !ai ? 'pending' : ai.status === 'UNAVAILABLE' ? 'blocked' : ai.stale ? 'active' : 'done';

  // New account auth
  if (caseData.authentication.new_account.status === 'VALIDATED') {
    result.node_new_auth = 'done';
  } else if (caseData.state === 'PENDING_NEW_ACCOUNT_AUTH') {
    result.node_new_auth = 'active';
  }

  // Old account auth
  if (caseData.authentication.old_account.status === 'MATCHED') {
    result.node_old_auth = 'done';
  } else if (caseData.state === 'PENDING_OLD_ACCOUNT_AUTH') {
    result.node_old_auth = 'active';
  } else if (caseData.authentication.old_account.status === 'UNAVAILABLE' || caseData.authentication.old_account.status === 'FAILED') {
    result.node_old_auth = 'blocked';
  }

  // Policy & Review
  if (caseData.state === 'PENDING_REVIEW') {
    result.node_policy_eval = 'done';
    result.node_operator_review = 'active';
  } else if (caseData.state === 'APPROVED_COOLING_OFF') {
    result.node_policy_eval = 'done';
    result.node_operator_review = 'done';
    result.node_cooling_off = 'active';
  } else if (caseData.state === 'ACTIVE_NEW_DESTINATION') {
    result.node_policy_eval = 'done';
    result.node_operator_review = 'done';
    result.node_cooling_off = 'done';
    result.node_activate_dest = 'done';
    result.node_payout_gate = 'done';
  } else if (caseData.state === 'REJECTED' || caseData.state === 'EXPIRED') {
    result.node_policy_eval = 'done';
    result.node_operator_review = 'blocked';
    result.node_cooling_off = 'blocked';
    result.node_activate_dest = 'blocked';
    result.node_payout_gate = 'blocked';
  }

  return result;
}
