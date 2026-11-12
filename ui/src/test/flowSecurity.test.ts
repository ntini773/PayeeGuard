import { describe, it, expect } from 'vitest';
import { CANONICAL_NODES, CANONICAL_EDGES } from '../components/flow/flowData';

describe('Data Flow Graph Security Boundaries (AGENTS.md & BRIEF.md)', () => {
  const AI_NODE_ID = 'node_ai_investigator';
  const FORBIDDEN_TARGET_IDS = [
    'node_policy_eval',
    'node_activate_dest',
    'node_cooling_off',
    'node_payout_gate',
    'node_create_case_hold',
  ];

  it('AI node exists and is tagged as advisory only', () => {
    const aiNode = CANONICAL_NODES.find((n) => n.id === AI_NODE_ID);
    expect(aiNode).toBeDefined();
    expect(aiNode?.type).toBe('advisory');
    expect(aiNode?.sublabel).toContain('No write path');
  });

  it('AI node has NO edge to policy, activation, cooling-off, or payout gate', () => {
    // Collect all outgoing edges from the AI node
    const outgoingFromAi = CANONICAL_EDGES.filter((edge) => edge.source === AI_NODE_ID);

    for (const edge of outgoingFromAi) {
      expect(FORBIDDEN_TARGET_IDS).not.toContain(edge.target);
    }

    // Explicitly assert that no edge targets payout gate or activation directly from AI
    const edgeToPayout = outgoingFromAi.find((e) => e.target === 'node_payout_gate');
    const edgeToActivation = outgoingFromAi.find((e) => e.target === 'node_activate_dest');
    const edgeToPolicy = outgoingFromAi.find((e) => e.target === 'node_policy_eval');

    expect(edgeToPayout).toBeUndefined();
    expect(edgeToActivation).toBeUndefined();
    expect(edgeToPolicy).toBeUndefined();
  });

  it('AI node only produces advisory output for operator review', () => {
    const outgoingFromAi = CANONICAL_EDGES.filter((edge) => edge.source === AI_NODE_ID);
    expect(outgoingFromAi.length).toBe(1);
    expect(outgoingFromAi[0].target).toBe('node_operator_review');
    expect(outgoingFromAi[0].isAdvisory).toBe(true);
    expect(outgoingFromAi[0].isDashed).toBe(true);
  });
});
